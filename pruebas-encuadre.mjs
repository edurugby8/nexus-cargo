/**
 * PRUEBAS DE ENCUADRE.
 *
 * Esta es la prueba que faltaba, y la que habría evitado la mitad de los
 * fallos de la primera versión.
 *
 * Las pruebas funcionales dicen si la página responde. No dicen si se VE algo.
 * Un plano puede cargar sin un error en consola, pasar todas las pruebas de
 * navegación y tener el camión ciento once grados fuera del eje: técnicamente
 * perfecto y visualmente vacío. Eso es exactamente lo que pasaba en el
 * capítulo de carretera.
 *
 * Así que esto MIDE el encuadre. Recorre el guion entero muestreando el
 * progreso, y en cada muestra:
 *
 *   1. proyecta la caja envolvente del SUJETO del capítulo sobre la pantalla;
 *   2. comprueba que está dentro del cuadro y que ocupa una fracción sensata
 *      —ni de detalle ni de mota—;
 *   3. comprueba que la cámara no está DENTRO de ninguna geometría, lanzando
 *      rayos en seis direcciones y midiendo a qué distancia hay pared;
 *   4. comprueba que el sujeto no está tapado, tirando un rayo de la cámara
 *      hacia él y viendo con qué se topa primero.
 *
 * Y lo hace en las dos relaciones de pantalla, porque el fallo de móvil era
 * precisamente que nadie lo había medido en vertical.
 *
 * Se ejecuta con `npm run encuadre`.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const RAIZ = new URL('./dist/', import.meta.url).pathname;
const PUERTO = 4413;
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain',
};

let fallos = 0;
let aciertos = 0;
const ok = (m) => { aciertos++; console.log(`  ok   ${m}`); };
const mal = (m) => { fallos++; console.log(`  FALLA ${m}`); };

/* ── Qué sujeto manda en cada capítulo ─────────────────────────────
   No es el mismo en todos, y ahí estaba parte del problema: dar por hecho que
   «el protagonista» es siempre el contenedor lleva a encuadrar el contenedor
   en un capítulo que trata de la llegada de un buque de 294 metros.

   `cobertura` es la fracción de la diagonal de pantalla que debe ocupar el
   sujeto. Los márgenes son anchos a propósito: esto no busca imponer una
   composición, busca cazar los desastres —el sujeto fuera de cuadro, o
   convertido en tres píxeles, o llenándolo todo sin que se entienda qué es—.

   `tapado` marca los capítulos donde es NORMAL que algo se cruce por delante:
   en la grúa pasa la estructura, y en carretera pasan quitamiedos y pórticos a
   propósito, porque son ellos los que dan la sensación de velocidad. */
const SUJETOS = {
  oceano:    { que: 'barco',      min: 0.04, max: 0.95, tapado: false },
  puerto:    { que: 'barco',      min: 0.06, max: 1.60, tapado: false },
  /* La descarga abre ANCHA a propósito —buque, grúa y patio— y en ese momento
     el contenedor es una caja entre cientos: ahí el mínimo tiene que ser más
     bajo que en los demás capítulos, o la prueba estaría exigiendo empezar el
     capítulo con un primer plano. Lo que compensa es el color: el
     protagonista es el único naranja del patio. */
  grua:      { que: 'heroe',      min: 0.032, max: 2.60, tapado: true },
  aduanas:   { que: 'camion',     min: 0.08, max: 2.20, tapado: true },
  salida:    { que: 'camion',     min: 0.10, max: 2.60, tapado: true },
  carretera: { que: 'camion',     min: 0.08, max: 2.60, tapado: true },
  centro:    { que: 'camion',     min: 0.05, max: 2.20, tapado: true },
  entrega:   { que: 'camion',     min: 0.04, max: 2.20, tapado: true },
};

/**
 * Distancia mínima aceptable de la cámara a un OBSTÁCULO.
 *
 * No a cualquier superficie: el suelo no cuenta, y el propio sujeto tampoco.
 * Hay planos que pasan a menos de un metro del costado del camión o rozando el
 * asfalto, y están puestos a propósito —son los que cuentan la velocidad—. Lo
 * que esto busca es que la cámara no se meta DENTRO de algo: una pata de grúa,
 * un quitamiedos, una pila de contenedores.
 */
const HOLGURA = 0.55;

function servir() {
  const s = createServer(async (req, res) => {
    let ruta = decodeURIComponent(req.url.split('?')[0]);
    if (ruta.startsWith('/nexus-cargo')) ruta = ruta.slice('/nexus-cargo'.length);
    if (ruta === '' || ruta === '/') ruta = '/index.html';
    try {
      const buf = await readFile(join(RAIZ, ruta));
      res.writeHead(200, { 'content-type': TIPOS[extname(ruta)] || 'application/octet-stream' });
      res.end(buf);
    } catch { res.writeHead(404); res.end('no'); }
  });
  return new Promise((r) => s.listen(PUERTO, () => r(s)));
}

/**
 * La sonda, inyectada en la página.
 *
 * Trabaja sobre la escena VIVA —las mismas matrices que se están pintando—,
 * no sobre una reconstrucción. Es la diferencia entre comprobar lo que se ve y
 * comprobar lo que debería verse.
 */
const SONDA = () => {
  const THREE = window.__escenaNX.THREE;
  const e = window.__escenaNX;

  window.__sonda = (progreso, sujeto) => {
    e.irA(progreso);
    const cam = e.camara;
    cam.updateMatrixWorld(true);
    e.escena.updateMatrixWorld(true);

    const caja = new THREE.Box3();
    const v = new THREE.Vector3();

    const medir = (obj) => {
      caja.setFromObject(obj);
      if (caja.isEmpty()) return null;
      let minX = 1e9; let maxX = -1e9; let minY = 1e9; let maxY = -1e9;
      let delante = 0;
      for (let i = 0; i < 8; i++) {
        v.set(
          i & 1 ? caja.max.x : caja.min.x,
          i & 2 ? caja.max.y : caja.min.y,
          i & 4 ? caja.max.z : caja.min.z,
        );
        const mundo = v.clone();
        v.project(cam);
        if (v.z > -1 && v.z < 1) delante++;
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
        minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
        void mundo;
      }
      const centro = caja.getCenter(new THREE.Vector3());
      const cc = centro.clone().project(cam);
      return {
        delante,
        cobertura: Math.hypot(maxX - minX, maxY - minY) / 2,
        centroDentro: Math.abs(cc.x) <= 1 && Math.abs(cc.y) <= 1 && cc.z > -1 && cc.z < 1,
        solapa: maxX > -1 && minX < 1 && maxY > -1 && minY < 1,
        centro: [centro.x, centro.y, centro.z],
        distancia: cam.position.distanceTo(centro),
      };
    };

    /* Holgura: seis rayos desde la cámara. Si alguno choca a menos de un metro
       y pico, la cámara está metida en algo. Se excluyen el domo del cielo y
       el mar, que son superficies envolventes y siempre «rodean» a la cámara
       sin que eso signifique nada. */
    const rayo = new THREE.Raycaster();
    rayo.far = 25;
    /* El sujeto que sigue el capítulo NO es un obstáculo: hay planos que le
       pasan a un metro del costado a propósito, que son justamente los que
       cuentan el peso y la velocidad. Y los suelos tampoco: van marcados como
       envolventes en su módulo, igual que el mar y el domo del cielo. */
    const propio = new Set();
    if (sujeto && e[sujeto]) e[sujeto].traverse((o) => propio.add(o));
    const solidos = [];
    e.escena.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      if (o.userData.envolvente || propio.has(o)) return;
      // Lo que está lejos no puede tocar un rayo de 25 m: descartarlo aquí
      // evita proyectar centenares de mallas en cada muestra.
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      v.setFromMatrixPosition(o.matrixWorld);
      if (v.distanceTo(cam.position) > 25 + o.geometry.boundingSphere.radius * 3) return;
      let padre = o;
      let oculto = false;
      while (padre) { if (!padre.visible) oculto = true; padre = padre.parent; }
      if (!oculto) solidos.push(o);
    });
    let holgura = Infinity;
    let quien = null;
    for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      rayo.set(cam.position, new THREE.Vector3(...d));
      const golpes = rayo.intersectObjects(solidos, false);
      if (golpes.length && golpes[0].distance < holgura) {
        holgura = golpes[0].distance;
        /* El fallo tiene que decir CONTRA QUÉ y DÓNDE, o no sirve de nada:
           buscar a mano un obstáculo de siete metros en un mundo de kilómetro
           y medio es lo que convierte una prueba útil en una molestia. */
        const o = golpes[0].object;
        const pos = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
        quien = `${o.name || o.type} de radio ${Math.round(o.geometry.boundingSphere?.radius || 0)} m`
          + ` en (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)}),`
          + ` cámara en (${cam.position.x.toFixed(0)}, ${cam.position.y.toFixed(0)}, ${cam.position.z.toFixed(0)})`;
      }
    }

    const sujetos = {
      barco: medir(e.barco),
      camion: medir(e.camion),
      heroe: medir(e.heroe),
    };

    return {
      progreso,
      capitulo: e.capituloDe(progreso),
      fov: cam.fov,
      aspecto: cam.aspect,
      camara: [cam.position.x, cam.position.y, cam.position.z],
      holgura: holgura === Infinity ? 999 : holgura,
      quien,
      sujetos,
    };
  };
};

async function medirPantalla(navegador, nombre, viewport) {
  const ctx = await navegador.newContext({ viewport, deviceScaleFactor: 1 });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on('pageerror', (e) => errores.push(e.message));
  pag.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await pag.addInitScript(() => { window.__debugNX = true; });
  await pag.goto(`http://127.0.0.1:${PUERTO}/nexus-cargo/`, { waitUntil: 'load' });
  await pag.waitForFunction(() => window.__escenaNX && window.__escenaNX.fotogramas > 4, null, { timeout: 60000 });
  await pag.evaluate(SONDA);

  console.log(`\n── ${nombre} · ${viewport.width}×${viewport.height} (relación ${(viewport.width / viewport.height).toFixed(2)}) ──`);

  const MUESTRAS = 120;
  const peor = {};
  const fuera = {};
  for (let i = 0; i <= MUESTRAS; i++) {
    const p = i / MUESTRAS;
    const cap0 = await pag.evaluate((p) => window.__escenaNX.capituloDe(p), p);
    const r = await pag.evaluate(([p, s]) => window.__sonda(p, s), [p, SUJETOS[cap0]?.que || null]);
    const cap = r.capitulo;
    const def = SUJETOS[cap];
    if (!def) continue;
    const s = r.sujetos[def.que];
    if (!s) continue;

    peor[cap] = peor[cap] || { min: 9, max: 0, holgura: 999, muestras: 0, quien: null, donde: 0 };
    const acc = peor[cap];
    acc.muestras++;
    acc.min = Math.min(acc.min, s.cobertura);
    acc.max = Math.max(acc.max, s.cobertura);
    if (r.holgura < acc.holgura) { acc.holgura = r.holgura; acc.quien = r.quien; acc.donde = p; }
    if (!s.solapa) {
      fuera[cap] = fuera[cap] || [];
      fuera[cap].push(p.toFixed(3));
    }
  }

  for (const [cap, def] of Object.entries(SUJETOS)) {
    const a = peor[cap];
    if (!a) { mal(`${nombre} · ${cap}: no se muestreó`); continue; }
    const etiqueta = `${nombre} · ${cap} (${def.que})`;
    if (fuera[cap]) {
      mal(`${etiqueta}: el sujeto sale del cuadro en ${fuera[cap].length} muestras (p=${fuera[cap].slice(0, 4).join(', ')}…)`);
    } else {
      ok(`${etiqueta}: en cuadro en las ${a.muestras} muestras`);
    }
    if (a.min < def.min) {
      mal(`${etiqueta}: llega a ocupar sólo ${(a.min * 100).toFixed(1)} % (mínimo ${(def.min * 100).toFixed(0)} %)`);
    } else {
      ok(`${etiqueta}: cobertura ${(a.min * 100).toFixed(0)}–${(a.max * 100).toFixed(0)} %`);
    }
    if (a.holgura < HOLGURA) {
      mal(`${etiqueta}: la cámara pasa a ${a.holgura.toFixed(2)} m de «${a.quien}» en p=${a.donde.toFixed(3)} (mínimo ${HOLGURA} m)`);
    } else {
      ok(`${etiqueta}: la cámara nunca baja de ${a.holgura === 999 ? '∞' : a.holgura.toFixed(1)} m de holgura`);
    }
  }

  if (errores.length) mal(`${nombre}: ${errores.length} errores de consola · ${errores[0]}`);
  else ok(`${nombre}: consola limpia`);

  await ctx.close();
}

/* ── Ejecución ────────────────────────────────────────────────────── */

const servidor = await servir();
const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

console.log('\nPRUEBAS DE ENCUADRE · NEXUS CARGO');
await medirPantalla(navegador, 'escritorio', { width: 1440, height: 900 });
await medirPantalla(navegador, 'móvil', { width: 390, height: 844 });
await medirPantalla(navegador, 'tableta', { width: 834, height: 1112 });

await navegador.close();
servidor.close();

console.log(`\n${aciertos} bien · ${fallos} mal\n`);
process.exit(fallos ? 1 : 0);
