/**
 * Utilidades compartidas: interpolación, curvas y medida del equipo.
 *
 * Las curvas de aceleración vienen de las ideas de `animations-v3.jsx`
 * (starter-components, CC0). No se copia el archivo —aquél es React— sino el
 * principio: el scroll y el puntero no MUEVEN nada, empujan un valor que
 * después se amortigua.
 */

export const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));

export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Interpolación exponencial independiente de la frecuencia de refresco.
 *
 * El delta SIEMPRE llega acotado por los DOS lados desde el bucle. Con un
 * delta negativo —que sale de mezclar el sello de `requestAnimationFrame` con
 * `performance.now()` en equipos lentos— esto se convierte en una exponencial
 * creciente y la escena se va de escala sin dar ningún error.
 */
export const damp = (actual, objetivo, lambda, dt) =>
  actual + (objetivo - actual) * (1 - Math.exp(-lambda * dt));

/** Rampa suave entre dos límites. */
export const suave = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Rampa aún más suave: derivada nula en los dos extremos. */
export const suaveFuerte = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/* ── Curvas de aceleración ─────────────────────────────────────────
   La maquinaria pesada NUNCA arranca ni para de golpe. Una grúa que mueve
   treinta toneladas tarda en ponerse en marcha y tarda en frenar, y eso se ve:
   es la diferencia entre una máquina y un objeto sin peso. */

export const entradaSalida = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const salidaCubica = (t) => 1 - (1 - t) ** 3;
export const entradaCubica = (t) => t * t * t;
export const salidaQuinta = (t) => 1 - (1 - t) ** 5;
/** Arranque lento y frenada larga: el perfil de un carro de grúa. */
export const arranqueYFrenada = (t) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x) ** 1.0 * 0.5 + entradaSalida(x) * 0.5;
};

/** Ruido de valor barato y repetible. Suficiente para dispersar cosas. */
export function ruido(x, y = 0, semilla = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + semilla * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/** Generador con semilla, para que el paisaje salga igual en cada visita. */
export function azarCon(semilla) {
  let s = semilla >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * Oscilación amortiguada: lo que hace un contenedor colgado de unos cables
 * cuando el carro para. Amplitud que decae, frecuencia constante.
 */
export const pendulo = (t, frecuencia = 2.4, decaimiento = 2.2) =>
  Math.sin(t * frecuencia * Math.PI * 2) * Math.exp(-t * decaimiento);

export const reducido = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const punteroFino = () =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Cuatro niveles de calidad.
 *
 * Lo que cambia entre ellos es la CANTIDAD de geometría, de partículas y de
 * resolución, no el aspecto: en el nivel bajo la escena es la misma, con menos
 * de todo. Un nivel que cambiase el aspecto haría imposible afinar la
 * dirección artística, porque cada equipo vería otra cosa.
 */
export function medirEquipo() {
  const nucleos = navigator.hardwareConcurrency || 4;
  const memoria = navigator.deviceMemory || 4;
  const dpr = window.devicePixelRatio || 1;
  const ancho = window.innerWidth;
  const fino = punteroFino();

  let nivel = 'alto';
  if (nucleos <= 6 || memoria <= 4 || ancho < 1100) nivel = 'medio';
  if (nucleos <= 4 || memoria <= 3 || ancho < 760) nivel = 'bajo';
  if (nucleos <= 2 || memoria <= 2) nivel = 'minimo';

  /* `?calidad=alto` fuerza el nivel.
     No es un capricho de depuración: el nivel cambia CUÁNTA geometría hay —el
     patio pasa de seis bloques a veinticuatro— y sin poder fijarlo, el banco
     de pruebas medía siempre en «bajo», que es el nivel que le toca a un
     contenedor sin tarjeta gráfica, mientras el visitante con un portátil
     normal ve «alto». Dos escenarios distintos, y las pruebas verdes en el
     que nadie mira. */
  const pedido = new URLSearchParams(window.location.search).get('calidad');
  if (['alto', 'medio', 'bajo', 'minimo'].includes(pedido)) nivel = pedido;

  const webgl = (() => {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  })();

  const porNivel = (alto, medio, bajo, minimo) =>
    ({ alto, medio, bajo, minimo })[nivel];

  return {
    nivel,
    webgl,
    punteroFino: fino,
    dpr: porNivel(Math.min(dpr, 2), Math.min(dpr, 1.7), Math.min(dpr, 1.4), 1),
    antialias: nivel === 'alto' || nivel === 'medio',
    sombras: nivel === 'alto',
    // Cuántos contenedores apilados hay en el puerto (van instanciados)
    // Divisiones de la malla del mar
    mar: porNivel(160, 110, 72, 44),
    // Partículas ambientales: gaviotas, polvo, salpicadura
    particulas: porNivel(340, 200, 110, 50),
    // Objetos de carretera (señales, barreras, farolas, vegetación)
    carretera: porNivel(150, 100, 60, 34),
    // Tráfico secundario
    trafico: porNivel(14, 9, 5, 2),
    // Lado de las texturas procedurales
    textura: porNivel(1024, 512, 512, 256),
    // Distancia de dibujo
    lejos: porNivel(2600, 2200, 1800, 1400),
  };
}
