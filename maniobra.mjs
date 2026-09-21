/**
 * LA MANIOBRA ENTERA, FOTOGRAMA A FOTOGRAMA.
 *
 * De donde la grúa deja el contenedor sobre el remolque hasta pasada la
 * barrera, en escritorio y en móvil, bajando el scroll y volviéndolo a subir.
 * No es una prueba: no afirma nada. Deja las imágenes y, con ellas, una tira
 * de contactos montada para poder mirar la maniobra de un vistazo en vez de
 * abrir treinta ficheros.
 *
 * Cada fotograma lleva sobreimpreso el progreso, el capítulo, la Z del camión
 * y la SEPARACIÓN MÍNIMA medida en ese instante entre el volumen del camión
 * —cabina, remolque y contenedor— y lo más cercano que no sea suelo. Así lo
 * que se ve y lo que se mide van en la misma imagen y no hay que fiarse de que
 * quien mira y quien mide estén hablando del mismo momento.
 *
 * Se ejecuta con `npm run maniobra`.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';

const RAIZ = new URL('./dist/', import.meta.url).pathname;
const SALIDA = process.env.SALIDA || new URL('./capturas-maniobra/', import.meta.url).pathname;
const PUERTO = 4426;
const NIVEL = process.env.NIVEL || 'alto';
const PASOS = Number(process.env.PASOS || 14);
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json',
  '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain',
};

const sv = createServer(async (q, r) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u.startsWith('/capturas/')) {
    try {
      const b = await readFile(join(SALIDA, u.slice('/capturas/'.length)));
      r.writeHead(200, { 'content-type': 'image/png' });
      return r.end(b);
    } catch { r.writeHead(404); return r.end('no'); }
  }
  if (u.startsWith('/nexus-cargo')) u = u.slice('/nexus-cargo'.length);
  if (u === '' || u === '/') u = '/index.html';
  try {
    const b = await readFile(join(RAIZ, u));
    r.writeHead(200, { 'content-type': TIPOS[extname(u)] || 'application/octet-stream' });
    r.end(b);
  } catch { r.writeHead(404); r.end('no'); }
});
await new Promise((r) => sv.listen(PUERTO, r));
await mkdir(SALIDA, { recursive: true });

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const fot = (p, n) => p.evaluate((n) => new Promise((r) => {
  let i = 0; const s = () => { i++; i >= n ? r(1) : requestAnimationFrame(s); }; requestAnimationFrame(s);
}), n);

/** Separación mínima, en vivo, entre el camión con su carga y el mundo. */
const SONDA = () => {
  const e = window.__escenaNX;
  const THREE = e.THREE;
  window.__holgura = () => {
    e.escena.updateMatrixWorld(true);
    const propio = new Set();
    e.camion.traverse((o) => propio.add(o));
    const caja = new THREE.Box3().setFromObject(e.camion);
    const m = e.mundo();
    if (e.heroe && e.heroe.visible && !m.grua.colgando && m.grua.paso > 4) {
      e.heroe.traverse((o) => propio.add(o));
      const c = new THREE.Box3().setFromObject(e.heroe);
      if (!c.isEmpty()) caja.union(c);
    }
    const sep = (a, b) => Math.hypot(
      Math.max(a.min.x - b.max.x, b.min.x - a.max.x, 0),
      Math.max(a.min.y - b.max.y, b.min.y - a.max.y, 0),
      Math.max(a.min.z - b.max.z, b.min.z - a.max.z, 0),
    );
    const m4 = new THREE.Matrix4();
    const ci = new THREE.Box3();
    let menor = 999;
    e.escena.traverse((o) => {
      if (!o.isMesh || !o.visible || propio.has(o)) return;
      if (o.userData.envolvente || o.userData.efecto || o.userData.franqueable) return;
      // El aparejo de la grúa sujeta la carga: tocarla es su trabajo
      if (o.userData.aparejo) return;
      let pa = o; while (pa) { if (!pa.visible) return; pa = pa.parent; }
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (mat && mat.transparent && mat.depthWrite === false) return;
      if (o.isInstancedMesh) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m4);
          m4.premultiply(o.matrixWorld);
          ci.copy(o.geometry.boundingBox).applyMatrix4(m4);
          menor = Math.min(menor, sep(caja, ci));
        }
        return;
      }
      ci.setFromObject(o);
      if (!ci.isEmpty()) menor = Math.min(menor, sep(caja, ci));
    });
    return {
      holgura: menor,
      z: e.camion.position.z,
      p: e.st.progreso,
      cap: e.capituloDe(e.st.progreso),
    };
  };
};

const ROTULO = ({ texto, color }) => {
  let d = document.getElementById('__rot');
  if (!d) {
    d = document.createElement('div');
    d.id = '__rot';
    d.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;padding:6px 12px;'
      + 'font:600 15px/1.3 ui-monospace,monospace;color:#fff;background:#000c;letter-spacing:.02em';
    document.body.appendChild(d);
  }
  d.textContent = texto;
  d.style.color = color;
};

console.log(`\nMANIOBRA · calidad ${NIVEL} · ${PASOS} pasos por sentido\n`);
const informe = [];

for (const [nombre, vp] of [['esc', { width: 1280, height: 800 }], ['mov', { width: 390, height: 844 }]]) {
  const ctx = await nav.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const pag = await ctx.newPage();
  await pag.addInitScript(() => { window.__debugNX = true; });
  await pag.goto(`http://127.0.0.1:${PUERTO}/nexus-cargo/?calidad=${NIVEL}`, { waitUntil: 'load' });
  await pag.waitForFunction(() => window.__escenaNX && window.__escenaNX.fotogramas > 4, null, { timeout: 60000 });
  await pag.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
  await pag.evaluate(SONDA);

  /* El tramo de scroll que cubre la maniobra: desde que la grúa arría sobre el
     remolque hasta que el camión ha pasado la barrera. Se saca de los propios
     capítulos, no de fracciones a ojo. */
  /* El tramo de scroll que cubre la maniobra: de mitad del capítulo de la
     descarga —cuando el gancho ya está bajando sobre el remolque— a el final
     de la salida del recinto. Se toma de las SECCIONES del documento y no
     buscando el progreso a tientas: la primera versión hacía bisección leyendo
     `st.objetivo` justo después de `scrollTo`, y ese valor lo actualiza el
     bucle de animación en el siguiente fotograma, así que leía siempre el
     anterior y la búsqueda se iba al final de la página. Las sesenta capturas
     salieron del mismo sitio: el último capítulo. */
  const rango = await pag.evaluate(() => {
    const g = document.getElementById('grua');
    const s = document.getElementById('salida');
    return {
      desde: Math.round(g.offsetTop + g.offsetHeight * 0.5),
      hasta: Math.round(s.offsetTop + s.offsetHeight * 0.9),
    };
  });

  for (const sentido of ['baja', 'sube']) {
    for (let i = 0; i <= PASOS; i++) {
      const k = sentido === 'baja' ? i / PASOS : 1 - i / PASOS;
      const y = Math.round(rango.desde + (rango.hasta - rango.desde) * k);
      await pag.evaluate((y) => window.scrollTo(0, y), y);
      await fot(pag, 40);
      const r = await pag.evaluate(() => window.__holgura());
      const holgura = r.holgura > 900 ? '—' : `${r.holgura.toFixed(2)} m`;
      const texto = `${sentido === 'baja' ? '▼' : '▲'} ${String(i).padStart(2, '0')}`
        + ` · p=${r.p.toFixed(3)} · ${r.cap} · camión z=${r.z.toFixed(1)}`
        + ` · holgura ${holgura}`;
      await pag.evaluate(ROTULO, { texto, color: r.holgura < 0.35 ? '#ff6a4d' : '#7ef0b0' });
      const fich = `${nombre}-${sentido}-${String(i).padStart(2, '0')}.png`;
      await pag.screenshot({ path: join(SALIDA, fich) });
      informe.push({ vista: nombre, sentido, i, p: +r.p.toFixed(4), cap: r.cap, z: +r.z.toFixed(1), holgura: r.holgura > 900 ? null : +r.holgura.toFixed(2) });
      console.log(`  ${nombre} ${texto}`);
    }
  }
  await ctx.close();
}

/* La tira de contactos: se monta en el propio navegador porque en esta máquina
   no hay ImageMagick, y una imagen única es lo que permite ver la maniobra
   seguida en vez de abrir treinta ficheros. */
const ficheros = (await readdir(SALIDA)).filter((f) => f.endsWith('.png') && !f.startsWith('tira-')).sort();
for (const [vista, ancho] of [['esc', 1280], ['mov', 390]]) {
  const mios = ficheros.filter((f) => f.startsWith(`${vista}-`));
  if (!mios.length) continue;
  const cols = vista === 'esc' ? 3 : 5;
  const esc = vista === 'esc' ? 420 : 250;
  const ctx = await nav.newContext({ viewport: { width: cols * esc + 20, height: 400 } });
  const pag = await ctx.newPage();
  await pag.setContent(`<body style="margin:0;background:#0b0e12;display:grid;
    grid-template-columns:repeat(${cols},${esc}px);gap:4px;padding:8px">
    ${mios.map((f) => `<img src="http://127.0.0.1:${PUERTO}/capturas/${f}" style="width:${esc}px;display:block">`).join('')}
    </body>`);
  await pag.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 60000 });
  await pag.screenshot({ path: join(SALIDA, `tira-${vista}.png`), fullPage: true });
  console.log(`\n  tira-${vista}.png · ${mios.length} fotogramas`);
  await ctx.close();
}

const apretados = informe.filter((r) => r.holgura !== null && r.holgura < 0.35);
console.log(apretados.length
  ? `\n${apretados.length} fotogramas con menos de 35 cm de holgura:\n` + apretados.map((r) => `  ${r.vista} ${r.sentido} p=${r.p} ${r.cap} z=${r.z} · ${r.holgura} m`).join('\n')
  : `\nEn los ${informe.length} fotogramas el camión nunca baja de 35 cm de holgura.`);
const menor = informe.filter((r) => r.holgura !== null).sort((a, b) => a.holgura - b.holgura)[0];
if (menor) console.log(`Holgura mínima de toda la maniobra: ${menor.holgura} m (${menor.vista}, ${menor.cap}, z=${menor.z}, p=${menor.p})\n`);

await nav.close();
sv.close();
