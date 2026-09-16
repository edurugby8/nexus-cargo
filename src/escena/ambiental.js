/**
 * Partículas ambientales: gaviotas, polvo del patio y salpicadura de estela.
 *
 * Todo el movimiento va en el VÉRTICE, en la GPU. La CPU sólo actualiza un
 * uniforme de tiempo por fotograma, así que trescientas partículas cuestan lo
 * mismo que una. Es la misma técnica que el polen de Umbría, aquí con tres
 * familias que se encienden según dónde esté el recorrido.
 *
 * Discretas a propósito. El encargo pide evitar «movimiento constante sin
 * propósito», y una nube de partículas encima de todo es exactamente eso: lo
 * que hacen aquí es dar aire al puerto y escala al patio, no llamar la
 * atención.
 */

import * as THREE from 'three';
import { clamp } from '../lib/util.js';
import { texturaMancha } from './texturas.js';

const VERTICE = /* glsl */ `
  attribute float aFase;
  attribute float aEscala;
  attribute float aVel;
  attribute vec3 aDeriva;

  uniform float uTiempo;
  uniform float uDpr;
  uniform float uAlto;
  uniform float uTamano;
  uniform float uPlanea;   // 1 = vuelo de gaviota · 0 = deriva de polvo

  varying float vBrillo;

  void main() {
    vec3 p = position;
    float t = uTiempo * aVel + aFase * 6.283;

    if (uPlanea > 0.5) {
      // Vuelo: círculos amplios con una oscilación vertical lenta
      p.x += cos(t * 0.21) * aDeriva.x;
      p.z += sin(t * 0.17) * aDeriva.z;
      p.y += sin(t * 0.43 + aFase) * aDeriva.y;
    } else {
      // Deriva: sube en bucle y se balancea
      p.y = mod(p.y + uTiempo * aVel * 0.6, uAlto);
      p.x += sin(t * 0.3) * aDeriva.x;
      p.z += cos(t * 0.24) * aDeriva.z;
    }

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uTamano * aEscala * uDpr * (90.0 / max(1.0, -mv.z));
    // Se apagan de lejos: así la profundidad se lee sin más niebla
    vBrillo = smoothstep(900.0, 60.0, -mv.z);
  }
`;

const FRAGMENTO = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacidad;
  uniform sampler2D uMapa;
  varying float vBrillo;
  void main() {
    float a = texture2D(uMapa, gl_PointCoord).a * uOpacidad * vBrillo;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function familia({ cuantas, caja, centro, color, tamano, velocidad, deriva, planea, mapa, dpr }) {
  const pos = new Float32Array(cuantas * 3);
  const fase = new Float32Array(cuantas);
  const escala = new Float32Array(cuantas);
  const vel = new Float32Array(cuantas);
  const der = new Float32Array(cuantas * 3);
  for (let i = 0; i < cuantas; i++) {
    pos[i * 3] = (Math.random() - 0.5) * caja[0] + centro[0];
    pos[i * 3 + 1] = Math.random() * caja[1] + centro[1];
    pos[i * 3 + 2] = (Math.random() - 0.5) * caja[2] + centro[2];
    fase[i] = Math.random();
    escala[i] = 0.55 + Math.random() * 0.9;
    vel[i] = velocidad[0] + Math.random() * (velocidad[1] - velocidad[0]);
    der[i * 3] = deriva * (0.4 + Math.random());
    der[i * 3 + 1] = deriva * 0.4 * (0.4 + Math.random());
    der[i * 3 + 2] = deriva * (0.4 + Math.random());
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aFase', new THREE.BufferAttribute(fase, 1));
  geo.setAttribute('aEscala', new THREE.BufferAttribute(escala, 1));
  geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 1));
  geo.setAttribute('aDeriva', new THREE.BufferAttribute(der, 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERTICE,
    fragmentShader: FRAGMENTO,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTiempo: { value: 0 },
      uDpr: { value: dpr },
      uAlto: { value: caja[1] },
      uTamano: { value: tamano },
      uPlanea: { value: planea ? 1 : 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacidad: { value: 0 },
      uMapa: { value: mapa },
    },
  });
  const puntos = new THREE.Points(geo, mat);
  puntos.frustumCulled = false;
  puntos.userData.liberar = () => { geo.dispose(); mat.dispose(); };
  return puntos;
}

export function crearAmbiental({ caps }) {
  const grupo = new THREE.Group();
  const mapa = texturaMancha(0.35);
  const dpr = Math.min(window.devicePixelRatio || 1, caps.dpr);
  const n = caps.particulas;

  // Gaviotas sobre la dársena: pocas, grandes y lentas
  const gaviotas = familia({
    cuantas: Math.round(n * 0.14), caja: [700, 70, 420], centro: [0, 40, 60],
    color: 0xe8eef2, tamano: 3.2, velocidad: [0.25, 0.7], deriva: 26,
    planea: true, mapa, dpr,
  });
  // Polvo y bruma del patio: lo que da cuerpo al aire entre las grúas
  const polvo = familia({
    cuantas: Math.round(n * 0.55), caja: [620, 55, 340], centro: [0, 0, -60],
    color: 0xd9cfbe, tamano: 2.1, velocidad: [0.08, 0.32], deriva: 9,
    planea: false, mapa, dpr,
  });
  // Polvo de carretera, que acompaña al camión
  const ruta = familia({
    cuantas: Math.round(n * 0.31), caja: [90, 26, 700], centro: [0, 0, -400],
    color: 0xcfc4b2, tamano: 1.9, velocidad: [0.2, 0.8], deriva: 7,
    planea: false, mapa, dpr,
  });
  grupo.add(gaviotas, polvo, ruta);

  grupo.userData.actualizar = (mundo, reloj, ajustes, freno, camara) => {
    const p = mundo.p;
    const fuerza = ajustes.particulas * freno;
    for (const f of [gaviotas, polvo, ruta]) f.material.uniforms.uTiempo.value = reloj;
    // Cada familia se enciende donde tiene sentido y se apaga donde no
    gaviotas.material.uniforms.uOpacidad.value = fuerza * 0.5 * clamp(1 - (p - 0.32) / 0.14);
    polvo.material.uniforms.uOpacidad.value = fuerza * 0.26 * clamp(1 - (p - 0.5) / 0.14);
    ruta.material.uniforms.uOpacidad.value = fuerza * 0.2 * clamp((p - 0.5) / 0.12);
    gaviotas.visible = gaviotas.material.uniforms.uOpacidad.value > 0.004;
    polvo.visible = polvo.material.uniforms.uOpacidad.value > 0.004;
    ruta.visible = ruta.material.uniforms.uOpacidad.value > 0.004;
    // El polvo de ruta viaja con el camión: si no, se queda atrás en seguida
    ruta.position.z = mundo.camion.z + 340;
  };
  grupo.userData.liberar = () => {
    mapa.dispose();
    [gaviotas, polvo, ruta].forEach((f) => f.userData.liberar());
  };
  return grupo;
}
