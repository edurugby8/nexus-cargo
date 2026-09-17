/**
 * PRUEBAS DE RESPONSIVE.
 *
 * Los cinco tamaños del encargo, y en cada uno las cosas que sólo fallan a un
 * ancho concreto y no dan ningún aviso: un botón que se sale del encabezado,
 * un panel que crece hasta tapar el texto, una barra de desplazamiento
 * horizontal de doce píxeles que nadie ve en un portátil.
 *
 * Lo que comprueba, por orden de lo que más molesta:
 *
 *   1. El ENCABEZADO cabe: ningún hijo se sale por los lados, el botón de
 *      solicitud se ve entero y no envuelve a dos líneas.
 *   2. El PANEL de seguimiento no pasa del 25 % de la pantalla, ni plegado ni
 *      desplegado, y se puede plegar y desplegar de verdad.
 *   3. Nada del panel se superpone al texto del capítulo ni a los controles.
 *   4. No hay desbordamiento horizontal en ninguna parte del documento.
 *   5. Los botones del final se pueden pulsar: están en pantalla, tienen
 *      tamaño de dedo y nada los tapa.
 *
 * Se ejecuta con `npm run responsive`.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const RAIZ = new URL('./dist/', import.meta.url).pathname;
const PUERTO = 4419;
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain',
};

/** Los cinco del encargo. El de 360×800 es el que más cosas rompe. */
const PANTALLAS = [
  ['escritorio grande', { width: 1920, height: 1080 }],
  ['portátil', { width: 1366, height: 768 }],
  ['tableta', { width: 834, height: 1112 }],
  ['móvil 390', { width: 390, height: 844 }],
  ['móvil 360', { width: 360, height: 800 }],
];

/** Lo mínimo que se puede tocar con un dedo, según las guías de ambas
    plataformas. Por debajo de esto un botón existe pero no se usa. */
const DEDO = 40;

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

console.log('\nPRUEBAS DE RESPONSIVE · NEXUS CARGO');

for (const [nombre, vp] of PANTALLAS) {
  const ctx = await nav.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const pag = await ctx.newPage();
  await pag.addInitScript(() => { window.__debugNX = true; });
  await pag.goto(`http://127.0.0.1:${PUERTO}/nexus-cargo/`, { waitUntil: 'load' });
  await pag.waitForFunction(() => window.__escenaNX && window.__escenaNX.fotogramas > 4, null, { timeout: 60000 });
  await pag.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });

  console.log(`\n── ${nombre} · ${vp.width}×${vp.height} ──`);

  /* 1 · El encabezado */
  const cab = await pag.evaluate(() => {
    const nav = document.getElementById('nav');
    const nb = nav.getBoundingClientRect();
    const cta = nav.querySelector('.nav__cta');
    const cb = cta ? cta.getBoundingClientRect() : null;
    const visible = cta && getComputedStyle(cta).display !== 'none';
    const rotulo = cta ? [...cta.querySelectorAll('span')]
      .filter((e) => getComputedStyle(e).display !== 'none')
      .map((e) => e.textContent.trim())[0] : null;
    let salidos = [];
    for (const h of nav.children) {
      const b = h.getBoundingClientRect();
      if (b.width < 1) continue;
      if (b.left < -1 || b.right > window.innerWidth + 1) {
        salidos.push(`${h.className} [${Math.round(b.left)}…${Math.round(b.right)}]`);
      }
    }
    return {
      alto: Math.round(nb.height),
      ctaVisible: !!visible,
      ctaAlto: cb ? Math.round(cb.height) : 0,
      ctaDerecha: cb ? Math.round(cb.right) : 0,
      rotulo,
      salidos,
      ancho: window.innerWidth,
    };
  });
  if (cab.salidos.length) mal(`${nombre}: el encabezado se sale — ${cab.salidos.join(' · ')}`);
  else if (!cab.ctaVisible) mal(`${nombre}: el botón de solicitud no se enseña`);
  else if (cab.ctaDerecha > cab.ancho) mal(`${nombre}: el botón de solicitud se corta (llega a ${cab.ctaDerecha} de ${cab.ancho})`);
  else if (cab.ctaAlto > 52) mal(`${nombre}: el botón de solicitud envuelve a dos líneas (${cab.ctaAlto} px)`);
  else ok(`${nombre}: el encabezado cabe entero, botón «${cab.rotulo}» visible y en una línea`);

  /* 2 y 3 · El panel, plegado y desplegado */
  await pag.evaluate(() => window.scrollTo(0, document.getElementById('grua').offsetTop + 200));
  await fot(pag, 14);

  const medirPanel = () => pag.evaluate(() => {
    const hud = document.getElementById('hud');
    const b = hud.getBoundingClientRect();
    const area = (b.width * b.height) / (window.innerWidth * window.innerHeight);
    const solapes = [];
    const estorbos = [
      ...document.querySelectorAll('.cap__caja h1,.cap__caja h2,.cap__caja p,.cap__caja li,.cap__caja a'),
      ...document.querySelectorAll('.controles button, .nav__cta'),
    ];
    for (const el of estorbos) {
      const e = el.getBoundingClientRect();
      if (e.width < 2 || e.height < 2) continue;
      if (e.bottom < 0 || e.top > window.innerHeight) continue;
      const ox = Math.min(b.right, e.right) - Math.max(b.left, e.left);
      const oy = Math.min(b.bottom, e.bottom) - Math.max(b.top, e.top);
      if (ox > 1 && oy > 1) solapes.push((el.textContent || el.className).trim().slice(0, 30));
    }
    return {
      abierto: hud.hasAttribute('data-abierto'),
      area,
      alto: Math.round(b.height),
      solapes,
      datosVisibles: document.getElementById('hud-cuerpo').getBoundingClientRect().height > 4,
    };
  });

  const antes = await medirPanel();
  await pag.click('#hud-conmutar');
  await pag.waitForTimeout(450);
  const despues = await medirPanel();
  // Y se vuelve a dejar como estaba, para no falsear lo que sigue
  await pag.click('#hud-conmutar');
  await pag.waitForTimeout(450);

  const peorArea = Math.max(antes.area, despues.area);
  peorArea <= 0.25
    ? ok(`${nombre}: el panel ocupa como mucho el ${(peorArea * 100).toFixed(1)} % de la pantalla`)
    : mal(`${nombre}: el panel ocupa el ${(peorArea * 100).toFixed(1)} % de la pantalla (tope 25 %)`);

  antes.abierto !== despues.abierto && antes.datosVisibles !== despues.datosVisibles
    ? ok(`${nombre}: el panel se pliega y se despliega (${antes.abierto ? 'abierto' : 'plegado'} → ${despues.abierto ? 'abierto' : 'plegado'})`)
    : mal(`${nombre}: el conmutador del panel no cambia nada`);

  const solapes = [...new Set([...antes.solapes, ...despues.solapes])];
  solapes.length === 0
    ? ok(`${nombre}: el panel no tapa texto ni controles`)
    : mal(`${nombre}: el panel tapa ${solapes.length} elementos — ${solapes.slice(0, 3).join(' · ')}`);

  /* 4 · Desbordamiento horizontal en todo el documento */
  const desborde = await pag.evaluate(() => {
    const d = document.documentElement;
    const extra = d.scrollWidth - d.clientWidth;
    if (extra <= 1) return { extra: 0, culpables: [] };
    const culpables = [];
    for (const el of document.querySelectorAll('body *')) {
      const b = el.getBoundingClientRect();
      if (b.right > d.clientWidth + 1 && b.width > 2) {
        culpables.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} (+${Math.round(b.right - d.clientWidth)})`);
      }
      if (culpables.length > 4) break;
    }
    return { extra, culpables };
  });
  desborde.extra <= 1
    ? ok(`${nombre}: sin desbordamiento horizontal`)
    : mal(`${nombre}: desborda ${desborde.extra} px — ${desborde.culpables.join(' · ')}`);

  /* 5 · Los botones del final, pulsables */
  const finales = await pag.evaluate(async () => {
    const sec = document.getElementById('entrega');
    window.scrollTo(0, sec.offsetTop + sec.offsetHeight * 0.55);
    await new Promise((r) => setTimeout(r, 260));
    const res = [];
    for (const a of sec.querySelectorAll('.acciones a')) {
      const b = a.getBoundingClientRect();
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      const encima = document.elementFromPoint(cx, cy);
      res.push({
        texto: a.textContent.trim().slice(0, 24),
        alto: Math.round(b.height),
        ancho: Math.round(b.width),
        dentro: b.top >= 0 && b.bottom <= window.innerHeight && b.left >= 0 && b.right <= window.innerWidth,
        alcanzable: !!(encima && (encima === a || a.contains(encima))),
      });
    }
    return res;
  });
  const malos = finales.filter((b) => !b.dentro || !b.alcanzable || b.alto < DEDO);
  finales.length && malos.length === 0
    ? ok(`${nombre}: los ${finales.length} botones del final se pueden pulsar (${finales[0].ancho}×${finales[0].alto} px)`)
    : mal(`${nombre}: botones finales con problema — ${malos.map((b) => `«${b.texto}» ${b.alto}px dentro=${b.dentro} alcanzable=${b.alcanzable}`).join(' · ')}`);

  await ctx.close();
}

await nav.close();
sv.close();
console.log(fallos ? `\n${fallos} FALLOS\n` : '\nLas cinco pantallas aguantan.\n');
process.exit(fallos ? 1 : 0);
