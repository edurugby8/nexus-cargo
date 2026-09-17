/**
 * Todo lo que no se mueve: muelle, terminal, aduanas, carretera, centro
 * logístico y destino.
 *
 * Está construido por REGIONES a lo largo del eje Z, en el mismo orden en que
 * se recorren. Cada región se puede mostrar y ocultar entera, que es lo que
 * permite tener un mundo de kilómetro y medio sin pagarlo todo a la vez.
 */

import * as THREE from 'three';
import { MEDIDAS } from './ruta.js';
import { azarCon, lerp, clamp } from '../lib/util.js';
import { crearPilas } from './contenedor.js';
import {
  texturaHormigon, texturaAsfalto, texturaChapa, texturaNave, texturaMancha,
} from './texturas.js';
import {
  aceroPintado, aceroDesnudo, hormigon, pintura, luminoso, cristal, relieveAsfalto,
} from './materiales.js';

/* ── Muelle y explanada de la terminal ────────────────────────────── */

export function crearPuerto({ caps }) {
  const grupo = new THREE.Group();
  const aDesechar = [];
  const azar = azarCon(7788);

  const mapaSuelo = texturaHormigon();
  const matSuelo = new THREE.MeshStandardMaterial({ map: mapaSuelo, roughness: 0.94, metalness: 0.04 });
  const matBorde = new THREE.MeshStandardMaterial({ color: 0x6f7378, roughness: 0.9 });
  const matEstructura = new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: 0.7, metalness: 0.4 });
  aDesechar.push(mapaSuelo, matSuelo, matBorde, matEstructura);

  // La explanada: desde el canto del muelle hacia tierra
  const geoSuelo = new THREE.PlaneGeometry(1400, 520);
  const suelo = new THREE.Mesh(geoSuelo, matSuelo);
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.set(0, 0.6, MEDIDAS.muelle - 260);
  suelo.receiveShadow = true;
  suelo.userData.envolvente = true;
  grupo.add(suelo);
  aDesechar.push(geoSuelo);

  // El cantil: el canto vertical contra el agua, con sus defensas
  const geoCantil = new THREE.BoxGeometry(1400, 6, 3);
  const cantil = new THREE.Mesh(geoCantil, matBorde);
  cantil.position.set(0, -2.4, MEDIDAS.muelle);
  cantil.receiveShadow = true;
  grupo.add(cantil);
  aDesechar.push(geoCantil);

  const geoDefensa = new THREE.CylinderGeometry(0.85, 0.85, 2.2, 10);
  const matDefensa = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.95 });
  aDesechar.push(geoDefensa, matDefensa);
  for (let x = -600; x <= 600; x += 26) {
    const d = new THREE.Mesh(geoDefensa, matDefensa);
    d.rotation.z = Math.PI / 2;
    d.position.set(x, 0.4, MEDIDAS.muelle + 1.4);
    grupo.add(d);
  }

  // Bolardos
  const geoBolardo = new THREE.CylinderGeometry(0.42, 0.55, 1.1, 8);
  aDesechar.push(geoBolardo);
  for (let x = -560; x <= 560; x += 40) {
    const b = new THREE.Mesh(geoBolardo, matEstructura);
    b.position.set(x, 1.15, MEDIDAS.muelle - 4);
    b.castShadow = true;
    grupo.add(b);
  }

  // Carriles de las grúas
  const geoCarril = new THREE.BoxGeometry(1400, 0.28, 0.9);
  aDesechar.push(geoCarril);
  for (const z of [MEDIDAS.muelle - 4, MEDIDAS.muelle - 4 - MEDIDAS.grua.via]) {
    const c = new THREE.Mesh(geoCarril, matEstructura);
    c.position.set(0, 0.74, z);
    grupo.add(c);
  }

  /* Pilas de contenedores del patio. Van instanciadas: son cientos y aportan
     masa y color, no detalle. */
  const zonas = [];
  for (let i = 0; i < 9; i++) {
    zonas.push({
      x: -420 + i * 105 + (i % 2) * 18,
      z: MEDIDAS.muelle - 70 - (i % 3) * 58,
      y: 0.6,
      filas: 6,
      altura: 3 + (i % 3),
    });
  }
  const pilas = crearPilas({ cuantos: caps.pilas, semilla: 5, zonas });
  grupo.add(pilas);

  // Torres de iluminación del puerto: dan la escala vertical del patio
  const geoTorre = new THREE.CylinderGeometry(0.3, 0.5, 34, 6);
  const geoFoco = new THREE.BoxGeometry(4, 0.8, 1.4);
  const mancha = texturaMancha(0.22);
  const matHalo = new THREE.MeshBasicMaterial({
    map: mancha, color: 0xffeec4, transparent: true, opacity: 0.5,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  aDesechar.push(geoTorre, geoFoco, mancha, matHalo);
  const geoHalo = new THREE.PlaneGeometry(9, 9);
  aDesechar.push(geoHalo);
  const halos = [];
  for (let i = 0; i < Math.round(9 * caps.carretera / 100 + 5); i++) {
    const x = -480 + i * 110;
    const t = new THREE.Mesh(geoTorre, matEstructura);
    t.position.set(x, 17.6, MEDIDAS.muelle - 150);
    t.castShadow = true;
    grupo.add(t);
    const f = new THREE.Mesh(geoFoco, matEstructura);
    f.position.set(x, 34.4, MEDIDAS.muelle - 150);
    grupo.add(f);
    const h = new THREE.Mesh(geoHalo, matHalo);
    h.position.set(x, 34.4, MEDIDAS.muelle - 150);
    h.renderOrder = 6;
    halos.push(h);
    grupo.add(h);
  }

  // Edificio de terminal, al fondo del patio
  const mapaNave = texturaNave('#b6bdc4');
  const matNave = new THREE.MeshStandardMaterial({ map: mapaNave, roughness: 0.78, metalness: 0.2 });
  aDesechar.push(mapaNave, matNave);
  const geoNave = new THREE.BoxGeometry(150, 22, 46);
  const nave = new THREE.Mesh(geoNave, matNave);
  nave.position.set(-260, 11.6, MEDIDAS.muelle - 210);
  nave.castShadow = true;
  nave.receiveShadow = true;
  grupo.add(nave);
  aDesechar.push(geoNave);

  grupo.userData.halos = halos;
  grupo.userData.actualizar = (mundo) => {
    // Los focos se encienden cuando cae la luz, no a una hora fija
    const noche = 1 - Math.min(1, mundo.ambiente.alturaSol / 0.34);
    matHalo.opacity = noche * 0.55;
    halos.forEach((h) => { h.visible = noche > 0.04; });
  };
  grupo.userData.liberar = () => {
    aDesechar.forEach((o) => o.dispose?.());
    pilas.userData.liberar?.();
  };
  return grupo;
}

/* ── Aduanas: escáner, semáforo y barrera ─────────────────────────── */

export function crearAduanas() {
  const grupo = new THREE.Group();
  const aDesechar = [];
  const X = MEDIDAS.gruaX;

  const matEstructura = new THREE.MeshStandardMaterial({ color: 0xb9bfc6, roughness: 0.62, metalness: 0.4 });
  const matOscuro = new THREE.MeshStandardMaterial({ color: 0x252b33, roughness: 0.55, metalness: 0.55 });
  const matNaranja = new THREE.MeshStandardMaterial({ color: 0xd06a20, roughness: 0.6, metalness: 0.25 });
  aDesechar.push(matEstructura, matOscuro, matNaranja);

  /* El arco del escáner. La inspección NO se enseña volviendo transparente el
     contenedor —eso no pasa y se nota—: lo que se ve es el BARRIDO del pórtico
     y el resultado en la interfaz, que es exactamente lo que ve un operador. */
  const geoPie = new THREE.BoxGeometry(1.6, 8.4, 3.2);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(geoPie, matEstructura);
    p.position.set(X + s * 5.2, 4.2, MEDIDAS.escaner);
    p.castShadow = true;
    grupo.add(p);
  }
  const geoDintel = new THREE.BoxGeometry(12, 1.8, 3.2);
  const dintel = new THREE.Mesh(geoDintel, matEstructura);
  dintel.position.set(X, 9.2, MEDIDAS.escaner);
  dintel.castShadow = true;
  grupo.add(dintel);
  aDesechar.push(geoPie, geoDintel);

  // La cortina de barrido, que recorre el contenedor de punta a punta
  const mancha = texturaMancha(0.6);
  const matBarrido = new THREE.MeshBasicMaterial({
    map: mancha, color: 0x64d8e8, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const geoBarrido = new THREE.PlaneGeometry(9, 8);
  const barrido = new THREE.Mesh(geoBarrido, matBarrido);
  barrido.rotation.y = Math.PI / 2;
  barrido.renderOrder = 7;
  grupo.add(barrido);
  aDesechar.push(mancha, matBarrido, geoBarrido);

  // Cabina de control
  const geoCabina = new THREE.BoxGeometry(5, 3.4, 4);
  const cabina = new THREE.Mesh(geoCabina, matEstructura);
  cabina.position.set(X + 10, 1.7, MEDIDAS.escaner - 8);
  cabina.castShadow = true;
  grupo.add(cabina);
  aDesechar.push(geoCabina);

  // Semáforo
  const geoPoste = new THREE.CylinderGeometry(0.16, 0.16, 4.4, 8);
  const poste = new THREE.Mesh(geoPoste, matOscuro);
  poste.position.set(X + 5.6, 2.2, MEDIDAS.barrera + 5);
  grupo.add(poste);
  const geoCaja = new THREE.BoxGeometry(0.7, 1.7, 0.6);
  const caja = new THREE.Mesh(geoCaja, matOscuro);
  caja.position.set(X + 5.6, 4.9, MEDIDAS.barrera + 5);
  grupo.add(caja);
  const geoLuz = new THREE.SphereGeometry(0.21, 10, 8);
  const matRojo = new THREE.MeshBasicMaterial({ color: 0xff2f1c });
  const matVerde = new THREE.MeshBasicMaterial({ color: 0x2fe07a });
  const matApagado = new THREE.MeshStandardMaterial({ color: 0x1a1d21, roughness: 0.8 });
  const luzRoja = new THREE.Mesh(geoLuz, matApagado);
  luzRoja.position.set(X + 5.6, 5.4, MEDIDAS.barrera + 4.68);
  const luzVerde = new THREE.Mesh(geoLuz, matApagado);
  luzVerde.position.set(X + 5.6, 4.5, MEDIDAS.barrera + 4.68);
  grupo.add(luzRoja, luzVerde);
  aDesechar.push(geoPoste, geoCaja, geoLuz, matRojo, matVerde, matApagado);

  // Barrera
  const geoBase = new THREE.BoxGeometry(0.7, 1.2, 0.7);
  const base = new THREE.Mesh(geoBase, matOscuro);
  base.position.set(X + 5.2, 0.6, MEDIDAS.barrera);
  grupo.add(base);
  const geoBrazo = new THREE.BoxGeometry(0.16, 0.34, 10.4);
  const brazo = new THREE.Mesh(geoBrazo, matNaranja);
  brazo.castShadow = true;
  const pivote = new THREE.Group();
  pivote.position.set(X + 5.2, 1.3, MEDIDAS.barrera);
  brazo.position.z = -5.2;
  pivote.add(brazo);
  grupo.add(pivote);
  aDesechar.push(geoBase, geoBrazo);

  // Caseta y garitas del control
  const geoCaseta = new THREE.BoxGeometry(6, 3.2, 5);
  const caseta = new THREE.Mesh(geoCaseta, matEstructura);
  caseta.position.set(X - 9, 1.6, MEDIDAS.barrera);
  caseta.castShadow = true;
  grupo.add(caseta);
  aDesechar.push(geoCaseta);

  grupo.userData.actualizar = (mundo) => {
    const a = mundo.aduana;
    // El barrido recorre el contenedor: entra por un extremo y sale por el otro
    barrido.visible = a.escaneo > 0.001 && a.escaneo < 0.999;
    if (barrido.visible) {
      barrido.position.set(X, 4.4, lerp(MEDIDAS.escaner + 7, MEDIDAS.escaner - 7, a.escaneo));
      matBarrido.opacity = Math.sin(a.escaneo * Math.PI) * 0.55;
    }
    luzRoja.material = a.verde ? matApagado : matRojo;
    luzVerde.material = a.verde ? matVerde : matApagado;
    // La barrera sube girando sobre su base, no se desvanece
    pivote.rotation.x = a.barrera * (Math.PI / 2) * 0.92;
  };
  grupo.userData.liberar = () => aDesechar.forEach((o) => o.dispose?.());
  return grupo;
}

/* ── Carretera y su mobiliario ────────────────────────────────────── */

export function crearCarretera({ caps }) {
  const grupo = new THREE.Group();
  const aDesechar = [];
  const azar = azarCon(4242);
  const X = MEDIDAS.gruaX;
  const desde = MEDIDAS.barrera + 6;
  const hasta = MEDIDAS.destino - 240;
  const largo = desde - hasta;
  const centroZ = (desde + hasta) / 2;

  /* ── POR QUÉ NO SE NOTABA LA VELOCIDAD ────────────────────────────
     El camión recorre quinientos metros en este capítulo, y a un ritmo de
     lectura normal eso son bastante más de cien metros por segundo. La
     velocidad estaba; lo que no había era CONTRA QUÉ medirla.

     La calzada era un plano gris con unas rayas sueltas cada varios metros, el
     terreno un plano pardo hasta el horizonte y el quitamiedos venía en
     segmentos de 4,2 m colocados cada 6,3: una valla rota, con hueco entre
     pieza y pieza. Nada de eso pasa lo bastante cerca ni lo bastante seguido.

     La velocidad no la da el vehículo: la dan las cosas que le pasan al lado.
     Es la misma lección de las hojas cercanas de Umbría, trasladada aquí. Así
     que ahora hay, por orden de lo que más se nota:

       · marcas viales al paso de verdad —raya de 5 m, vano de 12— que cruzan
         el cuadro entero en los planos bajos;
       · quitamiedos CONTINUO, con el poste cada 4 m: a esta marcha, un poste
         cada dieciséis centésimas. Es un estroboscopio;
       · hitos de arista cada 12 m, más cerca todavía que el quitamiedos;
       · cuatro pórticos de señalización en vez de cinco carteles sueltos, y un
         paso superior: cada estructura por la que se pasa por debajo es un
         golpe de luz instantáneo;
       · y un talud con pendiente en lugar de un plano, para que el borde de la
         calzada tenga un canto que corra.
     Nada de esto es decorado: todo está puesto por el ritmo al que cruza. */

  const mapa = texturaAsfalto();
  const matAsfalto = new THREE.MeshStandardMaterial({
    map: mapa, roughness: 0.9, metalness: 0.03,
    normalMap: relieveAsfalto(), normalScale: new THREE.Vector2(0.8, 0.8),
  });
  const matTierra = new THREE.MeshStandardMaterial({ color: 0x5c5742, roughness: 0.98 });
  const matTalud = new THREE.MeshStandardMaterial({ color: 0x6a6249, roughness: 0.97 });
  const matGuardarrail = aceroDesnudo(0xaeb6bd, 0.44);
  const matPoste = new THREE.MeshStandardMaterial({ color: 0x585e66, roughness: 0.7, metalness: 0.4 });
  const matVerde = new THREE.MeshStandardMaterial({ color: 0x40563a, roughness: 0.95 });
  const matMarca = pintura(0xe8ece9);
  aDesechar.push(mapa, matAsfalto, matTierra, matTalud, matPoste, matVerde);

  const dummy = new THREE.Object3D();
  const cuantos = Math.round(caps.carretera);

  /* ── Calzada ────────────────────────────────────────────────────── */
  const geoCalzada = new THREE.PlaneGeometry(13, largo);
  const calzada = new THREE.Mesh(geoCalzada, matAsfalto);
  calzada.rotation.x = -Math.PI / 2;
  calzada.position.set(X, 0.02, centroZ);
  calzada.receiveShadow = true;
  calzada.userData.envolvente = true;
  grupo.add(calzada);
  aDesechar.push(geoCalzada);

  /* El arcén, MUY ancho. Con noventa metros el terreno terminaba en un canto
     recto a media distancia y se veía el borde del mundo; con ochocientos, la
     niebla se lo come mucho antes de que llegue a notarse. */
  const geoArcen = new THREE.PlaneGeometry(800, largo);
  const arcen = new THREE.Mesh(geoArcen, matTierra);
  arcen.rotation.x = -Math.PI / 2;
  arcen.position.set(X, -1.15, centroZ);
  arcen.receiveShadow = true;
  arcen.userData.envolvente = true;
  grupo.add(arcen);
  aDesechar.push(geoArcen);

  /* Talud: la calzada va en terraplén y el terreno cae a los lados. Es un
     plano inclinado por banda, y cambia mucho más de lo que cuesta: el borde
     del asfalto pasa a tener CANTO, y un canto que corre se lee como marcha.
     Con el terreno a la misma cota que la carretera no hay borde que correr. */
  const geoTalud = new THREE.PlaneGeometry(4.2, largo);
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(geoTalud, matTalud);
    t.rotation.x = -Math.PI / 2;
    t.rotation.y = s * 0.28;
    t.position.set(X + s * 8.4, -0.55, centroZ);
    t.receiveShadow = true;
    t.userData.envolvente = true;
    grupo.add(t);
  }
  aDesechar.push(geoTalud);

  /* ── Marcas viales ───────────────────────────────────────────────
     La raya discontinua de una carretera convencional mide 5 m con vanos de
     12. Esas cifras no son decorativas: son EL reloj de la escena. A cien
     metros por segundo pasa una raya cada diecisiete centésimas, y eso es lo
     que el ojo integra como velocidad. Antes las rayas iban cada varios metros
     sin relación con nada y el efecto no aparecía. */
  const PASO_RAYA = 17;
  const rayas = Math.min(700, Math.floor(largo / PASO_RAYA));
  const geoRaya = new THREE.PlaneGeometry(0.15, 5);
  const mallaRaya = new THREE.InstancedMesh(geoRaya, matMarca, rayas);
  for (let i = 0; i < rayas; i++) {
    dummy.position.set(X, 0.045, desde - i * PASO_RAYA);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    mallaRaya.setMatrixAt(i, dummy.matrix);
  }
  mallaRaya.frustumCulled = false;
  mallaRaya.userData.envolvente = true;
  grupo.add(mallaRaya);
  aDesechar.push(geoRaya);

  // Líneas de borde, continuas, una a cada lado
  const geoBorde = new THREE.PlaneGeometry(0.18, largo);
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(geoBorde, matMarca);
    b.rotation.x = -Math.PI / 2;
    b.position.set(X + s * 6.1, 0.045, centroZ);
    grupo.add(b);
  }
  aDesechar.push(geoBorde);

  /* ── Quitamiedos, CONTINUO ───────────────────────────────────────
     El segmento mide exactamente lo que el paso, así que la valla no tiene
     huecos. Antes medía 4,2 m y se colocaba cada 6,3: dos metros de aire entre
     pieza y pieza, y a velocidad eso no se lee como una valla, se lee como una
     fila de cosas. El poste cada 4 metros es lo que de verdad parpadea. */
  const PASO_RAIL = Math.max(3.4, largo / cuantos);
  const tramos = Math.min(620, Math.floor(largo / PASO_RAIL));
  const geoRail = new THREE.BoxGeometry(0.07, 0.34, PASO_RAIL);
  const geoPosteRail = new THREE.BoxGeometry(0.11, 0.9, 0.13);
  aDesechar.push(geoRail, geoPosteRail);
  const rails = new THREE.InstancedMesh(geoRail, matGuardarrail, tramos * 2);
  const postes = new THREE.InstancedMesh(geoPosteRail, matPoste, tramos * 2);
  let n = 0;
  for (let i = 0; i < tramos; i++) {
    const z = desde - i * PASO_RAIL;
    for (const s of [-1, 1]) {
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.position.set(X + s * 7.4, 0.88, z);
      dummy.updateMatrix();
      rails.setMatrixAt(n, dummy.matrix);
      dummy.position.set(X + s * 7.4, 0.44, z - PASO_RAIL / 2);
      dummy.updateMatrix();
      postes.setMatrixAt(n, dummy.matrix);
      n++;
    }
  }
  rails.count = postes.count = n;
  rails.castShadow = postes.castShadow = true;
  rails.frustumCulled = postes.frustumCulled = false;
  grupo.add(rails, postes);

  /* Hitos de arista: el elemento más cercano de todos y el que más veces pasa.
     Van con su banda reflectante, que en los planos bajos se enciende al
     recibir el sol rasante. */
  const PASO_HITO = 12;
  const hitos = Math.min(400, Math.floor(largo / PASO_HITO));
  const geoHito = new THREE.BoxGeometry(0.1, 1.05, 0.13);
  const geoBanda = new THREE.BoxGeometry(0.11, 0.2, 0.14);
  const matBanda = pintura(0xf2f4ee);
  aDesechar.push(geoHito, geoBanda);
  const mallaHito = new THREE.InstancedMesh(geoHito, matMarca, hitos * 2);
  const mallaBanda = new THREE.InstancedMesh(geoBanda, matBanda, hitos * 2);
  let h = 0;
  for (let i = 0; i < hitos; i++) {
    const z = desde - i * PASO_HITO - 5;
    for (const s of [-1, 1]) {
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.position.set(X + s * 6.9, 0.52, z);
      dummy.updateMatrix();
      mallaHito.setMatrixAt(h, dummy.matrix);
      dummy.position.y = 0.86;
      dummy.updateMatrix();
      mallaBanda.setMatrixAt(h, dummy.matrix);
      h++;
    }
  }
  mallaHito.count = mallaBanda.count = h;
  mallaHito.frustumCulled = mallaBanda.frustumCulled = false;
  grupo.add(mallaHito, mallaBanda);

  // Farolas: van a un lado, altas, y pasan muy cerca del objetivo
  const geoFarola = new THREE.CylinderGeometry(0.11, 0.17, 9, 6);
  const geoBrazoF = new THREE.BoxGeometry(0.12, 0.12, 2.2);
  aDesechar.push(geoFarola, geoBrazoF);
  const farolas = Math.round(cuantos / 4);
  const mallaFarola = new THREE.InstancedMesh(geoFarola, matPoste, farolas);
  const mallaBrazo = new THREE.InstancedMesh(geoBrazoF, matPoste, farolas);
  for (let i = 0; i < farolas; i++) {
    const z = desde - (i / farolas) * largo - 12;
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.position.set(X + 9.4, 4.5, z);
    dummy.updateMatrix();
    mallaFarola.setMatrixAt(i, dummy.matrix);
    dummy.position.set(X + 8.5, 9, z);
    dummy.updateMatrix();
    mallaBrazo.setMatrixAt(i, dummy.matrix);
  }
  mallaFarola.castShadow = true;
  mallaFarola.frustumCulled = mallaBrazo.frustumCulled = false;
  grupo.add(mallaFarola, mallaBrazo);

  // Vegetación de talud: masas simples, nunca protagonistas
  const geoMata = new THREE.SphereGeometry(1.5, 6, 4);
  aDesechar.push(geoMata);
  const matas = new THREE.InstancedMesh(geoMata, matVerde, cuantos * 3);
  for (let i = 0; i < cuantos * 3; i++) {
    const z = desde - azar() * largo;
    const s = azar() > 0.5 ? 1 : -1;
    dummy.rotation.set(0, azar() * 3, 0);
    dummy.position.set(X + s * (11 + azar() * 30), -0.3 + azar() * 0.9, z);
    dummy.scale.set(0.6 + azar() * 1.6, 0.5 + azar(), 0.6 + azar() * 1.6);
    dummy.updateMatrix();
    matas.setMatrixAt(i, dummy.matrix);
  }
  matas.castShadow = true;
  matas.frustumCulled = false;
  grupo.add(matas);

  /* ── Pórticos de señalización ────────────────────────────────────
     Cuatro, repartidos por la recta. Se pasa POR DEBAJO de todos, y ése es el
     detalle: la estructura entra por arriba del cuadro, crece, cruza y
     desaparece en menos de un segundo. Es el mejor marcador de velocidad que
     hay y no cuesta casi nada. */
  const geoPortico = new THREE.BoxGeometry(0.34, 0.42, 17.5);
  const geoPataP = new THREE.BoxGeometry(0.34, 7.2, 0.34);
  const geoCartel = new THREE.BoxGeometry(0.16, 2.4, 5.2);
  const matCartel = new THREE.MeshStandardMaterial({ color: 0x15532e, roughness: 0.68 });
  aDesechar.push(geoPortico, geoPataP, geoCartel, matCartel);
  for (let i = 0; i < 4; i++) {
    const z = desde - 80 - i * (largo / 4.4);
    const p = new THREE.Mesh(geoPortico, matPoste);
    p.position.set(X, 7.3, z);
    p.castShadow = true;
    grupo.add(p);
    for (const s of [-1, 1]) {
      const pata = new THREE.Mesh(geoPataP, matPoste);
      pata.position.set(X + s * 8.6, 3.65, z);
      pata.castShadow = true;
      grupo.add(pata);
    }
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(geoCartel, matCartel);
      c.position.set(X + s * 2.9, 5.7, z);
      c.castShadow = true;
      grupo.add(c);
    }
  }

  /* Un paso superior. Pasar por debajo de una estructura es de las cosas que
     mejor cuentan la velocidad: el cambio de luz es instantáneo. */
  const zPuente = MEDIDAS.carretera.desde - 210;
  const matHormigon = hormigon(0x8e9196, 6);
  const geoTablero = new THREE.BoxGeometry(60, 1.6, 11);
  const tablero = new THREE.Mesh(geoTablero, matHormigon);
  tablero.position.set(X, 8.4, zPuente);
  tablero.castShadow = true;
  tablero.receiveShadow = true;
  grupo.add(tablero);
  const geoPilaP = new THREE.BoxGeometry(2.4, 8.4, 3.4);
  for (const s of [-1, 1]) {
    const pila = new THREE.Mesh(geoPilaP, matHormigon);
    pila.position.set(X + s * 12, 4.2, zPuente);
    pila.castShadow = true;
    grupo.add(pila);
  }
  const geoPretil = new THREE.BoxGeometry(60, 1.1, 0.4);
  for (const s of [-1, 1]) {
    const pretil = new THREE.Mesh(geoPretil, matHormigon);
    pretil.position.set(X, 9.7, zPuente + s * 5.3);
    grupo.add(pretil);
  }
  aDesechar.push(geoTablero, geoPilaP, geoPretil);

  grupo.userData.liberar = () => aDesechar.forEach((o) => o.dispose?.());
  return grupo;
}

/* ── Centro logístico y destino final ─────────────────────────────── */

export function crearCentro({ caps }) {
  const grupo = new THREE.Group();
  const aDesechar = [];
  const X = MEDIDAS.gruaX;
  const Z = MEDIDAS.centro;
  const azar = azarCon(661);

  /* ── POR QUÉ NO SE RECONOCÍA COMO UN ALMACÉN ──────────────────────
     Era una caja de 160 × 70 × 14 con una franja naranja y nueve rectángulos
     oscuros. Grande, sí, pero un bloque grande no es un centro logístico: es
     un bloque grande. Lo que hace reconocible una nave de distribución no es
     el tamaño, son cinco cosas que se leen antes que la forma:

       · la MARQUESINA sobre los muelles, que proyecta una sombra profunda y
         horizontal a lo largo de toda la fachada. Es la firma visual del
         edificio y sin ella no hay muelle de carga que valga;
       · los TOPES de goma y las placas niveladoras a la altura de la
         plataforma de un camión —1,25 m—, que es la cota que explica para qué
         sirve el edificio;
       · los SEMIRREMOLQUES estacionados en ángulo contra los muelles, que dan
         la escala y dicen que aquí se trabaja;
       · el BLOQUE DE OFICINAS en un extremo, más bajo y acristalado, que
         rompe los 160 metros de chapa;
       · y la CUBIERTA a dos aguas con sus nervios, porque un techo plano hace
         que cualquier nave parezca una maqueta.
     Todo eso está ahora, y el capítulo se re-repartió en `ruta.js` para que el
     camión se acerque durante el capítulo entero en vez de llegar en el último
     trece por ciento. */

  const mapaNave = texturaNave('#c2c8ce');
  const matNave = new THREE.MeshStandardMaterial({
    map: mapaNave, roughness: 0.7, metalness: 0.26,
    normalMap: aceroPintado('#c2c8ce', { semilla: 44 }).normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
  });
  const matSuelo = hormigon(0x5a5e64, 26);
  const matOscuro = aceroPintado('#242a31', { semilla: 45, rugosidad: 0.6, metal: 0.5 });
  const matNaranja = aceroPintado('#c85a1e', { semilla: 46, rugosidad: 0.58, metal: 0.25 });
  const matGomaTope = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.95 });
  const matMarca = pintura(0xdfe4e6);
  aDesechar.push(mapaNave, matNave, matGomaTope);

  /* LA NAVE VA A UN LADO DEL CARRIL, no encima.

     Estaba centrada casi en el eje por el que circula el camión y medía 168 m
     de fachada: el camión, que sigue hacia −Z hasta el destino, ATRAVESABA el
     edificio en el capítulo de entrega, y la cámara con él. La prueba de
     encuadre lo cazó por el lado de la cámara —34 cm de holgura contra la
     estructura—, pero el fallo de verdad era el otro: un camión que cruza una
     nave de punta a punta.

     Se estrecha a 96 m con seis muelles, que es una nave de distribución
     perfectamente normal, y se retira 70 m del carril. Ahora el camión pasa
     por delante de los muelles, que es lo que cuenta el capítulo, y el
     edificio entra en el encuadre de costado y creciendo. */
  const ANCHO = 96;           // fachada de muelles, en X
  const FONDO = 72;           // profundidad, en Z
  const ALTO = 13.5;          // al alero
  const zFachada = Z - 34;    // plano de los muelles
  const xNave = X - 70;

  /* ── Explanada ─────────────────────────────────────────────────── */
  const geoExplanada = new THREE.PlaneGeometry(300, 300);
  const explanada = new THREE.Mesh(geoExplanada, matSuelo);
  explanada.rotation.x = -Math.PI / 2;
  explanada.position.set(X - 20, 0.03, Z - 40);
  explanada.receiveShadow = true;
  explanada.userData.envolvente = true;
  grupo.add(explanada);
  aDesechar.push(geoExplanada);

  /* ── Cuerpo de la nave ─────────────────────────────────────────── */
  const geoNave = new THREE.BoxGeometry(ANCHO, ALTO, FONDO);
  const nave = new THREE.Mesh(geoNave, matNave);
  nave.position.set(xNave, ALTO / 2, zFachada - FONDO / 2);
  nave.castShadow = true;
  nave.receiveShadow = true;
  grupo.add(nave);
  aDesechar.push(geoNave);

  /* Cubierta a dos aguas. Un prisma triangular: dos faldones con un cinco por
     ciento de pendiente y un caballete. Es lo que quita de encima la sensación
     de maqueta que deja un techo plano. */
  const cubierta = new THREE.Shape();
  cubierta.moveTo(-FONDO / 2, 0);
  cubierta.lineTo(0, 3.2);
  cubierta.lineTo(FONDO / 2, 0);
  cubierta.closePath();
  const geoCubierta = new THREE.ExtrudeGeometry(cubierta, { depth: ANCHO, bevelEnabled: false });
  geoCubierta.rotateY(Math.PI / 2);
  geoCubierta.translate(-ANCHO / 2, 0, 0);
  const tejado = new THREE.Mesh(geoCubierta, matNave);
  tejado.position.set(xNave, ALTO, zFachada - FONDO / 2);
  tejado.castShadow = true;
  grupo.add(tejado);
  aDesechar.push(geoCubierta);

  // Franja de acento bajo el alero, y el rótulo de la marca
  const geoFranja = new THREE.BoxGeometry(ANCHO + 0.4, 1.5, FONDO + 0.4);
  const franja = new THREE.Mesh(geoFranja, matNaranja);
  franja.position.set(xNave, ALTO - 1.1, zFachada - FONDO / 2);
  grupo.add(franja);
  const geoRotulo = new THREE.BoxGeometry(34, 2.6, 0.4);
  const rotulo = new THREE.Mesh(geoRotulo, matMarca);
  rotulo.position.set(xNave + 30, ALTO - 4.6, zFachada + 0.25);
  grupo.add(rotulo);
  aDesechar.push(geoFranja, geoRotulo);

  /* ── Marquesina de muelles ─────────────────────────────────────── */
  const geoMarquesina = new THREE.BoxGeometry(ANCHO - 12, 0.75, 5.4);
  const marquesina = new THREE.Mesh(geoMarquesina, matNave);
  marquesina.position.set(xNave, 6.6, zFachada + 2.5);
  marquesina.castShadow = true;
  grupo.add(marquesina);
  const geoTirante = new THREE.BoxGeometry(0.16, 3.2, 0.16);
  aDesechar.push(geoMarquesina, geoTirante);

  /* ── Muelles de carga ──────────────────────────────────────────── */
  const puertas = [];
  const lucesMuelle = [];
  const geoHueco = new THREE.BoxGeometry(4.8, 5.0, 0.7);
  const geoPuerta = new THREE.BoxGeometry(4.4, 4.7, 0.2);
  const geoTope = new THREE.BoxGeometry(0.42, 0.55, 0.32);
  const geoAnden = new THREE.BoxGeometry(6.2, 1.25, 2.2);
  const geoNivelador = new THREE.BoxGeometry(2.4, 0.14, 1.9);
  const geoNumero = new THREE.BoxGeometry(0.9, 0.9, 0.1);
  const geoFoco = new THREE.BoxGeometry(0.42, 0.3, 0.5);
  aDesechar.push(geoHueco, geoPuerta, geoTope, geoAnden, geoNivelador, geoNumero, geoFoco);

  const MUELLES = 6;
  const ASIGNADO = 3;                 // el D-14 del panel de seguimiento
  for (let i = 0; i < MUELLES; i++) {
    const px = xNave - 34 + i * 13.6;

    // Andén: la plataforma a la altura de la caja de un camión
    const anden = new THREE.Mesh(geoAnden, matSuelo);
    anden.position.set(px, 0.625, zFachada + 1.1);
    anden.receiveShadow = true;
    anden.castShadow = true;
    grupo.add(anden);

    const hueco = new THREE.Mesh(geoHueco, matOscuro);
    hueco.position.set(px, 3.7, zFachada - 0.15);
    grupo.add(hueco);

    const puerta = new THREE.Mesh(geoPuerta, i === ASIGNADO ? matNaranja : matNave);
    puerta.position.set(px, 3.6, zFachada + 0.18);
    puerta.castShadow = true;
    grupo.add(puerta);
    puertas.push(puerta);

    // Placa niveladora, abatida sobre el andén
    const niv = new THREE.Mesh(geoNivelador, matOscuro);
    niv.position.set(px, 1.3, zFachada + 1.6);
    grupo.add(niv);

    /* Topes de goma. Son dos piezas de cuarenta centímetros y son el detalle
       que más dice «aquí atraca un camión»: están exactamente a la altura del
       faldón trasero de un semirremolque. */
    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(geoTope, matGomaTope);
      t.position.set(px + s * 2.6, 1.05, zFachada + 0.42);
      grupo.add(t);
    }

    // Número de muelle y foco, uno por puerta
    const num = new THREE.Mesh(geoNumero, i === ASIGNADO ? matMarca : matOscuro);
    num.position.set(px - 3.2, 5.3, zFachada + 0.22);
    grupo.add(num);

    const foco = new THREE.Mesh(geoFoco, luminoso(0xffe6b8, 0.6));
    foco.position.set(px + 3.1, 6.1, zFachada + 0.5);
    grupo.add(foco);
    lucesMuelle.push(foco);

    const tir = new THREE.Mesh(geoTirante, matNave);
    tir.position.set(px + 6.3, 7.9, zFachada + 1.4);
    tir.rotation.x = 0.5;
    grupo.add(tir);
  }

  /* ── Bloque de oficinas ────────────────────────────────────────── */
  const geoOficina = new THREE.BoxGeometry(30, 8.4, 16);
  const oficina = new THREE.Mesh(geoOficina, matNave);
  oficina.position.set(xNave - 62, 4.2, zFachada + 5);
  oficina.castShadow = true;
  oficina.receiveShadow = true;
  grupo.add(oficina);
  const geoVentanal = new THREE.BoxGeometry(27, 1.9, 0.2);
  for (let piso = 0; piso < 2; piso++) {
    const v = new THREE.Mesh(geoVentanal, cristal(0x16232e));
    v.position.set(xNave - 62, 2.6 + piso * 3.5, zFachada + 13.1);
    grupo.add(v);
  }
  const geoAleroOf = new THREE.BoxGeometry(31, 0.5, 17);
  const aleroOf = new THREE.Mesh(geoAleroOf, matNaranja);
  aleroOf.position.set(xNave - 62, 8.6, zFachada + 5);
  grupo.add(aleroOf);
  aDesechar.push(geoOficina, geoVentanal, geoAleroOf);

  /* ── Semirremolques estacionados ───────────────────────────────────
     Cuatro contra los muelles y tres en el patio. Son cajas, y ahí sí está
     bien que lo sean: nadie las mira. Lo que aportan es la unidad de medida
     —13,6 metros— repetida por todo el recinto, que es lo que hace legible el
     tamaño de la nave sin tener que decirlo. */
  const geoCaja = new THREE.BoxGeometry(13.6, 4.1, 2.55);
  const geoTren = new THREE.BoxGeometry(2.6, 0.9, 2.3);
  aDesechar.push(geoCaja, geoTren);
  const ponRemolque = (x, z, giro, color) => {
    const r = new THREE.Group();
    const c = new THREE.Mesh(geoCaja, color);
    c.position.y = 3.1;
    c.castShadow = true;
    r.add(c);
    const t = new THREE.Mesh(geoTren, matOscuro);
    t.position.set(-4.6, 0.7, 0);
    r.add(t);
    r.position.set(x, 0, z);
    r.rotation.y = giro;
    grupo.add(r);
  };
  for (let i = 0; i < MUELLES; i++) {
    if (i === ASIGNADO || i % 3 === 1) continue;
    const px = xNave - 34 + i * 13.6;
    ponRemolque(px, zFachada + 9.4, Math.PI / 2, i % 2 ? matNave : matNaranja);
  }
  /* Los del patio, TODOS al lado contrario del carril del camión.
     Estaban repartidos de x −32 a x 19, y el camión sale del recinto por x 20:
     la cámara del arranque del capítulo de entrega atravesaba uno de ellos —30
     cm de holgura en escritorio, 16 en tableta, medido por la prueba de
     encuadre—. Un patio de verdad tampoco aparca en mitad de la calle de
     circulación. */
  for (let i = 0; i < 4; i++) {
    ponRemolque(xNave - 34 + i * 14, zFachada + 52, Math.PI / 2 + 0.28, matNave);
  }

  /* ── Torres de alumbrado del patio ─────────────────────────────── */
  const geoMastil = new THREE.CylinderGeometry(0.24, 0.42, 22, 8);
  const geoCabeza = new THREE.BoxGeometry(4.2, 0.5, 1.6);
  aDesechar.push(geoMastil, geoCabeza);
  /* Van a los EXTREMOS del patio, no repartidas por él.
     Estaban cada 44 metros a lo ancho y una de ellas caía justo en el eje por
     el que la cámara entra en el capítulo de entrega: un mástil de veintidós
     metros plantado en mitad del cuadro, tapando el plano de pago de todo el
     recorrido. La prueba de encuadre lo cazó midiendo 0,35 m de holgura. Las
     torres de un patio de verdad van en el perímetro de todas formas, que es
     donde no estorban a los camiones —ni, resulta, a la cámara—. */
  const focosPatio = [];
  for (let i = 0; i < 4; i++) {
    const px = xNave + (i < 2 ? -58 - i * 22 : 46 + (i - 2) * 16);
    const m = new THREE.Mesh(geoMastil, matOscuro);
    m.position.set(px, 11, zFachada + 30);
    m.castShadow = true;
    grupo.add(m);
    const c = new THREE.Mesh(geoCabeza, luminoso(0xfff0cf, 0.5));
    c.position.set(px, 22.1, zFachada + 30);
    grupo.add(c);
    focosPatio.push(c);
  }

  /* ── Marcas de patio ───────────────────────────────────────────── */
  const geoLinea = new THREE.PlaneGeometry(0.2, 17);
  const lineas = new THREE.InstancedMesh(geoLinea, matMarca, MUELLES + 1);
  const dummy = new THREE.Object3D();
  for (let i = 0; i <= MUELLES; i++) {
    dummy.position.set(xNave - 40.8 + i * 13.6, 0.05, zFachada + 12);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    lineas.setMatrixAt(i, dummy.matrix);
  }
  lineas.frustumCulled = false;
  grupo.add(lineas);
  aDesechar.push(geoLinea);

  /* ── Carretillas ───────────────────────────────────────────────── */
  const geoCarretilla = new THREE.BoxGeometry(1.35, 2.1, 2.6);
  aDesechar.push(geoCarretilla);
  const carretillas = new THREE.InstancedMesh(geoCarretilla, matNaranja, 8);
  const bases = [];
  for (let i = 0; i < 8; i++) {
    bases.push({
      x: xNave - 40 + azar() * 80,
      z: zFachada + 6 + azar() * 16,
      fase: azar() * 6.28,
      radio: 3 + azar() * 8,
    });
  }
  carretillas.castShadow = true;
  carretillas.frustumCulled = false;
  grupo.add(carretillas);

  /* ── Control de acceso ─────────────────────────────────────────── */
  const geoPortico = new THREE.BoxGeometry(0.42, 0.42, 13);
  const portico = new THREE.Mesh(geoPortico, matOscuro);
  portico.position.set(X, 6.3, Z + 46);
  grupo.add(portico);
  const geoPataP = new THREE.BoxGeometry(0.42, 6.3, 0.42);
  for (const s of [-1, 1]) {
    const pata = new THREE.Mesh(geoPataP, matOscuro);
    pata.position.set(X + s * 6.3, 3.15, Z + 46);
    grupo.add(pata);
  }
  const geoCaseta = new THREE.BoxGeometry(3.4, 3, 3);
  const caseta = new THREE.Mesh(geoCaseta, matNave);
  caseta.position.set(X + 9.5, 1.5, Z + 46);
  caseta.castShadow = true;
  grupo.add(caseta);
  aDesechar.push(geoPortico, geoPataP, geoCaseta);

  /* Valla perimetral: cierra el recinto y, sobre todo, da una línea
     horizontal que corre al entrar. */
  const geoValla = new THREE.BoxGeometry(0.1, 2.4, 6);
  aDesechar.push(geoValla);
  const valla = new THREE.InstancedMesh(geoValla, matOscuro, 44);
  let nv = 0;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 22; i++) {
      dummy.position.set(X + (s < 0 ? -128 : 96), 1.2, Z + 52 - i * 6);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      valla.setMatrixAt(nv++, dummy.matrix);
    }
  }
  valla.count = nv;
  valla.frustumCulled = false;
  grupo.add(valla);

  grupo.userData.actualizar = (mundo, reloj) => {
    const c = mundo.centro;
    /* Las puertas suben, y la del muelle asignado antes que las demás: es lo
       que dirige la mirada al sitio donde va a pasar algo. */
    puertas.forEach((p, i) => {
      const propia = i === ASIGNADO ? 1 : 0.42;
      const abre = Math.min(1, c.puertas * propia);
      p.position.y = 3.6 + abre * 4.4;
      p.visible = abre < 0.985;
    });
    // El alumbrado se enciende con la caída de la luz, no con un interruptor
    const noche = Math.max(0, 1 - mundo.ambiente.alturaSol * 2.6);
    for (const f of lucesMuelle) f.material.emissiveIntensity = 0.25 + noche * 1.5;
    for (const f of focosPatio) f.material.emissiveIntensity = 0.2 + noche * 1.9;

    for (let i = 0; i < bases.length; i++) {
      const b = bases[i];
      const a = reloj * 0.28 + b.fase;
      dummy.position.set(b.x + Math.cos(a) * b.radio, 1.05, b.z + Math.sin(a * 0.8) * b.radio * 0.5);
      dummy.rotation.set(0, -a, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      carretillas.setMatrixAt(i, dummy.matrix);
    }
    carretillas.instanceMatrix.needsUpdate = true;
  };
  grupo.userData.liberar = () => aDesechar.forEach((o) => o.dispose?.());
  return grupo;
}

/** El destino: una plataforma de cliente, al atardecer. */
export function crearDestino() {
  const grupo = new THREE.Group();
  const aDesechar = [];
  const X = MEDIDAS.gruaX;
  const Z = MEDIDAS.destino;

  /* ── LA RECOMPENSA ────────────────────────────────────────────────
     Era una caja de 90 × 11 × 44 con una franja naranja y cinco rayas de
     aparcamiento. Después de ocho capítulos siguiendo un contenedor medio
     planeta, el viaje terminaba delante de un bloque.

     Un final tiene que PAGAR algo, y lo que este recorrido debe pagar es muy
     concreto: que la caja llegue y se abra. Así que aquí hay tres cosas que no
     había, y las tres se encienden con la llegada del camión:

       · una MARQUESINA de recepción con su muelle, que enmarca la maniobra;
       · dos puertas que se ABREN, con el interior iluminado detrás. Un hueco
         negro no cuenta nada; un hueco con luz dentro cuenta que hay alguien
         esperando;
       · palés, transpaleta y una carretilla en el delantal, que es lo que
         explica para qué ha venido el camión.

     Y el edificio se retiró dieciocho metros. Además de dejar respirar la
     maniobra, resuelve un fallo medido: la cámara del plano final, al
     compensar una pantalla estrecha, retrocedía hasta tocar la fachada —siete
     centímetros de holgura en tableta—. */

  const mapaNave = texturaNave('#cdd3d8');
  const matNave = new THREE.MeshStandardMaterial({
    map: mapaNave, roughness: 0.72, metalness: 0.22,
    normalMap: aceroPintado('#cdd3d8', { semilla: 61 }).normalMap,
    normalScale: new THREE.Vector2(0.4, 0.4),
  });
  const matSuelo = hormigon(0x5d6167, 18);
  const matNaranja = aceroPintado('#c85a1e', { semilla: 62, rugosidad: 0.58, metal: 0.25 });
  const matOscuro = aceroPintado('#232930', { semilla: 63, rugosidad: 0.6, metal: 0.5 });
  const matMarca = pintura(0xe6e9ea);
  const matGomaTope = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.95 });
  aDesechar.push(mapaNave, matNave, matGomaTope);

  const zFachada = Z - 40;

  const geoSuelo = new THREE.PlaneGeometry(180, 200);
  const suelo = new THREE.Mesh(geoSuelo, matSuelo);
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.set(X, 0.03, Z - 36);
  suelo.receiveShadow = true;
  suelo.userData.envolvente = true;
  grupo.add(suelo);
  aDesechar.push(geoSuelo);

  /* Cuerpo, con su cubierta inclinada y su franja. */
  const geoNave = new THREE.BoxGeometry(94, 11.5, 46);
  const nave = new THREE.Mesh(geoNave, matNave);
  nave.position.set(X - 4, 5.75, zFachada - 23);
  nave.castShadow = true;
  nave.receiveShadow = true;
  grupo.add(nave);

  const faldon = new THREE.Shape();
  faldon.moveTo(-23, 0);
  faldon.lineTo(0, 2.4);
  faldon.lineTo(23, 0);
  faldon.closePath();
  const geoCubierta = new THREE.ExtrudeGeometry(faldon, { depth: 94, bevelEnabled: false });
  geoCubierta.rotateY(Math.PI / 2);
  geoCubierta.translate(-47, 0, 0);
  const tejado = new THREE.Mesh(geoCubierta, matNave);
  tejado.position.set(X - 4, 11.5, zFachada - 23);
  tejado.castShadow = true;
  grupo.add(tejado);

  const geoFranja = new THREE.BoxGeometry(94.4, 1.2, 46.4);
  const franja = new THREE.Mesh(geoFranja, matNaranja);
  franja.position.set(X - 4, 10.2, zFachada - 23);
  grupo.add(franja);
  aDesechar.push(geoNave, geoCubierta, geoFranja);

  /* ── Marquesina de recepción ───────────────────────────────────── */
  const geoMarquesina = new THREE.BoxGeometry(34, 0.7, 6.4);
  const marquesina = new THREE.Mesh(geoMarquesina, matNave);
  marquesina.position.set(X - 2, 6.4, zFachada + 3);
  marquesina.castShadow = true;
  grupo.add(marquesina);
  const geoPilarM = new THREE.CylinderGeometry(0.18, 0.18, 6.4, 8);
  for (const dx of [-16, 16]) {
    const p = new THREE.Mesh(geoPilarM, matOscuro);
    p.position.set(X - 2 + dx, 3.2, zFachada + 5.8);
    p.castShadow = true;
    grupo.add(p);
  }
  aDesechar.push(geoMarquesina, geoPilarM);

  /* ── Las dos puertas, y lo que hay detrás ──────────────────────────
     El interior es una sola superficie emisiva un metro por dentro del hueco.
     No es un almacén modelado y no hace falta que lo sea: lo único que tiene
     que decir es que dentro hay luz y alguien esperando, y eso lo dice una
     mancha cálida en un hueco que se abre. */
  const puertas = [];
  const interiores = [];
  const geoHueco = new THREE.BoxGeometry(5.2, 5.4, 1.2);
  const geoPuerta = new THREE.BoxGeometry(4.9, 5.1, 0.18);
  const geoInterior = new THREE.PlaneGeometry(4.9, 5.1);
  const geoAnden = new THREE.BoxGeometry(7, 1.25, 2.4);
  const geoTope = new THREE.BoxGeometry(0.44, 0.58, 0.34);
  aDesechar.push(geoHueco, geoPuerta, geoInterior, geoAnden, geoTope);

  for (const dx of [-7.5, 7.5]) {
    const px = X - 2 + dx;
    const anden = new THREE.Mesh(geoAnden, matSuelo);
    anden.position.set(px, 0.625, zFachada + 1.2);
    anden.receiveShadow = true;
    anden.castShadow = true;
    grupo.add(anden);

    const hueco = new THREE.Mesh(geoHueco, matOscuro);
    hueco.position.set(px, 3.95, zFachada - 0.4);
    grupo.add(hueco);

    const dentro = new THREE.Mesh(geoInterior, luminoso(0xffd9a0, 0));
    dentro.position.set(px, 3.9, zFachada - 0.95);
    grupo.add(dentro);
    interiores.push(dentro);

    const puerta = new THREE.Mesh(geoPuerta, matNave);
    puerta.position.set(px, 3.85, zFachada + 0.2);
    puerta.castShadow = true;
    grupo.add(puerta);
    puertas.push(puerta);

    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(geoTope, matGomaTope);
      t.position.set(px + s * 2.8, 1.05, zFachada + 0.5);
      grupo.add(t);
    }
  }

  /* ── El delantal: palés, transpaleta y carretilla ────────────────── */
  const geoPale = new THREE.BoxGeometry(1.2, 0.16, 1.0);
  const geoCarga = new THREE.BoxGeometry(1.1, 1.05, 0.92);
  const matPale = new THREE.MeshStandardMaterial({ color: 0x8a6a3f, roughness: 0.95 });
  const matCarga = new THREE.MeshStandardMaterial({ color: 0x9aa3ac, roughness: 0.88 });
  aDesechar.push(geoPale, geoCarga, matPale, matCarga);
  const azar = azarCon(913);
  const dummy = new THREE.Object3D();
  const PALES = 9;
  const mallaPale = new THREE.InstancedMesh(geoPale, matPale, PALES);
  const mallaCarga = new THREE.InstancedMesh(geoCarga, matCarga, PALES);
  for (let i = 0; i < PALES; i++) {
    const px = X - 20 + (i % 5) * 2.1 + azar() * 0.4;
    const pz = zFachada + 8 + Math.floor(i / 5) * 2.3 + azar() * 0.5;
    dummy.rotation.set(0, azar() * 0.3 - 0.15, 0);
    dummy.scale.setScalar(1);
    dummy.position.set(px, 0.08, pz);
    dummy.updateMatrix();
    mallaPale.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 0.68;
    dummy.updateMatrix();
    mallaCarga.setMatrixAt(i, dummy.matrix);
  }
  mallaPale.castShadow = mallaCarga.castShadow = true;
  mallaPale.frustumCulled = mallaCarga.frustumCulled = false;
  grupo.add(mallaPale, mallaCarga);

  const geoCarretilla = new THREE.BoxGeometry(1.3, 2, 2.5);
  const carretilla = new THREE.Mesh(geoCarretilla, matNaranja);
  carretilla.position.set(X + 13, 1, zFachada + 11);
  carretilla.rotation.y = -0.5;
  carretilla.castShadow = true;
  grupo.add(carretilla);
  aDesechar.push(geoCarretilla);

  /* ── Rótulo y marcas de aparcamiento ───────────────────────────── */
  const geoRotulo = new THREE.BoxGeometry(22, 2.2, 0.35);
  const rotulo = new THREE.Mesh(geoRotulo, matMarca);
  rotulo.position.set(X - 2, 8.6, zFachada + 0.3);
  grupo.add(rotulo);
  aDesechar.push(geoRotulo);

  const geoMarca = new THREE.PlaneGeometry(0.22, 18);
  const marcas = new THREE.InstancedMesh(geoMarca, matMarca, 5);
  for (let i = -2; i <= 2; i++) {
    dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    dummy.scale.setScalar(1);
    dummy.position.set(X + i * 4.2, 0.06, Z + 4);
    dummy.updateMatrix();
    marcas.setMatrixAt(i + 2, dummy.matrix);
  }
  marcas.frustumCulled = false;
  marcas.userData.envolvente = true;
  grupo.add(marcas);
  aDesechar.push(geoMarca);

  /* ── Dos focos de patio, en el perímetro ───────────────────────── */
  const geoMastil = new THREE.CylinderGeometry(0.2, 0.34, 16, 8);
  const geoCabeza = new THREE.BoxGeometry(3, 0.4, 1.3);
  aDesechar.push(geoMastil, geoCabeza);
  const focos = [];
  for (const dx of [-46, 42]) {
    const m = new THREE.Mesh(geoMastil, matOscuro);
    m.position.set(X + dx, 8, zFachada + 18);
    m.castShadow = true;
    grupo.add(m);
    const c = new THREE.Mesh(geoCabeza, luminoso(0xfff0cf, 0.4));
    c.position.set(X + dx, 16.1, zFachada + 18);
    grupo.add(c);
    focos.push(c);
  }

  /* La llegada lo enciende todo. `entregado` sale del guion, así que abrir las
     puertas es tan reversible como el resto del recorrido: subiendo, se
     cierran. */
  grupo.userData.actualizar = (mundo) => {
    const llega = clamp((mundo.camion.z - (MEDIDAS.destino + 60)) / -60);
    const abre = mundo.camion.entregado ? 1 : llega;
    puertas.forEach((p, i) => {
      const a = clamp(abre * (i === 0 ? 1 : 0.85));
      p.position.y = 3.85 + a * 4.8;
      p.visible = a < 0.985;
    });
    for (const d of interiores) d.material.emissiveIntensity = abre * 1.7;
    const noche = Math.max(0, 1 - mundo.ambiente.alturaSol * 2.6);
    for (const f of focos) f.material.emissiveIntensity = 0.2 + noche * 1.9;
  };

  grupo.userData.liberar = () => aDesechar.forEach((o) => o.dispose?.());
  return grupo;
}
