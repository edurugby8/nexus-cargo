/**
 * Tractora y semirremolque portacontenedores.
 *
 * 16,5 metros de conjunto con 24 toneladas detrás. Tres detalles hacen que se
 * lea como un vehículo pesado y no como una caja que se desliza:
 *
 *   · las ruedas giran por la DISTANCIA recorrida dividida entre su radio, no
 *     con un contador aparte. Así es imposible que giren con el camión parado,
 *     que es el fallo que más delata a un vehículo falso;
 *   · el conjunto cabecea al acelerar y al frenar, porque la suspensión de un
 *     camión cargado trabaja mucho y despacio;
 *   · el remolque sigue a la tractora con un retardo, que es lo que hace el
 *     pivote de enganche de verdad.
 */

import * as THREE from 'three';
import { MEDIDAS } from './ruta.js';
import { clamp, lerp, damp } from '../lib/util.js';
import { texturaChapa, texturaMancha } from './texturas.js';

export function crearCamion({ caps }) {
  const grupo = new THREE.Group();
  const aDesechar = [];

  const mapa = texturaChapa('#1d3f63', 21, 0.25);
  mapa.repeat.set(2, 2);
  const matCabina = new THREE.MeshStandardMaterial({ map: mapa, roughness: 0.42, metalness: 0.5 });
  const matChasis = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.62, metalness: 0.6 });
  const matCristal = new THREE.MeshStandardMaterial({
    color: 0x141c26, roughness: 0.12, metalness: 0.65, transparent: true, opacity: 0.86,
  });
  const matGoma = new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.95, metalness: 0.05 });
  const matLlanta = new THREE.MeshStandardMaterial({ color: 0x9aa2ab, roughness: 0.42, metalness: 0.8 });
  const matCromo = new THREE.MeshStandardMaterial({ color: 0xb9c2cb, roughness: 0.22, metalness: 0.95 });
  aDesechar.push(mapa, matCabina, matChasis, matCristal, matGoma, matLlanta, matCromo);

  /* ── Tractora ────────────────────────────────────────────────────
     Va en su propio grupo para poder cabecear sin arrastrar al remolque. */
  const tractora = new THREE.Group();
  grupo.add(tractora);

  const geoChasis = new THREE.BoxGeometry(6.2, 0.34, 2.3);
  const chasis = new THREE.Mesh(geoChasis, matChasis);
  chasis.position.set(0, 0.95, 0);
  chasis.castShadow = true;
  tractora.add(chasis);

  const geoCab = new THREE.BoxGeometry(2.5, 2.5, 2.5);
  const cab = new THREE.Mesh(geoCab, matCabina);
  cab.position.set(1.55, 2.45, 0);
  cab.castShadow = true;
  cab.receiveShadow = true;
  tractora.add(cab);

  // Techo aerodinámico: sin él, una cabina es un cubo
  const geoSpoiler = new THREE.BoxGeometry(2.3, 0.85, 2.4);
  const spoiler = new THREE.Mesh(geoSpoiler, matCabina);
  spoiler.position.set(1.1, 3.9, 0);
  spoiler.castShadow = true;
  tractora.add(spoiler);

  const geoParabrisas = new THREE.BoxGeometry(0.14, 1.25, 2.2);
  const parabrisas = new THREE.Mesh(geoParabrisas, matCristal);
  parabrisas.position.set(2.78, 2.9, 0);
  tractora.add(parabrisas);
  const geoVentanilla = new THREE.BoxGeometry(1.5, 1, 0.1);
  for (const s of [-1, 1]) {
    const v = new THREE.Mesh(geoVentanilla, matCristal);
    v.position.set(1.5, 2.85, s * 1.27);
    tractora.add(v);
  }

  // Parachoques, rejilla y depósito
  const geoParachoques = new THREE.BoxGeometry(0.4, 0.6, 2.5);
  const parachoques = new THREE.Mesh(geoParachoques, matChasis);
  parachoques.position.set(2.95, 1.05, 0);
  tractora.add(parachoques);
  const geoDeposito = new THREE.CylinderGeometry(0.42, 0.42, 1.5, 12);
  for (const s of [-1, 1]) {
    const d = new THREE.Mesh(geoDeposito, matCromo);
    d.rotation.x = Math.PI / 2;
    d.position.set(-0.6, 0.95, s * 1.25);
    d.castShadow = true;
    tractora.add(d);
  }
  const geoTubo = new THREE.CylinderGeometry(0.12, 0.12, 3, 8);
  const tubo = new THREE.Mesh(geoTubo, matCromo);
  tubo.position.set(0.15, 2.6, -1.35);
  tubo.castShadow = true;
  tractora.add(tubo);
  aDesechar.push(geoChasis, geoCab, geoSpoiler, geoParabrisas, geoVentanilla,
    geoParachoques, geoDeposito, geoTubo);

  /* ── Semirremolque ───────────────────────────────────────────────
     Un chasis portacontenedores: sólo largueros y traviesas. El contenedor NO
     es parte del camión, lo pone la escena encima cuando la grúa lo suelta. */
  const remolque = new THREE.Group();
  grupo.add(remolque);
  const geoLarguero = new THREE.BoxGeometry(12.6, 0.42, 0.34);
  for (const s of [-1, 1]) {
    const l = new THREE.Mesh(geoLarguero, matChasis);
    l.position.set(-6.4, 1.05, s * 1.05);
    l.castShadow = true;
    remolque.add(l);
  }
  const geoTraviesa = new THREE.BoxGeometry(0.3, 0.3, 2.4);
  for (let i = 0; i < 7; i++) {
    const t = new THREE.Mesh(geoTraviesa, matChasis);
    t.position.set(-1 - i * 2, 1.05, 0);
    remolque.add(t);
  }
  // Placa de apoyo sobre la quinta rueda
  const geoPlaca = new THREE.BoxGeometry(1.6, 0.16, 2);
  const placa = new THREE.Mesh(geoPlaca, matChasis);
  placa.position.set(-0.4, 1.22, 0);
  remolque.add(placa);
  // Patas de apoyo y faldón antiempotramiento
  const geoPata = new THREE.BoxGeometry(0.22, 1.1, 0.22);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(geoPata, matChasis);
    p.position.set(-4.2, 0.6, s * 0.95);
    remolque.add(p);
  }
  const geoFaldon = new THREE.BoxGeometry(0.12, 0.7, 2.4);
  const faldon = new THREE.Mesh(geoFaldon, matChasis);
  faldon.position.set(-12.6, 0.75, 0);
  remolque.add(faldon);
  aDesechar.push(geoLarguero, geoTraviesa, geoPlaca, geoPata, geoFaldon);

  /* ── Ruedas ──────────────────────────────────────────────────────
     Diez: dos en el eje director y cuatro gemelas por cada eje motriz o del
     remolque. Se guardan aparte para girarlas todas con el mismo ángulo. */
  const radio = 0.52;
  const geoNeumatico = new THREE.CylinderGeometry(radio, radio, 0.34, caps.nivel === 'alto' ? 20 : 12);
  const geoLlanta = new THREE.CylinderGeometry(radio * 0.58, radio * 0.58, 0.36, 10);
  aDesechar.push(geoNeumatico, geoLlanta);
  const ruedas = [];
  const ponRueda = (padre, x, z) => {
    const r = new THREE.Group();
    const n = new THREE.Mesh(geoNeumatico, matGoma);
    n.rotation.x = Math.PI / 2;
    n.castShadow = true;
    r.add(n);
    const l = new THREE.Mesh(geoLlanta, matLlanta);
    l.rotation.x = Math.PI / 2;
    r.add(l);
    r.position.set(x, radio, z);
    padre.add(r);
    ruedas.push(r);
  };
  // Eje director
  for (const s of [-1, 1]) ponRueda(tractora, 2.1, s * 1.15);
  // Ejes motrices, ruedas gemelas
  for (const x of [-1.3, -2.7]) {
    for (const s of [-1, 1]) {
      ponRueda(tractora, x, s * 1.0);
      ponRueda(tractora, x, s * 1.38);
    }
  }
  // Tren del remolque
  for (const x of [-9.8, -11.2]) {
    for (const s of [-1, 1]) {
      ponRueda(remolque, x, s * 1.0);
      ponRueda(remolque, x, s * 1.38);
    }
  }

  /* ── Luces ───────────────────────────────────────────────────────
     Los faros son planos con una mancha aditiva: cuesta nada y a distancia es
     indistinguible de una luz de verdad. */
  const mancha = texturaMancha(0.3);
  const matFaro = new THREE.MeshBasicMaterial({
    map: mancha, color: 0xfff0d0, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const matPiloto = new THREE.MeshBasicMaterial({
    map: mancha, color: 0xff3b24, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  aDesechar.push(mancha, matFaro, matPiloto);
  const geoLuz = new THREE.PlaneGeometry(1.1, 1.1);
  aDesechar.push(geoLuz);
  const faros = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(geoLuz, matFaro);
    f.position.set(3.2, 1.15, s * 0.95);
    f.rotation.y = Math.PI / 2;
    f.renderOrder = 5;
    tractora.add(f);
    faros.push(f);
  }
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(geoLuz, matPiloto);
    p.position.set(-12.7, 1.1, s * 0.95);
    p.rotation.y = -Math.PI / 2;
    p.scale.setScalar(0.6);
    p.renderOrder = 5;
    remolque.add(p);
  }

  // Estado amortiguado propio: la suspensión tiene inercia, no copia el dato
  let cabeceoSuave = 0;
  let balanceoSuave = 0;

  grupo.userData.actualizar = (mundo, reloj, ajustes, dt) => {
    const c = mundo.camion;
    // El camión avanza hacia −Z, así que mira en esa dirección
    grupo.position.set(MEDIDAS.gruaX, 0, c.z);
    grupo.rotation.y = Math.PI / 2;

    const giro = c.giroRueda;
    for (const r of ruedas) r.rotation.z = -giro;

    // Cabeceo por aceleración, amortiguado: la suspensión no responde al
    // instante ni se queda quieta cuando el impulso termina.
    cabeceoSuave = damp(cabeceoSuave, c.cabeceo, 5.5, dt);
    // Y el traqueteo del firme, proporcional a la marcha
    const traqueteo = Math.sin(reloj * 9.3) * 0.004 + Math.sin(reloj * 14.7) * 0.0022;
    const s = (ajustes.suspension ?? 1) * c.marcha;
    balanceoSuave = damp(balanceoSuave, Math.sin(reloj * 3.1) * 0.006 * s, 4, dt);
    tractora.rotation.z = cabeceoSuave + traqueteo * s;
    tractora.rotation.x = balanceoSuave;
    tractora.position.y = Math.abs(traqueteo) * s * 2.2;
    // El remolque va con retardo: es lo que hace el pivote de enganche
    remolque.rotation.z = cabeceoSuave * 0.45 + traqueteo * s * 0.6;
    remolque.rotation.x = balanceoSuave * 0.7;

    const encendidas = c.luces ? 1 : 0;
    matFaro.opacity = encendidas * lerp(0.35, 0.8, c.marcha);
    matPiloto.opacity = encendidas * 0.5;
    faros.forEach((f) => { f.visible = encendidas > 0; });
  };

  grupo.userData.remolque = remolque;
  // Dónde se apoya el contenedor sobre el chasis, en coordenadas del camión
  grupo.userData.apoyo = new THREE.Vector3(-6.4, MEDIDAS.camion.plataforma, 0);
  grupo.userData.liberar = () => aDesechar.forEach((o) => o.dispose?.());
  return grupo;
}
