/**
 * Materiales.
 *
 * La razón de que un puerto hecho por código se vea «de bloques» casi nunca es
 * la geometría: es que todo devuelve la luz igual. Un acero pintado, un
 * hormigón de solera, un asfalto mojado y un cristal de cabina reaccionan de
 * formas muy distintas, y si los cuatro tienen la misma rugosidad y ningún
 * relieve, el ojo los lee como el mismo plástico y la escena entera se aplana.
 *
 * Aquí viven los materiales de verdad del proyecto. Todos son PBR
 * —`MeshStandardMaterial`, que es el flujo metalness/roughness— y todos llevan
 * al menos un mapa de RELIEVE y uno de RUGOSIDAD generados por código. Esa es
 * la diferencia que más se nota y la que menos cuesta: un mapa de rugosidad
 * variable hace que una chapa plana tenga zonas mate y zonas que devuelven el
 * cielo, y con eso sola aparece la forma.
 *
 * Todo es PROCEDIMENTAL, sin un solo archivo externo:
 *
 *   · no hay ninguna licencia de terceros que verificar ni que arrastrar;
 *   · no añade un byte a la descarga —se generan en el navegador, una vez—;
 *   · y, sobre todo, las medidas casan con `MEDIDAS`, que están en metros
 *     reales: la corrugación de un contenedor cae cada 28 cm porque el
 *     contenedor mide 12,192 m, no porque una imagen viniera así.
 *
 * Los mapas se CACHEAN por clave: hay cientos de contenedores y cinco grúas, y
 * todos comparten las mismas texturas y los mismos materiales.
 */

import * as THREE from 'three';

/* ── Utilidades de lienzo ─────────────────────────────────────────── */

let RESOLUCION = 512;
/** La resolución de los mapas la fija el nivel de equipo, una sola vez. */
export function fijarResolucionMateriales(px) {
  RESOLUCION = Math.max(128, Math.min(1024, px | 0));
}

const cacheMapas = new Map();
const cacheMateriales = new Map();
const desechables = [];

function lienzo(w, h, pintar) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  pintar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  desechables.push(t);
  return t;
}

/** Ruido determinista: la misma semilla da siempre la misma chapa. */
function azarDe(semilla) {
  let s = (semilla * 2654435761) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * Ruido de valor con octavas, dibujado sobre un lienzo.
 *
 * Se usa para todo: el moteado del hormigón, el grano del asfalto, las vetas
 * de óxido. Es caro dibujarlo píxel a píxel en JavaScript, así que se pinta a
 * baja resolución y se deja que el filtrado del navegador lo suavice al
 * escalar: a la distancia a la que se ven estas superficies, la diferencia no
 * existe y el coste se divide por dieciséis.
 */
function ruido(ctx, w, h, { celdas = 16, octavas = 4, semilla = 1, alfa = 1 }) {
  const azar = azarDe(semilla);
  let amplitud = 1;
  let total = 0;
  for (let o = 0; o < octavas; o++) total += amplitud, amplitud *= 0.5;
  amplitud = 1;
  ctx.globalAlpha = 1;
  for (let o = 0; o < octavas; o++) {
    const n = celdas * 2 ** o;
    const paso = w / n;
    ctx.globalAlpha = (amplitud / total) * alfa;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = Math.round(azar() * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x * paso, (y * paso * h) / w, paso + 1, (paso * h) / w + 1);
      }
    }
    amplitud *= 0.5;
  }
  ctx.globalAlpha = 1;
}

/**
 * Convierte un mapa de altura en un mapa de NORMALES.
 *
 * Three.js no lo hace solo, y usar `bumpMap` no es equivalente: el bump se
 * calcula por derivadas de pantalla y en superficies rasantes —un muelle visto
 * casi de canto, que aquí pasa continuamente— se rompe. Un mapa de normales de
 * verdad aguanta cualquier ángulo.
 */
function aNormales(textura, fuerza = 1.6) {
  const origen = textura.image;
  const w = origen.width;
  const h = origen.height;
  const src = origen.getContext('2d').getImageData(0, 0, w, h).data;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const destino = ctx.createImageData(w, h);
  const alturaEn = (x, y) => src[((y & (h - 1)) * w + (x & (w - 1))) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (alturaEn(x + 1, y) - alturaEn(x - 1, y)) * fuerza;
      const dy = (alturaEn(x, y + 1) - alturaEn(x, y - 1)) * fuerza;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      destino.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      destino.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      destino.data[i + 2] = (1 / len) * 0.5 * 255 + 127;
      destino.data[i + 3] = 255;
    }
  }
  ctx.putImageData(destino, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  desechables.push(t);
  return t;
}

/** Mapa en escala de grises para `roughnessMap`: blanco = mate, negro = pulido. */
function mapaRugosidad(semilla, { celdas = 10, contraste = 0.45, base = 0.5 }) {
  return lienzo(RESOLUCION / 2, RESOLUCION / 2, (ctx, w, h) => {
    ctx.fillStyle = `rgb(${(base * 255) | 0},${(base * 255) | 0},${(base * 255) | 0})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'overlay';
    ruido(ctx, w, h, { celdas, octavas: 4, semilla, alfa: contraste });
    ctx.globalCompositeOperation = 'source-over';
  });
}

const cacheado = (clave, hacer) => {
  if (!cacheMapas.has(clave)) cacheMapas.set(clave, hacer());
  return cacheMapas.get(clave);
};

/* ── Relieves ─────────────────────────────────────────────────────── */

/**
 * Chapa de acero pintado: soldaduras, abolladuras suaves y algún golpe.
 * Es el relieve de fondo de casi toda la máquina del puerto.
 */
export const relieveChapa = (semilla = 1) => cacheado(`n:chapa:${semilla}`, () => {
  const altura = lienzo(RESOLUCION / 2, RESOLUCION / 2, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    ruido(ctx, w, h, { celdas: 6, octavas: 3, semilla, alfa: 0.35 });
    // Cordones de soldadura horizontales, como los paneles de una chapa
    const azar = azarDe(semilla + 7);
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = Math.max(1, w / 220);
    for (let i = 1; i < 4; i++) {
      const y = (h * i) / 4 + (azar() - 0.5) * 6;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) ctx.lineTo(x, y + Math.sin(x * 0.14 + i) * 1.2);
      ctx.stroke();
    }
    // Remaches
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 40; i++) {
      const r = Math.max(1, w / 260);
      ctx.beginPath();
      ctx.arc(azar() * w, azar() * h, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  return aNormales(altura, 1.1);
});

/** Hormigón de solera: junta de dilatación, áridos y desconchones. */
export const relieveHormigon = () => cacheado('n:hormigon', () => {
  const altura = lienzo(RESOLUCION, RESOLUCION, (ctx, w, h) => {
    ctx.fillStyle = '#7a7a7a';
    ctx.fillRect(0, 0, w, h);
    ruido(ctx, w, h, { celdas: 24, octavas: 4, semilla: 31, alfa: 0.5 });
    // Juntas: dos rayas hundidas que dan la retícula de losas
    ctx.strokeStyle = 'rgba(0,0,0,.85)';
    ctx.lineWidth = Math.max(2, w / 150);
    ctx.strokeRect(0, 0, w, h);
  });
  return aNormales(altura, 1.5);
});

/** Asfalto: grano grueso y la trama de la extendedora. */
export const relieveAsfalto = () => cacheado('n:asfalto', () => {
  const altura = lienzo(RESOLUCION, RESOLUCION, (ctx, w, h) => {
    ctx.fillStyle = '#787878';
    ctx.fillRect(0, 0, w, h);
    ruido(ctx, w, h, { celdas: 48, octavas: 3, semilla: 53, alfa: 0.75 });
  });
  return aNormales(altura, 2.2);
});

/* ── Materiales ───────────────────────────────────────────────────── */

function registrar(clave, material) {
  cacheMateriales.set(clave, material);
  return material;
}

/**
 * Acero pintado.
 *
 * El parámetro que más cambia la lectura es la RUGOSIDAD, y por eso lleva
 * mapa: una pintura industrial nunca es uniforme —se raya donde se toca, se
 * apaga donde le da el sol— y ese contraste es lo que hace que una viga tenga
 * volumen en lugar de ser una silueta plana.
 */
export function aceroPintado(color, { semilla = 1, rugosidad = 0.58, metal = 0.35, relieve = 1 } = {}) {
  const clave = `m:acero:${color}:${semilla}:${rugosidad}:${metal}:${relieve}`;
  if (cacheMateriales.has(clave)) return cacheMateriales.get(clave);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: rugosidad,
    metalness: metal,
    normalMap: relieve > 0 ? relieveChapa(semilla) : null,
    normalScale: new THREE.Vector2(relieve, relieve),
    roughnessMap: cacheado(`r:acero:${semilla}`, () => mapaRugosidad(semilla, { celdas: 8, contraste: 0.5, base: 0.55 })),
  });
  return registrar(clave, mat);
}

/** Acero desnudo: carriles, herrajes, cables. Muy metálico y poco rugoso. */
export function aceroDesnudo(color = 0x6d747c, rugosidad = 0.34) {
  const clave = `m:desnudo:${color}:${rugosidad}`;
  if (cacheMateriales.has(clave)) return cacheMateriales.get(clave);
  return registrar(clave, new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), roughness: rugosidad, metalness: 0.92,
    normalMap: relieveChapa(3),
    normalScale: new THREE.Vector2(0.5, 0.5),
  }));
}

/** Hormigón: muelles, soleras, muros. Nada metálico y muy rugoso. */
export function hormigon(color = 0x9a9891, repeticion = 8) {
  const clave = `m:hormigon:${color}:${repeticion}`;
  if (cacheMateriales.has(clave)) return cacheMateriales.get(clave);
  const n = relieveHormigon().clone();
  n.repeat.set(repeticion, repeticion);
  n.needsUpdate = true;
  desechables.push(n);
  const r = cacheado('r:hormigon', () => mapaRugosidad(19, { celdas: 14, contraste: 0.4, base: 0.78 })).clone();
  r.repeat.set(repeticion, repeticion);
  r.needsUpdate = true;
  desechables.push(r);
  return registrar(clave, new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), roughness: 0.94, metalness: 0.02,
    normalMap: n, normalScale: new THREE.Vector2(0.7, 0.7), roughnessMap: r,
  }));
}

/** Asfalto: oscuro, mate, con el grano marcado y algún brillo de rodadura. */
export function asfalto(repeticion = 40) {
  const clave = `m:asfalto:${repeticion}`;
  if (cacheMateriales.has(clave)) return cacheMateriales.get(clave);
  const n = relieveAsfalto().clone();
  n.repeat.set(repeticion, repeticion * 3);
  n.needsUpdate = true;
  desechables.push(n);
  return registrar(clave, new THREE.MeshStandardMaterial({
    color: 0x2a2b2e, roughness: 0.88, metalness: 0.04,
    normalMap: n, normalScale: new THREE.Vector2(0.9, 0.9),
  }));
}

/** Goma de neumático: negro mate absoluto, sin un reflejo. */
export const goma = () => cacheMateriales.get('m:goma') || registrar('m:goma',
  new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.96, metalness: 0.0 }));

/**
 * Cristal de cabina.
 *
 * Opaco y muy reflectante, no transparente. Una cabina de camión o de grúa
 * vista desde fuera y a plena luz es un espejo oscuro; hacerla transparente
 * obliga a modelar un interior que nadie va a mirar y, peor, deja ver el
 * paisaje a través del vehículo, que es exactamente lo que delata una escena
 * hecha con prisa.
 */
export const cristal = (tinte = 0x0d1a24) => cacheMateriales.get(`m:cristal:${tinte}`)
  || registrar(`m:cristal:${tinte}`, new THREE.MeshStandardMaterial({
    color: new THREE.Color(tinte), roughness: 0.08, metalness: 0.55,
    envMapIntensity: 1.4,
  }));

/** Superficie que EMITE: faros, pilotos, rótulos y semáforos. */
export function luminoso(color, fuerza = 1.6) {
  const clave = `m:luz:${color}:${fuerza}`;
  if (cacheMateriales.has(clave)) return cacheMateriales.get(clave);
  return registrar(clave, new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), emissive: new THREE.Color(color),
    emissiveIntensity: fuerza, roughness: 0.4, metalness: 0,
  }));
}

/** Pintura de señalización: blanco muy mate, sin brillo metálico. */
export const pintura = (color = 0xdfe3e2) => cacheMateriales.get(`m:pintura:${color}`)
  || registrar(`m:pintura:${color}`, new THREE.MeshStandardMaterial({
    color: new THREE.Color(color), roughness: 0.82, metalness: 0.0,
  }));

/** Libera todo lo compartido. Lo llama la escena al desmontarse. */
export function liberarMateriales() {
  for (const d of desechables) d.dispose?.();
  for (const m of cacheMateriales.values()) m.dispose?.();
  desechables.length = 0;
  cacheMapas.clear();
  cacheMateriales.clear();
}
