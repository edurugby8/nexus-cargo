/**
 * La escena.
 *
 * Un solo lienzo WebGL detrás de todo el documento, un solo bucle y una sola
 * fuente de verdad: el progreso del desplazamiento. Este archivo no decide
 * NADA de la historia —eso está en `ruta.js`—; se limita a construir el mundo
 * y a pintar, en cada fotograma, lo que el guion dice que toca.
 *
 * La organización viene de `three-d-stage.js` (starter-components, CC0): la
 * escena posee el renderizador, las luces, la cámara y el redimensionado, y
 * los objetos se montan sobre ella. De `animations-v3.jsx`, la regla de que
 * nada se mueve en crudo: la cámara sigue una curva calculada y luego se
 * AMORTIGUA, que es lo que hace que el recorrido se sienta conducido.
 */

import * as THREE from 'three';
import { clamp, damp, lerp, medirEquipo } from '../lib/util.js';
import { AJUSTES } from '../ajustes.js';
import {
  poseEn, mundoEn, MEDIDAS, TRAMOS, ALTURAS, capituloEn, inicioDe,
} from './ruta.js';
import { fijarResolucion } from './texturas.js';
import { fijarResolucionMateriales, liberarMateriales } from './materiales.js';
import { crearMar, crearCielo } from './mar.js';
import { crearContenedor } from './contenedor.js';
import { crearBarco } from './barco.js';
import { crearGrua } from './grua.js';
import { crearCamion } from './camion.js';
import { crearPuerto, crearAduanas, crearCarretera, crearCentro, crearDestino } from './tierra.js';
import { crearAmbiental } from './ambiental.js';

export function montarEscena({ contenedor, caps, reducido, alProgreso, alPintar }) {
  fijarResolucion(caps.textura);
  fijarResolucionMateriales(caps.textura);

  const renderer = new THREE.WebGLRenderer({ antialias: caps.antialias, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, caps.dpr));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  if (caps.sombras) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  contenedor.appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  const niebla = new THREE.FogExp2(0xb9b0a2, 0.0012);
  escena.fog = niebla;

  const camara = new THREE.PerspectiveCamera(46, 1, 0.5, caps.lejos);
  escena.add(camara);

  /* ── Luces ────────────────────────────────────────────────────────
     Tres, y cada una con su trabajo. El sol proyecta sombra y es el único que
     lo hace: dos fuentes con sombra en una escena exterior se contradicen y se
     nota enseguida. El hemisférico impide que las caras en sombra sean negro
     plano. El relleno frío viene del lado opuesto y recorta las siluetas. */
  const sol = new THREE.DirectionalLight(0xffe0b0, 1.6);
  sol.position.set(-160, 120, 180);
  /* El objetivo de la luz va SIEMPRE en la escena y SIEMPRE se mueve con la
     cámara. Estaba condicionado a que hubiera sombras, y sin ellas se quedaba
     en el origen del mundo: con la cámara a mil seiscientos metros de allí, la
     luz llegaba rasante y el buque salía como una plancha negra. Un
     `DirectionalLight` no ilumina desde su posición, ilumina en la DIRECCIÓN
     que va de su posición a su objetivo; olvidar el segundo es olvidar la
     mitad. */
  escena.add(sol.target);
  if (caps.sombras) {
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    const c = sol.shadow.camera;
    c.left = -90; c.right = 90; c.top = 90; c.bottom = -90;
    c.near = 1; c.far = 520;
    c.updateProjectionMatrix();
    sol.shadow.bias = -0.0009;
    sol.shadow.normalBias = 0.6;
  }
  escena.add(sol);

  /* El hemisférico va alto a propósito. Sobre el mar, y más al amanecer, la
     luz rebotada del cielo y del agua es enorme: la cara en sombra de un casco
     nunca es negra. Con el valor bajo, el buque salía como una plancha negra
     recortada y perdía toda la forma que tiene el casco. */
  const cielo = new THREE.HemisphereLight(0x9ab6d0, 0x46505c, 1.5);
  escena.add(cielo);

  const relleno = new THREE.DirectionalLight(0xbcd2e8, 0.35);
  relleno.position.set(140, 60, -120);
  escena.add(relleno);
  escena.add(relleno.target);

  /* ── El mundo ─────────────────────────────────────────────────── */
  const mar = crearMar({ caps });
  // El domo, con holgura respecto al plano lejano de la cámara
  const domoCielo = crearCielo(caps.lejos * 0.82);
  mar.userData.envolvente = true;
  domoCielo.userData.envolvente = true;
  mar.traverse((o) => { o.userData.envolvente = true; });
  domoCielo.traverse((o) => { o.userData.envolvente = true; });
  escena.add(mar, domoCielo);

  const barco = crearBarco({ caps });
  escena.add(barco);

  const gruas = [];
  for (const x of [-190, -105, MEDIDAS.gruaX, 120, 215]) {
    const g = crearGrua({ x, activa: x === MEDIDAS.gruaX, caps });
    gruas.push(g);
    escena.add(g);
  }

  const puerto = crearPuerto({ caps });
  const aduanas = crearAduanas();
  const carretera = crearCarretera({ caps });
  const centro = crearCentro({ caps });
  const destino = crearDestino();
  escena.add(puerto, aduanas, carretera, centro, destino);

  const camion = crearCamion({ caps });
  escena.add(camion);

  // El contenedor protagonista: el único con código legible y puertas
  const heroe = crearContenedor({ protagonista: true, detalle: true });
  escena.add(heroe);

  const ambiental = crearAmbiental({ caps });
  escena.add(ambiental);

  /* ── Regiones ─────────────────────────────────────────────────────
     Un mundo de kilómetro y medio no se paga entero en cada fotograma. Cada
     región declara en qué tramo del recorrido puede verse, con holgura por los
     dos lados para que nada aparezca de golpe delante del objetivo. */
  /* El corte del puerto va justo ANTES de que empiece la carretera, no en el
     límite ni después.

     Parece una minucia y no lo es. El puerto se apagaba con `<= hasta` y
     `hasta` valía exactamente el comienzo de «En ruta», así que en el primer
     instante del capítulo la explanada seguía encendida; y la zona de aduanas
     se apagaba CINCO CENTÉSIMAS más tarde, ya bien entrada la carretera. Con
     la cámara a ras eso no se veía; con la cámara aérea, que mira lejos, sí:
     medido, la explanada asomaba a 351 m y el arco de aduanas a 93 m con el
     camión ya en ruta. El capítulo que trata de haber dejado el puerto atrás
     estaba enseñando el puerto.

     La centésima de margen es lo que hace el corte exclusivo. Y no deja un
     hueco: el terreno de la carretera arranca en z −106, seis metros antes de
     la barrera, así que cuando el puerto se apaga ya hay suelo debajo. */
  const finPuerto = inicioDe('carretera') - 0.001;
  const regiones = [
    { obj: barco, desde: -1, hasta: inicioDe('aduanas') + 0.1 },
    { obj: mar, desde: -1, hasta: finPuerto },
    { obj: puerto, desde: -1, hasta: finPuerto },
    { obj: aduanas, desde: inicioDe('grua') - 0.06, hasta: finPuerto },
    { obj: carretera, desde: inicioDe('aduanas') - 0.04, hasta: 1.1 },
    { obj: centro, desde: inicioDe('carretera') - 0.02, hasta: 1.1 },
    { obj: destino, desde: inicioDe('centro') - 0.02, hasta: 1.1 },
  ];
  for (const g of gruas) {
    // Las grúas miden 82 m: se ven desde mucho más lejos que el resto
    regiones.push({ obj: g, desde: -1, hasta: inicioDe('salida') + 0.04 });
  }

  /* ── ESTORBOS PARA LA CÁMARA ──────────────────────────────────────
     Elegir bien los planos no basta, y el capítulo de la descarga lo demuestra
     mejor que ninguno: la carga cuelga DEBAJO de la viga del pórtico, así que
     mirarla desde arriba obliga a atravesar la viga. No es un plano mal
     elegido; es que desde ese ángulo no existe un plano bueno.

     Así que la cámara esquiva. Se registra una lista CORTA de los estorbos que
     de verdad tapan —las cinco grúas, el edificio de terminal, la nave del
     centro y la del destino— y cada pocos fotogramas se tira un rayo de la
     cámara al sujeto. Si choca, la cámara SUBE por encima del estorbo,
     suavemente, y vuelve a bajar cuando el camino queda libre.

     Corta a propósito: un rayo contra cincuenta mallas cuesta nada; contra las
     tres mil del patio, costaría el fotograma. Y son las grandes las que tapan;
     un bolardo no tapa un camión. */
  const obstaculos = [];
  const registrarEstorbo = (raiz) => {
    raiz?.traverse((o) => {
      if (!o.isMesh || o.userData.envolvente) return;
      /* El APAREJO no es un estorbo: es lo que sujeta la carga. El spreader va
         cuarenta y seis centímetros por encima de la tapa del contenedor y los
         cables salen de sus esquinas, así que cualquier rayo hacia la carga
         roza el aparejo por definición. Contarlo hacía que la cámara se
         apartase de su propio sujeto durante todo el capítulo de la descarga. */
      if (o.userData.aparejo) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      // Sólo lo grande: por debajo de tres metros de radio no tapa nada
      if (o.geometry.boundingSphere.radius < 3) return;
      obstaculos.push(o);
    });
  };
  for (const g of gruas) registrarEstorbo(g);
  registrarEstorbo(aduanas);
  registrarEstorbo(centro);
  registrarEstorbo(destino);

  /* ── Estado del bucle ─────────────────────────────────────────── */
  const st = {
    progreso: 0, objetivo: 0,
    punteroX: 0, punteroY: 0, suaveX: 0, suaveY: 0,
    entrada: reducido ? 1 : 0,
  };
  const pose = { pos: [0, 0, 0], mira: [0, 0, 0], fov: 46 };
  const posSuave = new THREE.Vector3(0, 60, 400);
  const miraSuave = new THREE.Vector3(0, 20, 0);
  const objetivoPos = new THREE.Vector3();
  const objetivoMira = new THREE.Vector3();
  const dirSol = new THREE.Vector3();
  const puntoLocal = new THREE.Vector3();
  const giroRemolque = new THREE.Quaternion();
  const rayoCamara = new THREE.Raycaster();
  const dirRayo = new THREE.Vector3();
  const desvio = new THREE.Vector3();
  const tiro = new THREE.Vector3();
  const tanteo = new THREE.Vector3();
  /** Grados que la cámara ha tenido que desviarse para librar un estorbo. */
  let desvioEstorbo = 0;
  let desvioObjetivo = 0;
  let contadorRayo = 0;

  let reloj = 0;
  let movimiento = reducido ? 0 : 1;
  let visible = 1;
  let corriendo = true;
  let raf = 0;
  let anterior = performance.now();
  let primerFotograma = true;
  let fotogramas = 0;
  let capituloActual = -1;
  let inicioEntrada = 0;
  /* Progreso impuesto desde fuera. Sólo lo usan las pruebas de encuadre, que
     necesitan situar la escena en un punto exacto y sin amortiguación para
     medir lo que el guion pide, no lo que la inercia ha dejado a medias. */
  let forzado = null;

  /* Freno automático.
     Adivinar la potencia por núcleos y memoria se equivoca a menudo: un
     teléfono nuevo con la batería baja, un portátil con gráfica integrada.
     Esto no adivina, MIDE. Y sólo baja, nunca sube: un sistema que sube y baja
     se nota mucho más que ir un escalón por debajo. */
  let medioFotograma = 16;
  let lento = 0;
  let escalon = 0;
  const FRENOS = [1, 0.6, 0.32];

  /** Altura total del documento, en alturas de ventana. */
  const alturaDocumento = () => (ALTURAS + 1) * window.innerHeight;

  /* ── El progreso, medido sobre el DOCUMENTO REAL ──────────────────
     Aquí estaba el fallo que arrastraba a casi todos los demás.

     La versión anterior hacía `scrollY / (scrollHeight - innerHeight)`: el
     progreso era la fracción del documento ENTERO. Pero el documento no son
     sólo los ocho capítulos. Después del último vienen los servicios, el
     formulario y el pie, y eso ocupa el 9,5 % de la página en escritorio y el
     15,2 % en un móvil —medido—. Así que los ocho capítulos, que el guion
     reparte entre 0 y 1, en realidad sólo llegaban a 0,955 en escritorio y a
     0,892 en móvil. Resultado: leyendo el capítulo de entrega la escena iba
     todavía por el centro logístico, y el rótulo de navegación marcaba el
     capítulo anterior al que se estaba leyendo. Un capítulo entero de desfase,
     y peor en móvil, porque allí la cola crece —el texto envuelve— mientras
     los capítulos miden lo mismo.

     Ahora el progreso se deriva de la GEOMETRÍA MEDIDA de las secciones. Cada
     capítulo declara su tramo en el guion y ocupa su altura en el documento;
     se mapea la una sobre la otra. Con eso, el capítulo que se está leyendo y
     el que está pintando la escena son el mismo POR CONSTRUCCIÓN, en cualquier
     pantalla y con cualquier cantidad de texto detrás. */
  let mapa = [];

  function medirTramos() {
    const vh = window.innerHeight;
    const secciones = [];
    for (const t of TRAMOS) {
      const el = document.getElementById(t.id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      secciones.push({ top: r.top + window.scrollY, alto: Math.max(1, r.height), t });
    }
    if (!secciones.length) return;

    /* EL RELEVO, que es donde estaba el desfase.
       ─────────────────────────────────────────────────────────────
       La caja de texto de un capítulo está PEGADA mientras el scroll recorre
       su sección menos una altura de ventana. En esa última altura la caja se
       va hacia arriba y la del capítulo siguiente entra por abajo, y a mitad
       de camino la que ocupa la pantalla ya es la SIGUIENTE.

       El reparto anterior daba a cada capítulo su sección entera, así que
       durante esa última altura el rótulo, el panel y la escena seguían en el
       capítulo anterior mientras el visitante leía ya el siguiente. Medido: a
       3600 px la caja de «Descarga» ocupaba el 80 % de la pantalla y el menú
       marcaba «Llegada a puerto». Es exactamente el desfase de una escena que
       se reportó, y mi prueba anterior no lo veía porque muestreaba el centro
       de cada tramo —bien dentro de la zona pegada, donde todo coincide—.

       Ahora cada capítulo empieza MEDIA VENTANA ANTES del comienzo de su
       sección, que es el punto en el que su caja pasa a dominar la pantalla.
       El primero es la excepción y arranca en cero: si no, la portada
       empezaría con el recorrido ya avanzado un 23 %. */
    const mitad = vh / 2;
    const nuevo = [];
    for (let i = 0; i < secciones.length; i++) {
      const s = secciones[i];
      const sig = secciones[i + 1];
      const inicio = i === 0 ? 0 : s.top - mitad;
      const fin = sig ? sig.top - mitad : s.top + s.alto - mitad;
      nuevo.push({ inicio, largo: Math.max(1, fin - inicio), desde: s.t.desde, hasta: s.t.hasta });
    }
    mapa = nuevo;
  }

  function progresoDeScroll() {
    if (!mapa.length) {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      return clamp(window.scrollY / max);
    }
    const y = window.scrollY;
    if (y <= mapa[0].inicio) return 0;
    for (const t of mapa) {
      if (y < t.inicio + t.largo) return lerp(t.desde, t.hasta, clamp((y - t.inicio) / t.largo));
    }
    /* Pasado el último capítulo el viaje está hecho: la escena se queda en su
       plano final mientras se leen los servicios y el formulario. */
    return 1;
  }

  /* ── Encuadre según la pantalla ───────────────────────────────────
     `fov` en three.js es el ángulo VERTICAL. Un plano compuesto en un portátil
     —relación 1,6— con 46° verticales abarca 68° horizontales. El mismo plano
     en un móvil en vertical —relación 0,46— abarca 22°: el encuadre se cierra
     sobre un detalle y el camión, el buque o el almacén se salen por los
     lados. Por eso en móvil casi no se veía lo que el plano pretendía enseñar.

     Se corrige por los dos lados a la vez:
     · se ensancha el ángulo vertical para recuperar parte del horizontal, con
       tope, porque pasado cierto punto la perspectiva se deforma;
     · y lo que el ángulo no alcanza se compensa RETROCEDIENDO por el eje de la
       mirada, que conserva la composición sin deformarla.
     Las dos cosas juntas dan un encuadre equivalente en cualquier pantalla sin
     tener que escribir dos guiones. */
  const GRADO = Math.PI / 180;
  const ASPECTO_REF = 1.6;
  /** Por debajo de esto la cámara estaría dentro del firme. */
  const ALTURA_MINIMA = 0.9;

  /* ── Geometría del esquive ────────────────────────────────────────
     Dos piezas sueltas porque se usan dos veces: una para TANTEAR ángulos y
     otra para aplicar el que se haya elegido. */

  /**
   * Sitúa `tanteo` en la cámara girada `grados` de elevación alrededor del
   * punto de mira. Girar alrededor de la mira conserva el encuadre: el sujeto
   * no se mueve del cuadro, sólo cambia desde dónde se le ve. Devuelve `false`
   * si el giro metería la cámara bajo tierra, que no es una opción.
   */
  const girarElevacion = (grados) => {
    desvio.subVectors(objetivoPos, objetivoMira);
    const largo = desvio.length();
    const horiz = Math.hypot(desvio.x, desvio.z);
    if (horiz < 1e-4 || largo < 1e-4) return false;
    const elev = clamp(Math.atan2(desvio.y, horiz) + grados * GRADO, -1.3, 1.3);
    const nuevoHoriz = Math.cos(elev) * largo;
    tanteo.set(
      objetivoMira.x + (desvio.x / horiz) * nuevoHoriz,
      objetivoMira.y + Math.sin(elev) * largo,
      objetivoMira.z + (desvio.z / horiz) * nuevoHoriz,
    );
    return tanteo.y >= ALTURA_MINIMA;
  };

  /**
   * Cuántos de tres rayos hacia el sujeto chocan con un estorbo.
   *
   * TRES, no uno. Con un solo rayo al centro, media grúa delante pasaba
   * desapercibida si justo dejaba pasar ese rayo. Los otros dos van abiertos a
   * los costados, a la anchura de un contenedor, así que basta con que asome
   * un montante para que la cámara reaccione.
   */
  const rayosBloqueados = (desde) => {
    tiro.subVectors(objetivoMira, desde);
    const hasta = tiro.length();
    const h = Math.hypot(tiro.x, tiro.z) || 1;
    // Marco horizontal alrededor de la mirada: hacia dónde y hacia los lados
    const fx = tiro.x / h; const fz = tiro.z / h;
    let n = 0;
    for (const [lado, frente, baja] of HUELLA) {
      dirRayo.copy(tiro);
      dirRayo.x += -fz * lado + fx * frente;
      dirRayo.z += fx * lado + fz * frente;
      dirRayo.y -= baja;
      dirRayo.divideScalar(Math.max(1e-6, dirRayo.length()));
      rayoCamara.set(desde, dirRayo);
      rayoCamara.far = Math.max(1, hasta - 3);
      if (rayoCamara.intersectObjects(obstaculos, false).length) n++;
    }
    return n;
  };

  /* Los ángulos que se tantean, ordenados por lo poco que mueven la cámara: el
     primero que despeja, gana. Bajar va antes que subir a igualdad de grados
     porque el estorbo típico de esta historia —la viga del pórtico, el arco
     del escáner— está ARRIBA.

     Y el tope es TRECE GRADOS, no veintiocho. Con veintiocho disponibles, a la
     salida de aduanas el esquive encontraba que subiendo del todo se veía por
     encima del arco, y se iba a ciento sesenta y un metros de altura: el rayo
     quedaba limpio y el plano, destrozado. Un esquive es un ajuste, no un
     cambio de plano; si hacen falta más de trece grados, el problema es el
     guion y se arregla escribiendo el plano, no empujando la cámara. */
  const DESVIOS = [0, -6, 7, -13, 14];

  /* A dónde se tira cada rayo, alrededor del punto de mira: [lado, frente,
     baja] en metros. No basta con apuntar al centro del sujeto —un camión mide
     dieciséis metros y medio y lo que se le tapa es la COLA, no el centro—, así
     que se cubre su huella: los costados, el morro, la cola y por debajo. Ésa
     es la diferencia entre «el punto de mira está despejado» y «se ve el
     camión». */
  const HUELLA = [
    [0, 0, 0], [-7, 0, 0], [7, 0, 0], [0, 8, 1.2], [0, -8, 1.2],
  ];

  function encuadre(fovBase, aspecto) {
    const horizontalRef = 2 * Math.atan(Math.tan((fovBase * GRADO) / 2) * ASPECTO_REF);
    const verticalIdeal = 2 * Math.atan(Math.tan(horizontalRef / 2) / Math.max(0.2, aspecto));
    const fov = Math.min(Math.max(fovBase, verticalIdeal / GRADO), AJUSTES.fovMaximo);
    // Lo que el ángulo no ha podido recuperar, se recupera con distancia
    const cubierto = 2 * Math.atan(Math.tan((fov * GRADO) / 2) * aspecto);
    const retroceso = Math.tan(horizontalRef / 2) / Math.max(1e-4, Math.tan(cubierto / 2));
    return { fov, retroceso: Math.min(Math.max(retroceso, 1), AJUSTES.retrocesoMaximo) };
  }

  function redimensionar() {
    const w = contenedor.clientWidth || window.innerWidth;
    const h = contenedor.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, caps.dpr * FRENOS[escalon]));
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
    medirTramos();
  }
  redimensionar();
  window.addEventListener('resize', redimensionar);

  /* El bucle está partido en dos a propósito.

     `fotograma()` es el que se encadena con `requestAnimationFrame`;
     `pintar()` es el trabajo. Estaban juntos, y eso tenía una consecuencia
     fea: la sonda de depuración llamaba a `fotograma()` para situar la escena
     en un punto exacto, y cada llamada ENCOLABA un rAF más. Tras doscientas
     muestras había doscientos bucles concurrentes pintando la escena entera, y
     la prueba de encuadre pasaba de tres minutos a más de veinticinco. El
     coste crecía con el cuadrado de las muestras.

     Partirlo cuesta dos líneas y deja la sonda pintando exactamente un
     fotograma, que es lo que decía que hacía. */
  function fotograma() {
    raf = requestAnimationFrame(fotograma);
    if (!corriendo) return;
    pintar();
  }

  function pintar() {

    /* Un solo reloj y el delta acotado por los DOS lados. Con un delta
       negativo —que sale de mezclar el sello de requestAnimationFrame con
       performance.now() en equipos lentos— la interpolación exponencial se
       convierte en una exponencial creciente y la escena se va de escala. */
    const ahora = performance.now();
    const transcurrido = Math.max(0, ahora - anterior);
    const dt = Math.min(transcurrido / 1000, 0.25);
    anterior = ahora;

    // Media del coste del fotograma, con el factor ligado al TIEMPO: si fuese
    // por fotogramas, justo en el caso que interesa tardaría una eternidad
    const mezcla = Math.min(1, (transcurrido / 1000) * 3);
    medioFotograma += (Math.min(transcurrido, 400) - medioFotograma) * mezcla;
    if (escalon < FRENOS.length - 1 && visible) {
      lento = medioFotograma > 34 ? lento + transcurrido / 1000 : 0;
      if (lento > 2) { escalon++; lento = 0; redimensionar(); }
    }
    const freno = FRENOS[escalon];

    reloj += dt * movimiento * visible * AJUSTES.velocidad;

    /* El progreso.
       Lo que manda es el scroll nativo; lo que se amortigua es esto, no la
       página. Secuestrar la rueda para «suavizar» rompe la barra, el teclado y
       el táctil, y la página deja de responder como el visitante espera. */
    st.objetivo = forzado === null ? progresoDeScroll() : forzado;
    st.progreso = (reducido || forzado !== null)
      ? st.objetivo
      : damp(st.progreso, st.objetivo, 7.5, dt);

    const mundo = mundoEn(st.progreso, AJUSTES);

    /* ── Cámara ─────────────────────────────────────────────────── */
    /* La curva estrecha entra por debajo de 0,95 de relación: eso cubre el
       móvil en vertical y la tableta en vertical, y deja fuera el apaisado. */
    poseEn(st.progreso, pose, camara.aspect < 0.95);
    objetivoPos.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    objetivoMira.set(pose.mira[0], pose.mira[1], pose.mira[2]);

    /* Distancia de cámara y compensación de pantalla, las dos sobre el vector
       de encuadre: alejarse no cambia hacia dónde se mira. */
    const enc = encuadre(pose.fov, camara.aspect);
    const escala = AJUSTES.distanciaCamara * enc.retroceso;
    if (escala !== 1) {
      objetivoPos.sub(objetivoMira).multiplyScalar(escala).add(objetivoMira);
    }

    /* SUELO.
       El retroceso escala el vector de encuadre entero, incluida la altura, y
       eso tiene una consecuencia que no se ve hasta que se mira: un plano bajo
       —la cámara a ochenta centímetros, junto a la rueda del camión— escalado
       por dos se va por DEBAJO del asfalto. La prueba de encuadre lo cazó
       midiendo diez centímetros de holgura contra una superficie en el
       capítulo de carretera, en móvil y en tableta.

       Ninguno de los treinta y cinco planos pretende meter la cámara bajo
       tierra, así que el suelo es un límite duro y no un ajuste. Sólo aplica
       donde hay suelo: en alta mar y en el traslado de la grúa la cámara va a
       decenas de metros de altura y esto no la toca nunca. */
    if (objetivoPos.y < ALTURA_MINIMA) objetivoPos.y = ALTURA_MINIMA;

    /* ── Esquivar estorbos ──────────────────────────────────────────
       El tanteo se hace cada cuatro fotogramas, no cada uno: los estorbos son
       estructuras fijas y la cámara se mueve despacio, así que mirar a 15 Hz
       da el mismo resultado por la cuarta parte del coste.

       Y se esquiva EN LOS DOS SENTIDOS. La primera versión sólo subía, y eso
       acierta exactamente la mitad de las veces: cuando el estorbo está por
       ENCIMA de la línea de mira —la viga del pórtico, el arco del escáner por
       el que el camión pasa— subir mete la cámara más detrás del estorbo, no
       menos, y el sistema se realimenta solo hasta un picado imposible. A la
       salida de aduanas la cámara acababa a noventa y cinco metros y a 57° de
       picado porque ella misma se había empujado hasta ahí, y desde ahí el
       arco le tapaba la cola del camión, que era justo lo que huía de tapar.

       Ahora se tantean seis ángulos, tres hacia abajo y tres hacia arriba, y
       gana el que despeja moviendo menos. Si ninguno despeja del todo, el que
       menos rayos deje bloqueados; y si todos empatan, ninguno: apartarse sin
       ganar nada sólo estropea el plano que pide el guion. */
    if (obstaculos.length && (forzado !== null || (contadorRayo++ & 3) === 0)) {
      let mejor = 0;
      let mejorBloqueo = 99;
      for (const grados of DESVIOS) {
        if (!girarElevacion(grados)) continue;
        const b = rayosBloqueados(tanteo);
        if (b < mejorBloqueo) { mejorBloqueo = b; mejor = grados; }
        if (b === 0) break;
      }
      desvioObjetivo = mejor;
    }
    /* Con el progreso impuesto desde fuera —las pruebas— el esquive se aplica
       ENTERO y de golpe. Amortiguarlo ahí mediría a dónde ha llegado la
       cámara en dieciséis milisegundos, que es prácticamente donde estaba, y
       la prueba acabaría midiendo la inercia en vez del resultado. */
    desvioEstorbo = forzado !== null
      ? desvioObjetivo
      : damp(desvioEstorbo, desvioObjetivo, 2.2, dt);

    if (Math.abs(desvioEstorbo) > 0.2 && girarElevacion(desvioEstorbo)) {
      objetivoPos.copy(tanteo);
    }

    /* ENCUADRE EN VERTICAL.
       Ensanchar el ángulo para recuperar lo que una pantalla alta recorta por
       los lados tiene un efecto secundario: el campo extra se reparte por
       igual arriba y abajo, y abajo no hay nada que ver. En el capítulo de
       carretera casi la mitad del cuadro se iba en terreno vacío mientras el
       camión quedaba pequeño en el tercio superior.

       Se corrige inclinando la cámara hacia arriba en proporción a lo que se
       haya ensanchado: el horizonte baja, entra cielo en vez de suelo y el
       sujeto queda donde tiene que quedar. Es lo que hace cualquiera con una
       cámara en la mano al girar el móvil, y no hace falta escribir treinta y
       cinco planos más para conseguirlo. */
    if (enc.fov > pose.fov + 0.5) {
      const abierto = (enc.fov - pose.fov) / Math.max(1, AJUSTES.fovMaximo - pose.fov);
      objetivoMira.y += objetivoPos.distanceTo(objetivoMira) * 0.16 * abierto;
    }

    // Entrada: la cámara llega desde más arriba y más lejos al arrancar
    if (inicioEntrada > 0) {
      st.entrada = clamp((ahora - inicioEntrada) / 2600);
      if (st.entrada >= 1) inicioEntrada = 0;
    }
    if (st.entrada < 1) {
      const e = 1 - (1 - st.entrada) ** 3;
      objetivoPos.y += (1 - e) * 260;
      objetivoPos.z += (1 - e) * 180;
    }

    const lambda = (reducido || forzado !== null) ? 1e3 : 3.4;
    posSuave.lerp(objetivoPos, 1 - Math.exp(-lambda * dt));
    miraSuave.lerp(objetivoMira, 1 - Math.exp(-lambda * 1.25 * dt));

    st.suaveX = damp(st.suaveX, st.punteroX, 2.6, dt);
    st.suaveY = damp(st.suaveY, st.punteroY, 2.6, dt);
    const m = movimiento * AJUSTES.movimiento;
    const respira = Math.sin(reloj * 0.31) * 0.5 * m;

    camara.position.copy(posSuave);
    camara.position.y += respira;
    camara.position.x += st.suaveX * 2.2 * m;
    camara.position.y += -st.suaveY * 1.1 * m;
    camara.lookAt(miraSuave);
    camara.rotateZ(Math.sin(reloj * 0.21) * 0.0035 * m - st.suaveX * 0.008 * m);
    camara.fov = lerp(camara.fov, enc.fov, 1 - Math.exp(-3 * dt));
    camara.updateProjectionMatrix();

    /* ── Ambiente ───────────────────────────────────────────────── */
    const amb = mundo.ambiente;
    niebla.color.setHex(amb.cieloHorizonte);
    niebla.density = amb.niebla * AJUSTES.niebla;

    /* ── El sol ───────────────────────────────────────────────────
       Altura Y ACIMUT, los dos del guion. El acimut es la corrección que más
       cambia la página: antes era una constante, así que el sol salía siempre
       del mismo sitio y los ocho capítulos estaban iluminados exactamente
       igual —un viaje de trece horas con una sola luz—. Ahora gira ciento
       treinta grados a lo largo del recorrido, y con eso el buque queda a
       contraluz al amanecer, la grúa recibe la luz de costado y la nave del
       destino la recibe de frente al atardecer. */
    const elev = amb.alturaSol * Math.PI * 0.5;
    const az = amb.acimut * AJUSTES.giroSol;
    dirSol.set(
      Math.cos(elev) * Math.sin(az),
      Math.sin(elev) + 0.06,
      Math.cos(elev) * Math.cos(az),
    ).normalize();
    sol.position.copy(dirSol).multiplyScalar(320).add(miraSuave);
    sol.color.setHex(amb.colorLuz);
    sol.intensity = amb.fuerzaLuz * AJUSTES.luz;

    /* El rebote del cielo sube al final del viaje a propósito. Con el sol
       bajo, la luz directa apenas llega y casi todo lo que se ve es cielo
       rebotado; mantener el rebote bajo era lo que dejaba el centro logístico
       y la entrega apagados y del color del barro. */
    cielo.intensity = amb.rebote * AJUSTES.rebote * AJUSTES.luz;
    cielo.color.setHex(amb.cieloAlto);
    cielo.groundColor.setHex(0x4a4840);
    // El relleno viene SIEMPRE del lado opuesto al sol: es lo que recorta la silueta
    relleno.position.copy(dirSol).multiplyScalar(-260).add(miraSuave);
    relleno.position.y = Math.abs(relleno.position.y) + 40;
    relleno.intensity = amb.relleno * AJUSTES.relleno * AJUSTES.luz;

    renderer.toneMappingExposure = AJUSTES.exposicion
      * amb.exposicion
      * lerp(0.95, 1.25, amb.alturaSol)
      * lerp(1.12, 1, clamp(camara.aspect / 1.6));
    // El objetivo sigue a la cámara: fija la dirección de la luz y, cuando hay
    // sombras, centra además el mapa donde se está mirando.
    sol.target.position.copy(miraSuave);
    sol.target.updateMatrixWorld();
    relleno.target.position.copy(miraSuave);
    relleno.target.updateMatrixWorld();

    /* ── Actores ────────────────────────────────────────────────── */
    barco.userData.actualizar(mundo, reloj, AJUSTES);
    for (const g of gruas) g.userData.actualizar?.(mundo);
    camion.userData.actualizar(mundo, reloj, AJUSTES, dt);
    puerto.userData.actualizar?.(mundo);
    aduanas.userData.actualizar?.(mundo);
    centro.userData.actualizar?.(mundo, reloj);
    destino.userData.actualizar?.(mundo, reloj);
    ambiental.userData.actualizar?.(mundo, reloj, AJUSTES, freno, camara);

    /* ── El contenedor protagonista ─────────────────────────────────
       Su sitio depende de en qué punto del viaje esté: en la pila del buque,
       colgado del spreader o sobre el remolque. Se resuelve transformando un
       punto local por la matriz del padre correspondiente, que es lo que hace
       que herede el balanceo del buque y el cabeceo del camión sin tener que
       copiarlos a mano. */
    const c = mundo.grua.contenedor;
    if (c) {
      heroe.visible = true;
      if (mundo.p < TRAMOS[2].desde) {
        barco.updateMatrixWorld(true);
        puntoLocal.copy(barco.userData.huecoLocal);
        heroe.position.copy(puntoLocal.applyMatrix4(barco.matrixWorld));
        heroe.rotation.set(barco.rotation.x, 0, barco.rotation.z);
      } else {
        heroe.position.set(c.x, c.y, c.z);
        // Colgado, se ladea con el balanceo; apoyado, no
        heroe.rotation.set(0, 0, 0);
        heroe.rotation.x = mundo.grua.colgando ? clamp(mundo.grua.balanceo * 0.02, -0.06, 0.06) : 0;
      }
    } else {
      // Ya va sobre el camión: se cuelga de su matriz y hereda la suspensión
      heroe.visible = true;
      camion.updateMatrixWorld(true);
      puntoLocal.copy(camion.userData.apoyo);
      heroe.position.copy(puntoLocal.applyMatrix4(camion.matrixWorld));
      /* Se copia el giro del remolque y NO se añade nada más. El contenedor se
         construye con su largo sobre su propio eje X, igual que el camión, y
         el cuarto de vuelta que el camión ya tiene para mirar hacia −Z viene
         dentro de este cuaternión. El `rotateY(π/2)` que había aquí lo sumaba
         por segunda vez y dejaba el contenedor CRUZADO sobre el remolque,
         asomando por un costado: era el fallo más visible de los capítulos de
         carretera y centro logístico. */
      heroe.quaternion.copy(camion.userData.remolque.getWorldQuaternion(giroRemolque));
    }

    mar.userData.actualizar(mundo, reloj, AJUSTES, dt, dirSol);
    domoCielo.userData.actualizar(mundo, reloj, AJUSTES, dt, dirSol);
    domoCielo.position.copy(camara.position);

    /* ── Regiones ───────────────────────────────────────────────── */
    for (const r of regiones) {
      r.obj.visible = st.progreso >= r.desde && st.progreso <= r.hasta;
    }

    renderer.render(escena, camara);
    fotogramas++;

    /* Aviso de capítulo: una sola vez por cambio, no en cada fotograma.
       Se lee del progreso OBJETIVO, no del amortiguado. El amortiguado es el
       de la cámara, que va medio segundo por detrás a propósito; si el rótulo
       y el panel fueran con él, el visitante vería marcado un capítulo
       distinto del que está leyendo cada vez que se desplaza deprisa. El texto
       y la interfaz siguen al scroll; sólo la cámara se deja llevar. */
    const cap = capituloEn(st.objetivo);
    const cambio = cap.indice !== capituloActual;
    if (cambio) capituloActual = cap.indice;
    alProgreso?.(st.progreso, cap, mundo, cambio);

    if (primerFotograma) {
      primerFotograma = false;
      alPintar?.();
    }
  }
  raf = requestAnimationFrame(fotograma);

  const alVisibilidad = () => {
    corriendo = !document.hidden;
    visible = corriendo ? 1 : 0;
    anterior = performance.now();
  };
  document.addEventListener('visibilitychange', alVisibilidad);

  if (window.__debugNX) {
    window.__escenaNX = {
      THREE, escena, camara, renderer, barco, gruas, camion, heroe, st, AJUSTES, MEDIDAS,
      puerto, aduanas, carretera, centro, destino, mar, tramos: TRAMOS,
      get fotogramas() { return fotogramas; },
      get freno() { return { escalon, medioFotograma: Math.round(medioFotograma) }; },
      mundo: () => mundoEn(st.progreso, AJUSTES),
      capituloDe: (p) => capituloEn(p).capitulo.id,
      /* Sitúa la escena en un progreso exacto y pinta un fotograma con la
         amortiguación desactivada, de forma SÍNCRONA. Sin esto, una prueba de
         encuadre sólo podría medir a dónde ha llegado la inercia, que no es lo
         mismo que lo que el guion pide. */
      irA(p) {
        forzado = clamp(p);
        /* Y la ENTRADA se da por terminada. La cámara llega al principio desde
           260 m más arriba y 180 m más atrás, y esa entrada sólo arranca
           cuando el visitante pasa de la portada. En el banco de pruebas nadie
           pasa de la portada, así que `entrada` se quedaba en cero y TODAS las
           medidas —encuadre y oclusión— se tomaban con la cámara a
           doscientos sesenta metros de donde de verdad está. Medía otra
           película. */
        st.entrada = 1;
        inicioEntrada = 0;
        anterior = performance.now() - 16;
        pintar();
        forzado = null;
      },
    };
  }

  return {
    entrar() {
      if (reducido) { st.entrada = 1; return; }
      inicioEntrada = performance.now();
      st.entrada = 0;
    },
    puntero(x, y) { st.punteroX = x; st.punteroY = y; },
    set movimiento(v) { movimiento = v ? 1 : 0; },
    get progreso() { return st.progreso; },
    get fotogramas() { return fotogramas; },
    get topeFrenos() { return FRENOS.length; },
    alturaDocumento,
    medir: redimensionar,
    destruir() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', redimensionar);
      document.removeEventListener('visibilitychange', alVisibilidad);
      escena.traverse((o) => { o.userData?.liberar?.(); });
      liberarMateriales();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
