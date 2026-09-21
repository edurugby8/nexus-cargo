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

/* MARGEN DE SEGURIDAD, y va en el sentido contrario al que tenía.
   Antes esto ENCOGÍA la caja del camión medio metro «porque rozar no es
   atravesar»: o sea que cualquier cosa que se metiera hasta cuarenta y nueve
   centímetros dentro del camión pasaba la prueba. Al revés. La caja se ENSANCHA
   treinta y cinco centímetros por cada cara, de modo que lo que se exige no es
   que no se toquen, sino que quede aire entre medias. Lo que legítimamente se
   cruza a nivel —el carril de la grúa— o se abre al paso —el brazo de la
   barrera— va marcado `franqueable` y se comprueba aparte. */
const MARGEN = 0.35;
/** Cuántas paradas por capítulo. El camión recorre 900 m: hace falta densidad. */
const PASOS = 90;

/* EN LOS DOS NIVELES, y ésta es la parte que faltaba.
   El nivel de calidad no cambia sólo la resolución: cambia CUÁNTA cosa hay.
   El patio pasa de seis bloques a veinticuatro y la flota de tractores de
   nueve a veintiséis. El banco de pruebas corre sin tarjeta gráfica, así que
   se le asigna «bajo», y en bajo la flota era tan corta que ninguno de sus
   nueve tractores caía en el carril del camión: la prueba daba verde mientras
   cualquiera con un portátil normal veía el camión atravesar contenedores.
   Una prueba que sólo mira el escenario que nadie ve no es una prueba. */
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
    // Se ensancha la caja: no basta con no tocarse, tiene que sobrar sitio
    cajaSujeto.expandByScalar(holgura);

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
      if (o.userData.efecto || o.userData.franqueable) return;
      /* Ni el APAREJO de la grúa. El spreader va cuarenta y seis centímetros
         por encima de la tapa del contenedor porque es lo que lo está
         sujetando: con el margen de seguridad puesto, las dos cajas se tocan
         por definición mientras dura la maniobra. Medirlo como choque es
         contar como accidente el hecho de que la grúa agarre la carga. */
      if (o.userData.aparejo) return;
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

for (const nivel of NIVELES) {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
  const pag = await ctx.newPage();
  await pag.addInitScript(() => { window.__debugNX = true; });
  await pag.goto(`http://127.0.0.1:${PUERTO}/nexus-cargo/?calidad=${nivel}`, { waitUntil: 'load' });
  await pag.waitForFunction(() => window.__escenaNX && window.__escenaNX.fotogramas > 4, null, { timeout: 60000 });
  await pag.evaluate(SONDA);

  console.log(`\n── calidad ${nivel} ──`);

  const tramos = await pag.evaluate(() => window.__escenaNX.tramos.map((t) => [t.id, t.desde, t.hasta]));
  for (const [id, desde, hasta] of tramos) {
    const peores = new Map();
    for (let i = 0; i <= PASOS; i++) {
      const p = desde + (hasta - desde) * (i / PASOS);
      const r = await pag.evaluate(([p, h]) => window.__colision(p, h), [p, MARGEN]);
      for (const g of r.golpes) {
        const antes = peores.get(g.quien);
        if (!antes || g.solape > antes.solape) peores.set(g.quien, { ...g, p, camion: r.camion });
      }
    }
    if (!peores.size) { ok(`${nivel} · ${id}: el camión no atraviesa nada`); continue; }
    const lista = [...peores.values()]
      .sort((a, b) => b.solape - a.solape)
      .map((g) => `${g.quien} (${g.solape} m en p=${g.p.toFixed(3)}, junto a ${g.donde})`);
    mal(`${nivel} · ${id}: el camión atraviesa ${lista.join(' · ')}`);
  }

  await ctx.close();
}

/* ── EL RELEVO DE LA CARGA ────────────────────────────────────────────
   Mientras la grúa la sujeta, la carga la coloca el GUION; en cuanto la
   suelta, la coloca la matriz del camión. Son dos cuentas distintas para la
   misma cosa, y si no dan el mismo número el contenedor SALTA en el fotograma
   del relevo. Daba 6,4 m hacia atrás y metro y medio hacia abajo: la grúa lo
   posaba sobre la cabina y al soltarlo aparecía hundido en el remolque, así
   iba el resto del viaje. Se comprueba que no haya salto y que la caja apoye
   de verdad sobre la plataforma. */
{
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
  const pag = await ctx.newPage();
  await pag.addInitScript(() => { window.__debugNX = true; });
  await pag.goto(`http://127.0.0.1:${PUERTO}/nexus-cargo/?calidad=alto`, { waitUntil: 'load' });
  await pag.waitForFunction(() => window.__escenaNX && window.__escenaNX.fotogramas > 4, null, { timeout: 60000 });

  const tramos = await pag.evaluate(() => window.__escenaNX.tramos.map((t) => [t.id, t.desde, t.hasta]));
  const grua = tramos.find((t) => t[0] === 'grua');
  const fin = tramos.find((t) => t[0] === 'aduanas');
  /* Se mide EL PASO DEL RELEVO, no el paso más grande. Medir el mayor de
     todos marcaba la bajada del gancho —diecinueve metros de arriada en un
     suspiro, que es lo que hace una grúa— y tapaba lo que se busca, que es
     el corte del cambio de dueño. */
  let salto = null;
  let peorApoyo = 0;
  let anterior = null;
  let eraSuelto = null;
  for (let p = grua[1] + (grua[2] - grua[1]) * 0.7; p < fin[1] + 0.02; p += 0.001) {
    const r = await pag.evaluate((p) => {
      const e = window.__escenaNX;
      e.irA(p);
      e.escena.updateMatrixWorld(true);
      const caja = new e.THREE.Box3().setFromObject(e.heroe);
      return {
        pos: [e.heroe.position.x, e.heroe.position.y, e.heroe.position.z],
        bajo: caja.min.y,
        plataforma: e.camion.position.y + e.MEDIDAS.camion.plataforma,
        suelto: !e.mundo().grua.contenedor,
      };
    }, p);
    if (anterior && eraSuelto === false && r.suelto) {
      salto = { d: Math.hypot(...r.pos.map((v, i) => v - anterior[i])), p };
    }
    anterior = r.pos;
    eraSuelto = r.suelto;
    // Una vez apoyada, la caja tiene que descansar sobre la plataforma
    if (r.suelto) peorApoyo = Math.max(peorApoyo, Math.abs(r.bajo - r.plataforma));
  }
  /* Umbral: en el relevo la carga ya está posada y el camión aún no ha
     arrancado, así que entre un paso y el siguiente no debe moverse más que
     unos centímetros. Medio metro ya no es movimiento, es un corte. */
  if (!salto) mal('no se ha encontrado el relevo de la carga: la prueba no está mirando donde cree');
  else if (salto.d < 0.5) ok(`la carga pasa de la grúa al camión sin saltar (${(salto.d * 100).toFixed(0)} cm en el relevo)`);
  else mal(`la carga SALTA ${salto.d.toFixed(2)} m en p=${salto.p.toFixed(3)} al cambiar de dueño`);
  peorApoyo < 0.12
    ? ok(`la carga apoya sobre la plataforma (desviación máxima ${(peorApoyo * 100).toFixed(0)} cm)`)
    : mal(`la carga no apoya: queda ${(peorApoyo * 100).toFixed(0)} cm fuera de la plataforma del remolque`);

  /* LA BARRERA, que es lo único que puede cortar el carril a propósito.
     Está marcada `franqueable` y por eso las otras dos pruebas la dejan pasar,
     así que aquí se comprueba lo que de verdad importa: que cuando el morro
     del camión llega a ella, el brazo ya no está en el paso. Sin esto,
     `franqueable` sería una excusa para no mirar. */
  let peorBrazo = 99;
  let dondeBrazo = 0;
  for (let p = fin[1]; p < 0.60; p += 0.002) {
    const r = await pag.evaluate((p) => {
      const e = window.__escenaNX;
      e.irA(p);
      e.escena.updateMatrixWorld(true);
      const C = e.CORREDOR;
      let bajo = 99;
      e.aduanas.traverse((o) => {
        if (!o.isMesh || !o.userData.franqueable) return;
        /* Se recorre el brazo PUNTO A PUNTO, no por su caja envolvente.
           Levantado ochenta grados, la caja del brazo sigue tocando el borde
           del carril —por su extremo de abajo, que es el que está clavado en
           el poste, fuera del paso— y su mínimo en Y es la altura del pivote.
           Medido así, una barrera abierta del todo parecía cerrada. Lo que
           importa es a qué altura pasa el brazo POR ENCIMA DEL CARRIL. */
        o.geometry.computeBoundingBox();
        const bb = o.geometry.boundingBox;
        const v = new e.THREE.Vector3();
        for (let k = 0; k <= 24; k++) {
          v.set(
            bb.min.x + (bb.max.x - bb.min.x) * (k / 24),
            (bb.min.y + bb.max.y) / 2,
            (bb.min.z + bb.max.z) / 2,
          ).applyMatrix4(o.matrixWorld);
          if (Math.abs(v.x - C.x) > C.media) continue;
          bajo = Math.min(bajo, v.y);
        }
      });
      const caja = new e.THREE.Box3().setFromObject(e.camion);
      return { bajo, morro: caja.min.z, barrera: e.MEDIDAS.barrera };
    }, p);
    // Sólo importa desde que el morro está a veinte metros de la barrera
    if (r.morro > r.barrera + 20) continue;
    if (r.morro < r.barrera - 6) break;
    if (r.bajo < peorBrazo) { peorBrazo = r.bajo; dondeBrazo = p; }
  }
  peorBrazo > 5.2
    ? ok(`la barrera está levantada cuando el camión llega (el brazo sube a ${peorBrazo === 99 ? 'fuera del carril' : `${peorBrazo.toFixed(1)} m`})`)
    : mal(`la barrera sigue cortando el carril a ${peorBrazo.toFixed(1)} m de altura cuando el camión llega, en p=${dondeBrazo.toFixed(3)}`);

  await ctx.close();
}

await nav.close();
sv.close();
console.log(fallos ? `\n${fallos} FALLOS\n` : '\nEl camión no atraviesa nada en todo el recorrido.\n');
process.exit(fallos ? 1 : 0);
