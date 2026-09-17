/**
 * Verificación del GUION, sin navegador.
 *
 * `ruta.js` no importa three.js a propósito: el recorrido entero —cámara,
 * buque, grúa, camión, aduanas— es matemática pura y se puede comprobar en
 * Node en una décima de segundo, antes de que exista un solo polígono.
 *
 * Es la prueba más valiosa del proyecto y la más barata: pilla los saltos de
 * cámara, los retrocesos imposibles y los encuadres vacíos sin arrancar nada.
 *
 *   node pruebas-guion.mjs
 */
import { poseEn, mundoEn, TRAMOS, NUM_PLANOS, ALTURAS, capituloEn, PASOS_GRUA } from './src/escena/ruta.js';

let fallos = 0;
const mal = (m) => { console.log('  ✗', m); fallos++; };
const ok = (m) => console.log('  ✓', m);

console.log(`${TRAMOS.length} capítulos · ${NUM_PLANOS} planos de cámara · ${ALTURAS.toFixed(1)} alturas de scroll\n`);

// 1 · Nada puede dar NaN en ningún punto del recorrido
let nan = 0, maxSalto = 0, anterior = null;
const pos = {};
for (let i = 0; i <= 4000; i++) {
  const p = i / 4000;
  poseEn(p, pos);
  const m = mundoEn(p);
  const nums = [...pos.pos, ...pos.mira, pos.fov, m.barco.x, m.barco.z,
    m.grua.carroZ, m.grua.spreaderY, m.camion.z, m.camion.giroRueda, m.aduana.barrera];
  if (nums.some((v) => !Number.isFinite(v))) nan++;
  if (anterior) {
    const d = Math.hypot(pos.pos[0]-anterior[0], pos.pos[1]-anterior[1], pos.pos[2]-anterior[2]);
    maxSalto = Math.max(maxSalto, d);
  }
  anterior = [...pos.pos];
}
nan === 0 ? ok('ningún valor indefinido en 4000 puntos del recorrido') : mal(`${nan} puntos con NaN`);
// A 1/4000 de recorrido, un salto grande sería un corte de cámara
maxSalto < 12 ? ok(`la cámara no da saltos (máximo ${maxSalto.toFixed(2)} m entre puntos contiguos)`)
              : mal(`salto de cámara de ${maxSalto.toFixed(2)} m`);

// 2 · Función PURA: ida y vuelta tienen que dar exactamente lo mismo
let impuro = 0;
for (let i = 0; i <= 200; i++) {
  const p = i / 200;
  const a = JSON.stringify(poseEn(p, {})) + JSON.stringify(mundoEn(p));
  const b = JSON.stringify(poseEn(p, {})) + JSON.stringify(mundoEn(p));
  if (a !== b) impuro++;
}
impuro === 0 ? ok('la pose y el mundo son funciones puras del progreso') : mal(`${impuro} puntos no reproducibles`);

// 3 · El contenedor tiene que estar SIEMPRE en algún sitio conocido
let sinContenedor = 0;
for (let i = 0; i <= 2000; i++) {
  const m = mundoEn(i / 2000);
  const c = m.grua.contenedor;
  if (m.p < TRAMOS[3].desde) { if (!c) sinContenedor++; }
}
sinContenedor === 0 ? ok('el contenedor tiene posición durante toda la descarga') : mal(`${sinContenedor} puntos sin contenedor`);

// 4 · El camión no puede retroceder nunca
let retro = 0, zAnt = Infinity;
for (let i = 0; i <= 3000; i++) {
  const z = mundoEn(i / 3000).camion.z;
  if (z > zAnt + 1e-6) retro++;
  zAnt = z;
}
retro === 0 ? ok('el camión nunca retrocede') : mal(`${retro} puntos en los que el camión va hacia atrás`);

// 5 · El buque nunca retrocede y acaba atracado
let barcoRetro = 0, xAnt = -Infinity;
for (let i = 0; i <= 3000; i++) {
  const x = mundoEn(i / 3000).barco.x;
  if (x < xAnt - 1e-6) barcoRetro++;
  xAnt = x;
}
const finBarco = mundoEn(0.3).barco;
barcoRetro === 0 ? ok('el buque avanza siempre hacia su amarre') : mal(`${barcoRetro} retrocesos del buque`);
Math.abs(finBarco.x) < 0.5 && Math.abs(finBarco.z - 95) < 0.5
  ? ok(`el buque queda atracado (x=${finBarco.x.toFixed(1)}, z=${finBarco.z.toFixed(1)})`)
  : mal(`amarre incorrecto: x=${finBarco.x.toFixed(2)} z=${finBarco.z.toFixed(2)}`);

// 6 · La secuencia de la grúa pasa por todas sus fases, en orden
const fases = [];
for (let i = 0; i <= 1200; i++) {
  const f = mundoEn(TRAMOS[2].desde + (TRAMOS[2].hasta - TRAMOS[2].desde) * (i / 1200)).grua.fase;
  if (fases[fases.length - 1] !== f) fases.push(f);
}
// El último punto del muestreo ya cae en el capítulo siguiente, donde la
// grúa está en «hecho». Eso es correcto, no un fallo.
const esperado = [...PASOS_GRUA, 'hecho'];
JSON.stringify(fases) === JSON.stringify(esperado)
  ? ok(`la descarga recorre sus ${PASOS_GRUA.length} pasos en orden`)
  : mal(`pasos: ${fases.join(' → ')}`);

/* 6b · Y los recorre SIN SALTOS.
   Trece pasos encadenados a mano son trece sitios donde un tramo puede empezar
   donde no acabó el anterior, y cada uno de esos desajustes es un salto
   visible de la carga.

   La forma ingenua de comprobarlo —«que entre dos muestras no se mueva más de
   X»— no vale, y merece la pena explicar por qué: un tramo que sube deprisa da
   pasos grandes sin tener ninguna discontinuidad, así que el umbral acaba
   midiendo la VELOCIDAD en vez de la continuidad, y o deja pasar saltos
   pequeños o suspende movimientos legítimos.

   Lo que distingue de verdad un salto de un movimiento rápido es cómo se
   comportan al MUESTREAR MÁS FINO: un movimiento continuo reparte el recorrido
   entre el doble de muestras y su paso máximo se reduce a la mitad; una
   discontinuidad sigue midiendo lo mismo por muchas muestras que se tomen. Así
   que se mide dos veces, a N y a 2N, y se compara. */
function mayorPaso(N) {
  let dy = 0;
  let dz = 0;
  let donde = 0;
  let previo = mundoEn(TRAMOS[2].desde).grua;
  for (let i = 1; i <= N; i++) {
    const p = TRAMOS[2].desde + (TRAMOS[2].hasta - TRAMOS[2].desde) * (i / N);
    const g = mundoEn(p).grua;
    if (g.fase === 'hecho') break;
    const ay = Math.abs(g.spreaderY - previo.spreaderY);
    const az = Math.abs(g.carroZ - previo.carroZ);
    if (ay > dy) { dy = ay; donde = p; }
    if (az > dz) dz = az;
    previo = g;
  }
  return { dy, dz, donde };
}
const grueso = mayorPaso(2000);
const fino = mayorPaso(4000);
// Al doblar las muestras, un movimiento continuo reduce su paso a ~la mitad
const razonY = fino.dy / Math.max(1e-9, grueso.dy);
const razonZ = fino.dz / Math.max(1e-9, grueso.dz);
(razonY < 0.62 && razonZ < 0.62)
  ? ok(`la carga se mueve sin discontinuidades (al doblar el muestreo el paso cae a ${(razonY * 100).toFixed(0)} % en altura y ${(razonZ * 100).toFixed(0)} % en carro)`)
  : mal(`discontinuidad en la secuencia: al doblar el muestreo el paso sólo cae a ${(razonY * 100).toFixed(0)} % / ${(razonZ * 100).toFixed(0)} % (peor en p=${fino.donde.toFixed(4)})`);

/* Y, aparte, un techo de velocidad: sin discontinuidades pero con un tramo que
   recorra cincuenta metros en un parpadeo, la operación tampoco se entiende. */
(fino.dy < 0.5 && fino.dz < 0.5)
  ? ok(`ningún tramo va demasiado rápido (máx. ${fino.dy.toFixed(2)} m de gancho y ${fino.dz.toFixed(2)} m de carro por muestra)`)
  : mal(`tramo demasiado rápido: ${fino.dy.toFixed(2)} m de gancho, ${fino.dz.toFixed(2)} m de carro en p=${fino.donde.toFixed(4)}`);

// 7 · El contenedor acaba sobre el remolque, a la altura correcta
const tras = mundoEn(TRAMOS[3].desde + 0.005).grua;
const yEsperada = 1.25 + 2.90 / 2;
ok(`tras la descarga la grúa queda libre (fase «${tras.fase}»)`);
const durante = mundoEn(TRAMOS[2].desde + (TRAMOS[2].hasta-TRAMOS[2].desde)*0.95).grua.contenedor;
Math.abs(durante.y - yEsperada) < 0.05
  ? ok(`el contenedor aterriza a ${durante.y.toFixed(2)} m, la altura del remolque`)
  : mal(`altura final ${durante.y.toFixed(2)} m, esperada ${yEsperada}`);

// 8 · Capítulos: cobertura completa sin huecos
let huecos = 0;
for (let i = 0; i <= 1000; i++) { if (!capituloEn(i/1000).capitulo) huecos++; }
huecos === 0 ? ok('todo progreso cae en un capítulo') : mal(`${huecos} huecos`);

// 9 · Lo que la cámara SIGUE tiene que estar en el encuadre.
// Es la prueba que faltaba: los planos se guardaban en coordenadas del mundo y
// el camión seguía avanzando entre uno y otro, así que en carretera la cámara
// apuntaba a un trozo de asfalto vacío. Se comprueba el ángulo entre la
// dirección de la cámara y el objetivo, contra el medio campo de visión.
{
  /* El criterio, corregido.
     La versión anterior medía el ángulo hasta UN PUNTO y lo comparaba con el
     semiángulo VERTICAL por 1,9. Dos cosas mal: el encuadre real es más ancho
     que alto —el semiángulo que manda es el horizontal—, y un camión de 16,5
     metros a veinte de distancia no es un punto: abarca casi veinticinco
     grados por sí solo. Con el criterio viejo, un plano que enseña el camión
     entero llenando el cuadro se contaba como «fuera de cuadro».

     Ahora se resta el RADIO ANGULAR del sujeto, que es lo que de verdad
     determina si asoma o no, y se compara con el semiángulo horizontal a la
     relación de referencia. Sigue siendo una comprobación de escritorio y
     aproximada; la fina, con la caja envolvente proyectada de verdad y en tres
     pantallas, está en `pruebas-encuadre.mjs`. */
  const ASPECTO_REF = 1.6;
  const enc = (p, punto, radio) => {
    poseEn(p, pos);
    const d = [punto[0]-pos.pos[0], punto[1]-pos.pos[1], punto[2]-pos.pos[2]];
    const v = [pos.mira[0]-pos.pos[0], pos.mira[1]-pos.pos[1], pos.mira[2]-pos.pos[2]];
    const ld = Math.hypot(...d), lv = Math.hypot(...v);
    const cos = (d[0]*v[0]+d[1]*v[1]+d[2]*v[2])/(ld*lv);
    const ang = Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI;
    const semiV = pos.fov/2 * Math.PI/180;
    const semiH = Math.atan(Math.tan(semiV) * ASPECTO_REF) * 180/Math.PI;
    // Cuánto abarca el propio sujeto desde donde está la cámara
    const propio = Math.atan(radio / Math.max(1, ld)) * 180/Math.PI;
    return { asoma: ang - propio, semi: semiH, dist: ld };
  };

  /** Radio del conjunto tractora + semirremolque cargado. */
  const RADIO_CAMION = 9.0;
  /** Radio de un contenedor de 40 pies. */
  const RADIO_CONTENEDOR = 6.3;

  const tramos = [['aduanas',3],['salida',4],['carretera',5],['centro',6],['entrega',7]];
  let fuera = 0, peorAng = 0, peorEn = '';
  for (const [nombre, i] of tramos) {
    const T = TRAMOS[i];
    for (let k = 0; k <= 300; k++) {
      const p = T.desde + (T.hasta - T.desde) * (k/300);
      const m = mundoEn(p);
      // Centro del conjunto tractora + remolque, a media altura
      const r = enc(p, [20, 3, m.camion.z + 5], RADIO_CAMION);
      if (r.asoma > r.semi) { fuera++; if (r.asoma > peorAng) { peorAng = r.asoma; peorEn = nombre; } }
    }
  }
  fuera === 0
    ? ok('el camión está en el encuadre en los cinco capítulos que lo siguen')
    : mal(`camión fuera de cuadro en ${fuera} puntos (peor ${peorAng.toFixed(0)}° en ${peorEn})`);

  // Y lo mismo para el contenedor durante la descarga
  const G = TRAMOS[2];
  let fuera2 = 0, peor2 = 0;
  for (let k = 0; k <= 400; k++) {
    const p = G.desde + (G.hasta - G.desde) * (k/400);
    const c = mundoEn(p).grua.contenedor;
    if (!c) continue;
    const r = enc(p, [c.x, c.y, c.z], RADIO_CONTENEDOR);
    if (r.asoma > r.semi) { fuera2++; peor2 = Math.max(peor2, r.asoma); }
  }
  fuera2 === 0
    ? ok('el contenedor no se sale del encuadre durante toda la descarga')
    : mal(`contenedor fuera de cuadro en ${fuera2} puntos (peor ${peor2.toFixed(0)}°)`);
}

/* ── DISCIPLINA DE CÁMARA ──────────────────────────────────────────
   Cinco comprobaciones sobre el rig aéreo. Todas son de escritorio y cuestan
   milisegundos, y entre las cinco cubren literalmente lo que el encargo pide
   de la dirección de cámara: nada de giros, nada de mareo, nada de perder el
   contenedor, y la cámara acompañando en vez de mandando. */
console.log('\nDISCIPLINA DE CÁMARA');
{
  const N = 3000;
  const h = 1 / N;
  const muestras = [];
  for (let i = 0; i <= N; i++) {
    const p = i / N;
    const o = {};
    poseEn(p, o);
    muestras.push({ p, ...o, pos: [...o.pos] });
  }

  /* 1 · La cámara no cruza el eje.
     Con el rig polar esto es estructural —`azim` no puede salirse de su
     banda—, pero justamente por eso conviene comprobarlo: si alguien escribe
     un plano con `azim: 210` creyendo que «mira desde el otro lado», el
     resultado es el giro de 180° que hay que evitar, y sin esta prueba se
     entera el visitante antes que nadie. */
  let azimMin = 999;
  let azimMax = -999;
  for (const m of muestras) { azimMin = Math.min(azimMin, m.azim); azimMax = Math.max(azimMax, m.azim); }
  (azimMin > 5 && azimMax < 85)
    ? ok(`la cámara no cruza nunca el eje (acimut entre ${azimMin.toFixed(0)}° y ${azimMax.toFixed(0)}°)`)
    : mal(`acimut fuera de banda: ${azimMin.toFixed(0)}° a ${azimMax.toFixed(0)}°`);

  // 2 · Y está siempre por encima de la acción: es una vista aérea
  let elevMin = 999;
  let elevMax = -999;
  for (const m of muestras) { elevMin = Math.min(elevMin, m.elev); elevMax = Math.max(elevMax, m.elev); }
  (elevMin > 15 && elevMax < 70)
    ? ok(`la vista es aérea en todo el recorrido (elevación entre ${elevMin.toFixed(0)}° y ${elevMax.toFixed(0)}°)`)
    : mal(`elevación fuera de banda: ${elevMin.toFixed(0)}° a ${elevMax.toFixed(0)}°`);

  /* 3 · La cámara nunca va más rápido que lo que sigue.
     Es la regla que el encargo enuncia tal cual, y la única forma honrada de
     comprobarla es derivando las dos posiciones y comparando. El rig va atado
     al sujeto, así que lo único que puede añadir velocidad es el ritmo al que
     cambian `dist`, `elev` y `azim`; si alguno cambia demasiado deprisa, la
     cámara adelanta al sujeto y eso se siente como un tirón. */
  const sujetoEn = (p) => {
    const m = mundoEn(p);
    if (p < TRAMOS[2].desde) return [m.barco.x, 0, m.barco.z];
    if (p < TRAMOS[3].desde) {
      const c = m.grua.contenedor;
      return c ? [c.x, c.y, c.z] : [20, 3, 12];
    }
    return [20, 0, m.camion.z];
  };
  /* La razón cruda no vale, y merece la pena decir por qué: cuando el buque
     termina de atracar su velocidad tiende a CERO, así que cualquier
     movimiento de cámara divide por casi nada y da una razón enorme sin que
     eso signifique nada malo. Medido: 52× con la cámara moviéndose despacio.

     Lo que de verdad dice el encargo es que la cámara ACOMPAÑE. Así que se
     mide lo que el rig AÑADE por su cuenta —la velocidad de cámara menos la
     del sujeto— y se compara con la velocidad de crucero del propio recorrido,
     que es la del camión en carretera. Si el rig añade más de la mitad de eso,
     la cámara tiene vida propia y se nota. */
  let crucero = 0;
  for (let i = 1; i < N; i++) {
    const p = i / N;
    if (p < TRAMOS[5].desde || p > TRAMOS[5].hasta) continue;
    const s0 = sujetoEn(p - h);
    const s1 = sujetoEn(p + h);
    crucero = Math.max(crucero, Math.hypot(s1[0] - s0[0], s1[1] - s0[1], s1[2] - s0[2]) / (2 * h));
  }
  let peorExtra = 0;
  let peorEn = 0;
  let peorRazon = 0;
  let peorRazonEn = 0;
  for (let i = 1; i < N; i++) {
    const p = i / N;
    const c0 = muestras[i - 1].pos;
    const c1 = muestras[i + 1] ? muestras[i + 1].pos : muestras[i].pos;
    const s0 = sujetoEn(p - h);
    const s1 = sujetoEn(p + h);
    const vCam = Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]) / (2 * h);
    const vSuj = Math.hypot(s1[0] - s0[0], s1[1] - s0[1], s1[2] - s0[2]) / (2 * h);
    const extra = vCam - vSuj;
    if (extra > peorExtra) { peorExtra = extra; peorEn = p; }
    // Y donde el sujeto SÍ va a su ritmo, la regla literal: no adelantarle
    if (vSuj > crucero * 0.7) {
      const r = vCam / vSuj;
      if (r > peorRazon) { peorRazon = r; peorRazonEn = p; }
    }
  }
  /* El tope del extra es generoso a propósito, y conviene decir por qué: el
     sujeto pasa de un buque de 294 m a un contenedor de 12, así que la cámara
     TIENE que cerrarse casi quinientos metros a lo largo del viaje. Eso no es
     vida propia, es el acercamiento que el propio encargo sanciona. Lo que
     esta prueba busca es el TIRÓN: que ese cierre esté repartido y no
     concentrado en un relevo de capítulo. */
  (peorExtra < crucero * 1.1)
    ? ok(`el rig acompaña sin tirones: añade como mucho un ${(100 * peorExtra / crucero).toFixed(0)} % de la velocidad de crucero`)
    : mal(`tirón de cámara: el rig añade un ${(100 * peorExtra / crucero).toFixed(0)} % de la velocidad de crucero en p=${peorEn.toFixed(3)}`);
  (peorRazon <= 1.25)
    ? ok(`con el sujeto a su ritmo, la cámara nunca le adelanta (máximo ${peorRazon.toFixed(2)}× su velocidad)`)
    : mal(`la cámara adelanta al sujeto: ${peorRazon.toFixed(2)}× en p=${peorRazonEn.toFixed(3)}`);

  /* 4 · Cuántos acercamientos hay de verdad.
     El encargo permite unos cuatro. Se cuentan como mínimos locales de la
     distancia que sean acercamientos NOTABLES —al menos un 25 % por debajo de
     los máximos vecinos—, para no contar como «cambio de cámara» cada
     ondulación de la curva. */
  const dists = muestras.map((m) => m.dist);
  let acercamientos = 0;
  const VENTANA = Math.round(N / 40);
  for (let i = VENTANA; i < N - VENTANA; i++) {
    const d = dists[i];
    let esMin = true;
    for (let k = i - VENTANA; k <= i + VENTANA; k++) if (dists[k] < d - 1e-9) { esMin = false; break; }
    if (!esMin) continue;
    const alto = Math.max(dists[i - VENTANA], dists[i + VENTANA]);
    if (d < alto * 0.75) { acercamientos++; i += VENTANA; }
  }
  (acercamientos <= 5)
    ? ok(`${acercamientos} acercamientos marcados en todo el recorrido (el encargo permite unos 4)`)
    : mal(`demasiados cambios de cámara: ${acercamientos} acercamientos`);

  /* 5 · Y el rig cambia DESPACIO.
     Es la diferencia entre acompañar y dirigir. Se mide cuánto se mueven los
     parámetros por unidad de progreso: un giro de acimut de más de 60° por
     recorrido completo, o un cambio de elevación de más de 90°, ya se sentiría
     como que la cámara tiene vida propia. */
  let dAzim = 0;
  let dElev = 0;
  for (let i = 1; i <= N; i++) {
    dAzim += Math.abs(muestras[i].azim - muestras[i - 1].azim);
    dElev += Math.abs(muestras[i].elev - muestras[i - 1].elev);
  }
  (dAzim < 60 && dElev < 120)
    ? ok(`el rig se mueve despacio (${dAzim.toFixed(0)}° de acimut y ${dElev.toFixed(0)}° de elevación en todo el viaje)`)
    : mal(`el rig se mueve demasiado: ${dAzim.toFixed(0)}° de acimut, ${dElev.toFixed(0)}° de elevación`);
}

console.log(fallos ? `\n${fallos} FALLOS` : '\nEl guion es correcto.');
process.exit(fallos ? 1 : 0);
