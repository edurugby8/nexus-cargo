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
/** Cota de la cabeza del carril: es donde apoya la grúa. */
const APOYO = 0.7;

/**
 * Media distancia entre las dos patas de un mismo carril: el HUECO del
 * pórtico, por el que tienen que pasar dos cosas.
 *
 * Estaba en 7, o sea catorce metros de eje a eje y ONCE METROS Y CUARENTA de
 * paso libre. Un contenedor de cuarenta pies mide 12,19 y el spreader que lo
 * agarra, 12,60: la carga no cabía por el hueco de su propia grúa, así que al
 * arriarla sobre el camión ATRAVESABA las dos patas. No era un problema de
 * cámara —se veía tapada— sino de que ese movimiento es imposible.
 *
 * Con 9 quedan dieciocho metros de eje a eje y 15,40 de paso libre: el
 * spreader entra con metro y medio por banda, que es la holgura real de una
 * grúa de este tamaño.
 *
 * La medida se elige por lo que tiene que caber y NO por dónde está la
 * cámara. Probé a llevarla a 9,5 y a 12 buscando además despejar la visual, y
 * las dos veces salió peor: mover una estructura de ocho mil toneladas para
 * esquivar un objetivo es mover el problema, porque la visual barre ese plano
 * entera mientras el camión avanza y siempre acaba encontrándola. Si el plano
 * no ve la maniobra, se corrige el plano.
 */
const PORTAL = 9;

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
  /* LA GRÚA SE APOYA EN EL CARRIL, no en la cota cero.
     Estaba plantada en y = 0 mientras la explanada del muelle es una
     plataforma de hormigón a 60 cm y el carril que la sostiene remata a 70:
     las cuatro patas y los ocho bogies de ocho mil toneladas de grúa estaban
     enterrados setenta centímetros en el pavimento. No se ve desde lejos y
     salta a la vista en cuanto la cámara baja al muelle. */
  grupo.position.set(x, APOYO, 0);
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
    for (const dx of [-PORTAL, PORTAL]) {
      const pata = new THREE.Mesh(geoPata, matEstructura);
      pata.position.set(dx, (G.alto - 20) / 2, z);
      pata.castShadow = true;
      grupo.add(pata);
    }
    /* Carros de traslación: UNO POR PATA, no uno de lado a lado.
       Era una caja de dieciocho metros tendida de carril a carril, y por el
       centro de esa caja —por el eje de la grúa, x = 20— es justo por donde
       sube el camión del muelle a aduanas. El camión la atravesaba de parte a
       parte, medio metro y medio de acero macizo, en los dos carriles.

       Y no era sólo una colisión: una grúa de muelle de verdad NO tiene nada
       tendido entre carriles a ras de suelo, porque por debajo del pórtico
       circulan precisamente los camiones. Lo que lleva es un tren de bogies
       bajo cada pata. Así que la pieza correcta y la pieza que no estorba son
       la misma, que es como suelen acabar estas cosas. */
    const geoBogie = new THREE.BoxGeometry(5.4, 1.8, 2.6);
    for (const dx of [-PORTAL, PORTAL]) {
      const bogie = new THREE.Mesh(geoBogie, matOscuro);
      bogie.position.set(dx, 0.9, z);
      bogie.castShadow = true;
      grupo.add(bogie);
    }
    aDesechar.push(geoBogie);
  }

  // Travesaños entre patas
  const geoTrav = new THREE.BoxGeometry(PORTAL * 2 + 2, 1.9, 1.9);
  aDesechar.push(geoTrav);
  for (const z of zPata) {
    for (const y of [G.alto - 24, (G.alto - 20) * 0.45]) {
      const t = new THREE.Mesh(geoTrav, matEstructura);
      t.position.set(0, y, z);
      grupo.add(t);
    }
  }

  /* Viga superior: del voladizo sobre el agua a la retro sobre tierra.
     Medía `voladizo + retro` y se centraba a ojo con un «+6», y así no llegaba
     a donde tiene que llegar: acababa en z = 16 por el lado de tierra cuando
     el tirante que la sujeta baja hasta −20,5. Faltaba, justamente, la LUZ
     ENTRE CARRILES, que es por donde el carro tiene que pasar para dejar la
     caja sobre el camión: la grúa cargaba el camión desde treinta metros más
     allá de donde terminaba su propia viga.
     Ahora va de punta a punta: del extremo del voladizo sobre el agua al
     extremo de la retro sobre tierra, pasando por encima de los dos carriles. */
  const puntaMar = MEDIDAS.muelle - 4 + G.voladizo;
  const puntaTierra = MEDIDAS.muelle - 4 - G.via - G.retro;
  const largoViga = puntaMar - puntaTierra;
  const centroViga = (puntaMar + puntaTierra) / 2;
  const viga = celosia(largoViga, 5.2, 22, matEstructura, 'x');
  viga.rotation.y = Math.PI / 2;
  viga.position.set(0, G.alto - 19, centroViga);
  grupo.add(viga);
  aDesechar.push(...viga.userData.geos);

  // Tirantes desde la torre a los extremos de la viga
  const torreAlto = G.alto;
  const geoTorre = new THREE.BoxGeometry(2.1, 20, 2.1);
  aDesechar.push(geoTorre);
  for (const dx of [-PORTAL, PORTAL]) {
    const t = new THREE.Mesh(geoTorre, matEstructura);
    t.position.set(dx, torreAlto - 10, zPata[0] - G.via / 2);
    t.castShadow = true;
    grupo.add(t);
  }
  const tirante = (z1, z2) => {
    const largo = Math.hypot(z2 - z1, 20);
    const geo = new THREE.BoxGeometry(0.95, largo, 0.95);
    aDesechar.push(geo);
    for (const dx of [-PORTAL, PORTAL]) {
      const m = new THREE.Mesh(geo, matEstructura);
      m.position.set(dx, torreAlto - 10, (z1 + z2) / 2);
      m.rotation.x = Math.atan2(z2 - z1, 20) * -1;
      grupo.add(m);
    }
  };
  tirante(zPata[0] - G.via / 2, puntaMar);
  tirante(zPata[0] - G.via / 2, puntaTierra);

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
    /* El aparejo —spreader, twistlocks y cables— va marcado porque no es un
       ESTORBO aunque geométricamente lo parezca: es lo que sujeta la carga y
       viaja con ella. La cámara y las pruebas de oclusión lo tratan como parte
       del sujeto, igual que el contenedor protagonista es parte del camión que
       lo lleva. Sin esta marca, la cámara se apartaba de su propio contenedor
       durante todo el capítulo de la descarga. */
    spreader.traverse((o) => { o.userData.aparejo = true; });
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
      c.userData.aparejo = true;
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
      // `spreaderY` viene del guion en cota del mundo; aquí se pinta en
      // coordenadas de la grúa, que ahora está subida a la cabeza del carril
      g.spreaderY + yTapa + 0.46 - APOYO,
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
