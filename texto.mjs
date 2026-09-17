/**
 * PRUEBAS DE TEXTO.
 *
 * Dos comprobaciones que van juntas porque fallan por lo mismo: el texto de un
 * capítulo vive en una caja PEGADA de exactamente una altura de ventana, y en
 * cuanto el contenido no cabe ahí, se recorta por abajo sin avisar. No lanza
 * ningún error, no sale en consola y en una pantalla grande no se ve nunca.
 *
 *   1. Desbordamiento: si algo sobresale de su caja, o si alguna línea de
 *      titular queda cortada por su propio recorte de animación.
 *   2. El relevo entre capítulos: durante una altura de ventana hay DOS cajas
 *      en pantalla, la que se va y la que llega. Se comprueba que el solape es
 *      un relevo y no un amontonamiento.
 *
 * Se ejecuta con `npm run texto`.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const RAIZ = new URL('./dist/', import.meta.url).pathname;
const PUERTO = 4416;
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

console.log('\nPRUEBAS DE TEXTO · NEXUS CARGO');

/* Tres pantallas, y la tercera es la que importa: 360 × 640 es el móvil bajo
   de gama que sigue siendo común, y es donde una caja de una altura de
   ventana se queda sin sitio para un titular de tres líneas. */
for (const [nombre, vp] of [
  ['escritorio', { width: 1440, height: 900 }],
  ['móvil', { width: 390, height: 844 }],
  ['móvil corto', { width: 360, height: 640 }],
]) {
  const ctx = await nav.newContext({ viewport: vp });
  const pag = await ctx.newPage();
  await pag.addInitScript(() => { window.__debugNX = true; });
  await pag.goto(`http://127.0.0.1:${PUERTO}/nexus-cargo/`, { waitUntil: 'load' });
  await pag.waitForFunction(() => window.__escenaNX && window.__escenaNX.fotogramas > 4, null, { timeout: 60000 });
  await pag.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });

  console.log(`\n── ${nombre} · ${vp.width}×${vp.height} ──`);

  const caps = await pag.evaluate(() => [...document.querySelectorAll('.cap')]
    .map((s) => ({ id: s.id, top: s.offsetTop, alto: s.offsetHeight })));

  let desbordan = [];
  let recortadas = 0;
  for (const c of caps) {
    await pag.evaluate((y) => window.scrollTo(0, y), Math.round(c.top + 20));
    await fot(pag, 10);
    const r = await pag.evaluate((id) => {
      const caja = document.querySelector(`#${id} .cap__caja`);
      const cb = caja.getBoundingClientRect();
      let arriba = 0;
      let abajo = 0;
      let cortadas = 0;
      for (const el of caja.querySelectorAll('h1,h2,p,li,a,ul,ol')) {
        const b = el.getBoundingClientRect();
        if (b.height < 2) continue;
        arriba = Math.min(arriba, Math.round(b.top - cb.top));
        abajo = Math.max(abajo, Math.round(b.bottom - cb.bottom));
      }
      /* ¿alguna línea de titular cortada por su propio `overflow: hidden`?

         Sólo cuentan las líneas YA REVELADAS. Antes de su animación, la línea
         está a propósito desplazada fuera de su recorte —de eso va el efecto—,
         así que medirlas todas contaba como «cortadas» las que aún no habían
         entrado y daba veinte falsos positivos. Se filtra por la matriz de
         transformación: identidad significa revelada. */
      for (const l of caja.querySelectorAll('.linea')) {
        const i = l.firstElementChild;
        if (!i) continue;
        const t = getComputedStyle(i).transform;
        if (t && t !== 'none' && !/matrix\(1, 0, 0, 1, 0, 0\)/.test(t)) continue;
        const lb = l.getBoundingClientRect();
        const ib = i.getBoundingClientRect();
        if (ib.bottom - lb.bottom > 2 || lb.top - ib.top > 2) cortadas++;
      }
      return { arriba, abajo, cortadas, alto: Math.round(cb.height) };
    }, c.id);
    recortadas += r.cortadas;
    if (r.abajo > 2 || r.arriba < -2) desbordan.push(`${c.id} (arriba ${r.arriba}, abajo ${r.abajo})`);
  }

  desbordan.length === 0
    ? ok(`${nombre}: ningún capítulo desborda su caja`)
    : mal(`${nombre}: desbordan ${desbordan.join(' · ')}`);
  recortadas === 0
    ? ok(`${nombre}: ninguna línea de titular queda cortada`)
    : mal(`${nombre}: ${recortadas} líneas de titular cortadas por su recorte`);

  /* El relevo. En el límite entre dos capítulos hay una altura de ventana en
     la que conviven las dos cajas: una saliendo por arriba y otra entrando.
     Eso es lo correcto; lo que no puede pasar es que haya TRES, ni que las dos
     estén a la vez centradas y superpuestas. */
  let peorSolape = 0;
  let malRelevo = null;
  for (let i = 1; i < caps.length; i++) {
    for (const off of [-120, -40, 0, 40, 120]) {
      await pag.evaluate((y) => window.scrollTo(0, y), caps[i].top + off);
      await fot(pag, 8);
      const v = await pag.evaluate(() => {
        const vis = [];
        for (const caja of document.querySelectorAll('.cap__caja')) {
          const b = caja.getBoundingClientRect();
          if (b.bottom > 8 && b.top < window.innerHeight - 8) {
            vis.push({ id: caja.closest('.cap').id, top: b.top, bottom: b.bottom });
          }
        }
        return vis;
      });
      if (v.length > 2) { malRelevo = `${caps[i].id}: ${v.length} cajas a la vez`; }
      if (v.length === 2) {
        const solape = Math.min(v[0].bottom, v[1].bottom) - Math.max(v[0].top, v[1].top);
        const frac = solape / vp.height;
        if (frac > peorSolape) peorSolape = frac;
      }
    }
  }
  if (malRelevo) mal(`${nombre}: ${malRelevo}`);
  else if (peorSolape > 0.55) mal(`${nombre}: en el relevo las dos cajas se solapan un ${(peorSolape * 100).toFixed(0)} % de la ventana`);
  else ok(`${nombre}: el relevo entre capítulos es limpio (solape máximo ${(peorSolape * 100).toFixed(0)} % de la ventana)`);

  await ctx.close();
}

await nav.close();
sv.close();
console.log(fallos ? `\n${fallos} FALLOS\n` : '\nEl texto aguanta en las tres pantallas.\n');
process.exit(fallos ? 1 : 0);
