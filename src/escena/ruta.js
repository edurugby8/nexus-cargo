/**
 * EL GUION.
 *
 * Este archivo es el que manda. Contiene la idea que sostiene todo el
 * proyecto: **el mundo entero es una función pura del desplazamiento**.
 *
 * No hay estado acumulado en ninguna parte. La posición del buque, la altura
 * del spreader, el giro de las ruedas, el ángulo de la barrera y la pose de la
 * cámara se CALCULAN a partir de un único escalar `p ∈ [0,1]` sacado de
 * `window.scrollY`. De ahí salen gratis las cinco exigencias del encargo:
 *
 *   · bajar y volver a subir recorren exactamente la misma curva;
 *   · recargar a media página deja la escena en su capítulo;
 *   · el texto y la cámara no pueden desincronizarse, porque leen lo mismo;
 *   · saltar a un capítulo es asignar un número;
 *   · y no hace falta secuestrar la rueda para nada.
 *
 * La organización por capítulos con su propio tramo de scroll viene de
 * `deck-stage.js` (starter-components, CC0): se toma la idea, no el código.
 *
 * ── Geografía ─────────────────────────────────────────────────────────
 * Todo en METROS, y con las medidas de verdad: un contenedor de 40 pies mide
 * 12,19 × 2,44 × 2,90; el buque, 294 de eslora; la grúa pórtico, 82 de alto.
 * La sensación de escala monumental no se finge con el encuadre: sale sola
 * cuando las cifras son las que son.
 *
 * El mundo se recorre hacia −Z:
 *
 *      +Z  mar abierto
 *     +95  el buque, atracado de costado (su eje va en X)
 *     +40  el canto del muelle
 *       0  explanada de la terminal
 *     −80  escáner de aduanas
 *    −110  barrera de salida
 *    −640  carretera
 *    −730  centro logístico
 *    −812  destino final
 */

import { clamp, lerp, suave, suaveFuerte, salidaCubica, entradaSalida, pendulo } from '../lib/util.js';
import { CAPITULOS } from '../datos.js';

/* ── Reparto del scroll ───────────────────────────────────────────── */

const total = CAPITULOS.reduce((s, c) => s + c.tramo, 0);
let acumulado = 0;
/** Cada capítulo con su tramo normalizado dentro del recorrido completo. */
export const TRAMOS = CAPITULOS.map((c) => {
  const desde = acumulado / total;
  acumulado += c.tramo;
  return { ...c, desde, hasta: acumulado / total };
});

/** Alturas de ventana que ocupa el documento entero. */
export const ALTURAS = total;

/** En qué capítulo cae un progreso, y cuánto lleva recorrido dentro de él. */
export function capituloEn(p) {
  for (let i = 0; i < TRAMOS.length; i++) {
    const t = TRAMOS[i];
    if (p <= t.hasta || i === TRAMOS.length - 1) {
      return { indice: i, capitulo: t, local: clamp((p - t.desde) / (t.hasta - t.desde)) };
    }
  }
  return { indice: 0, capitulo: TRAMOS[0], local: 0 };
}

/** Progreso global correspondiente al inicio de un capítulo. */
export const inicioDe = (id) => (TRAMOS.find((t) => t.id === id) || TRAMOS[0]).desde;

/** Progreso local de un capítulo, o 0 si el recorrido va por otro sitio. */
const localDe = (p, id) => {
  const t = TRAMOS.find((x) => x.id === id);
  if (!t) return 0;
  return clamp((p - t.desde) / (t.hasta - t.desde));
};

/* ── Medidas del mundo ────────────────────────────────────────────── */

export const MEDIDAS = {
  contenedor: { largo: 12.19, ancho: 2.44, alto: 2.90 },   // 40' High Cube
  buque: { eslora: 294, manga: 48, francobordo: 14, casco: 11 },
  grua: { alto: 82, luz: 52, voladizo: 78, retro: 26, via: 30.5 },
  camion: { largo: 16.5, ancho: 2.55, alto: 4.0, plataforma: 1.25 },
  muelle: 40,          // z del canto del muelle
  amarre: { x: 0, z: 95 },
  gruaX: 20,           // la grúa que trabaja nuestro contenedor
  camionEspera: { x: 20, z: 12 },
  escaner: -80,
  barrera: -112,
  carretera: { desde: -140, hasta: -640 },
  centro: -730,
  destino: -812,
};

/* ── El buque ─────────────────────────────────────────────────────── */

/**
 * El NX ORION entra por babor con su eje siempre en X: no vira. Un buque de
 * 294 metros se aproxima casi paralelo al muelle y son los remolcadores los
 * que lo empujan de costado los últimos metros. Hacerle dar un giro cerrado
 * sería más vistoso y mucho menos creíble.
 */
export function barcoEn(p) {
  const mar = localDe(p, 'oceano');
  const puerto = localDe(p, 'puerto');
  const enPuerto = p >= TRAMOS[1].desde;

  // Avance: velocidad de crucero en mar abierto, deceleración larga al entrar
  const x = enPuerto
    ? lerp(-520, MEDIDAS.amarre.x, salidaCubica(puerto))
    : lerp(-1500, -520, suave(0, 1, mar));

  // Acercamiento lateral: los remolcadores empujan al final, no al principio
  const z = enPuerto
    ? lerp(150, MEDIDAS.amarre.z, suaveFuerte(0.35, 1, puerto))
    : 150;

  // Cuanto más despacio va, menos cabecea: la mar le pega distinto
  const marcha = enPuerto ? 1 - salidaCubica(puerto) : 1;
  return { x, z, marcha, atracado: enPuerto && puerto > 0.985 };
}

/* ── La grúa y el contenedor ──────────────────────────────────────── */

/**
 * El ciclo de descarga, por fases. Las fracciones son del capítulo, y están
 * repartidas como en una operación de verdad: bajar el spreader es lo más
 * lento, el traslado del carro lo más largo, y el aterrizaje sobre el
 * remolque otra vez lento porque ahí no se puede fallar.
 */
const FASES = {
  bajaVacio: [0.00, 0.14],
  encaja:    [0.14, 0.22],
  tensa:     [0.22, 0.28],
  iza:       [0.28, 0.46],
  traslada:  [0.46, 0.72],
  arria:     [0.72, 0.90],
  suelta:    [0.90, 1.00],
};
const fase = (t, [a, b]) => clamp((t - a) / (b - a));

export function gruaEn(p, ajustes = { velocidadGrua: 1, oscilacion: 1 }) {
  const t0 = localDe(p, 'grua');
  // El ajuste de velocidad adelanta o retrasa el ciclo dentro de su capítulo
  const t = clamp(t0 * ajustes.velocidadGrua);
  const antes = p < TRAMOS[2].desde;
  const despues = p >= TRAMOS[3].desde;

  const zBuque = MEDIDAS.amarre.z;
  const zCamion = MEDIDAS.camionEspera.z;
  const yCubierta = 32.5;        // parte alta de la pila donde viaja el nuestro
  const yCamion = MEDIDAS.camion.plataforma + MEDIDAS.contenedor.alto / 2;
  const yCrucero = 58;           // altura de paso por encima del buque

  if (antes) {
    return {
      carroZ: zBuque, spreaderY: yCrucero, cerrado: 0, tension: 0,
      contenedor: { x: MEDIDAS.gruaX, y: yCubierta, z: zBuque }, colgando: false,
      fase: 'espera', balanceo: 0,
    };
  }
  if (despues) {
    return {
      carroZ: zCamion, spreaderY: yCrucero, cerrado: 0, tension: 0,
      contenedor: null, colgando: false, fase: 'hecho', balanceo: 0,
    };
  }

  /* Altura del gancho. Cada tramo con su propia curva: el vacío baja rápido y
     frena al final; la carga sube con arranque lento; el aterrizaje es el más
     cuidadoso de todos. */
  let y = yCrucero;
  let carro = zBuque;
  let cerrado = 0;
  let tension = 0;
  let colgando = false;
  let nombre = 'bajaVacio';

  if (t < FASES.encaja[0]) {
    y = lerp(yCrucero, yCubierta, salidaCubica(fase(t, FASES.bajaVacio)));
  } else if (t < FASES.tensa[0]) {
    y = yCubierta;
    cerrado = entradaSalida(fase(t, FASES.encaja));
    nombre = 'encaja';
  } else if (t < FASES.iza[0]) {
    y = yCubierta;
    cerrado = 1;
    // Los cables se tensan ANTES de que la carga se despegue. Es el momento
    // que más delata a una grúa falsa: la de verdad no arranca de golpe.
    tension = entradaSalida(fase(t, FASES.tensa));
    colgando = true;
    nombre = 'tensa';
  } else if (t < FASES.traslada[0]) {
    cerrado = 1; tension = 1; colgando = true;
    y = lerp(yCubierta, yCrucero, entradaSalida(fase(t, FASES.iza)));
    nombre = 'iza';
  } else if (t < FASES.arria[0]) {
    cerrado = 1; tension = 1; colgando = true;
    y = yCrucero;
    carro = lerp(zBuque, zCamion, entradaSalida(fase(t, FASES.traslada)));
    nombre = 'traslada';
  } else if (t < FASES.suelta[0]) {
    cerrado = 1; tension = 1; colgando = true;
    carro = zCamion;
    y = lerp(yCrucero, yCamion, entradaSalida(fase(t, FASES.arria)));
    nombre = 'arria';
  } else {
    carro = zCamion;
    const s = fase(t, FASES.suelta);
    cerrado = 1 - entradaSalida(clamp(s * 2));
    y = lerp(yCamion, yCrucero, clamp((s - 0.4) / 0.6) ** 2);
    colgando = s < 0.4;
    nombre = 'suelta';
    tension = 1 - clamp(s * 2.5);
  }

  /* Balanceo de la carga.
     Treinta toneladas colgadas de cuatro cables no paran cuando para el carro.
     Se calcula la ACELERACIÓN del carro por diferencias finitas y se convierte
     en un péndulo amortiguado: la carga se queda atrás al arrancar y se
     adelanta al frenar, exactamente al revés de lo que hace el carro. */
  let balanceo = 0;
  if (colgando && nombre !== 'tensa') {
    const h = 0.004;
    const carroEn = (u) => {
      const f = fase(clamp(u), FASES.traslada);
      return lerp(zBuque, zCamion, entradaSalida(f));
    };
    const aceleracion = (carroEn(t + h) - 2 * carroEn(t) + carroEn(t - h)) / (h * h);
    const largoCable = Math.max(2, MEDIDAS.grua.alto - 8 - y);
    balanceo = clamp(-aceleracion * 1.1e-5, -1, 1) * Math.sqrt(largoCable) * 0.5;
    // Y al soltar el carro queda la oscilación libre, que se apaga sola
    if (nombre === 'arria' || nombre === 'suelta') {
      balanceo += pendulo(clamp((t - FASES.arria[0]) / 0.2), 1.1, 3.2) * 1.4;
    }
    balanceo *= ajustes.oscilacion;
  }

  const contenedor = colgando
    ? { x: MEDIDAS.gruaX, y, z: carro + balanceo }
    : (nombre === 'bajaVacio' || nombre === 'encaja')
      ? { x: MEDIDAS.gruaX, y: yCubierta, z: zBuque }
      : { x: MEDIDAS.gruaX, y: yCamion, z: zCamion };

  return { carroZ: carro, spreaderY: y, cerrado, tension, contenedor, colgando, fase: nombre, balanceo };
}

/* ── El camión ────────────────────────────────────────────────────── */

/**
 * Posición del camión a lo largo de todo el recorrido. Devuelve también la
 * VELOCIDAD, que es lo que alimenta el giro de las ruedas, el cabeceo de la
 * suspensión y la inclinación al acelerar y frenar. Se saca por diferencias
 * finitas de la propia posición, así que no puede desincronizarse de ella.
 */
function camionZ(p, ajustes) {
  const M = MEDIDAS;
  const v = ajustes?.velocidadCamion ?? 1;
  if (p < TRAMOS[3].desde) return M.camionEspera.z;

  const aduanas = localDe(p, 'aduanas');
  if (p < TRAMOS[4].desde) {
    // Del muelle al escáner, y parada en seco delante del arco
    const a = clamp(aduanas * 1.55 * v);
    return lerp(M.camionEspera.z, M.escaner, entradaSalida(a));
  }
  const salida = localDe(p, 'salida');
  if (p < TRAMOS[5].desde) {
    // Arranque desde parado: la barrera sube primero
    const a = clamp((salida - 0.18) / 0.82) * v;
    return lerp(M.escaner, M.carretera.desde, entradaSalida(clamp(a)));
  }
  const ruta = localDe(p, 'carretera');
  if (p < TRAMOS[6].desde) {
    return lerp(M.carretera.desde, M.carretera.hasta, suave(0, 1, ruta));
  }
  const centro = localDe(p, 'centro');
  if (p < TRAMOS[7].desde) {
    return lerp(M.carretera.hasta, M.centro, entradaSalida(clamp(centro * 1.15)));
  }
  const fin = localDe(p, 'entrega');
  return lerp(M.centro, M.destino, entradaSalida(clamp(fin * 1.35)));
}

export function camionEn(p, ajustes = { velocidadCamion: 1, suspension: 1 }) {
  const h = 0.0012;
  const z = camionZ(p, ajustes);
  const zAntes = camionZ(p - h, ajustes);
  const zDespues = camionZ(p + h, ajustes);
  // Velocidad y aceleración en unidades de progreso; sólo importan relativas
  const velocidad = (zAntes - zDespues) / (2 * h);
  const aceleracion = (zDespues - 2 * z + zAntes) / (h * h);

  const marcha = clamp(Math.abs(velocidad) / 2600);
  return {
    z,
    velocidad,
    marcha,                                    // 0 parado · 1 a su ritmo
    // Giro de rueda: es la DISTANCIA recorrida entre el radio, no un contador
    // aparte. Así una rueda nunca puede girar con el camión quieto.
    giroRueda: -z / 0.52,
    // Cabeceo: morro abajo al frenar, arriba al acelerar
    cabeceo: clamp(aceleracion * 2.2e-7, -1, 1) * 0.035 * (ajustes.suspension ?? 1),
    luces: p >= TRAMOS[4].desde - 0.02,
    entregado: p >= TRAMOS[7].desde + (TRAMOS[7].hasta - TRAMOS[7].desde) * 0.55,
  };
}

/* ── Aduanas ──────────────────────────────────────────────────────── */

export function aduanaEn(p) {
  const t = localDe(p, 'aduanas');
  const enAduana = p >= TRAMOS[3].desde && p < TRAMOS[5].desde;
  const salida = localDe(p, 'salida');
  return {
    escaneo: clamp((t - 0.42) / 0.3),              // barrido de rayos X
    lectura: clamp((t - 0.34) / 0.12),             // lectura del código
    verde: t > 0.82 || p >= TRAMOS[4].desde,       // el semáforo cambia
    barrera: p >= TRAMOS[4].desde ? suaveFuerte(0, 0.26, salida) : 0,
    activo: enAduana,
  };
}

/* ── Centro logístico ─────────────────────────────────────────────── */

export function centroEn(p) {
  const t = localDe(p, 'centro');
  return {
    puertas: suaveFuerte(0.12, 0.42, t),
    matricula: clamp((t - 0.06) / 0.14),
    activo: p >= TRAMOS[5].desde,
  };
}

/* ── Ambiente ─────────────────────────────────────────────────────── */

/**
 * Luz, niebla y cielo a lo largo del día.
 *
 * El viaje empieza al amanecer en alta mar y acaba al atardecer en el destino.
 * Eso no es decoración: es lo que hace que el recorrido se sienta como un
 * trayecto largo y no como ocho escenas sueltas. Todos los valores se
 * interpolan de forma continua, así que no hay ni un corte.
 */
const MOMENTOS = [
  /* p, cielo alto, horizonte, niebla, color de luz, fuerza, altura del sol.

     Los horizontes van CONTENIDOS a propósito. La primera versión los puso en
     pardos muy saturados y, combinados con la niebla, el encuadre entero se
     volvía del mismo color de barro: no se distinguía el mar del cielo ni del
     buque. Un amanecer sobre el mar es sobre todo azul con una franja cálida
     estrecha, no un filtro naranja encima de todo. */
  [0.00, 0x0a1a30, 0x6d6a72, 0.00058, 0xffb877, 1.15, 0.10],
  [0.13, 0x123a58, 0x8a8286, 0.00062, 0xffc48c, 1.30, 0.18],
  [0.25, 0x255083, 0xb9bfc2, 0.00068, 0xfff0d2, 1.85, 0.36],
  [0.40, 0x33659a, 0xc9d0d4, 0.00090, 0xfff6e4, 2.10, 0.52],
  [0.55, 0x3a70ac, 0xccd6de, 0.00105, 0xfffaf0, 2.20, 0.62],
  [0.72, 0x36699f, 0xc6c7c2, 0.00110, 0xfff3d8, 2.05, 0.54],
  [0.86, 0x223d5c, 0xab8f79, 0.00056, 0xffcf95, 1.35, 0.30],
  [1.00, 0x142640, 0x8f6a52, 0.00072, 0xff9e5c, 1.05, 0.14],
];

const mezclaHex = (a, b, t) => {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((Math.round(lerp(ar, br, t)) << 16)
    | (Math.round(lerp(ag, bg, t)) << 8)
    | Math.round(lerp(ab, bb, t)));
};

export function ambienteEn(p) {
  let i = 0;
  while (i < MOMENTOS.length - 2 && p > MOMENTOS[i + 1][0]) i++;
  const a = MOMENTOS[i];
  const b = MOMENTOS[i + 1];
  const t = suave(a[0], b[0], p);
  return {
    cieloAlto: mezclaHex(a[1], b[1], t),
    cieloHorizonte: mezclaHex(a[2], b[2], t),
    niebla: lerp(a[3], b[3], t),
    colorLuz: mezclaHex(a[4], b[4], t),
    fuerzaLuz: lerp(a[5], b[5], t),
    alturaSol: lerp(a[6], b[6], t),
  };
}

/* ── La cámara ────────────────────────────────────────────────────── */

/**
 * Los planos.
 *
 * Cada capítulo declara sus posiciones de cámara en su propio tiempo local.
 * Las que dependen de algo que se mueve —el buque, el contenedor, el camión—
 * se escriben como funciones del mundo; se evalúan una sola vez al arrancar,
 * en su propio punto del recorrido, y como todo es función pura del progreso
 * el resultado es exacto.
 *
 * Después, todos los planos de todos los capítulos se enhebran en UNA curva
 * continua. Ésa es la razón de que la cámara no pueda dar un salto ni un giro
 * brusco: no hay cortes entre capítulos porque no hay capítulos en la curva,
 * hay una sola trayectoria.
 */
const PLANOS = {
  oceano: [
    // Vista aérea alta, y descenso progresivo hacia el buque
    { t: 0.00, ancla: 'barco', pos: [-210, 430, 360], mira: [40, 18, 0], fov: 36 },
    { t: 0.45, ancla: 'barco', pos: [-60, 205, 225], mira: [60, 24, 0], fov: 40 },
    { t: 0.78, ancla: 'barco', pos: [150, 92, 140], mira: [10, 28, 0], fov: 46 },
    { t: 1.00, ancla: 'barco', pos: [236, 46, 96], mira: [40, 30, 0], fov: 50 },
  ],
  puerto: [
    { t: 0.00, ancla: 'barco', pos: [268, 52, 104], mira: [60, 30, 0], fov: 50 },
    // Plano desde tierra: las grúas aparecen entre la bruma
    { t: 0.42, ancla: 'mundo', pos: [205, 96, -12], mira: [40, 40, 96], fov: 44 },
    { t: 0.74, ancla: 'mundo', pos: [150, 62, 6], mira: [20, 30, 92], fov: 46 },
    { t: 1.00, ancla: 'mundo', pos: [96, 44, 26], mira: [24, 28, 92], fov: 48 },
  ],
  grua: [
    /* La cámara acompaña al contenedor toda la operación. Los planos van
       APARTADOS de la estructura: el primer intento los puso justo encima de
       la carga y la cámara acababa metida entre las celosías de la viga,
       mirando el pórtico por dentro. */
    /* Cerca. A cincuenta metros el contenedor era un detalle y el encuadre lo
       mandaba el castillo del buque; el protagonista de este capítulo mide
       doce metros y tiene que llenar el cuadro. Ninguna posición repetida:
       tres cuartos alto, lateral corto, contrapicado, y seguimiento. */
    { t: 0.00, ancla: 'contenedor', pos: [26, 9, 17], mira: [0, 0, 0], fov: 44 },
    { t: 0.22, ancla: 'contenedor', pos: [17, 2.5, 12], mira: [0, 0, 0], fov: 46 },
    { t: 0.42, ancla: 'contenedor', pos: [24, -6, 15], mira: [0, 2, 0], fov: 46 },
    { t: 0.62, ancla: 'contenedor', pos: [28, 5, 5], mira: [0, -1, 0], fov: 44 },
    { t: 0.82, ancla: 'contenedor', pos: [19, 4, 14], mira: [0, -1, 0], fov: 46 },
    { t: 1.00, ancla: 'camion', pos: [24, 10, 22], mira: [0, 3.5, 0], fov: 46 },
  ],
  aduanas: [
    { t: 0.00, ancla: 'camion', pos: [23, 10, 24], mira: [0, 4, 0], fov: 46 },
    { t: 0.38, ancla: 'camion', pos: [19, 6.5, 7], mira: [0, 4.2, -10], fov: 48 },
    { t: 0.68, ancla: 'camion', pos: [16, 8.5, -15], mira: [0, 4.4, 2], fov: 44 },
    { t: 1.00, ancla: 'camion', pos: [10, 6.2, -22], mira: [1, 4.6, 1], fov: 42 },
  ],
  salida: [
    // Plano bajo junto a la rueda: es lo que cuenta el peso del conjunto
    { t: 0.00, ancla: 'camion', pos: [7.5, 1.5, -15], mira: [1, 3.2, 2], fov: 44 },
    { t: 0.45, ancla: 'camion', pos: [13, 4.4, -20], mira: [0, 4, 3], fov: 46 },
    { t: 1.00, ancla: 'camion', pos: [17, 7.5, -26], mira: [0, 4.2, 6], fov: 46 },
  ],
  carretera: [
    /* Cinco posiciones distintas, y ninguna repetida: rueda, lateral, trasera,
       aérea y otra vez baja para el paso bajo el puente. */
    { t: 0.00, ancla: 'camion', pos: [16, 7, -30], mira: [0, 4.2, 4], fov: 46 },
    { t: 0.16, ancla: 'camion', pos: [5.6, 0.85, -2], mira: [1.5, 2.4, 8], fov: 52 },
    { t: 0.36, ancla: 'camion', pos: [14, 3.6, 1], mira: [0, 3.4, 3], fov: 44 },
    { t: 0.55, ancla: 'camion', pos: [1.5, 5.4, 26], mira: [0, 3.6, 2], fov: 42 },
    { t: 0.74, ancla: 'camion', pos: [34, 56, 30], mira: [0, 3, -6], fov: 38 },
    { t: 0.90, ancla: 'camion', pos: [12, 5.5, -22], mira: [0, 4, 4], fov: 46 },
    { t: 1.00, ancla: 'camion', pos: [18, 9, -34], mira: [0, 4, 2], fov: 46 },
  ],
  /* Ojo con los planos generales: es tentador plantar la cámara mirando al
     edificio, pero el camión sigue llegando y se queda fuera de cuadro —o
     peor, se mete por delante del objetivo—. Medido, uno de estos planos tenía
     el camión a ciento once grados del eje. Van anclados al camión con un
     desplazamiento amplio: el almacén entra en el encuadre solo, porque el
     camión va hacia él. */
  centro: [
    { t: 0.00, ancla: 'camion', pos: [22, 11, -40], mira: [0, 5, 2], fov: 44 },
    { t: 0.38, ancla: 'camion', pos: [52, 30, 62], mira: [-6, 2, -34], fov: 42 },
    { t: 0.72, ancla: 'camion', pos: [30, 13, 34], mira: [-2, 2, -26], fov: 46 },
    { t: 1.00, ancla: 'camion', pos: [20, 9.5, 26], mira: [0, 4.5, -4], fov: 46 },
  ],
  entrega: [
    { t: 0.00, ancla: 'camion', pos: [20, 9.5, 28], mira: [0, 4.5, -4], fov: 46 },
    { t: 0.45, ancla: 'camion', pos: [26, 8, -30], mira: [0, 4.2, 4], fov: 44 },
    { t: 0.78, ancla: 'camion', pos: [30, 15, -46], mira: [-2, 4, 6], fov: 42 },
    { t: 1.00, ancla: 'camion', pos: [40, 32, -74], mira: [-4, 3, 12], fov: 40 },
  ],
};

/**
 * Dónde está el anclaje de un plano en un progreso dado.
 *
 * Aquí está la corrección que más falta hacía. Antes los planos se guardaban
 * en coordenadas del mundo, calculadas una vez al arrancar. Eso funciona para
 * lo que no se mueve, pero el camión SIGUE AVANZANDO entre un plano y el
 * siguiente, y la cámara sólo coincidía con él justo en los planos: en medio
 * se separaban decenas de metros y el camión se salía del encuadre. En el
 * capítulo de carretera, sencillamente, no se veía el camión.
 *
 * Ahora cada plano es un DESPLAZAMIENTO respecto a lo que sigue, y el anclaje
 * se evalúa en el progreso ACTUAL. La cámara acompaña exactamente a su
 * objetivo y lo que se interpola es sólo el encuadre.
 */
function anclajeEn(nombre, p) {
  if (nombre === 'barco') {
    const b = barcoEn(p);
    return [b.x, 0, b.z];
  }
  if (nombre === 'contenedor') {
    const g = gruaEn(p);
    const c = g.contenedor || { x: MEDIDAS.gruaX, y: 3, z: MEDIDAS.camionEspera.z };
    return [c.x, c.y, c.z];
  }
  if (nombre === 'camion') {
    return [MEDIDAS.gruaX, 0, camionZ(p, { velocidadCamion: 1 })];
  }
  return [0, 0, 0];
}

/** Estado completo del mundo en un progreso dado. Función pura. */
export function mundoEn(p, ajustes) {
  const a = ajustes || { velocidadGrua: 1, oscilacion: 1, velocidadCamion: 1, suspension: 1 };
  return {
    p,
    barco: barcoEn(p),
    grua: gruaEn(p, a),
    camion: camionEn(p, a),
    aduana: aduanaEn(p),
    centro: centroEn(p),
    ambiente: ambienteEn(p),
  };
}

/* Los planos, ordenados en una sola lista por progreso. */
const CLAVES = [];
for (const tramo of TRAMOS) {
  const lista = PLANOS[tramo.id];
  if (!lista) continue;
  for (const plano of lista) {
    CLAVES.push({
      p: lerp(tramo.desde, tramo.hasta, plano.t),
      pos: plano.pos, mira: plano.mira, fov: plano.fov,
      ancla: plano.ancla || 'mundo',
    });
  }
}
CLAVES.sort((a, b) => a.p - b.p);

/* Planos coincidentes: el último de un capítulo y el primero del siguiente
   caen en el MISMO punto del recorrido. Si se dejan los dos y no dicen lo
   mismo, la curva tiene que recorrer esa diferencia en cero progreso, y eso es
   un corte de cámara —medido, 104 metros de salto—.

   Cómo se resuelve depende del ANCLAJE:

   · si los dos siguen lo mismo, se funden en uno, que es la intención de los
     dos a la vez;
   · si siguen cosas distintas, fundirlos no significa nada: un «46 metros a la
     derecha» del contenedor y un «96 metros» del origen del mundo no se pueden
     promediar. Se descarta el SALIENTE y manda el entrante, de modo que el
     tramo anterior enhebra hasta él y el relevo de anclaje se reparte a lo
     largo de un tramo con anchura de verdad. */
for (let i = CLAVES.length - 2; i >= 0; i--) {
  if (CLAVES[i + 1].p - CLAVES[i].p > 1e-6) continue;
  const a = CLAVES[i];
  const b = CLAVES[i + 1];
  if (a.ancla === b.ancla) {
    a.pos = a.pos.map((v, k) => (v + b.pos[k]) / 2);
    a.mira = a.mira.map((v, k) => (v + b.mira[k]) / 2);
    a.fov = (a.fov + b.fov) / 2;
    CLAVES.splice(i + 1, 1);
  } else {
    CLAVES.splice(i, 1);
  }
}

/**
 * Hermite cúbico con parametrización NO uniforme.
 *
 * La versión de libro de Catmull-Rom supone que los puntos están
 * equiespaciados. Aquí no lo están ni de lejos —un capítulo tiene siete planos
 * y otro tres—, y tratarlos como si lo estuvieran produce sobreoscilaciones:
 * la cámara se pasa de largo y vuelve. Escalando las tangentes por la
 * separación real de cada tramo, la curva pasa por todos los puntos con la
 * derivada continua, que es justo lo que significa «sin giros bruscos».
 */
const hermite = (P0, P1, P2, P3, p0, p1, p2, p3, t) => {
  const h = p2 - p1;
  const m1 = ((P2 - P0) / Math.max(1e-9, p2 - p0)) * h;
  const m2 = ((P3 - P1) / Math.max(1e-9, p3 - p1)) * h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * P1
    + (t3 - 2 * t2 + t) * m1
    + (-2 * t3 + 3 * t2) * P2
    + (t3 - t2) * m2;
};

/**
 * Pose de la cámara en un progreso dado. Función pura, sin estado.
 * La amortiguación NO va aquí: va en el bucle, sobre el resultado. Mezclar
 * las dos cosas es lo que hace que una página se desincronice al subir.
 */
export function poseEn(p, salida = {}) {
  const n = CLAVES.length;
  let i = 0;
  while (i < n - 2 && p > CLAVES[i + 1].p) i++;
  const c1 = CLAVES[i];
  const c2 = CLAVES[Math.min(n - 1, i + 1)];
  const c0 = CLAVES[Math.max(0, i - 1)];
  const c3 = CLAVES[Math.min(n - 1, i + 2)];
  const t = c2.p > c1.p ? clamp((p - c1.p) / (c2.p - c1.p)) : 0;

  /* Nada de suavizar el parámetro dentro del tramo. Parece buena idea —«que
     cada plano entre y salga despacio»— pero anula la derivada en cada nudo,
     así que la cámara SE PARA en cada plano y vuelve a arrancar. Justo lo
     contrario de un recorrido continuo. La suavidad la da el Hermite, que
     empalma los tramos con la derivada continua; el resto lo pone la
     amortiguación del bucle. */
  /* El anclaje se evalúa en el progreso ACTUAL, no en el del plano. Cuando
     dos planos consecutivos siguen cosas distintas —el contenedor y luego el
     camión— se mezclan los dos anclajes a lo largo del tramo, y como en ese
     momento el contenedor va justo encima del camión, el relevo no se nota. */
  const anclaA = anclajeEn(c1.ancla, p);
  const anclaB = anclajeEn(c2.ancla, p);

  salida.pos = salida.pos || [0, 0, 0];
  salida.mira = salida.mira || [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const ancla = lerp(anclaA[k], anclaB[k], t);
    salida.pos[k] = ancla + hermite(c0.pos[k], c1.pos[k], c2.pos[k], c3.pos[k],
      c0.p, c1.p, c2.p, c3.p, t);
    salida.mira[k] = ancla + hermite(c0.mira[k], c1.mira[k], c2.mira[k], c3.mira[k],
      c0.p, c1.p, c2.p, c3.p, t);
  }
  salida.fov = lerp(c1.fov, c2.fov, t);
  return salida;
}

/** Cuántos planos tiene el recorrido. Para diagnóstico y pruebas. */
export const NUM_PLANOS = CLAVES.length;
