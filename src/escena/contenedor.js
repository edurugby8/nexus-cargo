/**
 * El contenedor.
 *
 * La pieza que el visitante va a mirar más de cerca y durante más tiempo, así
 * que es la que más detalle merece. Un 40 pies High Cube mide 12,192 × 2,438 ×
 * 2,896 metros: ésas son las medidas reales y son las que se usan, porque toda
 * la sensación de escala del puerto depende de que ésta sea la unidad
 * correcta.
 *
 * Qué se rehízo en la segunda fase y por qué
 * ------------------------------------------
 * La primera versión tenía dos fallos, uno de bulto y otro de nivel.
 *
 * El de bulto: los dos TESTEROS estaban girados al revés —+90° donde tocaba
 * −90°— y quedaban del revés. Como un material no pinta la cara trasera, se
 * veía el interior de la caja: en el capítulo de la grúa el contenedor salía
 * deshilachado y translúcido, con el corrugado del lado opuesto asomando por
 * dentro. Es el fallo que más saltaba a la vista de toda la página.
 *
 * El de nivel: era una caja con estrías. Un contenedor de verdad no es una
 * caja; es un BASTIDOR —cuatro esquinas, cuatro largueros, dos testeros— con
 * chapa corrugada tensada entre medias, y la chapa va HUNDIDA respecto al
 * bastidor. Ese escalón de tres centímetros es lo que dibuja la sombra larga
 * que recorre el costado y lo que hace que se lea como acero y no como un
 * bloque pintado. Ahora está modelado.
 *
 * El corrugado va en GEOMETRÍA, no en textura, y esa decisión se mantiene: la
 * cámara llega a pasar a dos metros del costado y a esa distancia un corrugado
 * pintado se delata al instante porque no proyecta sombra ni cambia con la
 * luz. Son unos cientos de triángulos, y se comparten entre todos.
 *
 * Los MODELOS EXTERNOS: se buscaron. Ver `MODELOS.md` en la raíz — el resumen
 * es que las fuentes con licencia verificable no son alcanzables desde el
 * entorno de construcción y las alcanzables no documentan licencia por
 * archivo. Se aplica la alternativa prevista en el encargo: versión propia,
 * mejorada, y con las medidas reales.
 */

import * as THREE from 'three';
import { texturaContenedor, texturaContenedorGenerico } from './texturas.js';
import { aceroPintado, aceroDesnudo } from './materiales.js';

/** Medidas ISO de un 40' High Cube, en metros. */
const L = 12.192;
const A = 2.438;
const H = 2.896;

/** Cuánto sobresale el bastidor respecto a la chapa. Tres centímetros. */
const HUNDIDO = 0.03;
/** Canto de los largueros de esquina, arriba y abajo. */
const LARGUERO = 0.165;
/**
 * Panel corrugado.
 *
 * Se genera el PERFIL en 2D —la línea quebrada que recorre el zigzag— y luego
 * se barre en altura. Así el perfil se escribe una vez y vale para el costado
 * largo y para el testero, y las normales salen del propio perfil en lugar de
 * calcularse a ojo.
 *
 * Cada faceta lleva su normal CONSTANTE, sin promediar con las vecinas. Es lo
 * contrario de lo que se suele hacer, y aquí es lo correcto: un corrugado es
 * una sucesión de planos con aristas vivas, y suavizar las normales lo
 * convertiría en una chapa ondulada blanda. Las rayas verticales nítidas de un
 * contenedor son precisamente esas aristas.
 *
 * @param {number} ancho      anchura total del panel
 * @param {number} alto       altura total del panel
 * @param {number} fondo      profundidad del pliegue
 * @param {number} ondas      cuántas ondas caben
 */
function panelCorrugado(ancho, alto, fondo, ondas) {
  /* Perfil de una onda, en fracciones del paso. Trapezoidal, como el de
     verdad: llano hundido, rampa, llano saliente, rampa. */
  const PERFIL = [[0, 0], [0.30, 0], [0.42, 1], [0.58, 1], [0.70, 0], [1, 0]];

  const puntos = [];
  const paso = ancho / ondas;
  for (let i = 0; i < ondas; i++) {
    const x0 = -ancho / 2 + i * paso;
    for (const [fx, fz] of PERFIL) {
      const x = x0 + fx * paso;
      // Se evita duplicar el punto de unión entre ondas
      if (puntos.length && Math.abs(puntos[puntos.length - 1][0] - x) < 1e-6) continue;
      puntos.push([x, fz * fondo]);
    }
  }

  const y0 = -alto / 2;
  const y1 = alto / 2;
  const pos = [];
  const nor = [];
  const uv = [];

  for (let i = 0; i < puntos.length - 1; i++) {
    const [x0, z0] = puntos[i];
    const [x1, z1] = puntos[i + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const largo = Math.hypot(dx, dz) || 1;
    // Normal hacia −Z: el panel mira a su propio −Z y se coloca ya girado
    const nx = -dz / largo;
    const nz = -dx / largo;
    const u0 = (x0 + ancho / 2) / ancho;
    const u1 = (x1 + ancho / 2) / ancho;
    pos.push(x0, y0, z0, x1, y0, z1, x1, y1, z1);
    pos.push(x0, y0, z0, x1, y1, z1, x0, y1, z0);
    for (let k = 0; k < 6; k++) nor.push(nx, 0, nz);
    uv.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeBoundingSphere();
  return geo;
}

/**
 * Una esquina (corner casting).
 *
 * Es la pieza por la que se agarra TODO —el spreader, los twistlocks del
 * buque, las trincas del remolque— y la única del contenedor que no está
 * pintada: va en acero desnudo y por eso destaca. Lleva su chaflán, porque una
 * esquina viva delata el bloque al instante.
 */
function esquina() {
  const g = new THREE.BoxGeometry(0.34, 0.24, 0.245);
  // Chaflán barato: se encoge el anillo de vértices exteriores
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    p.setXYZ(i, x * 0.94, y, z * 0.9);
    if (Math.abs(y) > 0.11) p.setX(i, x * 0.88);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Construye un contenedor.
 * @param {object} op
 * @param {boolean} op.protagonista  si lleva el código y el logotipo
 * @param {string}  op.color
 * @param {number}  op.semilla
 * @param {boolean} op.detalle  puertas, herrajes y bolsas de carretilla
 */
export function crearContenedor({ protagonista = false, color = '#c85a1e', semilla = 1, detalle = false } = {}) {
  const grupo = new THREE.Group();
  const aDesechar = [];

  const mapa = protagonista ? texturaContenedor() : texturaContenedorGenerico(color, semilla);
  aDesechar.push(mapa);

  /* Tres materiales y no más. El costado lleva el rótulo; el bastidor va del
     mismo color pero SIN rótulo y algo más oscuro, que es lo que hace que se
     lea como una pieza distinta; los herrajes van en acero desnudo. */
  const tono = protagonista ? '#c25518' : color;
  const matCostado = new THREE.MeshStandardMaterial({
    map: mapa, roughness: 0.66, metalness: 0.28,
    normalMap: aceroPintado(tono, { semilla }).normalMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
  });
  aDesechar.push(matCostado);
  const matBastidor = aceroPintado(tono, { semilla: semilla + 1, rugosidad: 0.52, metal: 0.42 });
  const matTecho = aceroPintado(protagonista ? '#a84814' : color, { semilla: semilla + 2, rugosidad: 0.74, metal: 0.3 });
  const matHerraje = aceroDesnudo(0x5b626b, 0.38);

  /* ── Alma ──────────────────────────────────────────────────────────
     Un bloque macizo justo por dentro de la chapa. No se ve nunca: está para
     que la caja sea OPACA desde cualquier ángulo. Las chapas corrugadas son
     superficies de una sola cara y en un rasante —o en el medio segundo que la
     cámara tarda en pasar de un costado al otro— se colaba la vista del
     interior. Cuesta doce triángulos y cierra el problema entero. */
  const geoAlma = new THREE.BoxGeometry(L - 0.02, H - 0.02, A - 0.02);
  const alma = new THREE.Mesh(geoAlma, matTecho);
  alma.castShadow = true;
  grupo.add(alma);
  aDesechar.push(geoAlma);

  /* ── Costados ──────────────────────────────────────────────────────
     Hundidos respecto al bastidor: ése es el escalón que dibuja la sombra. */
  const ondasLargo = protagonista ? 42 : 16;
  const geoLargo = panelCorrugado(L - 0.34, H - LARGUERO * 2, 0.036, ondasLargo);
  aDesechar.push(geoLargo);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(geoLargo, matCostado);
    m.position.z = s * (A / 2 - HUNDIDO);
    m.rotation.y = s > 0 ? Math.PI : 0;
    m.castShadow = true;
    m.receiveShadow = true;
    grupo.add(m);
  }

  /* ── Testeros ──────────────────────────────────────────────────────
     El giro va en el sentido CONTRARIO al que tenía. El perfil se genera con
     su normal hacia −Z; para que el testero de +X mire hacia FUERA hay que
     girarlo −90° sobre Y. Con el signo cambiado los dos quedaban del revés y
     se veía el interior. */
  const geoCorto = panelCorrugado(A - 0.3, H - LARGUERO * 2, 0.03, 8);
  aDesechar.push(geoCorto);
  // Frontal cerrado (−X). El trasero (+X) son las puertas, más abajo.
  const frontal = new THREE.Mesh(geoCorto, matCostado);
  frontal.position.x = -(L / 2 - HUNDIDO);
  frontal.rotation.y = Math.PI / 2;
  frontal.castShadow = true;
  grupo.add(frontal);

  /* ── Bastidor ──────────────────────────────────────────────────────
     Cuatro largueros y cuatro pilares de esquina. Sobresalen de la chapa, y
     eso es lo que convierte la caja en una estructura. */
  const geoLargueroL = new THREE.BoxGeometry(L, LARGUERO, 0.09);
  const geoPilar = new THREE.BoxGeometry(0.12, H - LARGUERO * 2, 0.16);
  const geoLargueroC = new THREE.BoxGeometry(0.1, LARGUERO, A);
  aDesechar.push(geoLargueroL, geoPilar, geoLargueroC);
  for (const sy of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const l = new THREE.Mesh(geoLargueroL, matBastidor);
      l.position.set(0, sy * (H / 2 - LARGUERO / 2), sz * (A / 2 - 0.02));
      l.castShadow = true;
      grupo.add(l);
    }
    for (const sx of [-1, 1]) {
      const l = new THREE.Mesh(geoLargueroC, matBastidor);
      l.position.set(sx * (L / 2 - 0.02), sy * (H / 2 - LARGUERO / 2), 0);
      grupo.add(l);
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const p = new THREE.Mesh(geoPilar, matBastidor);
      p.position.set(sx * (L / 2 - 0.05), 0, sz * (A / 2 - 0.05));
      p.castShadow = true;
      grupo.add(p);
    }
  }

  /* ── Techo ─────────────────────────────────────────────────────────
     Con una combadura mínima hacia el centro, que es como está de verdad para
     que evacúe el agua, y con sus travesaños. La combadura no se ve de frente;
     se ve cuando la cámara pasa por encima en el traslado de la grúa y el
     reflejo del cielo recorre la chapa en lugar de quedarse quieto. */
  const geoTecho = new THREE.PlaneGeometry(L - 0.2, A - 0.2, 12, 3);
  const pt = geoTecho.attributes.position;
  for (let i = 0; i < pt.count; i++) {
    const v = pt.getY(i) / ((A - 0.2) / 2);
    pt.setZ(i, -0.035 * (1 - v * v));
  }
  geoTecho.computeVertexNormals();
  const techo = new THREE.Mesh(geoTecho, matTecho);
  techo.rotation.x = -Math.PI / 2;
  techo.position.y = H / 2 - 0.005;
  techo.receiveShadow = true;
  grupo.add(techo);
  aDesechar.push(geoTecho);

  /* ── Esquinas ──────────────────────────────────────────────────────
     Las ocho, en acero desnudo. Son la referencia de escala del contenedor:
     todo el mundo sabe, sin saberlo, el tamaño que tiene una de éstas. */
  const geoEsq = esquina();
  aDesechar.push(geoEsq);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const m = new THREE.Mesh(geoEsq, matHerraje);
        m.position.set(sx * (L / 2 - 0.17), sy * (H / 2 - 0.12), sz * (A / 2 - 0.12));
        m.castShadow = true;
        grupo.add(m);
      }
    }
  }

  if (detalle) {
    /* ── Puertas ─────────────────────────────────────────────────────
       Dos hojas, cuatro barras de cierre cada una con sus manetas y sus
       guías, y las bisagras. Es el extremo que el guion enseña de frente
       cuando el contenedor aterriza sobre el remolque y cuando se abre en el
       destino, así que es el que más detalle pide. */
    const geoHoja = panelCorrugado((A - 0.34) / 2, H - LARGUERO * 2, 0.026, 4);
    aDesechar.push(geoHoja);
    for (const s of [-1, 1]) {
      const hoja = new THREE.Mesh(geoHoja, matCostado);
      hoja.position.set(L / 2 - 0.012, 0, s * (A - 0.34) / 4);
      hoja.rotation.y = -Math.PI / 2;
      hoja.castShadow = true;
      grupo.add(hoja);
    }

    const geoBarra = new THREE.CylinderGeometry(0.026, 0.026, H - LARGUERO * 2 - 0.1, 8);
    const geoManeta = new THREE.BoxGeometry(0.05, 0.3, 0.09);
    const geoGuia = new THREE.BoxGeometry(0.07, 0.09, 0.1);
    const geoBisagra = new THREE.CylinderGeometry(0.045, 0.045, 0.16, 8);
    aDesechar.push(geoBarra, geoManeta, geoGuia, geoBisagra);
    for (let i = 0; i < 4; i++) {
      const z = (-1.5 + i) * (A / 4.6);
      const barra = new THREE.Mesh(geoBarra, matHerraje);
      barra.position.set(L / 2 + 0.05, 0, z);
      barra.castShadow = true;
      grupo.add(barra);
      const maneta = new THREE.Mesh(geoManeta, matHerraje);
      maneta.position.set(L / 2 + 0.1, H * 0.05, z);
      grupo.add(maneta);
      for (const sy of [-1, 1]) {
        const guia = new THREE.Mesh(geoGuia, matHerraje);
        guia.position.set(L / 2 + 0.04, sy * (H / 2 - 0.3), z);
        grupo.add(guia);
      }
    }
    for (const sz of [-1, 1]) {
      for (const sy of [-1, 0, 1]) {
        const b = new THREE.Mesh(geoBisagra, matHerraje);
        b.rotation.x = Math.PI / 2;
        b.position.set(L / 2 + 0.03, sy * (H / 2 - 0.55), sz * (A / 2 - 0.09));
        grupo.add(b);
      }
    }

    /* Bolsas de carretilla en el bajo: dos huecos oscuros que rompen la línea
       inferior. Son diez centímetros de sombra y ahorran que el contenedor
       parezca apoyado sobre una plancha. */
    const geoBolsa = new THREE.BoxGeometry(0.64, 0.12, 0.06);
    aDesechar.push(geoBolsa);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const b = new THREE.Mesh(geoBolsa, matHerraje);
        b.position.set(sx * 1.05, -(H / 2) + 0.09, sz * (A / 2 - 0.01));
        grupo.add(b);
      }
    }
  }

  grupo.userData.liberar = () => aDesechar.forEach((o) => o.dispose?.());
  grupo.userData.medidas = { L, A, H };
  return grupo;
}

/**
 * Las pilas del puerto, en UNA sola llamada de dibujo por color.
 *
 * Son cientos de contenedores y todos comparten geometría; instanciarlos es la
 * diferencia entre cuatrocientas llamadas y seis. La geometría es la simple
 * —sin corrugado— porque la cámara nunca se acerca a ellos: lo que aportan es
 * masa, color y escala, y eso se lee de lejos.
 *
 * Lo que sí se corrigió es el APILADO. Antes la altura salía de una cuenta
 * aritmética sobre el índice y las pilas quedaban en escalones regulares, que
 * es justo lo que no hace un patio de verdad. Ahora la altura viene de un
 * ruido determinista por columna: irregular, pero igual en cada recarga.
 */
export function crearPilas({ cuantos, semilla = 1, zonas }) {
  const grupo = new THREE.Group();
  const aDesechar = [];
  const COLORES = ['#2e5d86', '#7d2f2a', '#3f6b4a', '#8a6a24', '#4a4f57', '#6b3a5e'];
  const porColor = Math.ceil(cuantos / COLORES.length);
  const geo = new THREE.BoxGeometry(L, H, A);
  const dummy = new THREE.Object3D();
  aDesechar.push(geo);

  // Ruido barato y determinista: mismo patio en cada visita
  const azar = (n) => {
    const x = Math.sin(n * 127.1 + semilla * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  COLORES.forEach((color, ci) => {
    const mapa = texturaContenedorGenerico(color, semilla + ci);
    const mat = new THREE.MeshStandardMaterial({
      map: mapa, roughness: 0.78, metalness: 0.2,
      normalMap: aceroPintado(color, { semilla: semilla + ci }).normalMap,
      normalScale: new THREE.Vector2(0.4, 0.4),
    });
    aDesechar.push(mapa, mat);
    const malla = new THREE.InstancedMesh(geo, mat, porColor);
    malla.castShadow = true;
    malla.receiveShadow = true;
    for (let n = 0; n < porColor; n++) {
      const zona = zonas[(n + ci) % zonas.length];
      const fila = Math.floor(n / 5) % zona.filas;
      const col = n % 5;
      const altura = Math.floor(azar(n * 13 + ci * 977) * zona.altura);
      dummy.position.set(
        zona.x + (col - 2) * (L + 0.9),
        H / 2 + altura * (H + 0.04) + zona.y,
        zona.z + fila * (A + 0.7),
      );
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      malla.setMatrixAt(n, dummy.matrix);
    }
    malla.instanceMatrix.needsUpdate = true;
    malla.frustumCulled = false;
    grupo.add(malla);
  });

  grupo.userData.liberar = () => aDesechar.forEach((o) => o.dispose?.());
  return grupo;
}
