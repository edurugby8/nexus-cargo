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
import { cristal } from './materiales.js';

export function crearCamion({ caps }) {
  const grupo = new THREE.Group();
  const aDesechar = [];

  const mapa = texturaChapa('#1d3f63', 21, 0.25);
  mapa.repeat.set(2, 2);
  const matCabina = new THREE.MeshStandardMaterial({ map: mapa, roughness: 0.42, metalness: 0.5 });
  const matChasis = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.62, metalness: 0.6 });
  const matCristal = cristal(0x101a24);
  const matGoma = new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.95, metalness: 0.05 });
  const matLlanta = new THREE.MeshStandardMaterial({ color: 0x9aa2ab, roughness: 0.42, metalness: 0.8 });
  const matCromo = new THREE.MeshStandardMaterial({ color: 0xb9c2cb, roughness: 0.22, metalness: 0.95 });
  aDesechar.push(mapa, matCabina, matChasis, matGoma, matLlanta, matCromo);

  /* ── Tractora ────────────────────────────────────────────────────
     Va en su propio grupo para poder cabecear sin arrastrar al remolque. */
  const tractora = new THREE.Group();
  grupo.add(tractora);

  const geoChasis = new THREE.BoxGeometry(6.2, 0.34, 2.3);
  const chasis = new THREE.Mesh(geoChasis, matChasis);
  chasis.position.set(0, 0.95, 0);
  chasis.castShadow = true;
  tractora.add(chasis);

  /* La cabina, por PERFIL EXTRUIDO y no por cajas.
     Una tractora europea es reconocible por su silueta lateral: frontal casi
     vertical pero echado adelante, parabrisas muy inclinado, techo largo y
     plano que cae hacia atrás. Con tres cajas apiladas eso no sale —salía un
     cubo con un sombrero— y era lo que más «de bloques» hacía ver al camión en
     los cinco capítulos en los que aparece.

     Se dibuja el perfil una vez, en metros, y se extruye a lo ancho. Cuesta
     una geometría y resuelve la silueta entera, que es lo único que se ve a
     cincuenta metros. El bisel del extruido redondea las aristas: sin él,
     cualquier canto vivo devuelve una línea blanca de un píxel que delata la
     caja al instante. */
  const perfil = new THREE.Shape();
  perfil.moveTo(-1.28, 0.00);
  perfil.lineTo(1.30, 0.00);
  perfil.lineTo(1.42, 0.26);
  perfil.lineTo(1.46, 1.02);           // frontal, ligeramente echado adelante
  perfil.lineTo(1.34, 1.30);           // quiebro bajo el parabrisas
  perfil.lineTo(0.66, 2.16);           // parabrisas, muy inclinado
  perfil.quadraticCurveTo(0.42, 2.34, 0.10, 2.36);
  perfil.lineTo(-0.98, 2.30);          // techo, cayendo hacia atrás
  perfil.quadraticCurveTo(-1.26, 2.28, -1.28, 2.02);
  perfil.closePath();

  const geoCab = new THREE.ExtrudeGeometry(perfil, {
    depth: 2.44, bevelEnabled: true, bevelThickness: 0.05,
    bevelSize: 0.06, bevelSegments: 2, curveSegments: 6,
  });
  geoCab.translate(0, 0, -1.22);
  geoCab.rotateY(Math.PI / 2);
  const cab = new THREE.Mesh(geoCab, matCabina);
  cab.position.set(1.45, 1.2, 0);
  cab.castShadow = true;
  cab.receiveShadow = true;
  tractora.add(cab);

  /* Deflector de techo. Va SEPARADO de la cabina y con un hueco visible entre
     los dos, como el de verdad: ese hueco de quince centímetros es lo que
     hace que se lea como una pieza añadida de plástico y no como parte de la
     chapa. */
  const geoSpoiler = new THREE.BoxGeometry(1.85, 0.62, 2.36);
  const spoiler = new THREE.Mesh(geoSpoiler, matCabina);
  spoiler.position.set(0.86, 3.86, 0);
  spoiler.castShadow = true;
  tractora.add(spoiler);
  const geoAleta = new THREE.BoxGeometry(1.85, 0.72, 0.07);
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(geoAleta, matCabina);
    a.position.set(0.86, 3.7, s * 1.2);
    tractora.add(a);
  }

  /* Cristales. Opacos y muy reflectantes, no transparentes: una cabina a plena
     luz es un espejo oscuro, y hacerla translúcida obliga a modelar un interior
     que nadie mira y deja ver el paisaje a través del camión. */
  const geoParabrisas = new THREE.BoxGeometry(1.12, 0.06, 2.12);
  const parabrisas = new THREE.Mesh(geoParabrisas, matCristal);
  parabrisas.position.set(2.45, 2.62, 0);
  parabrisas.rotation.z = -Math.atan2(0.86, 0.68) + Math.PI / 2;
  tractora.add(parabrisas);
  const geoVentanilla = new THREE.BoxGeometry(1.25, 0.86, 0.06);
  for (const s of [-1, 1]) {
    const v = new THREE.Mesh(geoVentanilla, matCristal);
    v.position.set(1.42, 2.78, s * 1.235);
    tractora.add(v);
  }

  /* Visera y retrovisores: dos piezas pequeñas que rompen la silueta por
     arriba y por los lados. Sin ellas la cabina se lee como maqueta. */
  const geoVisera = new THREE.BoxGeometry(0.34, 0.1, 2.44);
  const visera = new THREE.Mesh(geoVisera, matChasis);
  visera.position.set(2.18, 3.42, 0);
  visera.rotation.z = 0.24;
  tractora.add(visera);
  const geoBrazo = new THREE.CylinderGeometry(0.035, 0.035, 0.52, 6);
  const geoEspejo = new THREE.BoxGeometry(0.09, 0.62, 0.22);
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(geoBrazo, matChasis);
    b.rotation.x = Math.PI / 2;
    b.position.set(2.15, 3.1, s * 1.48);
    tractora.add(b);
    const e = new THREE.Mesh(geoEspejo, matChasis);
    e.position.set(2.15, 2.82, s * 1.72);
    e.castShadow = true;
    tractora.add(e);
  }

  /* Estribos y guardabarros. Es lo que hay entre la rueda y la puerta, y su
     ausencia deja un hueco negro que se ve desde cualquier plano bajo —y en
     este recorrido hay tres. */
  const geoEstribo = new THREE.BoxGeometry(0.5, 0.06, 0.62);
  const geoGuarda = new THREE.BoxGeometry(1.5, 0.12, 0.5);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const e = new THREE.Mesh(geoEstribo, matChasis);
      e.position.set(1.58, 0.62 + i * 0.42, s * 1.3);
      tractora.add(e);
    }
    const g = new THREE.Mesh(geoGuarda, matChasis);
    g.position.set(2.1, 1.02, s * 1.15);
    tractora.add(g);
  }
  aDesechar.push(geoSpoiler, geoAleta, geoParabrisas, geoVentanilla, geoVisera,
    geoBrazo, geoEspejo, geoEstribo, geoGuarda);

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
  aDesechar.push(geoChasis, geoCab, geoParachoques, geoDeposito, geoTubo);

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
    // El camión avanza hacia −Z, así que mira en esa dirección. La cota sale
    // del guion: el muelle está 60 cm por encima de la carretera y las ruedas
    // tienen que apoyarse en el firme de cada sitio, no en un cero abstracto.
    grupo.position.set(MEDIDAS.gruaX, c.y, c.z);
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
