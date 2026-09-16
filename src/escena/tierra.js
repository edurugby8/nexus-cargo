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
import { azarCon, lerp } from '../lib/util.js';
import { crearPilas } from './contenedor.js';
import {
  texturaHormigon, texturaAsfalto, texturaChapa, texturaNave, texturaMancha,
} from './texturas.js';

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

  const mapa = texturaAsfalto();
  const matAsfalto = new THREE.MeshStandardMaterial({ map: mapa, roughness: 0.92, metalness: 0.03 });
  const matTierra = new THREE.MeshStandardMaterial({ color: 0x4a4636, roughness: 0.98 });
  const matGuardarrail = new THREE.MeshStandardMaterial({ color: 0xa9b1b8, roughness: 0.48, metalness: 0.7 });
  const matPoste = new THREE.MeshStandardMaterial({ color: 0x585e66, roughness: 0.7, metalness: 0.4 });
  const matVerde = new THREE.MeshStandardMaterial({ color: 0x3c5236, roughness: 0.95 });
  aDesechar.push(mapa, matAsfalto, matTierra, matGuardarrail, matPoste, matVerde);

  const geoCalzada = new THREE.PlaneGeometry(13, largo);
  const calzada = new THREE.Mesh(geoCalzada, matAsfalto);
  calzada.rotation.x = -Math.PI / 2;
  calzada.position.set(X, 0.02, (desde + hasta) / 2);
  calzada.receiveShadow = true;
  grupo.add(calzada);
  aDesechar.push(geoCalzada);

  /* El arcén, MUY ancho. Con noventa metros el terreno terminaba en un canto
     recto a media distancia y se veía el borde del mundo; con ochocientos, la
     niebla se lo come mucho antes de que llegue a notarse. */
  const geoArcen = new THREE.PlaneGeometry(800, largo);
  const arcen = new THREE.Mesh(geoArcen, matTierra);
  arcen.rotation.x = -Math.PI / 2;
  arcen.position.set(X, -0.02, (desde + hasta) / 2);
  arcen.receiveShadow = true;
  grupo.add(arcen);
  aDesechar.push(geoArcen);

  /* Mobiliario instanciado.
     Es lo que cuenta la velocidad: pasa cerca, pasa rápido y pasa seguido.
     Es la lección de las hojas cercanas de Umbría trasladada a la carretera —
     lo que da sensación de marcha no es el vehículo, es lo que le pasa al
     lado—. */
  const dummy = new THREE.Object3D();
  const cuantos = Math.round(caps.carretera);

  const geoPosteRail = new THREE.BoxGeometry(0.12, 0.8, 0.12);
  const geoRail = new THREE.BoxGeometry(0.06, 0.32, 4.2);
  aDesechar.push(geoPosteRail, geoRail);
  const rails = new THREE.InstancedMesh(geoRail, matGuardarrail, cuantos * 2);
  const postes = new THREE.InstancedMesh(geoPosteRail, matPoste, cuantos * 2);
  let n = 0;
  for (let i = 0; i < cuantos; i++) {
    const z = desde - (i / cuantos) * largo;
    for (const s of [-1, 1]) {
      dummy.position.set(X + s * 7.6, 0.92, z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      rails.setMatrixAt(n, dummy.matrix);
      dummy.position.y = 0.4;
      dummy.updateMatrix();
      postes.setMatrixAt(n, dummy.matrix);
      n++;
    }
  }
  rails.count = postes.count = n;
  rails.castShadow = postes.castShadow = true;
  rails.frustumCulled = postes.frustumCulled = false;
  grupo.add(rails, postes);

  // Farolas: van a un lado, altas, y pasan muy cerca del objetivo
  const geoFarola = new THREE.CylinderGeometry(0.11, 0.17, 9, 6);
  const geoBrazoF = new THREE.BoxGeometry(0.12, 0.12, 2.2);
  aDesechar.push(geoFarola, geoBrazoF);
  const farolas = Math.round(cuantos / 6);
  const mallaFarola = new THREE.InstancedMesh(geoFarola, matPoste, farolas);
  const mallaBrazo = new THREE.InstancedMesh(geoBrazoF, matPoste, farolas);
  for (let i = 0; i < farolas; i++) {
    const z = desde - (i / farolas) * largo - 12;
    dummy.position.set(X + 9.4, 4.5, z);
    dummy.rotation.set(0, 0, 0);
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
  const matas = new THREE.InstancedMesh(geoMata, matVerde, cuantos * 2);
  for (let i = 0; i < cuantos * 2; i++) {
    const z = desde - azar() * largo;
    const s = azar() > 0.5 ? 1 : -1;
    dummy.position.set(X + s * (11 + azar() * 24), 0.5 + azar() * 0.9, z);
    dummy.scale.setScalar(0.6 + azar() * 1.5);
    dummy.rotation.set(0, azar() * 3, 0);
    dummy.updateMatrix();
    matas.setMatrixAt(i, dummy.matrix);
  }
  matas.castShadow = true;
  matas.frustumCulled = false;
  grupo.add(matas);

  // Señalización: pórticos y carteles
  const geoPortico = new THREE.BoxGeometry(0.3, 0.3, 18);
  const geoPataP = new THREE.BoxGeometry(0.3, 7.2, 0.3);
  const geoCartel = new THREE.BoxGeometry(0.16, 2.6, 5.4);
  const matCartel = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.65 });
  aDesechar.push(geoPortico, geoPataP, geoCartel, matCartel);
  for (let i = 0; i < 5; i++) {
    const z = desde - 70 - i * (largo / 5.6);
    const p = new THREE.Mesh(geoPortico, matPoste);
    p.position.set(X, 7.2, z);
    p.castShadow = true;
    grupo.add(p);
    for (const s of [-1, 1]) {
      const pata = new THREE.Mesh(geoPataP, matPoste);
      pata.position.set(X + s * 8.8, 3.6, z);
      grupo.add(pata);
    }
    const c = new THREE.Mesh(geoCartel, matCartel);
    c.position.set(X - 2.2, 5.6, z);
    c.castShadow = true;
    grupo.add(c);
  }

  /* Un paso superior. Pasar por debajo de una estructura es de las cosas que
     mejor cuentan la velocidad: el cambio de luz es instantáneo. */
  const zPuente = MEDIDAS.carretera.desde - 210;
  const matHormigon = new THREE.MeshStandardMaterial({ color: 0x8e9196, roughness: 0.9 });
  aDesechar.push(matHormigon);
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

  const mapaNave = texturaNave('#c2c8ce');
  const matNave = new THREE.MeshStandardMaterial({ map: mapaNave, roughness: 0.74, metalness: 0.22 });
  const matSuelo = new THREE.MeshStandardMaterial({ color: 0x53575d, roughness: 0.93 });
  const matOscuro = new THREE.MeshStandardMaterial({ color: 0x242a31, roughness: 0.6, metalness: 0.5 });
  const matNaranja = new THREE.MeshStandardMaterial({ color: 0xc85a1e, roughness: 0.6, metalness: 0.25 });
  aDesechar.push(mapaNave, matNave, matSuelo, matOscuro, matNaranja);

  const geoExplanada = new THREE.PlaneGeometry(220, 260);
  const explanada = new THREE.Mesh(geoExplanada, matSuelo);
  explanada.rotation.x = -Math.PI / 2;
  explanada.position.set(X, 0.03, Z - 40);
  explanada.receiveShadow = true;
  grupo.add(explanada);
  aDesechar.push(geoExplanada);

  // La nave: 160 × 70 × 14. Grande de verdad, que es de lo que habla el texto.
  const geoNave = new THREE.BoxGeometry(160, 14, 70);
  const nave = new THREE.Mesh(geoNave, matNave);
  nave.position.set(X - 10, 7, Z - 70);
  nave.castShadow = true;
  nave.receiveShadow = true;
  grupo.add(nave);
  aDesechar.push(geoNave);

  // Franja de acento y rótulo
  const geoFranja = new THREE.BoxGeometry(160.4, 1.4, 70.4);
  const franja = new THREE.Mesh(geoFranja, matNaranja);
  franja.position.set(X - 10, 12.6, Z - 70);
  grupo.add(franja);
  aDesechar.push(geoFranja);

  /* Muelles de carga con sus puertas seccionales. Se abren cuando llega el
     camión, que es lo que hace que el edificio parezca vivo. */
  const puertas = [];
  const geoHueco = new THREE.BoxGeometry(4.6, 4.8, 0.5);
  const geoPuerta = new THREE.BoxGeometry(4.4, 4.6, 0.22);
  const geoTope = new THREE.BoxGeometry(0.5, 0.35, 0.6);
  aDesechar.push(geoHueco, geoPuerta, geoTope);
  for (let i = 0; i < 9; i++) {
    const px = X - 52 + i * 11;
    const hueco = new THREE.Mesh(geoHueco, matOscuro);
    hueco.position.set(px, 2.5, Z - 35.2);
    grupo.add(hueco);
    const puerta = new THREE.Mesh(geoPuerta, i === 4 ? matNaranja : matNave);
    puerta.position.set(px, 2.4, Z - 34.9);
    puerta.castShadow = true;
    grupo.add(puerta);
    puertas.push(puerta);
    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(geoTope, matOscuro);
      t.position.set(px + s * 2.5, 1.2, Z - 34.6);
      grupo.add(t);
    }
  }

  // Vehículos de patio: masas simples que dan actividad sin coste
  const geoCarretilla = new THREE.BoxGeometry(1.6, 1.8, 2.6);
  aDesechar.push(geoCarretilla);
  const carretillas = new THREE.InstancedMesh(geoCarretilla, matNaranja, 7);
  const dummy = new THREE.Object3D();
  const azar = azarCon(661);
  const bases = [];
  for (let i = 0; i < 7; i++) {
    bases.push({ x: X - 45 + azar() * 80, z: Z - 20 - azar() * 12, fase: azar() * 6.28, radio: 3 + azar() * 7 });
  }
  carretillas.castShadow = true;
  carretillas.frustumCulled = false;
  grupo.add(carretillas);

  // Cámara de lectura de matrícula, en la entrada
  const geoPortico = new THREE.BoxGeometry(0.4, 0.4, 12);
  const portico = new THREE.Mesh(geoPortico, matOscuro);
  portico.position.set(X, 6.2, Z + 26);
  grupo.add(portico);
  for (const s of [-1, 1]) {
    const pata = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6.2, 0.4), matOscuro);
    pata.position.set(X + s * 5.8, 3.1, Z + 26);
    grupo.add(pata);
    aDesechar.push(pata.geometry);
  }
  aDesechar.push(geoPortico);

  grupo.userData.actualizar = (mundo, reloj) => {
    const c = mundo.centro;
    // Las puertas suben: la del muelle asignado, antes que las demás
    puertas.forEach((p, i) => {
      const propia = i === 4 ? 1 : 0.35;
      const abre = Math.min(1, c.puertas * propia * (i === 4 ? 1 : 0.7));
      p.position.y = 2.4 + abre * 4.3;
      p.visible = abre < 0.99;
    });
    for (let i = 0; i < bases.length; i++) {
      const b = bases[i];
      const a = reloj * 0.28 + b.fase;
      dummy.position.set(b.x + Math.cos(a) * b.radio, 0.9, b.z + Math.sin(a * 0.8) * b.radio * 0.5);
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

  const mapaNave = texturaNave('#cdd3d8');
  const matNave = new THREE.MeshStandardMaterial({ map: mapaNave, roughness: 0.76, metalness: 0.2 });
  const matSuelo = new THREE.MeshStandardMaterial({ color: 0x4e5258, roughness: 0.94 });
  const matNaranja = new THREE.MeshStandardMaterial({ color: 0xc85a1e, roughness: 0.6 });
  aDesechar.push(mapaNave, matNave, matSuelo, matNaranja);

  const geoSuelo = new THREE.PlaneGeometry(160, 180);
  const suelo = new THREE.Mesh(geoSuelo, matSuelo);
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.set(X, 0.03, Z - 30);
  suelo.receiveShadow = true;
  grupo.add(suelo);
  aDesechar.push(geoSuelo);

  const geoNave = new THREE.BoxGeometry(90, 11, 44);
  const nave = new THREE.Mesh(geoNave, matNave);
  nave.position.set(X - 4, 5.5, Z - 46);
  nave.castShadow = true;
  nave.receiveShadow = true;
  grupo.add(nave);
  const geoFranja = new THREE.BoxGeometry(90.4, 1.1, 44.4);
  const franja = new THREE.Mesh(geoFranja, matNaranja);
  franja.position.set(X - 4, 9.9, Z - 46);
  grupo.add(franja);
  aDesechar.push(geoNave, geoFranja);

  // Marcas de aparcamiento: es lo que explica dónde va a parar el camión
  const geoMarca = new THREE.PlaneGeometry(0.22, 18);
  const matMarca = new THREE.MeshBasicMaterial({ color: 0xe6e8ea, transparent: true, opacity: 0.45 });
  aDesechar.push(geoMarca, matMarca);
  for (let i = -2; i <= 2; i++) {
    const m = new THREE.Mesh(geoMarca, matMarca);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.PI / 2;
    m.position.set(X + i * 4.2, 0.06, Z + 2);
    grupo.add(m);
  }

  grupo.userData.liberar = () => aDesechar.forEach((o) => o.dispose?.());
  return grupo;
}
