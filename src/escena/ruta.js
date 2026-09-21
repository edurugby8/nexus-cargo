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
  /* `apoyo` es lo que hay del origen del camión al CENTRO de su carga, hacia
     atrás. Una tractora con semirremolque no lleva la caja encima del morro:
     la lleva seis metros y medio por detrás, sobre la quinta rueda. Este
     número estaba escrito a mano en el camión y no existía en el guion, así
     que la grúa bajaba el contenedor sobre la CABINA y al soltarlo saltaba
     6,4 m hacia atrás y se hundía metro y medio dentro del remolque. Ahora es
     una sola medida y los dos la leen de aquí. */
  camion: { largo: 16.5, ancho: 2.55, alto: 4.0, plataforma: 1.25, apoyo: 6.4 },
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

/**
 * EL CARRIL DEL CAMIÓN.
 *
 * Un pasillo continuo y despejado desde donde la grúa deja el contenedor
 * sobre el remolque hasta pasada la barrera de salida. Aquí está escrito una
 * sola vez y de aquí lo leen los tres que tienen que estar de acuerdo: el
 * patio, que se aparta; la prueba, que comprueba que nadie se ha metido; y la
 * cámara, que sabe por dónde va a pasar el camión.
 *
 * Hasta ahora esto no existía. Había un `x = 20` repetido en media docena de
 * sitios y cada objeto se colocaba por su cuenta, así que cada vez que algo se
 * metía en el paso había que descubrirlo mirando, corregir ESE objeto, y
 * esperar al siguiente. Un carril declarado convierte eso en una invariante:
 * no se comprueba que el camión no chocara en los puntos que a uno se le
 * ocurrió muestrear, se comprueba que EL PASILLO ESTÁ VACÍO, que es una
 * propiedad del mundo y no del muestreo.
 *
 * Las medidas: el camión mide 2,55 de ancho y 4,75 con el contenedor encima.
 * Cuatro metros a cada lado del eje dejan 2,7 de holgura por banda —más que
 * un carril de autopista— y el gálibo de 6,5 pasa por debajo del dintel del
 * escáner, que arranca a 8,3.
 *
 * Lo que SÍ puede estar dentro va marcado `franqueable`: el carril de la grúa,
 * que va embebido en el pavimento y se cruza como en cualquier puerto, y el
 * brazo de la barrera, que está para cortar el paso y se levanta antes de que
 * el camión llegue. Esos dos se comprueban aparte.
 */
export const CORREDOR = {
  x: MEDIDAS.gruaX,
  media: 4,                                          // media anchura libre
  alto: 6.5,                                         // gálibo
  patio: 36,                                         // retranqueo del patio
  desde: MEDIDAS.camionEspera.z + 18,                // por detrás del remolque
  hasta: MEDIDAS.barrera - 14,                       // pasada la barrera
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
 * EL CICLO DE DESCARGA, EN TRECE PASOS.
 *
 * La primera versión tenía siete fases y no se entendía. No porque faltara
 * movimiento, sino porque faltaban los momentos MUERTOS: la grúa bajaba,
 * agarraba, subía y trasladaba sin detenerse nunca, y una operación sin pausas
 * se lee como una animación, no como una máquina trabajando. Lo que hace
 * comprensible una descarga es exactamente lo contrario de lo que parece: los
 * instantes en los que NO pasa nada mientras algo se decide.
 *
 * Los trece pasos, con lo que cada uno aporta a que se entienda:
 *
 *   1  aproxima   el carro sale sobre el buque · establece de dónde viene
 *   2  bajaVacio  el spreader desciende vacío · da la altura del buque
 *   3  alinea     corrección lateral fina · dice que hay alguien pilotando
 *   4  posa       el spreader toca la pila · el primer contacto
 *   5  encaja     giran los twistlocks · el agarre, en primer plano
 *   6  tensa      los cables cogen carga, nada se mueve · el peso
 *   7  despega    los primeros dos metros, muy lentos · el momento crítico
 *   8  iza        izado completo hasta altura de paso
 *   9  traslada   el carro cruza hacia tierra · el recorrido largo
 *  10  frena      el carro para y la carga sigue · las treinta toneladas
 *  11  arria      descenso sobre el remolque
 *  12  asienta    el apoyo, y la suspensión del camión cede
 *  13  suelta     se abren los twistlocks y el spreader se va
 *
 * Los tramos NO son iguales, y ahí está media legibilidad: `encaja` y `tensa`
 * ocupan casi tanto scroll como el traslado entero aunque no muevan nada, y
 * `despega` dura lo mismo que un izado seis veces más largo. Es el reparto de
 * una operación de verdad, donde el tiempo se va en los milímetros.
 */
const PASOS = [
  ['aproxima',  0.000, 0.075],
  ['bajaVacio', 0.075, 0.175],
  ['alinea',    0.175, 0.225],
  ['posa',      0.225, 0.270],
  ['encaja',    0.270, 0.340],
  ['tensa',     0.340, 0.400],
  ['despega',   0.400, 0.470],
  ['iza',       0.470, 0.580],
  ['traslada',  0.580, 0.715],
  ['frena',     0.715, 0.770],
  /* El descenso sobre el remolque es el tramo MÁS LARGO de los trece, y no
     por capricho. Ocupaba el 8 % del capítulo para bajar cincuenta y cinco
     metros: a ritmo de lectura normal, dos décimas de segundo. Se veía un
     borrón, no una maniobra. Aquí es donde una operación de verdad se toma su
     tiempo, porque es donde no se puede fallar, y el guion ahora lo refleja.
     Lo cazó la prueba de velocidad por tramo del guion. */
  ['arria',     0.770, 0.900],
  ['asienta',   0.900, 0.950],
  ['suelta',    0.950, 1.000],
];

/** En qué paso cae un tiempo local, y cuánto lleva recorrido dentro de él. */
function pasoEn(t) {
  for (let i = 0; i < PASOS.length; i++) {
    const [nombre, a, b] = PASOS[i];
    if (t < b || i === PASOS.length - 1) {
      return { indice: i, nombre, local: clamp((t - a) / (b - a)) };
    }
  }
  return { indice: 0, nombre: PASOS[0][0], local: 0 };
}

/** Los nombres, en orden. Para las pruebas y para el panel. */
export const PASOS_GRUA = PASOS.map((p) => p[0]);

export function gruaEn(p, ajustes = { velocidadGrua: 1, oscilacion: 1 }) {
  const t0 = localDe(p, 'grua');
  // El ajuste de velocidad adelanta o retrasa el ciclo dentro de su capítulo
  const t = clamp(t0 * ajustes.velocidadGrua);
  const antes = p < TRAMOS[2].desde;
  const despues = p >= TRAMOS[3].desde;

  const zBuque = MEDIDAS.amarre.z;
  // Donde la grúa deja la carga: sobre la PLATAFORMA, no sobre la cabina
  const zCamion = MEDIDAS.camionEspera.z + MEDIDAS.camion.apoyo;
  const yCubierta = 32.5;        // parte alta de la pila donde viaja el nuestro
  // La plataforma del remolque se mide desde el firme, no desde la cota cero
  const yCamion = sueloEn(MEDIDAS.camionEspera.z)
    + MEDIDAS.camion.plataforma + MEDIDAS.contenedor.alto / 2;
  /* Altura de paso. Era 58 y la viga del pórtico está a 61: tres metros de
     hueco. Consecuencia geométrica ineludible: con la carga a 58 y la viga a
     61, CUALQUIER cámara por encima del contenedor tenía la viga en medio.
     Medido, tapaba el 78 % del contenedor en escritorio y el 89 % en móvil.
     No era un plano mal elegido, era imposible de elegir bien.

     Una grúa sube lo JUSTO para salvar la pila del buque, que remata a 32,5.
     Con 38, el fondo del contenedor pasa dos metros y medio por encima de la
     pila —que es lo que hace una grúa de verdad— y quedan veintitrés metros
     libres por debajo de la viga. Ahí sí cabe una cámara mirando la carga
     desde arriba sin tener la viga en medio: a 48 m de distancia y 22° de
     elevación, la cámara queda a 57, cuatro metros por debajo de la viga.

     Es geometría, no gusto: la altura de paso y el ángulo de cámara están
     atados, y elegir uno sin el otro es lo que hacía imposible encuadrar este
     capítulo. */
  const yCrucero = 38;           // altura de paso por encima del buque
  const zEspera = zBuque + 26;   // de dónde sale el carro al empezar

  if (antes) {
    return {
      carroZ: zEspera, spreaderY: yCrucero, cerrado: 0, tension: 0,
      contenedor: { x: MEDIDAS.gruaX, y: yCubierta, z: zBuque }, colgando: false,
      fase: 'espera', paso: -1, avance: 0, balanceo: 0, desvio: 0, asiento: 0,
    };
  }
  if (despues) {
    return {
      carroZ: zCamion, spreaderY: yCamion + 14, cerrado: 0, tension: 0,
      contenedor: null, colgando: false,
      fase: 'hecho', paso: PASOS.length, avance: 1, balanceo: 0, desvio: 0, asiento: 0,
    };
  }

  const { indice, nombre, local } = pasoEn(t);

  /* Estado por defecto: el del comienzo del ciclo. Cada paso cambia sólo lo
     suyo, y lo que no toca se queda donde lo dejó el anterior. Escribirlo así
     —en vez de una cadena de `if` con todo repetido— es lo que permitió pasar
     de siete pasos a trece sin que el archivo se volviera ilegible. */
  let carro = zBuque;
  let y = yCubierta;
  let cerrado = 0;
  let tension = 0;
  let colgando = false;
  let desvio = 0;      // corrección lateral del spreader, en metros
  let asiento = 0;     // cuánto ha cedido la suspensión del camión

  switch (nombre) {
    case 'aproxima':
      carro = lerp(zEspera, zBuque, entradaSalida(local));
      y = yCrucero;
      desvio = lerp(0.9, 0.35, local);
      break;
    case 'bajaVacio':
      // Baja rápido y frena al final: nadie se acerca despacio desde arriba
      y = lerp(yCrucero, yCubierta + 1.4, salidaCubica(local));
      desvio = lerp(0.35, 0.12, local);
      break;
    case 'alinea':
      /* La corrección fina. Dos tanteos que se van apagando: es el gesto que
         más dice que hay una persona en la cabina, y cuesta una línea. */
      y = yCubierta + 1.4 - 1.1 * entradaSalida(local);
      desvio = 0.12 * Math.cos(local * Math.PI * 2.5) * (1 - local);
      break;
    case 'posa':
      y = lerp(yCubierta + 0.3, yCubierta, salidaCubica(local));
      break;
    case 'encaja':
      // Los twistlocks giran un cuarto de vuelta. Nada más se mueve.
      cerrado = entradaSalida(local);
      break;
    case 'tensa':
      /* Los cables se tensan ANTES de que la carga se despegue. Es el momento
         que más delata a una grúa falsa: la de verdad no arranca de golpe. */
      cerrado = 1;
      tension = entradaSalida(local);
      colgando = true;
      break;
    case 'despega':
      // Dos metros, y son los más lentos de los ochenta que va a subir
      cerrado = 1; tension = 1; colgando = true;
      y = yCubierta + 2 * entradaSalida(local);
      break;
    case 'iza':
      cerrado = 1; tension = 1; colgando = true;
      y = lerp(yCubierta + 2, yCrucero, entradaSalida(local));
      break;
    case 'traslada':
      cerrado = 1; tension = 1; colgando = true;
      y = yCrucero;
      carro = lerp(zBuque, zCamion + 4, suave(0, 1, local));
      break;
    case 'frena':
      /* El carro llega y para. La carga no: sigue, se pasa, y vuelve. Este
         paso no existía y es el que convierte la caja en treinta toneladas. */
      cerrado = 1; tension = 1; colgando = true;
      y = yCrucero;
      carro = lerp(zCamion + 4, zCamion, salidaCubica(local));
      break;
    case 'arria':
      cerrado = 1; tension = 1; colgando = true;
      carro = zCamion;
      y = lerp(yCrucero, yCamion + 0.25, entradaSalida(local));
      break;
    case 'asienta':
      cerrado = 1; colgando = true;
      carro = zCamion;
      y = lerp(yCamion + 0.25, yCamion, salidaCubica(local));
      // Los cables se destensan a medida que el remolque coge el peso
      tension = 1 - entradaSalida(local);
      asiento = entradaSalida(local);
      break;
    default: {           // 'suelta'
      carro = zCamion;
      cerrado = 1 - entradaSalida(clamp(local * 2.2));
      /* El spreader se retira lo justo para dejar libre el contenedor: unos
         catorce metros, no los cincuenta y cinco de la altura de crucero.
         Subirlo entero en el cinco por ciento final del capítulo era un
         tirón —1,26 m entre fotogramas contiguos, medido por la prueba de
         continuidad—, y además no es lo que hace una grúa: sube a salvar la
         carga y espera ahí al siguiente ciclo.
         Con derivada nula en los dos extremos, para que ni arranque ni pare
         de golpe. */
      y = lerp(yCamion, yCamion + 14, entradaSalida(clamp((local - 0.35) / 0.65)));
      colgando = false;
      asiento = 1;
      break;
    }
  }

  /* Balanceo de la carga.
     Treinta toneladas colgadas de cuatro cables no paran cuando para el carro.
     Se calcula la ACELERACIÓN del carro por diferencias finitas sobre la misma
     función que lo mueve, y se convierte en un péndulo amortiguado: la carga
     se queda atrás al arrancar y se adelanta al frenar, exactamente al revés
     de lo que hace el carro. */
  let balanceo = 0;
  if (colgando && nombre !== 'tensa') {
    const h = 0.003;
    const aceleracion = (carroDe(t + h) - 2 * carroDe(t) + carroDe(t - h)) / (h * h);
    const largoCable = Math.max(2, MEDIDAS.grua.alto - 8 - y);
    balanceo = clamp(-aceleracion * 1.1e-5, -1, 1) * Math.sqrt(largoCable) * 0.5;
    // Pasado el frenazo queda la oscilación libre, que se apaga sola
    if (nombre === 'frena' || nombre === 'arria' || nombre === 'asienta') {
      const desde = PASOS[9][1];
      balanceo += pendulo(clamp((t - desde) / 0.22), 1.1, 3.2) * 1.6;
    }
    balanceo *= ajustes.oscilacion;
  }

  const contenedor = colgando
    ? { x: MEDIDAS.gruaX + desvio, y, z: carro + balanceo }
    : (indice <= 4)
      ? { x: MEDIDAS.gruaX, y: yCubierta, z: zBuque }
      : { x: MEDIDAS.gruaX, y: yCamion, z: zCamion };

  return {
    carroZ: carro, spreaderY: y, cerrado, tension, contenedor, colgando,
    fase: nombre, paso: indice, avance: local, balanceo, desvio, asiento,
  };
}

/** Dónde está el carro en un tiempo local dado. Se usa para derivarlo. */
function carroDe(t) {
  const { nombre, local } = pasoEn(clamp(t));
  const zBuque = MEDIDAS.amarre.z;
  // Donde la grúa deja la carga: sobre la PLATAFORMA, no sobre la cabina
  const zCamion = MEDIDAS.camionEspera.z + MEDIDAS.camion.apoyo;
  if (nombre === 'aproxima') return lerp(zBuque + 26, zBuque, entradaSalida(local));
  if (nombre === 'traslada') return lerp(zBuque, zCamion + 4, suave(0, 1, local));
  if (nombre === 'frena') return lerp(zCamion + 4, zCamion, salidaCubica(local));
  return pasoEn(clamp(t)).indice < 8 ? zBuque : zCamion;
}

/* ── El camión ────────────────────────────────────────────────────── */

/**
 * ALTURA DEL FIRME BAJO EL CAMIÓN.
 *
 * El camión rodaba a cota cero de punta a punta del viaje, y el mundo no está
 * a cota cero: el muelle es una plataforma de hormigón a 60 cm sobre el nivel
 * del mar, la carretera es asfalto a ras de terreno y las explanadas del
 * centro y del destino están casi un palmo por debajo de la carretera.
 *
 * Resultado: dentro del puerto el camión llevaba las ruedas MEDIO METRO
 * metidas en el hormigón —medio neumático enterrado, y es lo que le hacía
 * atravesar los carriles de las grúas de muelle, que van apoyados sobre esa
 * misma explanada— y en el centro logístico flotaba sesenta y siete
 * centímetros por encima del pavimento.
 *
 * Aquí se devuelve la cota del pavimento en cada punto del recorrido, con una
 * rampa de treinta metros en cada cambio: es lo que hay de verdad entre la
 * plataforma del muelle y la carretera, y treinta metros a la velocidad a la
 * que va el camión son un segundo largo, así que se lee como un desnivel y no
 * como un escalón. Lo usan el camión, la carga que lleva encima y el ancla de
 * cámara que lo sigue, de manera que los tres no pueden separarse.
 */
export function sueloEn(z) {
  const MUELLE = 0.6;        // la explanada de hormigón del puerto
  const ASFALTO = 0.02;      // la calzada
  const RECINTO = -0.67;     // las explanadas del centro y del destino
  const RAMPA = 30;
  const finPuerto = MEDIDAS.carretera.desde + 20;      // −120: pasada la barrera
  const bocaRecinto = MEDIDAS.centro + 76;             // antes de la entrada
  if (z > finPuerto) return MUELLE;
  if (z > finPuerto - RAMPA) return lerp(MUELLE, ASFALTO, (finPuerto - z) / RAMPA);
  if (z > bocaRecinto) return ASFALTO;
  if (z > bocaRecinto - RAMPA) return lerp(ASFALTO, RECINTO, (bocaRecinto - z) / RAMPA);
  return RECINTO;
}

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
    /* La llegada al centro logístico, re-repartida.
       Antes este tramo se recorría con `centro * 1.15`: el camión llegaba a la
       nave en el último 13 % del capítulo y los otros siete octavos eran
       carretera vacía con el almacén demasiado lejos para leerse. Medido: a
       mitad del capítulo el camión estaba todavía a 89 metros del edificio y
       la cámara, 124 por detrás.
       Ahora el capítulo se divide en tres actos que sí cuentan algo: se acerca
       y el edificio crece (0 a 0,45), entra en el recinto y rodea el patio
       (0,45 a 0,78), y se coloca frente a su muelle (0,78 a 1). Nunca hay un
       tramo largo sin nada delante. */
    const t = clamp(centro);
    const entrada = M.centro + 46;      // la boca del recinto
    const patio = M.centro + 14;        // ya dentro, bordeando los muelles
    if (t < 0.45) return lerp(M.carretera.hasta, entrada, entradaSalida(t / 0.45));
    if (t < 0.78) return lerp(entrada, patio, entradaSalida((t - 0.45) / 0.33));
    return lerp(patio, M.centro, entradaSalida((t - 0.78) / 0.22));
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
    y: sueloEn(z),                             // la cota del firme que pisa
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
  /* Una entrada POR CAPÍTULO, anclada a su comienzo, más el cierre. Antes las
     ocho entradas caían en valores de progreso escogidos a ojo (0,13, 0,25,
     0,40…) que no coincidían con ningún límite de capítulo: la luz cambiaba a
     mitad de una escena y el capítulo entero se quedaba con el sobrante del
     anterior. Ahora cada capítulo ESTRENA su luz y la termina, que es lo que
     pedía el encargo cuando hablaba de iluminación por capítulo.

     Columnas:
       cielo alto · horizonte · niebla · color de luz · fuerza · altura del sol
       · acimut · relleno · rebote de cielo · sesgo de exposición

     El ACIMUT es nuevo y es lo que más cambia. Antes el sol venía siempre de
     la misma dirección y los ocho capítulos estaban iluminados igual: un
     recorrido de trece horas con una sola luz. Ahora gira 130° a lo largo del
     viaje, así que el buque se ve a contraluz al amanecer, la grúa recibe la
     luz de costado a media mañana y la nave del destino la recibe de frente al
     atardecer. Es la misma escena y parece otra.

     Los horizontes van CONTENIDOS a propósito. La primera versión los puso en
     pardos muy saturados y, combinados con la niebla, el encuadre entero se
     volvía del mismo color de barro: no se distinguía el mar del cielo ni del
     buque. Un amanecer sobre el mar es sobre todo azul con una franja cálida
     estrecha, no un filtro naranja encima de todo. */
  /*  p      cieloAlto  horizonte  niebla   luz      fuerza altura acimut relleno rebote exposición */
  [0.0000, 0x0a1a30, 0x6d6a72, 0.00058, 0xffb877, 1.35, 0.09, -0.95, 0.55, 1.35, 1.00],  // 1 alta mar
  [0.1264, 0x123a58, 0x8a8286, 0.00064, 0xffc48c, 1.55, 0.19, -0.66, 0.52, 1.40, 1.02],  // 2 puerto
  [0.2414, 0x255083, 0xb9bfc2, 0.00070, 0xfff0d2, 2.00, 0.38, -0.28, 0.46, 1.45, 1.04],  // 3 descarga
  [0.3908, 0x2f5f95, 0xc6ced3, 0.00086, 0xfff6e4, 2.20, 0.54,  0.06, 0.42, 1.50, 1.02],  // 4 aduanas
  [0.5057, 0x36699f, 0xccd6de, 0.00100, 0xfffaf0, 2.30, 0.62,  0.30, 0.40, 1.55, 1.00],  // 5 salida
  [0.5977, 0x3a70ac, 0xcdd7df, 0.00108, 0xfff8ea, 2.25, 0.58,  0.58, 0.44, 1.55, 0.99],  // 6 en ruta
  [0.7586, 0x35659a, 0xc6b49c, 0.00072, 0xffe3b6, 2.05, 0.38,  0.92, 0.62, 1.85, 1.10],  // 7 centro
  [0.8851, 0x3c5f85, 0xc5a68a, 0.00058, 0xffcb96, 1.95, 0.26,  1.16, 0.74, 2.15, 1.26],  // 8 entrega
  [1.0000, 0x2d4a70, 0xa8866c, 0.00072, 0xffab6d, 1.55, 0.17,  1.34, 0.82, 2.45, 1.42],  // cierre
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
    /** Acimut del sol, en radianes. Gira a lo largo del viaje. */
    acimut: lerp(a[7], b[7], t),
    /** Fuerza del relleno frío que viene del lado contrario. */
    relleno: lerp(a[8], b[8], t),
    /** Rebote del cielo. Es lo que impide que una cara en sombra sea negra. */
    rebote: lerp(a[9], b[9], t),
    /** Sesgo de exposición del capítulo. */
    exposicion: lerp(a[10], b[10], t),
    /** Cuánto están encendidas las luces artificiales: 0 de día, 1 de noche. */
    practicas: clamp(1 - lerp(a[6], b[6], t) * 2.4),
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
/**
 * LA CÁMARA: UN RIG AÉREO CONTINUO.
 * ═══════════════════════════════════════════════════════════════════
 *
 * Esta parte se rehízo entera, y el motivo es el mejor que puede haber para
 * rehacer algo: la versión anterior era técnicamente correcta y se veía mal.
 *
 * Tenía cuarenta y dos planos escritos a mano, cada uno con su desplazamiento
 * en coordenadas del mundo. Cada uno, por separado, estaba bien compuesto. El
 * problema era el conjunto: la cámara saltaba de un tres cuartos alto a un
 * contrapicado, de ahí a un lateral por el otro lado, luego a ras de rueda y
 * después a sesenta metros de altura. Cada corte cruzaba el eje. Y cruzar el
 * eje una vez es un recurso; cruzarlo cuarenta y dos veces en un recorrido de
 * scroll continuo es marear al visitante y hacerle perder el contenedor, que
 * es justo lo único que la página tiene que conseguir que siga.
 *
 * LO QUE LO SUSTITUYE
 * Un solo rig, definido en coordenadas POLARES respecto al sujeto:
 *
 *      dist   distancia horizontal al sujeto, en metros
 *      elev   ángulo de elevación sobre la horizontal, en grados
 *      azim   ángulo respecto a la dirección de marcha, en grados
 *
 * y de ahí sale la posición:
 *
 *      x = ancla.x + sin(azim) · dist
 *      y = ancla.y + tan(elev) · dist
 *      z = ancla.z + cos(azim) · dist
 *
 * El mundo se recorre hacia −Z, así que un `azim` positivo deja la cámara
 * SIEMPRE por detrás y SIEMPRE al mismo costado. Y ahí está la clave: como
 * `azim` se mantiene entre 26° y 38° durante todo el recorrido, la cámara no
 * puede cruzar el eje. No es que se haya tenido cuidado de que no lo cruce: es
 * que el sistema no sabe cruzarlo. Un giro de 180° sería un `azim` de 210°, y
 * no hay ninguno.
 *
 * Lo mismo con la elevación: `elev` va de 22° a 58°, así que la cámara está
 * siempre por encima de la acción. Se ve la maqueta desde arriba, que es lo que
 * el encargo pide, y el horizonte asoma un poco por el fondo sin llegar a
 * mandar.
 *
 * QUÉ SE INTERPOLA
 * No la posición: los PARÁMETROS. La curva de Hermite pasa por `dist`, `elev`,
 * `azim` y el punto de mira, y la posición se calcula al final. Eso tiene una
 * consecuencia que vale oro: entre dos planos la cámara describe un arco
 * alrededor del sujeto en vez de una recta que lo atraviesa. Interpolar
 * posiciones es exactamente lo que metía la cámara dentro de las grúas.
 *
 * LOS CUATRO MOMENTOS ESPECIALES
 * El encargo permite unos cuatro, y son éstos, marcados abajo con ★:
 *
 *   ★1  apertura   elev 22°, dist 520 — baja y amplia, para presentar el buque
 *   ★2  enganche   elev 38°, dist 30 — acercamiento moderado en la recogida
 *   ★3  ruta       elev 58°, dist 70 — seguimiento aéreo alto por carretera
 *   ★4  entrega    elev 42°, dist 34 — acercamiento suave final
 *
 * Todos vuelven después, gradualmente, a la vista principal —elev ~50°—. No
 * hay cortes: la curva es continua y los parámetros se mueven despacio.
 *
 * LA REGLA DE LA VELOCIDAD
 * «La cámara nunca debe moverse más rápido que el objeto que sigue.» Como el
 * rig va rígidamente atado al ancla, la cámara hereda la velocidad del sujeto;
 * lo único que puede añadir es el ritmo al que cambian `dist`, `elev` y
 * `azim`. Por eso esos tres cambian LENTO, y por eso hay una prueba que mide
 * la razón entre las dos velocidades a lo largo del recorrido entero.
 */

/** La vista principal a la que todo vuelve. */
const AEREA = { elev: 50, azim: 30 };

const PLANOS = {
  /* CAPÍTULO 1 · ALTA MAR  ────────────────────────────────── ★1 apertura
     El único momento de todo el recorrido en el que se ve el buque entero, y
     hace falta: son 294 metros, y todo lo que viene después se mide contra
     eso. Baja y amplia, y desde ahí la cámara SUBE hasta la aérea, que es lo
     que convierte la apertura en un movimiento y no en un plano suelto. */
  oceano: [
    { t: 0.00, ancla: 'barco', dist: 520, elev: 22, azim: 38, miraY: 16, miraZ: -30, fov: 34 },
    { t: 0.50, ancla: 'barco', dist: 455, elev: 30, azim: 36, miraY: 14, miraZ: -24, fov: 36 },
    { t: 1.00, ancla: 'barco', dist: 395, elev: 40, azim: 34, miraY: 12, miraZ: -18, fov: 38 },
  ],

  /* CAPÍTULO 2 · LLEGADA A PUERTO
     Se sigue subiendo. El buque se acerca al muelle y la cámara pasa de
     acompañarlo de costado a mirarlo desde arriba: la maniobra de atraque se
     entiende desde arriba y no se entiende desde ningún otro sitio. */
  puerto: [
    { t: 0.00, ancla: 'barco', dist: 395, elev: 42, azim: 34, miraY: 12, miraZ: -18, fov: 38 },
    { t: 0.55, ancla: 'barco', dist: 330, elev: 46, azim: 32, miraY: 10, miraZ: -14, fov: 40 },
    { t: 1.00, ancla: 'barco', dist: 192, elev: 48, azim: 30, miraY: 8, miraZ: -10, fov: 42 },
  ],

  /* CAPÍTULO 3 · DESCARGA  ─────────────────────────────────── ★2 enganche
     El sujeto pasa a ser el contenedor, que mide doce metros en vez de
     doscientos noventa y cuatro. La distancia tiene que bajar un orden de
     magnitud, y por eso este capítulo tiene más planos que ningún otro: no
     para cambiar de sitio, sino para que ese descenso sea gradual.

     La cámara se mantiene sobre el agua, al costado de la grúa y por encima
     de la viga. Nunca entra en el pórtico: con `azim` 28–30° y `dist` mínima
     de 30 m, la cámara queda a 14 m del eje de la grúa por el lado del mar,
     y las patas están a 7. */
  grua: [
    /* Seis planos, y ninguno para «cambiar de sitio»: están para que el
       acercamiento sea GRADUAL. El sujeto pasa de un buque de 294 metros a un
       contenedor de doce, así que la cámara tiene que cerrarse un orden de
       magnitud, y hacerlo de golpe en el relevo de ancla se siente como un
       barrido —medido: la cámara recorría 480 m mientras el buque ya estaba
       atracado y quieto—. Ahora el cierre se reparte desde alta mar hasta el
       enganche, y en ningún punto la cámara le gana al sujeto. */
    { t: 0.00, ancla: 'contenedor', dist: 176, elev: 46, azim: 30, miraY: 4, miraZ: -10, fov: 42 },
    { t: 0.28, ancla: 'contenedor', dist: 124, elev: 43, azim: 30, miraY: 2, miraZ: -8, fov: 42 },
    { t: 0.44, ancla: 'contenedor', dist: 82, elev: 32, azim: 29, miraY: 1, miraZ: -5, fov: 43 },
    /* ★2 · el acercamiento del enganche, TERMINADO antes de que el carro
       arranque. Si la cámara sigue cerrándose mientras la carga cruza hacia
       tierra, se suman las dos velocidades y la cámara adelanta al contenedor
       —1,50× medido—, que es justo lo que el encargo prohíbe. A partir de
       aquí la distancia se queda quieta y la cámara se limita a acompañar. */
    { t: 0.56, ancla: 'contenedor', dist: 52, elev: 22, azim: 28, miraY: 0, miraZ: -3, fov: 44 },
    { t: 0.72, ancla: 'contenedor', dist: 48, elev: 21, azim: 28, miraY: 0, miraZ: -2, fov: 44 },
    { t: 0.84, ancla: 'contenedor', dist: 48, elev: 23, azim: 28, miraY: 0, miraZ: -3, fov: 44 },
    { t: 0.93, ancla: 'contenedor', dist: 48, elev: 32, azim: 29, miraY: -1, miraZ: -4, fov: 44 },
    { t: 1.00, ancla: 'camion', dist: 58, elev: 48, azim: 30, miraY: 3, miraZ: -8, fov: 44 },
  ],

  /* CAPÍTULO 4 · ADUANAS
     Ya en la aérea principal, y ahí se queda. El camión avanza, para bajo el
     escáner y arranca; la cámara no hace nada más que acompañarlo y cerrarse
     un poco. Que no pase nada con la cámara es el objetivo. */
  aduanas: [
    { t: 0.00, ancla: 'camion', dist: 62, elev: 48, azim: 30, miraY: 3, miraZ: -8, fov: 44 },
    { t: 0.50, ancla: 'camion', dist: 52, elev: 50, azim: 30, miraY: 2.5, miraZ: -10, fov: 44 },
    { t: 1.00, ancla: 'camion', dist: 48, elev: 50, azim: 30, miraY: 2.5, miraZ: -10, fov: 44 },
  ],

  /* CAPÍTULO 5 · SALIDA DEL RECINTO */
  salida: [
    { t: 0.00, ancla: 'camion', dist: 46, elev: 50, azim: 30, miraY: 2.5, miraZ: -10, fov: 44 },
    { t: 1.00, ancla: 'camion', dist: 50, elev: 50, azim: 30, miraY: 2.5, miraZ: -14, fov: 44 },
  ],

  /* CAPÍTULO 6 · EN RUTA  ─────────────────────────────────────── ★3 ruta
     El seguimiento aéreo alto. Aquí la altura no es un capricho: desde arriba
     se ve la carretera CORRER por debajo —las marcas viales, el quitamiedos,
     los pórticos—, y eso cuenta la velocidad mucho mejor que un plano bajo,
     que además obligaría a la cámara a esquivar mobiliario cada dos segundos.
     La mirada va muy adelantada, que es lo que dice hacia dónde se va. */
  carretera: [
    { t: 0.00, ancla: 'camion', dist: 50, elev: 50, azim: 30, miraY: 2.5, miraZ: -16, fov: 44 },
    { t: 0.35, ancla: 'camion', dist: 46, elev: 50, azim: 28, miraY: 1.5, miraZ: -22, fov: 42 },
    { t: 0.70, ancla: 'camion', dist: 45, elev: 50, azim: 28, miraY: 1.5, miraZ: -22, fov: 42 },
    { t: 1.00, ancla: 'camion', dist: 52, elev: 50, azim: 30, miraY: 2.5, miraZ: -18, fov: 44 },
  ],

  /* CAPÍTULO 7 · CENTRO LOGÍSTICO
     Se abre para que quepa la nave y se vuelve a cerrar al acercarse al
     muelle. La nave queda al costado −X del carril, así que el `azim` baja un
     poco: la cámara se corre hacia el eje y el edificio entra por el lado. */
  centro: [
    { t: 0.00, ancla: 'camion', dist: 54, elev: 50, azim: 30, miraY: 2.5, miraZ: -18, fov: 44 },
    { t: 0.45, ancla: 'camion', dist: 78, elev: 50, azim: 26, miraY: 0.5, miraZ: -24, fov: 42 },
    { t: 1.00, ancla: 'camion', dist: 66, elev: 50, azim: 28, miraY: 2.5, miraZ: -14, fov: 44 },
  ],

  /* CAPÍTULO 8 · ENTREGA  ────────────────────────────────────── ★4 entrega
     El acercamiento final, suave, sobre la maniobra de aparcamiento y las
     puertas que se abren. Y después la cámara se retira y deja el conjunto
     pequeño en el cuadro: un final se mira desde fuera. */
  entrega: [
    { t: 0.00, ancla: 'camion', dist: 62, elev: 50, azim: 28, miraY: 2.5, miraZ: -14, fov: 44 },
    { t: 0.45, ancla: 'camion', dist: 34, elev: 42, azim: 26, miraY: 2, miraZ: -6, fov: 44 },
    { t: 0.62, ancla: 'camion', dist: 44, elev: 46, azim: 26, miraY: 2, miraZ: -8, fov: 44 },
    { t: 1.00, ancla: 'camion', dist: 92, elev: 50, azim: 28, miraY: 0, miraZ: -16, fov: 42 },
  ],
};

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
    const z = camionZ(p, { velocidadCamion: 1 });
    return [MEDIDAS.gruaX, sueloEn(z), z];
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

/**
 * Los planos, enhebrados en UNA lista continua por progreso.
 *
 * Una sola lista, no dos. La versión anterior mantenía una curva aparte para
 * pantalla estrecha con doce planos escritos a mano; con el rig polar eso
 * sobra, porque el encuadre vertical se consigue tocando DOS NÚMEROS —acercar
 * y subir— y esos dos números se derivan, no se escriben. Menos código y,
 * sobre todo, imposible que las dos curvas se separen al tocar una.
 */
const CLAVES = [];
for (const tramo of TRAMOS) {
  const lista = PLANOS[tramo.id];
  if (!lista) continue;
  for (const plano of lista) {
    CLAVES.push({
      p: lerp(tramo.desde, tramo.hasta, plano.t),
      dist: plano.dist,
      elev: plano.elev,
      azim: plano.azim,
      miraY: plano.miraY ?? 0,
      miraZ: plano.miraZ ?? 0,
      fov: plano.fov,
      ancla: plano.ancla || 'mundo',
    });
  }
}
CLAVES.sort((a, b) => a.p - b.p);

/* Planos coincidentes: el último de un capítulo y el primero del siguiente
   caen en el MISMO punto del recorrido. Si se dejan los dos y no dicen lo
   mismo, la curva tiene que recorrer esa diferencia en cero progreso.

   Con el rig polar esto es mucho menos grave que antes —dos planos
   coincidentes con el mismo ancla difieren en unos grados, no en cien
   metros—, pero sigue siendo un pico en la derivada, y la derivada es
   justamente lo que hay que cuidar. Cuando los dos siguen lo mismo se funden;
   cuando siguen cosas distintas manda el ENTRANTE, y el relevo de ancla se
   reparte a lo largo del tramo anterior, que tiene anchura de verdad. */
for (let i = CLAVES.length - 2; i >= 0; i--) {
  if (CLAVES[i + 1].p - CLAVES[i].p > 1e-6) continue;
  const a = CLAVES[i];
  const b = CLAVES[i + 1];
  if (a.ancla === b.ancla) {
    for (const k of ['dist', 'elev', 'azim', 'miraY', 'miraZ', 'fov']) {
      a[k] = (a[k] + b[k]) / 2;
    }
    CLAVES.splice(i + 1, 1);
  } else {
    CLAVES.splice(i, 1);
  }
}

/**
 * Hermite cúbico con parametrización NO uniforme.
 *
 * La versión de libro de Catmull-Rom supone que los puntos están
 * equiespaciados. Aquí no lo están ni de lejos —un capítulo tiene seis planos
 * y otro dos—, y tratarlos como si lo estuvieran produce sobreoscilaciones.
 * Escalando las tangentes por la separación real de cada tramo, la curva pasa
 * por todos los puntos con la derivada continua, que es lo que significa «sin
 * giros bruscos».
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

const GRADO = Math.PI / 180;

/**
 * Pose de la cámara en un progreso dado. Función pura, sin estado.
 *
 * Se interpolan los PARÁMETROS del rig y la posición se calcula al final. Ésa
 * es toda la diferencia con la versión anterior, y es la que hace que la
 * cámara describa un arco alrededor del sujeto en vez de una recta que lo
 * atraviesa. Interpolar posiciones es exactamente lo que metía la cámara
 * dentro de las grúas y de los edificios.
 *
 * La amortiguación NO va aquí: va en el bucle, sobre el resultado. Mezclar las
 * dos cosas es lo que hace que una página se desincronice al subir.
 *
 * @param {number}  p         progreso del recorrido, 0 a 1
 * @param {object}  salida    objeto reutilizado, para no crear basura
 * @param {boolean} estrecho  pantalla vertical: encuadre más cerrado y alto
 */
export function poseEn(p, salida = {}, estrecho = false) {
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
  const eje = (k) => hermite(c0[k], c1[k], c2[k], c3[k], c0.p, c1.p, c2.p, c3.p, t);

  let dist = Math.max(4, eje('dist'));
  let elev = eje('elev');
  const azim = eje('azim');
  const miraY = eje('miraY');
  const miraZ = eje('miraZ');
  const fov = eje('fov');

  /* Encuadre vertical: más cerca y más alto.
     Un móvil en vertical no es un escritorio pequeño. Con el rig polar la
     adaptación es de dos números en vez de doce planos escritos aparte:
     acercarse un quinto y subir cinco grados centra la acción y quita del
     cuadro el terreno vacío de los lados, que en vertical es lo que sobra. */
  if (estrecho) {
    dist *= 0.82;
    elev += 5;
  }

  /* El anclaje se evalúa en el progreso ACTUAL, no en el del plano. Cuando dos
     planos consecutivos siguen cosas distintas —el contenedor y luego el
     camión— se mezclan los dos anclajes a lo largo del tramo, y como en ese
     momento el contenedor va justo encima del camión, el relevo no se nota. */
  const anclaA = anclajeEn(c1.ancla, p);
  const anclaB = anclajeEn(c2.ancla, p);
  const ax = lerp(anclaA[0], anclaB[0], t);
  const ay = lerp(anclaA[1], anclaB[1], t);
  const az = lerp(anclaA[2], anclaB[2], t);

  /* De polares a mundo. El recorrido va hacia −Z, así que un `azim` positivo
     deja la cámara por detrás y siempre al mismo costado: no hay forma de que
     cruce el eje. */
  const a = azim * GRADO;
  salida.pos = salida.pos || [0, 0, 0];
  salida.mira = salida.mira || [0, 0, 0];
  salida.pos[0] = ax + Math.sin(a) * dist;
  salida.pos[1] = ay + Math.tan(clamp(elev, 6, 78) * GRADO) * dist;
  salida.pos[2] = az + Math.cos(a) * dist;
  salida.mira[0] = ax;
  salida.mira[1] = ay + miraY;
  salida.mira[2] = az + miraZ;
  salida.fov = fov;
  salida.dist = dist;
  salida.elev = elev;
  salida.azim = azim;
  /* A QUÉ se está mirando. Lo necesita el esquive de estorbos: para saber si
     algo tapa al sujeto hay que saber cuál es el sujeto y, sobre todo, cuánto
     ocupa. Un camión mide dieciséis metros y medio; comprobar sólo el punto de
     mira deja fuera precisamente lo que se le tapa, que es la cola. */
  salida.ancla = t < 0.5 ? c1.ancla : c2.ancla;
  return salida;
}

export const NUM_PLANOS = CLAVES.length;
