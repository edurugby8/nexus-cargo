/**
 * PRUEBAS DE SINCRONÍA, DESDE EL PUNTO DE VISTA DEL VISITANTE.
 *
 * Ya había una comprobación de sincronía y daba verde, pero medía lo que yo
 * creía que el visitante ve, no lo que ve. Muestreaba el centro del tramo de
 * cada capítulo —bien dentro de la zona en la que su caja de texto está
 * pegada— y ahí, naturalmente, todo coincidía.
 *
 * El visitante no lee sólo ahí. Cada capítulo ocupa dos alturas y pico de
 * scroll, y su caja de texto está PEGADA sólo hasta una altura de ventana
 * antes del final; en esa última altura la caja se va hacia arriba mientras la
 * del capítulo siguiente entra por abajo. Durante ese trecho lo que se LEE es
 * ya el capítulo siguiente, y si el rótulo y el panel siguen en el anterior,
 * el visitante ve exactamente lo que describe: «en Descarga pone Llegada a
 * puerto».
 *
 * Así que esto mide otra cosa: recorre la página CON SCROLL GRADUAL y, en cada
 * parada, decide qué capítulo se está leyendo por la superficie que su caja de
 * texto ocupa en pantalla. Ése es el capítulo que el menú, el panel y la escena
 * tienen que estar marcando.
 *
 * Se ejecuta con `npm run sincronia`.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const RAIZ = new URL('./dist/', import.meta.url).pathname;
const PUERTO = 4422;
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain',
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
const fot = (p, n) => p.evaluate((n) => new Promise((r) => {
  let i = 0; const s = () => { i++; i >= n ? r(1) : requestAnimationFrame(s); }; requestAnimationFrame(s);
}), n);

console.log('\nPRUEBAS DE SINCRONÍA · NEXUS CARGO');

for (const [nombre, vp] of [
  ['escritorio', { width: 1440, height: 900 }],
  ['móvil', { width: 390, height: 844 }],
]) {
  const ctx = await nav.newContext({ viewport: vp });
  const pag = await ctx.newPage();
  await pag.addInitScript(() => { window.__debugNX = true; });
  await pag.goto(`http://127.0.0.1:${PUERTO}/nexus-cargo/`, { waitUntil: 'load' });
  await pag.waitForFunction(() => window.__escenaNX && window.__escenaNX.fotogramas > 4, null, { timeout: 60000 });
  await pag.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });

  console.log(`\n── ${nombre} · ${vp.width}×${vp.height} ──`);

  const finCaps = await pag.evaluate(() => {
    const c = [...document.querySelectorAll('.cap')];
    const u = c[c.length - 1];
    return u.offsetTop + u.offsetHeight;
  });

  /* Paso de muestreo: un tercio de altura de ventana. Lo bastante fino para
     caer dentro de las zonas de relevo, que es donde se rompe. */
  const paso = Math.round(vp.height / 3);
  const desajustes = [];
  let muestras = 0;

  for (let y = 0; y < finCaps; y += paso) {
    await pag.evaluate((y) => window.scrollTo(0, y), y);
    await fot(pag, 6);
    const r = await pag.evaluate(() => {
      /* Qué capítulo se está LEYENDO: el que más superficie de su caja de
         texto tiene en pantalla. Es la definición del visitante, no la mía. */
      let mejor = null;
      let mejorArea = 0;
      for (const caja of document.querySelectorAll('.cap__caja')) {
        const b = caja.getBoundingClientRect();
        const alto = Math.min(b.bottom, window.innerHeight) - Math.max(b.top, 0);
        if (alto <= 0) continue;
        if (alto > mejorArea) { mejorArea = alto; mejor = caja.closest('.cap').id; }
      }
      const enlace = document.querySelector('#nav-capitulos a[data-activa]');
      return {
        leyendo: mejor,
        visible: mejorArea / window.innerHeight,
        menu: enlace?.dataset.cap || null,
        panel: document.getElementById('hud-rotulo')?.textContent || null,
        escena: window.__escenaNX.capituloDe(window.__escenaNX.st.objetivo),
      };
    });
    muestras++;
    // Sólo se exige coincidencia cuando hay un capítulo CLARAMENTE dominante
    if (r.visible < 0.62 || !r.leyendo) continue;
    if (r.menu !== r.leyendo || r.escena !== r.leyendo) {
      desajustes.push(`y=${y} leyendo «${r.leyendo}» (${(r.visible * 100).toFixed(0)} % de pantalla) · menú «${r.menu}» · escena «${r.escena}»`);
    }
  }

  desajustes.length === 0
    ? ok(`${nombre}: menú, escena y panel coinciden con lo que se lee en las ${muestras} paradas`)
    : mal(`${nombre}: ${desajustes.length} desajustes de ${muestras} paradas\n        ${desajustes.slice(0, 6).join('\n        ')}`);

  await ctx.close();
}

await nav.close();
sv.close();
console.log(fallos ? `\n${fallos} FALLOS\n` : '\nTodo señala el mismo capítulo.\n');
process.exit(fallos ? 1 : 0);
