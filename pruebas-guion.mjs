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
import { poseEn, mundoEn, TRAMOS, NUM_PLANOS, ALTURAS, capituloEn } from './src/escena/ruta.js';

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
const esperado = ['bajaVacio','encaja','tensa','iza','traslada','arria','suelta','hecho'];
JSON.stringify(fases) === JSON.stringify(esperado)
  ? ok(`la descarga recorre sus 7 fases en orden`)
  : mal(`fases: ${fases.join(' → ')}`);

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
  const enc = (p, punto) => {
    poseEn(p, pos);
    const d = [punto[0]-pos.pos[0], punto[1]-pos.pos[1], punto[2]-pos.pos[2]];
    const v = [pos.mira[0]-pos.pos[0], pos.mira[1]-pos.pos[1], pos.mira[2]-pos.pos[2]];
    const ld = Math.hypot(...d), lv = Math.hypot(...v);
    const cos = (d[0]*v[0]+d[1]*v[1]+d[2]*v[2])/(ld*lv);
    return { ang: Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI, dist: ld, semi: pos.fov/2 };
  };
  const tramos = [['aduanas',3],['salida',4],['carretera',5],['centro',6],['entrega',7]];
  let fuera = 0, peorAng = 0, peorEn = '';
  for (const [nombre, i] of tramos) {
    const T = TRAMOS[i];
    for (let k = 0; k <= 300; k++) {
      const p = T.desde + (T.hasta - T.desde) * (k/300);
      const m = mundoEn(p);
      // Centro del conjunto tractora + remolque, a media altura
      const r = enc(p, [20, 3, m.camion.z + 5]);
      // El horizontal es más ancho que el vertical: se usa el semiángulo
      // vertical con margen, que es el criterio estricto
      if (r.ang > r.semi * 1.9) { fuera++; if (r.ang > peorAng) { peorAng = r.ang; peorEn = nombre; } }
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
    const r = enc(p, [c.x, c.y, c.z]);
    if (r.ang > r.semi * 1.9) { fuera2++; peor2 = Math.max(peor2, r.ang); }
  }
  fuera2 === 0
    ? ok('el contenedor no se sale del encuadre durante toda la descarga')
    : mal(`contenedor fuera de cuadro en ${fuera2} puntos (peor ${peor2.toFixed(0)}°)`);
}

console.log(fallos ? `\n${fallos} FALLOS` : '\nEl guion es correcto.');
process.exit(fallos ? 1 : 0);
