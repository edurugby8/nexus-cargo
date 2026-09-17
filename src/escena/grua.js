/**
 * La grúa pórtico de muelle (ship-to-shore).
 *
 * 82 metros hasta la punta del pórtico, 78 de voladizo sobre el agua y 30,5
 * entre carriles. Es la pieza que da la escala monumental de todo el puerto, y
 * la única que el visitante ve funcionar de principio a fin.
 *
 * Lo que hace que se lea como una máquina de verdad no es el detalle, son tres
 * cosas: que el carro arranque y frene con su peso, que los CABLES cuelguen
 * del carro y se inclinen cuando la carga pendulea —no que sean barras
 * rígidas— y que el spreader encaje antes de tensar.
 */

import * as THREE from 'three';
import { MEDIDAS } from './ruta.js';
import { clamp, lerp } from '../lib/util.js';
import { texturaChapa } from './texturas.js';

const G = MEDIDAS.grua;

/**
 * Celosía: dos cordones y sus diagonales. Barata y se lee a un kilómetro.
 *
 * Los cordones medían medio metro. En una viga de ciento cuatro metros eso es
 * un hilo: a la distancia a la que se ve la grúa quedaban en menos de un píxel
 * y el pórtico se leía como un dibujo de alambre flotando sobre el puerto, no
 * como ocho mil toneladas de acero. El cordón de una viga cajón de este
 * tamaño anda por el metro y medio, y con esa medida la estructura por fin
 * pesa.
 */
function celosia(largo, canto, tramos, material, eje = 'x') {
  const grupo = new THREE.Group();
  const geoCordon = eje === 'x'
    ? new THREE.BoxGeometry(largo, 1.5, 1.5)
    : new THREE.BoxGeometry(1.5, largo, 1.5);
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(geoCordon, material);
    if (eje === 'x') c.position.y = s * canto / 2; else c.position.x = s * canto / 2;
    c.castShadow = true;
    grupo.add(c);
  }
  const paso = largo / tramos;
  const diag = Math.hypot(paso, canto);
  const geoDiag = new THREE.BoxGeometry(diag, 0.65, 0.65);
  for (let i = 0; i < tramos; i++) {
    const d = new THREE.Mesh(geoDiag, material);
    const centro = -largo / 2 + paso * (i + 0.5);
    const ang = Math.atan2(canto, paso) * (i % 2 ? 1 : -1);
    if (eje === 'x') { d.position.set(centro, 0, 0); d.rotation.z = ang; }
    else { d.position.set(0, centro, 0); d.rotation.z = Math.PI / 2 - ang; }
    grupo.add(d);
  }
  grupo.userData.geos = [geoCordon, geoDiag];
  return grupo;
}

/**
 * Una grúa. `activa` marca la que trabaja nuestro contenedor: sólo ésa lleva
 * carro y spreader animados; las demás son silueta y ahorran todo el trabajo.
 */
export function crearGrua({ x, activa = false, caps }) {
  const grupo = new THREE.Group();
  grupo.position.x = x;
  const aDesechar = [];

  const mapa = texturaChapa('#7d8792', 11, 0.6);
  mapa.repeat.set(3, 3);
  const matEstructura = new THREE.MeshStandardMaterial({ map: mapa, roughness: 0.68, metalness: 0.45 });
  /* El acento de la grúa NO es naranja, y es una decisión de legibilidad, no
     de gusto. El contenedor protagonista es naranja, y con el carro, la casa
     de máquinas y el spreader del mismo color, en un plano general del puerto
     había cuatro cosas naranjas y ninguna forma de saber cuál era la que hay
     que seguir. Ahora el naranja es exclusivo del NXCU 482019: en todo el
     recorrido no hay otra cosa de ese color, así que localizarlo es
     instantáneo aunque la cámara esté a doscientos metros. */
  const matAcento = new THREE.MeshStandardMaterial({ color: 0x2f6f86, roughness: 0.6, metalness: 0.35 });
  const matOscuro = new THREE.MeshStandardMaterial({ color: 0x232a33, roughness: 0.5, metalness: 0.7 });
  aDesechar.push(mapa, matEstructura, matAcento, matOscuro);

  // Patas del pórtico: cuatro, a ambos lados de la vía
  const geoPata = new THREE.BoxGeometry(2.6, G.alto - 20, 2.6);
  aDesechar.push(geoPata);
  const zPata = [MEDIDAS.muelle - 4, MEDIDAS.muelle - 4 - G.via];
  for (const z of zPata) {
    for (const dx of [-7, 7]) {
      const pata = new THREE.Mesh(geoPata, matEstructura);
      pata.position.set(dx, (G.alto - 20) / 2, z);
      pata.castShadow = true;
      grupo.add(pata);
    }
    // Carro de traslación y ruedas sobre el carril
    const geoBogie = new THREE.BoxGeometry(18, 1.8, 2.6);
    const bogie = new THREE.Mesh(geoBogie, matOscuro);
    bogie.position.set(0, 0.9, z);
    bogie.castShadow = true;
    grupo.add(bogie);
    aDesechar.push(geoBogie);
  }

  // Travesaños entre patas
  const geoTrav = new THREE.BoxGeometry(16, 1.9, 1.9);
  aDesechar.push(geoTrav);
  for (const z of zPata) {
    for (const y of [G.alto - 24, (G.alto - 20) * 0.45]) {
      const t = new THREE.Mesh(geoTrav, matEstructura);
      t.position.set(0, y, z);
      grupo.add(t);
    }
  }

  // Viga superior: del voladizo sobre el agua a la retro sobre tierra
  const largoViga = G.voladizo + G.retro;
  const centroViga = MEDIDAS.muelle - 4 + G.voladizo / 2 - G.retro / 2 + 6;
  const viga = celosia(largoViga, 5.2, 22, matEstructura, 'x');
  viga.rotation.y = Math.PI / 2;
  viga.position.set(0, G.alto - 19, centroViga);
  grupo.add(viga);
  aDesechar.push(...viga.userData.geos);

  // Tirantes desde la torre a los extremos de la viga
  const torreAlto = G.alto;
  const geoTorre = new THREE.BoxGeometry(2.1, 20, 2.1);
  aDesechar.push(geoTorre);
  for (const dx of [-7, 7]) {
    const t = new THREE.Mesh(geoTorre, matEstructura);
    t.position.set(dx, torreAlto - 10, zPata[0] - G.via / 2);
    t.castShadow = true;
    grupo.add(t);
  }
  const tirante = (z1, z2) => {
    const largo = Math.hypot(z2 - z1, 20);
    const geo = new THREE.BoxGeometry(0.95, largo, 0.95);
    aDesechar.push(geo);
    for (const dx of [-7, 7]) {
      const m = new THREE.Mesh(geo, matEstructura);
      m.position.set(dx, torreAlto - 10, (z1 + z2) / 2);
      m.rotation.x = Math.atan2(z2 - z1, 20) * -1;
      grupo.add(m);
    }
  };
  tirante(zPata[0] - G.via / 2, MEDIDAS.muelle - 4 + G.voladizo);
  tirante(zPata[0] - G.via / 2, MEDIDAS.muelle - 4 - G.via - G.retro);

  // Casa de máquinas y cabina del operador
  const geoCasa = new THREE.BoxGeometry(12, 5, 9);
  const casa = new THREE.Mesh(geoCasa, matAcento);
  casa.position.set(0, G.alto - 24, zPata[1] - 8);
  casa.castShadow = true;
  grupo.add(casa);
  aDesechar.push(geoCasa);

  let carro = null; let spreader = null; let cables = []; let cabina = null;
  if (activa) {
    // Carro: lo que recorre la viga llevando la carga
    const geoCarro = new THREE.BoxGeometry(9, 2.4, 6);
    carro = new THREE.Mesh(geoCarro, matAcento);
    carro.castShadow = true;
    grupo.add(carro);
    aDesechar.push(geoCarro);

    const geoCab = new THREE.BoxGeometry(3, 2.6, 3);
    cabina = new THREE.Mesh(geoCab, matOscuro);
    cabina.castShadow = true;
    grupo.add(cabina);
    aDesechar.push(geoCab);

    /* Spreader: el bastidor telescópico que agarra el contenedor por sus
       cuatro esquinas. Lo que se ve girar en los cierres son los twistlocks. */
    spreader = new THREE.Group();
    const geoViga = new THREE.BoxGeometry(12.6, 0.75, 0.75);
    const geoTrave = new THREE.BoxGeometry(0.75, 0.7, 2.9);
    aDesechar.push(geoViga, geoTrave);
    for (const dz of [-1.35, 1.35]) {
      const v = new THREE.Mesh(geoViga, matAcento);
      v.position.z = dz;
      v.castShadow = true;
      spreader.add(v);
    }
    for (const dx of [-6, 0, 6]) {
      const t = new THREE.Mesh(geoTrave, matAcento);
      t.position.x = dx;
      spreader.add(t);
    }
    const geoLock = new THREE.CylinderGeometry(0.16, 0.16, 0.5, 6);
    aDesechar.push(geoLock);
    spreader.userData.locks = [];
    for (const dx of [-6.05, 6.05]) {
      for (const dz of [-1.35, 1.35]) {
        const l = new THREE.Mesh(geoLock, matOscuro);
        l.position.set(dx, -0.55, dz);
        spreader.add(l);
        spreader.userData.locks.push(l);
      }
    }
    grupo.add(spreader);

    /* Los cables.
       Cuatro, del carro a las esquinas del spreader. Se reconstruyen cada
       fotograma orientando un cilindro entre los dos extremos: así, cuando la
       carga pendulea, los cables SE INCLINAN, que es lo que hacen los de
       verdad. Pintarlos como barras verticales fijas es el error clásico y se
       ve a la primera. */
    const geoCable = new THREE.CylinderGeometry(0.07, 0.07, 1, 5);
    const matCable = new THREE.MeshStandardMaterial({ color: 0x3b424c, roughness: 0.42, metalness: 0.85 });
    aDesechar.push(geoCable, matCable);
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(geoCable, matCable);
      c.castShadow = true;
      cables.push(c);
      grupo.add(c);
    }
  }

  const arriba = new THREE.Vector3();
  const abajo = new THREE.Vector3();
  const medio = new THREE.Vector3();
  const eje = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();

  grupo.userData.actualizar = (mundo) => {
    if (!activa) return;
    const g = mundo.grua;
    const yViga = G.alto - 21;
    carro.position.set(0, yViga, g.carroZ);
    cabina.position.set(5.5, yViga - 3.4, g.carroZ);
    /* El spreader va por ENCIMA de la tapa del contenedor, no dentro.
       Estaba a 1,75 m del centro de la carga, y la tapa de un High Cube está a
       1,448: las vigas del bastidor quedaban clavadas en el techo y el
       spreader no se veía en ningún plano de la descarga. Justo la pieza que
       explica cómo se agarra la carga. */
    const yTapa = MEDIDAS.contenedor.alto / 2;
    spreader.position.set(
      MEDIDAS.gruaX + (g.desvio || 0) - grupo.position.x,
      g.spreaderY + yTapa + 0.46,
      g.contenedor ? g.contenedor.z : g.carroZ,
    );
    // El spreader se ladea con la carga: cuelga, no está atornillado
    spreader.rotation.x = clamp((spreader.position.z - g.carroZ) * 0.03, -0.12, 0.12);
    spreader.userData.locks.forEach((l) => { l.rotation.y = g.cerrado * Math.PI / 2; });

    for (let i = 0; i < 4; i++) {
      const dx = i < 2 ? -5.9 : 5.9;
      const dz = i % 2 ? -1.3 : 1.3;
      arriba.set(dx * 0.62, yViga - 1.2, g.carroZ + dz);
      abajo.set(dx, spreader.position.y + 0.4, spreader.position.z + dz);
      medio.addVectors(arriba, abajo).multiplyScalar(0.5);
      dir.subVectors(abajo, arriba);
      const largo = dir.length();
      cables[i].position.copy(medio);
      cables[i].scale.set(1, Math.max(0.01, largo), 1);
      cables[i].quaternion.setFromUnitVectors(eje, dir.normalize());
      cables[i].visible = largo > 0.3;
    }
  };

  grupo.userData.liberar = () => aDesechar.forEach((o) => o.dispose?.());
  return grupo;
}
