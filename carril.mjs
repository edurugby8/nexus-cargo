/**
 * EL CARRIL DEL CAMIÓN TIENE QUE ESTAR VACÍO.
 *
 * Ésta es la prueba de fondo, y es distinta de todas las demás porque no
 * muestrea NADA: no recorre el progreso, no mira fotogramas, no depende de
 * dónde se le ocurra parar a quien la escribe. Toma el pasillo declarado en el
 * guion —de donde la grúa deja el contenedor sobre el remolque hasta pasada la
 * barrera— y comprueba que no hay una sola malla dentro. Es una invariante del
 * mundo, así que si algo invade el paso lo dice siempre, en el primer
 * fotograma, sin que haya que acertar con el momento.
 *
 * Las dos anteriores fallaban precisamente por eso: comprobaban el camión
 * contra el mundo en las paradas que yo elegía y en el nivel de calidad que le
 * tocaba al contenedor de pruebas. Con la mitad de los objetos colocados al
 * azar y con cuatro niveles que cambian cuántos hay, eso es una lotería.
 *
 * Aquí se abren las mallas instanciadas una a una —el patio son miles de cajas
 * en seis mallas— y se recorren LOS CUATRO NIVELES, porque cada uno construye
 * un puerto distinto.
 *
 * Se ejecuta con `npm run carril`.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const RAIZ = new URL('./dist/', import.meta.url).pathname;
const PUERTO = 4425;
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain',
};

const NIVELES = (process.env.NIVELES || 'alto,medio,bajo,minimo').split(',');

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

  const quien = (o) => {
    const raices = {
      barco: e.barco, camion: e.camion, heroe: e.heroe, puerto: e.puerto,
      aduanas: e.aduanas, carretera: e.carretera, centro: e.centro,
      destino: e.destino, mar: e.mar,
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

  window.__carril = () => {
    /* Todo VISIBLE, en todo el recorrido. Las regiones ocultan escenarios
       según el capítulo, así que se miran una por una encendidas: un objeto
       que invade el paso lo invade cuando se ve, no cuando yo muestreo. */
    const encendidas = [];
    e.escena.traverse((o) => { encendidas.push([o, o.visible]); o.visible = true; });
    e.escena.updateMatrixWorld(true);

    const C = e.CORREDOR;
    const pasillo = new THREE.Box3(
      new THREE.Vector3(C.x - C.media, 0.05, Math.min(C.desde, C.hasta)),
      new THREE.Vector3(C.x + C.media, C.alto, Math.max(C.desde, C.hasta)),
    );

    const propio = new Set();
    e.camion.traverse((o) => propio.add(o));
    if (e.heroe) e.heroe.traverse((o) => propio.add(o));

    const m4 = new THREE.Matrix4();
    const caja = new THREE.Box3();
    const invasores = new Map();
    const anota = (o, c) => {
      const dentro = Math.min(
        c.max.x - pasillo.min.x, pasillo.max.x - c.min.x,
        c.max.y - pasillo.min.y, pasillo.max.y - c.min.y,
        c.max.z - pasillo.min.z, pasillo.max.z - c.min.z,
      );
      const n = quien(o);
      const antes = invasores.get(n);
      if (!antes || dentro > antes.dentro) {
        invasores.set(n, {
          dentro: +dentro.toFixed(2),
          donde: c.getCenter(new THREE.Vector3()).toArray().map((v) => +v.toFixed(1)),
          tam: c.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(1)),
        });
      }
    };

    e.escena.traverse((o) => {
      if (!o.isMesh || propio.has(o)) return;
      // Suelos, efectos de luz y lo que se cruza a nivel: no son obstáculos
      if (o.userData.envolvente || o.userData.efecto || o.userData.franqueable) return;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (mat && mat.transparent && mat.depthWrite === false) return;
      if (o.isInstancedMesh) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m4);
          m4.premultiply(o.matrixWorld);
          caja.copy(o.geometry.boundingBox).applyMatrix4(m4);
          if (caja.intersectsBox(pasillo)) anota(o, caja);
        }
        return;
      }
      caja.setFromObject(o);
      if (!caja.isEmpty() && caja.intersectsBox(pasillo)) anota(o, caja);
    });

    for (const [o, v] of encendidas) o.visible = v;
    return {
      pasillo: [pasillo.min.toArray(), pasillo.max.toArray()],
      invasores: [...invasores.entries()].map(([n, i]) => ({ quien: n, ...i })),
    };
  };
};

console.log('\nEL CARRIL DEL CAMIÓN · NEXUS CARGO');

for (const nivel of NIVELES) {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
  const pag = await ctx.newPage();
  await pag.addInitScript(() => { window.__debugNX = true; });
  await pag.goto(`http://127.0.0.1:${PUERTO}/nexus-cargo/?calidad=${nivel}`, { waitUntil: 'load' });
  await pag.waitForFunction(() => window.__escenaNX && window.__escenaNX.fotogramas > 4, null, { timeout: 60000 });
  await pag.evaluate(SONDA);
  const r = await pag.evaluate(() => window.__carril());

  if (!r.invasores.length) {
    ok(`calidad ${nivel}: el carril está limpio de ${r.pasillo[0][2].toFixed(0)} a ${r.pasillo[1][2].toFixed(0)} en Z`);
  } else {
    const lista = r.invasores
      .sort((a, b) => b.dentro - a.dentro)
      .map((i) => `${i.quien} (se mete ${i.dentro} m, caja de ${i.tam} en ${i.donde})`);
    mal(`calidad ${nivel}: ${r.invasores.length} invaden el carril · ${lista.join(' · ')}`);
  }
  await ctx.close();
}

await nav.close();
sv.close();
console.log(fallos ? `\n${fallos} FALLOS\n` : '\nEl carril está despejado en los cuatro niveles.\n');
process.exit(fallos ? 1 : 0);
