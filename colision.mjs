/**
 * PRUEBAS DE COLISIÓN: QUÉ ATRAVIESA EL CAMIÓN.
 *
 * La prueba de oclusión mira lo que se cruza delante de la CÁMARA. Ésta mira
 * algo más elemental y más grave: que el camión —y el contenedor que lleva
 * encima— no pase POR DENTRO de nada. Un patio de contenedores atravesado no
 * es un defecto de encuadre, es la escena entera dejando de ser creíble, y no
 * hay plano que lo disimule.
 *
 * Se recorre el progreso entero y, en cada parada, se comprueba la caja del
 * camión contra todas las mallas sólidas del mundo, las instanciadas incluidas
 * —el patio son seis mallas y varios miles de cajas, y precisamente ésas son
 * las que atravesaba—. Se informa del estorbo, del punto y de cuánto se ha
 * metido, porque «hay una colisión» sin decir dónde obliga a buscarla a mano
 * en un mundo de kilómetro y medio.
 *
 * Se ejecuta con `npm run colision`.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const RAIZ = new URL('./dist/', import.meta.url).pathname;
const PUERTO = 4424;
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain',
};

/* Holgura. Dos cuerpos que se rozan por un centímetro no se ven atravesados, y
   exigir separación exacta convertiría cualquier redondeo en un fallo. Medio
   metro es lo que se nota a simple vista. */
const HOLGURA = 0.5;
/** Cuántas paradas por capítulo. El camión recorre 900 m: hace falta densidad. */
const PASOS = 90;

let fallos = 0;
const ok = (m) => console.log(`  ok   ${m}`);
const mal = (m) => { fallos++; console.log(`  FALLA ${m}`); };

const sv = createServer(async (q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u.startsWith('/nexus-cargo')) u = u.slice('/nexus-cargo'.length);
  if (u === '' || u === '/') u = '/index.html';
  try {
    const b = await readFile(join(RAIZ, u));
    r.writeHead(200, { 'content-type': TIPOS[extname(u)] || 'application/octet-stream' });
    r.end(b);
  } catch { r.writeHead(404); r.end('no'); }
});
await new Promise((r) => sv.listen(PUERTO, r));

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

const SONDA = () => {
  const e = window.__escenaNX;
  const THREE = e.THREE;
  const cajaSujeto = new THREE.Box3();
  const cajaOtro = new THREE.Box3();
  const cajaInst = new THREE.Box3();
  const m4 = new THREE.Matrix4();

  const quien = (o) => {
    const raices = {
      barco: e.barco, camion: e.camion, heroe: e.heroe, puerto: e.puerto,
      aduanas: e.aduanas, carretera: e.carretera, centro: e.centro, destino: e.destino, mar: e.mar,
    };
    for (const [nombre, raiz] of Object.entries(raices)) {
      if (!raiz) continue;
      let x = o;
      while (x) { if (x === raiz) return nombre; x = x.parent; }
    }
    for (let i = 0; i < (e.gruas || []).length; i++) {
      let x = o;
      while (x) { if (x === e.gruas[i]) return `grua-${i}`; x = x.parent; }
    }
    return o.name || o.type;
  };

  window.__colision = (progreso, holgura) => {
    e.irA(progreso);
    e.escena.updateMatrixWorld(true);

    /* El camión y su carga son UN cuerpo: el contenedor va encima, así que
       medirlos por separado daría una colisión permanente entre los dos. */
    const propio = new Set();
    e.camion.traverse((o) => propio.add(o));
    if (e.heroe) e.heroe.traverse((o) => propio.add(o));

    cajaSujeto.setFromObject(e.camion);
    /* La carga sólo cuenta cuando VA EN EL CAMIÓN.
       La primera versión la unía siempre que no colgase de los cables, y eso
       incluye las dos horas en que el contenedor sigue estibado en el buque, a
       ochenta metros del camión y treinta de altura: la caja resultante medía
       83 × 30 m, abarcaba media terminal y «chocaba» con las cinco grúas y con
       el propio buque. Cuarenta metros de falso positivo por no preguntarle al
       guion algo que el guion sabe. El paso 4 es el enganche: antes de él la
       carga es del buque, después es del camión. */
    const mundo = e.mundo();
    const cargado = !mundo.grua.colgando && mundo.grua.paso > 4;
    if (e.heroe && e.heroe.visible && cargado) {
      cajaOtro.setFromObject(e.heroe);
      if (!cajaOtro.isEmpty()) cajaSujeto.union(cajaOtro);
    }
    // Se encoge la caja: rozar no es atravesar
    cajaSujeto.expandByScalar(-holgura);
    if (cajaSujeto.isEmpty()) return { golpes: [] };

    const golpes = new Map();
    const anotar = (o, caja) => {
      const solape = Math.min(
        caja.max.x - cajaSujeto.min.x, cajaSujeto.max.x - caja.min.x,
        caja.max.y - cajaSujeto.min.y, cajaSujeto.max.y - caja.min.y,
        caja.max.z - cajaSujeto.min.z, cajaSujeto.max.z - caja.min.z,
      );
      const n = quien(o);
      const antes = golpes.get(n);
      if (!antes || solape > antes.solape) {
        golpes.set(n, {
          solape: +solape.toFixed(2),
          donde: caja.getCenter(new THREE.Vector3()).toArray().map((v) => +v.toFixed(1)),
        });
      }
    };

    e.escena.traverse((o) => {
      if (!o.isMesh || !o.visible || propio.has(o) || o.userData.envolvente) return;
      /* Ni los EFECTOS. La cortina del escáner es un plano aditivo de nueve
         metros que el camión tiene que atravesar —de eso va la inspección—, y
         contarlo como colisión es confundir la luz con el acero. */
      if (o.userData.efecto) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (mat && mat.transparent && mat.depthWrite === false) return;
      let padre = o;
      while (padre) { if (!padre.visible) return; padre = padre.parent; }
      if (o.isInstancedMesh) {
        /* Las mallas instanciadas hay que abrirlas una a una: su caja global
           cubre el patio entero y diría que el camión choca siempre. */
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m4);
          m4.premultiply(o.matrixWorld);
          cajaInst.copy(o.geometry.boundingBox).applyMatrix4(m4);
          if (cajaInst.intersectsBox(cajaSujeto)) anotar(o, cajaInst);
        }
        return;
      }
      cajaOtro.setFromObject(o);
      if (cajaOtro.intersectsBox(cajaSujeto)) anotar(o, cajaOtro);
    });

    return {
      capitulo: e.capituloDe(progreso),
      camion: cajaSujeto.getCenter(new THREE.Vector3()).toArray().map((v) => +v.toFixed(1)),
      golpes: [...golpes.entries()].map(([n, g]) => ({ quien: n, ...g })),
    };
  };
};

console.log('\nPRUEBAS DE COLISIÓN · NEXUS CARGO');

const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
const pag = await ctx.newPage();
await pag.addInitScript(() => { window.__debugNX = true; });
await pag.goto(`http://127.0.0.1:${PUERTO}/nexus-cargo/`, { waitUntil: 'load' });
await pag.waitForFunction(() => window.__escenaNX && window.__escenaNX.fotogramas > 4, null, { timeout: 60000 });
await pag.evaluate(SONDA);

const tramos = await pag.evaluate(() => window.__escenaNX.tramos.map((t) => [t.id, t.desde, t.hasta]));
for (const [id, desde, hasta] of tramos) {
  const peores = new Map();
  for (let i = 0; i <= PASOS; i++) {
    const p = desde + (hasta - desde) * (i / PASOS);
    const r = await pag.evaluate(([p, h]) => window.__colision(p, h), [p, HOLGURA]);
    for (const g of r.golpes) {
      const antes = peores.get(g.quien);
      if (!antes || g.solape > antes.solape) peores.set(g.quien, { ...g, p, camion: r.camion });
    }
  }
  if (!peores.size) { ok(`${id}: el camión no atraviesa nada`); continue; }
  const lista = [...peores.values()]
    .sort((a, b) => b.solape - a.solape)
    .map((g) => `${g.quien} (${g.solape} m en p=${g.p.toFixed(3)}, junto a ${g.donde})`);
  mal(`${id}: el camión atraviesa ${lista.join(' · ')}`);
}

await ctx.close();
await nav.close();
sv.close();
console.log(fallos ? `\n${fallos} FALLOS\n` : '\nEl camión no atraviesa nada en todo el recorrido.\n');
process.exit(fallos ? 1 : 0);
