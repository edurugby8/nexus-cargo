/**
 * Capturas limpias de los ocho capítulos, sin interfaz.
 *
 * Para revisar encuadres a ojo cuando la prueba de encuadre dice que todo está
 * en cuadro pero uno quiere ver QUÉ hay en ese cuadro. No es una prueba: no
 * afirma nada, sólo deja imágenes en `SALIDA`.
 *
 * El relato se oculta con `visibility`, nunca con `display`: con `display:none`
 * el documento pierde toda su altura, el progreso se queda en cero y todas las
 * capturas salen del primer capítulo.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const RAIZ = new URL('./dist/', import.meta.url).pathname;
const SALIDA = process.env.SALIDA || new URL('./capturas/', import.meta.url).pathname;
const TIPOS = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.json':'application/json', '.xml':'application/xml', '.txt':'text/plain' };

const sv = createServer(async (q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u.startsWith('/nexus-cargo')) u = u.slice('/nexus-cargo'.length);
  if (u === '' || u === '/') u = '/index.html';
  try { const b = await readFile(join(RAIZ, u)); r.writeHead(200, { 'content-type': TIPOS[extname(u)] || 'application/octet-stream' }); r.end(b); }
  catch { r.writeHead(404); r.end('no'); }
});
await new Promise((r) => sv.listen(4418, r));
await mkdir(SALIDA, { recursive: true });

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const fot = (p, n) => p.evaluate((n) => new Promise((r) => { let i = 0; const s = () => { i++; i >= n ? r(1) : requestAnimationFrame(s); }; requestAnimationFrame(s); }), n);

for (const [nombre, vp] of [['esc', { width: 1440, height: 900 }], ['mov', { width: 390, height: 844 }]]) {
  const ctx = await nav.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const pag = await ctx.newPage();
  await pag.addInitScript(() => { window.__debugNX = true; });
  await pag.goto(`http://127.0.0.1:4418/nexus-cargo/?calidad=${process.env.NIVEL || 'alto'}`, { waitUntil: 'load' });
  await pag.waitForFunction(() => window.__escenaNX && window.__escenaNX.fotogramas > 4, null, { timeout: 60000 });
  await pag.addStyleTag({ content: 'html{scroll-behavior:auto !important} .relato,.nav,.hud,.avance,.controles,.pie{visibility:hidden !important}' });
  const caps = await pag.evaluate(() => [...document.querySelectorAll('.cap')].map((s) => ({ id: s.id, top: s.offsetTop, alto: s.offsetHeight })));
  const max = await pag.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  for (const c of caps) {
    for (const [suf, frac] of [['a', 0.25], ['b', 0.65]]) {
      await pag.evaluate((y) => window.scrollTo(0, y), Math.min(max, Math.round(c.top + c.alto * frac)));
      await fot(pag, 40);
      await pag.screenshot({ path: `${SALIDA}/${nombre}-${c.id}-${suf}.png` });
    }
  }
  await ctx.close();
}
await nav.close(); sv.close();
console.log('capturas en', SALIDA);
