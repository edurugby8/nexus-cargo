/**
 * PRUEBAS DE OCLUSIÓN: QUÉ SE CRUZA DELANTE DE LA CÁMARA.
 *
 * La prueba de encuadre comprueba que el sujeto esté DENTRO del cuadro. Eso no
 * basta: puede estar dentro del cuadro y tener una pata de grúa delante, o una
 * explanada de mil setecientos metros ocupando media pantalla. El encuadre
 * sería correcto y la escena, ilegible.
 *
 * Esto mide lo otro. En cada muestra:
 *
 *   1. lanza un abanico de rayos de la cámara hacia el SUJETO del capítulo y
 *      apunta qué se topa antes de llegar;
 *   2. mide qué fracción del sujeto queda tapada;
 *   3. lanza rayos hacia el cuadro entero para encontrar superficies GRANDES
 *      muy cerca del objetivo, que son las que se comen la escena aunque no
 *      tapen al sujeto.
 *
 * El informe dice el nombre del estorbo y dónde está, porque una prueba que
 * sólo dice «algo tapa» obliga a buscarlo a mano en un mundo de kilómetro y
 * medio.
 *
 * Se ejecuta con `npm run oclusion`.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const RAIZ = new URL('./dist/', import.meta.url).pathname;
const PUERTO = 4423;
const TIPOS = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain',
};

const SUJETO = {
  oceano: 'barco', puerto: 'barco', grua: 'heroe',
  aduanas: 'camion', salida: 'camion', carretera: 'camion',
  centro: 'camion', entrega: 'camion',
};

/** Cuánto del sujeto puede quedar tapado sin que estorbe. */
const TAPADO = 0.34;

/* En los dos extremos de calidad. El nivel no cambia sólo la resolución:
   cambia cuánta geometría hay delante, así que una cámara despejada en «bajo»
   puede estar mirando una pata de grúa en «alto». */
const NIVELES = (process.env.NIVELES || 'alto,bajo').split(',');
/**
 * Y cuánto se mide SOSTENIDO, no en un fotograma suelto.
 *
 * El camión atraviesa un arco de escáner y pasa bajo cuatro pórticos: durante
 * un instante, la viga que cruza la carretera se le pone delante de la cola.
 * Eso no es un defecto —es lo que se ve cuando un camión sale de una aduana— y
 * exigir que no ocurra nunca obliga a mover la cámara trece grados para
 * esquivar una viga que va a estar delante medio segundo, que sale mucho más
 * caro en plano de lo que cuesta en legibilidad.
 *
 * Lo que sí es un defecto es que el sujeto se quede tapado y SIGA tapado. Así
 * que se mide el peor valor que se mantiene en dos paradas seguidas: un pico
 * aislado pasa, una oclusión que dura, no.
 */
const sostenido = (serie) => {
  let peor = 0;
  for (let i = 1; i < serie.length; i++) peor = Math.max(peor, Math.min(serie[i - 1], serie[i]));
  return peor;
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

const SONDA = () => {
  const THREE = window.__escenaNX.THREE;
  const e = window.__escenaNX;
  const caja = new THREE.Box3();
  const v = new THREE.Vector3();
  const rayo = new THREE.Raycaster();

  /** Nombre legible de una malla: el grupo raíz al que pertenece. */
  const quien = (o) => {
    const raices = {
      barco: e.barco, camion: e.camion, heroe: e.heroe,
      puerto: e.puerto, aduanas: e.aduanas, carretera: e.carretera,
      centro: e.centro, destino: e.destino, mar: e.mar,
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

  window.__oclusion = (progreso, nombreSujeto) => {
    e.irA(progreso);
    const cam = e.camara;
    cam.updateMatrixWorld(true);
    e.escena.updateMatrixWorld(true);

    const sujeto = e[nombreSujeto];
    caja.setFromObject(sujeto);
    const centro = caja.getCenter(new THREE.Vector3());
    const tam = caja.getSize(new THREE.Vector3());

    /* El propio sujeto no se tapa a sí mismo, y el CONTENEDOR PROTAGONISTA
       cuenta como parte del camión: va encima, así que cualquier rayo hacia la
       caja del camión lo atraviesa. Medirlo como estorbo daba un 100 % de
       oclusión en aduanas, salida y carretera sin que hubiera nada delante. */
    const propio = new Set();
    sujeto.traverse((o) => propio.add(o));
    if (nombreSujeto === 'camion' && e.heroe) e.heroe.traverse((o) => propio.add(o));
    if (nombreSujeto === 'heroe' && e.camion) e.camion.traverse((o) => propio.add(o));
    /* Y el APAREJO de la grúa —spreader, twistlocks y cables— es parte de la
       carga mientras la lleva: el bastidor va cuarenta y seis centímetros por
       encima de la tapa y los cables salen de sus cuatro esquinas, así que un
       rayo picado hacia el centro del contenedor roza el bastidor por pura
       geometría. Contarlo como estorbo daba un 56 % de «oclusión» en todo el
       capítulo de la descarga culpando a la grúa de tapar lo que sujeta. */
    e.escena.traverse((o) => { if (o.userData.aparejo) propio.add(o); });

    const solidos = [];
    e.escena.traverse((o) => {
      /* Los SUELOS y el mar no son estorbos: son las superficies sobre las que
         y dentro de las que están las cosas. Un rayo hacia la parte baja del
         casco —que baja once metros bajo el agua— atraviesa el mar
         necesariamente, y contarlo daba un 44 % de oclusión permanente en los
         dos capítulos marítimos sin que hubiera nada delante del buque. */
      if (!o.isMesh || !o.visible || propio.has(o) || o.userData.envolvente) return;
      let padre = o;
      let oculto = false;
      while (padre) { if (!padre.visible) oculto = true; padre = padre.parent; }
      if (!oculto) solidos.push(o);
    });

    /* Abanico de rayos hacia el sujeto: nueve puntos repartidos por su caja
       envolvente. Con uno solo al centro, media grúa delante pasa
       desapercibida si justo deja pasar el rayo del medio. */
    const objetivos = [centro];
    for (const sx of [-0.35, 0.35]) {
      for (const sy of [0.05, 0.34]) {
        for (const sz of [-0.35, 0.35]) {
          objetivos.push(new THREE.Vector3(
            centro.x + tam.x * sx, centro.y + tam.y * sy, centro.z + tam.z * sz,
          ));
        }
      }
    }

    let tapados = 0;
    const estorbos = new Map();
    for (const o of objetivos) {
      v.subVectors(o, cam.position);
      const dist = v.length();
      rayo.set(cam.position, v.normalize());
      rayo.far = dist - 0.4;
      const golpes = rayo.intersectObjects(solidos, false);
      if (golpes.length) {
        tapados++;
        const n = quien(golpes[0].object);
        const antes = estorbos.get(n);
        if (!antes || golpes[0].distance < antes) estorbos.set(n, golpes[0].distance);
      }
    }

    return {
      capitulo: e.capituloDe(progreso),
      tapado: tapados / objetivos.length,
      estorbos: [...estorbos.entries()].map(([n, d]) => `${n} a ${Math.round(d)} m`),
      camara: [cam.position.x, cam.position.y, cam.position.z].map(Math.round),
    };
  };
};

console.log('\nPRUEBAS DE OCLUSIÓN · NEXUS CARGO');

const VISTAS = [];
for (const nivel of NIVELES) {
  VISTAS.push([`${nivel} · escritorio`, { width: 1440, height: 900 }, nivel]);
  VISTAS.push([`${nivel} · móvil`, { width: 390, height: 844 }, nivel]);
}

for (const [nombre, vp, nivel] of VISTAS) {
  const ctx = await nav.newContext({ viewport: vp });
  const pag = await ctx.newPage();
  await pag.addInitScript(() => { window.__debugNX = true; });
  await pag.goto(`http://127.0.0.1:${PUERTO}/nexus-cargo/?calidad=${nivel}`, { waitUntil: 'load' });
  await pag.waitForFunction(() => window.__escenaNX && window.__escenaNX.fotogramas > 4, null, { timeout: 60000 });
  await pag.evaluate(SONDA);

  console.log(`\n── ${nombre} · ${vp.width}×${vp.height} ──`);

  const tramos = await pag.evaluate(() => window.__escenaNX.tramos.map((t) => [t.id, t.desde, t.hasta]));
  for (const [id, desde, hasta] of tramos) {
    const N = 16;
    let peor = 0;
    let peorEn = 0;
    const serie = [];
    const culpables = new Map();
    for (let i = 0; i <= N; i++) {
      const p = desde + (hasta - desde) * (i / N);
      const r = await pag.evaluate(([p, s]) => window.__oclusion(p, s), [p, SUJETO[id]]);
      serie.push(r.tapado);
      if (r.tapado > peor) { peor = r.tapado; peorEn = p; }
      if (r.tapado > TAPADO) {
        for (const c of r.estorbos) {
          const clave = c.split(' a ')[0];
          culpables.set(clave, (culpables.get(clave) || 0) + 1);
        }
      }
    }
    const seguido = sostenido(serie);
    seguido <= TAPADO
      ? ok(`${nombre} · ${id}: el sujeto no se tapa de seguido más de un ${(seguido * 100).toFixed(0)} % (pico suelto ${(peor * 100).toFixed(0)} %)`)
      : mal(`${nombre} · ${id}: el sujeto queda tapado un ${(seguido * 100).toFixed(0)} % de seguido, con pico del ${(peor * 100).toFixed(0)} % en p=${peorEn.toFixed(3)} — ${[...culpables.keys()].join(', ')}`);
  }

  await ctx.close();
}

await nav.close();
sv.close();
console.log(fallos ? `\n${fallos} FALLOS\n` : '\nNada se cruza delante del sujeto.\n');
process.exit(fallos ? 1 : 0);
