/**
 * El portacontenedores NX ORION.
 *
 * 294 metros de eslora y 48 de manga. La cifra importa: es lo que convierte la
 * grúa en algo enorme y el contenedor en algo pequeño. Si el buque se hace «a
 * ojo» más corto, toda la escala del puerto se viene abajo.
 *
 * El casco se construye por secciones a lo largo de la eslora, con la manga y
 * el pantoque variando según una curva: proa afinada con lanzamiento, cuerpo
 * cilíndrico en el medio y popa recogida. Es lo mismo que hace un astillero
 * con las cuadernas, y sale mucho mejor que deformar una caja.
 */

import * as THREE from 'three';
import { MEDIDAS } from './ruta.js';
import { clamp, lerp, azarCon } from '../lib/util.js';
import { texturaChapa, texturaContenedorGenerico, texturaMancha } from './texturas.js';

const { eslora: E, manga: M, francobordo: F, casco: C } = MEDIDAS.buque;

/** Semimanga en una posición de la eslora (0 popa · 1 proa). */
function mangaEn(t) {
  if (t < 0.08) return M * 0.5 * lerp(0.45, 0.92, t / 0.08);      // espejo de popa
  if (t < 0.24) return M * 0.5 * lerp(0.92, 1, (t - 0.08) / 0.16);
  if (t < 0.72) return M * 0.5;                                    // cuerpo cilíndrico
  if (t < 0.93) return M * 0.5 * lerp(1, 0.52, (t - 0.72) / 0.21); // entrada de proa
  return M * 0.5 * lerp(0.52, 0.04, (t - 0.93) / 0.07);            // roda
}

/** Lanzamiento de proa: la roda se adelanta arriba. */
const lanzamiento = (t, y) => (t > 0.86 ? ((t - 0.86) / 0.14) ** 2 * y * 0.55 : 0);

function geometriaCasco(secciones = 44, verticales = 7) {
  const pos = [];
  const nor = [];
  const uv = [];
  const punto = (t, v) => {
    const y = lerp(-C, F, v);
    // El pantoque: abajo el casco se recoge
    const recogida = v < 0.32 ? lerp(0.58, 1, v / 0.32) : 1;
    const b = mangaEn(t) * recogida;
    const x = lerp(-E / 2, E / 2, t) + lanzamiento(t, y + C);
    return [x, y, b];
  };
  for (let i = 0; i < secciones; i++) {
    const t0 = i / secciones;
    const t1 = (i + 1) / secciones;
    for (let j = 0; j < verticales; j++) {
      const v0 = j / verticales;
      const v1 = (j + 1) / verticales;
      for (const lado of [-1, 1]) {
        const a = punto(t0, v0); const b = punto(t1, v0);
        const c = punto(t1, v1); const d = punto(t0, v1);
        const P = [
          [a[0], a[1], a[2] * lado], [b[0], b[1], b[2] * lado],
          [c[0], c[1], c[2] * lado], [d[0], d[1], d[2] * lado],
        ];
        const orden = lado > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
        for (const k of orden) pos.push(P[k][0], P[k][1], P[k][2]);
        for (let n = 0; n < 6; n++) {
          nor.push(0, 0, lado);
          uv.push(t0 * 9, v0 * 2);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

export function crearBarco({ caps }) {
  const grupo = new THREE.Group();
  const aDesechar = [];
  const azar = azarCon(9482019);

  const mapaCasco = texturaChapa('#1f3a52', 3, 0.9);
  mapaCasco.repeat.set(9, 2);
  const matCasco = new THREE.MeshStandardMaterial({
    map: mapaCasco, color: 0xffffff, roughness: 0.72, metalness: 0.35, side: THREE.DoubleSide,
  });
  const matObraViva = new THREE.MeshStandardMaterial({ color: 0x7a2a22, roughness: 0.85, metalness: 0.1 });
  const matCubierta = new THREE.MeshStandardMaterial({ color: 0x2c3c4a, roughness: 0.9, metalness: 0.15 });
  const matBlanco = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.6, metalness: 0.2 });
  const matOscuro = new THREE.MeshStandardMaterial({ color: 0x1a232c, roughness: 0.5, metalness: 0.6 });
  aDesechar.push(mapaCasco, matCasco, matObraViva, matCubierta, matBlanco, matOscuro);

  const geoCasco = geometriaCasco(caps.nivel === 'alto' ? 56 : 34, caps.nivel === 'alto' ? 8 : 5);
  const casco = new THREE.Mesh(geoCasco, matCasco);
  casco.castShadow = true;
  casco.receiveShadow = true;
  grupo.add(casco);
  aDesechar.push(geoCasco);

  // Franja de obra viva: la línea roja de flotación es de las cosas que más
  // dicen «esto es un barco» con menos geometría
  const geoFranja = new THREE.BoxGeometry(E * 0.985, 1.5, M * 1.002);
  const franja = new THREE.Mesh(geoFranja, matObraViva);
  franja.position.y = -0.6;
  grupo.add(franja);
  aDesechar.push(geoFranja);

  // Cubierta
  const geoCub = new THREE.BoxGeometry(E * 0.97, 0.5, M * 0.94);
  const cubierta = new THREE.Mesh(geoCub, matCubierta);
  cubierta.position.y = F;
  cubierta.receiveShadow = true;
  grupo.add(cubierta);
  aDesechar.push(geoCub);

  // Castillo de popa: puente, acomodación y chimenea
  const popaX = -E * 0.34;
  const geoAcom = new THREE.BoxGeometry(24, 26, M * 0.62);
  const acom = new THREE.Mesh(geoAcom, matBlanco);
  acom.position.set(popaX, F + 13, 0);
  acom.castShadow = true;
  grupo.add(acom);
  const geoPuente = new THREE.BoxGeometry(20, 4.2, M * 0.84);
  const puente = new THREE.Mesh(geoPuente, matOscuro);
  puente.position.set(popaX, F + 27.5, 0);
  puente.castShadow = true;
  grupo.add(puente);
  const geoChim = new THREE.CylinderGeometry(3.4, 4.2, 15, 10);
  const chim = new THREE.Mesh(geoChim, matOscuro);
  chim.position.set(popaX - 16, F + 20, 0);
  chim.castShadow = true;
  grupo.add(chim);
  aDesechar.push(geoAcom, geoPuente, geoChim);

  /* Carga de cubierta: bahías de contenedores instanciados.
     Nueve mil cuatrocientos TEU no se pueden dibujar, pero tampoco hace falta:
     lo que cuenta la escala es la MASA apilada y el ritmo de las bahías. */
  const L = 12.192; const A = 2.438; const Hc = 2.896;
  const COLORES = ['#2e5d86', '#7d2f2a', '#3f6b4a', '#8a6a24', '#4a4f57', '#a85f1c'];
  const bahias = caps.nivel === 'alto' ? 15 : caps.nivel === 'medio' ? 12 : 8;
  const filas = caps.nivel === 'alto' ? 13 : caps.nivel === 'medio' ? 9 : 6;
  const pisos = caps.nivel === 'minimo' ? 3 : 5;
  const geoCaja = new THREE.BoxGeometry(L, Hc, A);
  aDesechar.push(geoCaja);
  const dummy = new THREE.Object3D();
  const porColor = Math.ceil((bahias * filas * pisos) / COLORES.length);
  COLORES.forEach((color, ci) => {
    const mapa = texturaContenedorGenerico(color, 40 + ci);
    const mat = new THREE.MeshStandardMaterial({ map: mapa, roughness: 0.8, metalness: 0.18 });
    aDesechar.push(mapa, mat);
    const malla = new THREE.InstancedMesh(geoCaja, mat, porColor);
    malla.castShadow = true;
    malla.receiveShadow = true;
    let n = 0;
    for (let b = 0; b < bahias && n < porColor; b++) {
      for (let f = 0; f < filas && n < porColor; f++) {
        for (let piso = 0; piso < pisos && n < porColor; piso++) {
          if ((b * 31 + f * 17 + piso * 7 + ci) % COLORES.length !== ci) continue;
          // Los perfiles de pila bajan hacia proa, como en la realidad
          const limite = b > bahias * 0.75 ? pisos - 2 : pisos;
          if (piso >= limite) continue;
          dummy.position.set(
            -E * 0.22 + b * (L + 0.8),
            F + 0.75 + Hc / 2 + piso * (Hc + 0.04),
            (f - (filas - 1) / 2) * (A + 0.08),
          );
          dummy.updateMatrix();
          malla.setMatrixAt(n++, dummy.matrix);
        }
      }
    }
    malla.count = n;
    malla.instanceMatrix.needsUpdate = true;
    malla.frustumCulled = false;
    grupo.add(malla);
  });

  /* El hueco de NUESTRO contenedor.
     Se deja libre a propósito la bahía 24 en la posición donde la grúa va a
     trabajar: el contenedor protagonista se coloca ahí desde la escena, y al
     izarlo queda el hueco. Sin el hueco, la descarga no se entendería. */
  grupo.userData.huecoLocal = new THREE.Vector3(
    MEDIDAS.gruaX - MEDIDAS.amarre.x, 32.5, 0,
  );

  // Grúas de a bordo y mástiles, para romper la silueta
  const geoMastil = new THREE.CylinderGeometry(0.5, 0.7, 22, 6);
  aDesechar.push(geoMastil);
  for (const x of [E * 0.44, popaX + 16]) {
    const m = new THREE.Mesh(geoMastil, matBlanco);
    m.position.set(x, F + 11, 0);
    m.castShadow = true;
    grupo.add(m);
  }

  /* Estela y espuma de amura. La estela va pegada al agua y se estira con la
     velocidad: cuando el buque para, desaparece. */
  const mancha = texturaMancha(0.05);
  const matEstela = new THREE.MeshBasicMaterial({
    map: mancha, color: 0xdfeaf2, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  aDesechar.push(mancha, matEstela);
  const geoEstela = new THREE.PlaneGeometry(220, 44);
  const estela = new THREE.Mesh(geoEstela, matEstela);
  estela.rotation.x = -Math.PI / 2;
  estela.position.set(-E * 0.55, 0.35, 0);
  estela.renderOrder = 3;
  grupo.add(estela);
  const amura = new THREE.Mesh(new THREE.PlaneGeometry(46, 26), matEstela);
  amura.rotation.x = -Math.PI / 2;
  amura.position.set(E * 0.44, 0.4, 0);
  amura.renderOrder = 3;
  grupo.add(amura);
  aDesechar.push(geoEstela, amura.geometry);

  grupo.userData.actualizar = (mundo, reloj, ajustes) => {
    const b = mundo.barco;
    grupo.position.set(b.x, 0, b.z);
    // Balanceo y cabeceo: amplitud proporcional a la marcha. Un buque parado
    // en dársena abrigada apenas se mueve, y ése es justo el contraste que
    // hace que el de alta mar se note.
    const m = b.marcha * ajustes.balanceo;
    grupo.rotation.z = Math.sin(reloj * 0.31) * 0.014 * m;
    grupo.rotation.x = Math.sin(reloj * 0.47 + 1.1) * 0.008 * m;
    grupo.position.y = Math.sin(reloj * 0.38) * 0.5 * m;
    const fuerza = clamp(b.marcha * 1.2);
    matEstela.opacity = fuerza * 0.34;
    estela.visible = amura.visible = fuerza > 0.02;
    estela.scale.set(lerp(0.4, 1, fuerza), 1, 1);
  };
  grupo.userData.liberar = () => aDesechar.forEach((o) => o.dispose?.());
  return grupo;
}
