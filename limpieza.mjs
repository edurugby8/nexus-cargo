/**
 * PRUEBAS DE LIMPIEZA DE ESCENARIO.
 *
 * Un capítulo no puede enseñar los decorados del anterior. Suena obvio, pero
 * es el fallo más fácil de dejar pasar: los objetos se apagan por REGIONES de
 * progreso, y basta que una región se cierre un poco tarde para que, en un
 * plano aéreo que mira lejos, el puerto siga asomando al fondo de la carretera
 * a doscientos metros.
 *
 * No vale con mirar si el objeto está «visible»: puede estarlo y quedar detrás
 * de la cámara. Lo que esto comprueba es si está DENTRO DEL TRONCO DE VISIÓN,
 * que es lo único que significa «se ve».
 *
 * Se ejecuta con `npm run limpieza`.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const RAIZ = new URL('./dist/', import.meta.url).pathname;
const PUERTO = 4421;
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain',
};

/**
 * Qué NO puede verse en cada capítulo.
 *
 * Los tres de tierra adentro son los que importan: una vez el camión sale del
 * recinto, el puerto se ha terminado y volver a enseñarlo deshace el viaje.
 */
const PROHIBIDO = {
  carretera: ['gruas', 'barco', 'puerto', 'aduanas'],
  centro: ['gruas', 'barco', 'puerto', 'aduanas'],
  entrega: ['gruas', 'barco', 'puerto', 'aduanas'],
};

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

console.log('\nPRUEBAS DE LIMPIEZA DE ESCENARIO · NEXUS CARGO');

for (const [nombre, vp] of [
  ['escritorio', { width: 1440, height: 900 }],
  ['móvil', { width: 390, height: 844 }],
]) {
  const ctx = await nav.newContext({ viewport: vp });
  const pag = await ctx.newPage();
  await pag.addInitScript(() => { window.__debugNX = true; });
  await pag.goto(`http://127.0.0.1:${PUERTO}/nexus-cargo/`, { waitUntil: 'load' });
  await pag.waitForFunction(() => window.__escenaNX && window.__escenaNX.fotogramas > 4, null, { timeout: 60000 });

  await pag.evaluate(() => {
    const THREE = window.__escenaNX.THREE;
    const e = window.__escenaNX;
    const frustum = new THREE.Frustum();
    const m = new THREE.Matrix4();
    const caja = new THREE.Box3();

    /* Los grupos del puerto, por nombre. `gruas` es una lista; el resto son
       grupos sueltos que la escena expone para depuración. */
    window.__asoma = (progreso, nombres) => {
      e.irA(progreso);
      const cam = e.camara;
      cam.updateMatrixWorld(true);
      e.escena.updateMatrixWorld(true);
      m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      frustum.setFromProjectionMatrix(m);

      const vistos = [];
      for (const nombre of nombres) {
        const obj = e[nombre];
        if (!obj) continue;
        const lista = Array.isArray(obj) ? obj : [obj];
        for (const o of lista) {
          if (!o.visible) continue;
          caja.setFromObject(o);
          if (caja.isEmpty()) continue;
          if (frustum.intersectsBox(caja)) {
            // A qué distancia, para saber si es un asomo lejano o un estorbo
            const c = caja.getCenter(new THREE.Vector3());
            vistos.push({ nombre, dist: Math.round(cam.position.distanceTo(c)) });
            break;
          }
        }
      }
      return { capitulo: e.capituloDe(progreso), vistos };
    };
  });

  console.log(`\n── ${nombre} · ${vp.width}×${vp.height} ──`);

  for (const [cap, prohibidos] of Object.entries(PROHIBIDO)) {
    const tramo = await pag.evaluate((cap) => {
      const t = window.__escenaNX.tramos.find((x) => x.id === cap);
      return [t.desde, t.hasta];
    }, cap);

    const encontrados = new Map();
    const N = 24;
    for (let i = 0; i <= N; i++) {
      const p = tramo[0] + (tramo[1] - tramo[0]) * (i / N);
      const r = await pag.evaluate(([p, n]) => window.__asoma(p, n), [p, prohibidos]);
      for (const v of r.vistos) {
        if (!encontrados.has(v.nombre) || encontrados.get(v.nombre).dist > v.dist) {
          encontrados.set(v.nombre, { dist: v.dist, p });
        }
      }
    }

    encontrados.size === 0
      ? ok(`${nombre} · ${cap}: no asoma nada del puerto`)
      : mal(`${nombre} · ${cap}: asoma ${[...encontrados.entries()]
        .map(([n, v]) => `${n} a ${v.dist} m (p=${v.p.toFixed(3)})`).join(' · ')}`);
  }

  await ctx.close();
}

await nav.close();
sv.close();
console.log(fallos ? `\n${fallos} FALLOS\n` : '\nCada capítulo enseña sólo su escenario.\n');
process.exit(fallos ? 1 : 0);
