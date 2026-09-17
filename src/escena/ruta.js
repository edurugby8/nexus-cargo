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
  const zCamion = MEDIDAS.camionEspera.z;
  const yCubierta = 32.5;        // parte alta de la pila donde viaja el nuestro
  const yCamion = MEDIDAS.camion.plataforma + MEDIDAS.contenedor.alto / 2;
  const yCrucero = 58;           // altura de paso por encima del buque
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
  const zCamion = MEDIDAS.camionEspera.z;
  if (nombre === 'aproxima') return lerp(zBuque + 26, zBuque, entradaSalida(local));
  if (nombre === 'traslada') return lerp(zBuque, zCamion + 4, suave(0, 1, local));
  if (nombre === 'frena') return lerp(zCamion + 4, zCamion, salidaCubica(local));
  return pasoEn(clamp(t)).indice < 8 ? zBuque : zCamion;
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
const PLANOS = {
  /* CAPÍTULO 1 · ALTA MAR
     Descenso desde muy arriba hasta el costado del buque. El plano de apertura
     está lejísimos a propósito: es el único momento del recorrido en el que se
     ve el barco entero, y hace falta para que todo lo que viene después tenga
     una escala contra la que medirse. */
  oceano: [
    { t: 0.00, ancla: 'barco', pos: [-210, 430, 360], mira: [40, 18, 0], fov: 36,
      movil: { pos: [-150, 470, 430], mira: [40, 10, 0], fov: 40 } },
    { t: 0.45, ancla: 'barco', pos: [-60, 205, 225], mira: [60, 24, 0], fov: 40 },
    { t: 0.78, ancla: 'barco', pos: [150, 92, 140], mira: [10, 28, 0], fov: 46 },
    { t: 1.00, ancla: 'barco', pos: [236, 46, 96], mira: [40, 30, 0], fov: 50 },
  ],

  /* CAPÍTULO 2 · LLEGADA A PUERTO
     Se cambia de punto de vista: hasta aquí la cámara viajaba con el buque, y
     ahora se planta en tierra y deja que el buque venga. Es el mismo recurso
     que usa cualquier documental para decir «hemos llegado»: se deja de seguir
     y se espera. */
  puerto: [
    { t: 0.00, ancla: 'barco', pos: [268, 52, 104], mira: [60, 30, 0], fov: 50 },
    { t: 0.42, ancla: 'mundo', pos: [205, 96, -12], mira: [40, 40, 96], fov: 44,
      movil: { pos: [232, 118, -30], mira: [34, 34, 96], fov: 50 } },
    { t: 0.74, ancla: 'mundo', pos: [150, 62, 6], mira: [20, 30, 92], fov: 46 },
    { t: 1.00, ancla: 'mundo', pos: [96, 44, 26], mira: [24, 28, 92], fov: 48 },
  ],

  /* CAPÍTULO 3 · DESCARGA
     ---------------------------------------------------------------------
     Un plano por cada momento de la operación, y cada uno elegido por lo que
     tiene que DEJAR CLARO, no por lo vistoso que sea:
     · el general de salida dice de dónde viene la carga;
     · el corto sobre los twistlocks dice cómo se agarra;
     · el contrapicado del despegue dice cuánto pesa;
     · el perfil del traslado dice cuánto recorre;
     · y el del apoyo dice dónde acaba.
     Ninguna posición se repite y no hay dos consecutivas del mismo lado: la
     cámara cruza el eje en cada corte, que es lo que impide que trece pasos se
     confundan entre sí.

     Y todos van APARTADOS de la estructura. El primer intento los puso encima
     de la carga y la cámara acababa metida entre las celosías de la viga,
     mirando el pórtico por dentro; el segundo los puso a cincuenta metros y el
     contenedor quedaba de detalle. Doce metros de contenedor piden entre
     quince y cuarenta de distancia, y ahí están todos menos el general. */
  grua: [
    // 1 · aproxima — general desde tierra: buque, grúa y carro saliendo
    { t: 0.000, ancla: 'contenedor', pos: [46, 20, -58], mira: [0, -7, 8], fov: 42,
      movil: { pos: [58, 26, -74], mira: [0, -10, 8], fov: 48 } },
    // 2 · bajaVacio — se acerca mientras el spreader baja
    { t: 0.075, ancla: 'contenedor', pos: [34, 16, -30], mira: [0, 12, 2], fov: 46,
      movil: { pos: [42, 22, -38], mira: [0, 14, 2], fov: 52 } },
    // 3 · alinea — al otro lado, cerca, a la altura de la carga
    { t: 0.175, ancla: 'contenedor', pos: [-19, 7, 16], mira: [0, 6, 0], fov: 48 },
    // 4/5 · posa y encaja — corto sobre la esquina: aquí se ve el agarre
    { t: 0.270, ancla: 'contenedor', pos: [8.5, 3.4, 7], mira: [-1, 1.4, 0], fov: 48,
      movil: { pos: [11, 4.2, 9], mira: [-1, 1.2, 0], fov: 52 } },
    // 6 · tensa — se aparta un poco: nada se mueve, y eso hay que verlo entero
    { t: 0.340, ancla: 'contenedor', pos: [-24, 10, -14], mira: [0, 8, 0], fov: 46 },
    // 7 · despega — contrapicado: es el plano que cuenta las treinta toneladas
    { t: 0.400, ancla: 'contenedor', pos: [16, -8, 13], mira: [0, 2.5, 0], fov: 46 },
    // 8 · iza — sube con ella, por delante
    { t: 0.470, ancla: 'contenedor', pos: [26, 4, -19], mira: [0, 7, 0], fov: 46 },
    // 9 · traslada — perfil largo contra el buque: el recorrido se mide solo
    { t: 0.580, ancla: 'contenedor', pos: [-40, 12, -18], mira: [0, 4, 0], fov: 42,
      movil: { pos: [-50, 20, -24], mira: [0, 2, 0], fov: 48 } },
    // 10 · frena — de frente y bajo: la carga se viene encima y vuelve
    { t: 0.715, ancla: 'contenedor', pos: [11, -4, -26], mira: [0, 1, 0], fov: 46 },
    // 11 · arria — desde arriba, viendo el remolque debajo
    { t: 0.790, ancla: 'contenedor', pos: [23, 16, 18], mira: [0, -5, 0], fov: 46 },
    // 12 · asienta — el apoyo, a la altura de la plataforma
    { t: 0.900, ancla: 'camion', pos: [15, 4.2, 14], mira: [0, 3, 0], fov: 46 },
    // 13 · suelta — se abre y el spreader se va hacia arriba, fuera de cuadro
    { t: 1.000, ancla: 'camion', pos: [21, 7.5, 19], mira: [0, 3.6, 0], fov: 46 },
  ],

  /* CAPÍTULO 4 · ADUANAS
     El camión avanza hacia el escáner y para. La cámara hace lo contrario de
     lo que pide el cuerpo: en vez de seguirle, se adelanta y le espera, que es
     lo que convierte un avance en una LLEGADA. */
  aduanas: [
    { t: 0.00, ancla: 'camion', pos: [21, 8, 22], mira: [0, 3.8, 0], fov: 46 },
    { t: 0.38, ancla: 'camion', pos: [15, 5.5, -19], mira: [0, 3.6, 6], fov: 44,
      movil: { pos: [19, 7.5, -25], mira: [0, 3.4, 6], fov: 50 } },
    { t: 0.68, ancla: 'camion', pos: [-11, 6.8, -16], mira: [0, 3.6, 2], fov: 46 },
    { t: 1.00, ancla: 'camion', pos: [9, 4.6, -21], mira: [1, 3.8, 3], fov: 44 },
  ],

  /* CAPÍTULO 5 · SALIDA DEL RECINTO
     Plano bajo junto a la rueda: es el que cuenta el peso del conjunto, y el
     único de todo el recorrido a menos de dos metros del suelo. */
  salida: [
    { t: 0.00, ancla: 'camion', pos: [7.5, 1.4, -14], mira: [1, 3.2, 3], fov: 46 },
    { t: 0.45, ancla: 'camion', pos: [-12, 4.2, -18], mira: [0, 3.6, 4], fov: 46 },
    { t: 1.00, ancla: 'camion', pos: [16, 7, -24], mira: [0, 4, 6], fov: 46 },
  ],

  /* CAPÍTULO 6 · EN RUTA
     ---------------------------------------------------------------------
     Aquí el problema no era el encuadre: era que no se notaba la VELOCIDAD.
     Un camión a noventa por una recta vacía, filmado desde lejos y de lado, se
     mueve por la pantalla igual de despacio que uno parado. La velocidad no la
     da el objeto: la dan las cosas que le pasan cerca a la cámara.

     Así que los planos de este capítulo están todos BAJOS y CERCA, con algo
     entre la cámara y el horizonte: la rueda, el quitamiedos, el pórtico de
     señalización, el tablero del paso superior. Lo que entra y sale de cuadro
     en medio segundo es lo que se lee como noventa por hora. El único plano
     alto dura poco y está justo para que se respire. */
  carretera: [
    // Sale del ramal y coge la recta
    /* En vertical este plano se abre y se echa atrás: con el desplazamiento
       de apaisado, el camión quedaba pegado al borde izquierdo y cortado. */
    { t: 0.00, ancla: 'camion', pos: [15, 6.4, -27], mira: [0, 4, 5], fov: 46,
      movil: { pos: [19, 8.5, -33], mira: [0, 4.5, 2], fov: 50 } },
    // A la altura del buje, rozando el asfalto
    /* Este plano va MÁS ADENTRO de lo que pide la composición, a propósito.
       La compensación de pantalla aleja la cámara por el eje de la mirada, y
       desde 5,2 m de separación eso la sacaba por encima del quitamiedos —que
       está a 7,4— en cuanto la pantalla era estrecha. Desde 3,4 aguanta el
       retroceso máximo sin pasarse de la valla. */
    { t: 0.14, ancla: 'camion', pos: [3.4, 0.9, -1], mira: [1.6, 2.2, 9], fov: 54,
      movil: { pos: [3.9, 1.1, -2], mira: [1.4, 2.4, 9], fov: 58 } },
    // Adelantado y bajo, con el quitamiedos barriendo el primer plano
    { t: 0.30, ancla: 'camion', pos: [-9.5, 1.9, -17], mira: [0, 3.4, 4], fov: 50 },
    // Persecución pegada, por detrás del semirremolque
    { t: 0.46, ancla: 'camion', pos: [2.5, 4.6, 21], mira: [0, 3.6, 2], fov: 44 },
    // El único alto del capítulo, y corto: la ruta desde fuera
    { t: 0.62, ancla: 'camion', pos: [30, 48, 26], mira: [0, 2, -8], fov: 38,
      movil: { pos: [38, 62, 34], mira: [0, 0, -8], fov: 44 } },
    // Vuelve abajo para el paso superior: el tablero cruza sobre la cámara
    { t: 0.80, ancla: 'camion', pos: [8.5, 2.6, -19], mira: [0, 4.2, 6], fov: 52 },
    // Y otra vez a la rueda, ya frenando
    { t: 1.00, ancla: 'camion', pos: [13, 5, -23], mira: [0, 4, 4], fov: 46 },
  ],

  /* CAPÍTULO 7 · CENTRO LOGÍSTICO
     Ojo con los planos generales: es tentador plantar la cámara mirando al
     edificio, pero el camión sigue llegando y se queda fuera de cuadro —o
     peor, se mete por delante del objetivo—. Medido, uno de estos planos tenía
     el camión a ciento once grados del eje.

     Van todos anclados al camión con un desplazamiento amplio y con la mirada
     ADELANTADA hacia donde el camión va: el almacén entra en el encuadre solo,
     porque el camión va hacia él, y entra creciendo, que es la única forma de
     que un edificio de ciento sesenta metros se lea como grande. */
  centro: [
    { t: 0.00, ancla: 'camion', pos: [19, 9, -34], mira: [0, 4.5, 10], fov: 46,
      movil: { pos: [24, 12, -42], mira: [0, 5, 6], fov: 50 } },
    // Tres cuartos alto: se ve la nave entera por primera vez
    { t: 0.34, ancla: 'camion', pos: [44, 26, 54], mira: [-10, 0, -46], fov: 42,
      movil: { pos: [56, 34, 68], mira: [-12, -4, -46], fov: 48 } },
    // Baja al patio y se mete entre el camión y los muelles de carga
    { t: 0.66, ancla: 'camion', pos: [-16, 5.5, 12], mira: [2, 3.4, -22], fov: 48 },
    // Maniobra final de aproximación al muelle asignado
    { t: 1.00, ancla: 'camion', pos: [17, 8, 22], mira: [0, 4, -8], fov: 46 },
  ],

  /* CAPÍTULO 8 · ENTREGA
     El pago de todo el recorrido. Va de lo cerca a lo lejos, al revés que los
     demás capítulos: se abren las puertas en primer plano, y desde ahí la
     cámara se retira hasta dejar el conjunto —nave, patio, camión— pequeño en
     el cuadro. Es un final, y un final se mira desde fuera. */
  entrega: [
    { t: 0.00, ancla: 'camion', pos: [17, 8, 24], mira: [0, 4, -6], fov: 46 },
    /* Las puertas del contenedor, de frente.
       Va por el lado +X, que es el del patio abierto. En el lado contrario
       está la fachada de muelles del centro logístico, y al compensar una
       pantalla estrecha la cámara retrocedía hasta METERSE por una de las
       puertas de carga: 46 cm de holgura en móvil y 6 en tableta, medido. El
       encuadre es el mismo; lo que cambia es de qué lado se rodea. */
    { t: 0.38, ancla: 'camion', pos: [13, 3.6, 15], mira: [2, 3, -2], fov: 48,
      movil: { pos: [16, 4.4, 19], mira: [2, 3, -2], fov: 52 } },
    { t: 0.72, ancla: 'camion', pos: [26, 13, -34], mira: [-4, 3, 8], fov: 42 },
    { t: 1.00, ancla: 'camion', pos: [48, 34, -78], mira: [-8, 0, 14], fov: 40,
      movil: { pos: [58, 44, -94], mira: [-8, -6, 14], fov: 46 } },
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

/**
 * Los planos, enhebrados en UNA lista continua por progreso.
 *
 * Se construyen DOS listas, no una: la ancha y la estrecha. Un móvil en
 * vertical no es un escritorio pequeño, es otra composición. La escena
 * compensa por su cuenta el ángulo y la distancia —eso resuelve que el sujeto
 * quepa—, pero hay planos en los que lo que cambia es la INTENCIÓN: un general
 * que en apaisado enseña el buque de perfil, en vertical tiene que subir y
 * abrirse para que el buque quepa de proa a popa; un contrapicado que en
 * apaisado cabe justo, en vertical necesita separarse.
 *
 * Los planos que no declaran variante usan el mismo en las dos listas, así que
 * sólo se escribe lo que de verdad cambia: doce de treinta y cinco.
 */
function enhebrar(estrecho) {
  const claves = [];
  for (const tramo of TRAMOS) {
    const lista = PLANOS[tramo.id];
    if (!lista) continue;
    for (const plano of lista) {
      const v = (estrecho && plano.movil) ? plano.movil : plano;
      claves.push({
        p: lerp(tramo.desde, tramo.hasta, plano.t),
        pos: v.pos, mira: v.mira, fov: v.fov,
        ancla: plano.ancla || 'mundo',
      });
    }
  }
  claves.sort((a, b) => a.p - b.p);
  return claves;
}

const CLAVES = enhebrar(false);
const CLAVES_ESTRECHO = enhebrar(true);

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
function fundirCoincidentes(claves) {
  for (let i = claves.length - 2; i >= 0; i--) {
    if (claves[i + 1].p - claves[i].p > 1e-6) continue;
    const a = claves[i];
    const b = claves[i + 1];
    if (a.ancla === b.ancla) {
      a.pos = a.pos.map((v, k) => (v + b.pos[k]) / 2);
      a.mira = a.mira.map((v, k) => (v + b.mira[k]) / 2);
      a.fov = (a.fov + b.fov) / 2;
      claves.splice(i + 1, 1);
    } else {
      claves.splice(i, 1);
    }
  }
  return claves;
}
fundirCoincidentes(CLAVES);
fundirCoincidentes(CLAVES_ESTRECHO);

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
export function poseEn(p, salida = {}, estrecho = false) {
  const lista = estrecho ? CLAVES_ESTRECHO : CLAVES;
  const n = lista.length;
  let i = 0;
  while (i < n - 2 && p > lista[i + 1].p) i++;
  const c1 = lista[i];
  const c2 = lista[Math.min(n - 1, i + 1)];
  const c0 = lista[Math.max(0, i - 1)];
  const c3 = lista[Math.min(n - 1, i + 2)];
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
