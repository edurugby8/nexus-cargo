/**
 * Recorrido funcional de NEXUS CARGO.
 *
 *   npm run build && npm run preview     (en una terminal)
 *   node pruebas.mjs                     (en otra)
 *
 * Sale con código 1 si algo falla.
 *
 * Dos reglas aprendidas a base de perder tiempo y que aquí se respetan:
 *
 *  · Donde hay que esperar a que la escena se asiente, se cuentan FOTOGRAMAS
 *    PINTADOS, no milisegundos. Bajo renderizado por software un fotograma
 *    puede durar más de un segundo, y cualquier plazo fijo da por buena una
 *    escena que ni siquiera ha vuelto a pintar.
 *  · Donde se espera a que pase algo, se espera a LA CONDICIÓN. El
 *    desplazamiento suave de un anclaje tarda lo que tarde en fotogramas.
 */
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:4400/nexus-cargo/';
const fallos = [];
const ok = (n) => console.log('  ✓', n);
const fallo = (n, d) => { fallos.push(n); console.log('  ✗', n, '→', d); };

const navegador = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});

async function abrir(opciones = {}) {
  const p = await navegador.newPage({ viewport: { width: 1440, height: 900 }, ...opciones });
  p.on('pageerror', (e) => fallo('error de página', e.message.split('\n')[0]));
  p.on('console', (m) => { if (m.type() === 'error') fallo('consola', m.text().slice(0, 140)); });
  await p.addInitScript(() => { window.__debugNX = true; });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(4500);
  return p;
}

/** Espera a que la escena pinte N fotogramas de verdad. */
const fotogramas = (p, n = 6) => p
  .evaluate(() => { window.__d = window.__escenaNX?.fotogramas ?? 0; })
  .then(() => p.waitForFunction((k) => !window.__escenaNX || window.__escenaNX.fotogramas - window.__d >= k,
    n, { timeout: 90000, polling: 150 }))
  .catch(() => {});

/**
 * Lleva el recorrido a un progreso dado y espera a que se asiente DE VERDAD.
 *
 * La cámara va amortiguada a propósito, así que durante un rato después de
 * saltar sigue viniendo de donde estaba. Esperar un número fijo de fotogramas
 * no vale: hay que esperar a que deje de moverse, contando fotogramas PINTADOS
 * entre comprobaciones. Con un sondeo por milisegundos, a un fotograma por
 * segundo dos lecturas seguidas leen el mismo fotograma y parece quieta.
 */
async function irA(p, progreso) {
  await p.evaluate((f) => {
    document.documentElement.style.scrollBehavior = 'auto';
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo(0, Math.round(max * f));
  }, progreso);
  await p.evaluate(() => { window.__marca = null; });
  await p.waitForFunction(() => {
    const d = window.__escenaNX;
    if (!d) return true;
    const p = d.camara.position;
    const m = window.__marca;
    if (!m || Math.abs(p.x - m.x) > 0.05 || Math.abs(p.y - m.y) > 0.05 || Math.abs(p.z - m.z) > 0.05) {
      window.__marca = { x: p.x, y: p.y, z: p.z, f: d.fotogramas };
      return false;
    }
    return d.fotogramas - m.f >= 5;
  }, null, { timeout: 120000, polling: 200 }).catch(() => {});
}

/* ── Escritorio ───────────────────────────────────────────────────── */
console.log('ESCRITORIO');
{
  const p = await abrir();
  const carga = await p.evaluate(() => {
    const c = document.getElementById('carga');
    return !c || (c.hasAttribute('data-listo') && getComputedStyle(c).visibility === 'hidden');
  });
  carga ? ok('la pantalla de carga se retira sola') : fallo('carga', 'sigue puesta');

  const e = await p.evaluate(() => ({
    montada: !!window.__escenaNX,
    capitulos: document.querySelectorAll('.cap').length,
    navegacion: document.querySelectorAll('#nav-capitulos a').length,
    servicios: document.querySelectorAll('#servicios-lista li').length,
    ruta: document.querySelectorAll('#ruta-resumen li').length,
    alturas: +(document.body.scrollHeight / innerHeight).toFixed(1),
  }));
  e.montada ? ok('la escena 3D se monta') : fallo('escena', 'no se montó');
  e.capitulos === 8 ? ok(`los ocho capítulos existen en el documento`) : fallo('capítulos', String(e.capitulos));
  e.navegacion === 8 ? ok('la navegación por capítulos se construye') : fallo('navegación', String(e.navegacion));
  e.servicios === 8 && e.ruta === 5
    ? ok(`contenido construido (${e.servicios} servicios, ${e.ruta} paradas de ruta)`)
    : fallo('contenido', JSON.stringify(e));
  e.alturas > 12 ? ok(`el recorrido ocupa ${e.alturas} pantallas`) : fallo('altura', String(e.alturas));

  // El titular de portada tiene que estar A LA VISTA: se escondía bajo su
  // propio recorte porque el CSS parte de translateY(105%) y GSAP lo lee como
  // píxeles, no como porcentaje suyo.
  await p.waitForFunction(() => {
    const i = document.querySelector('.titulo .linea__int');
    return i && Math.abs(new DOMMatrix(getComputedStyle(i).transform).m42) < 2;
  }, null, { timeout: 30000, polling: 200 }).catch(() => {});
  const titulo = await p.evaluate(() =>
    Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.titulo .linea__int')).transform).m42));
  titulo < 2 ? ok('el titular de portada se revela') : fallo('revelado', `desplazado ${titulo.toFixed(0)} px`);

  // La rueda desplaza lo normal: nada de secuestrar el scroll
  const antes = await p.evaluate(() => scrollY);
  await p.mouse.wheel(0, 800);
  await p.waitForTimeout(700);
  const despues = await p.evaluate(() => scrollY);
  despues - antes > 700
    ? ok(`la rueda desplaza lo normal (${Math.round(despues - antes)} px de 800)`)
    : fallo('rueda secuestrada', `${Math.round(despues - antes)} px`);
  await p.close();
}

/* ── El viaje entero ──────────────────────────────────────────────── */
console.log('\nEL VIAJE');
{
  const p = await abrir();
  const visto = [];
  for (const f of [0.03, 0.17, 0.31, 0.44, 0.55, 0.68, 0.82, 0.96]) {
    await irA(p, f);
    visto.push(await p.evaluate(() => {
      const d = window.__escenaNX;
      const m = d.mundo();
      const h = d.heroe;
      const v = h.position.clone().project(d.camara);
      return {
        cap: document.querySelector('#nav-capitulos a[data-activa]')?.dataset.cap,
        fase: m.grua.fase,
        heroeEnPantalla: Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15 && v.z > 0 && v.z < 1,
        dist: +d.camara.position.distanceTo(h.position).toFixed(0),
      };
    }));
  }
  const capitulos = visto.map((v) => v.cap);
  const esperados = ['oceano', 'puerto', 'grua', 'aduanas', 'salida', 'carretera', 'centro', 'entrega'];
  JSON.stringify(capitulos) === JSON.stringify(esperados)
    ? ok(`el recorrido pasa por los ocho capítulos en orden`)
    : fallo('capítulos', capitulos.join(' → '));

  /* El contenedor protagonista tiene que poder SEGUIRSE: es de lo que va la
     pieza. Se comprueba que está en el encuadre en todos los capítulos en los
     que la cámara lo acompaña. */
  const enCuadro = visto.filter((v) => v.heroeEnPantalla).length;
  enCuadro >= 6
    ? ok(`el contenedor está en el encuadre en ${enCuadro} de los 8 capítulos`)
    : fallo('contenedor', `sólo en ${enCuadro} capítulos`);

  // Las fases de la grúa avanzan, no se quedan atascadas
  visto[2].fase !== 'espera' && visto[3].fase === 'hecho'
    ? ok(`la descarga se ejecuta y termina (fase en el capítulo 3: «${visto[2].fase}»)`)
    : fallo('grúa', visto.map((v) => v.fase).join(','));
  await p.close();
}

/* ── Ida y vuelta, y recarga a mitad ──────────────────────────────── */
console.log('\nSCROLL');
{
  const p = await abrir();
  const pose = async () => p.evaluate(() => {
    const d = window.__escenaNX;
    return [d.camara.position.x, d.camara.position.y, d.camara.position.z]
      .map((v) => Math.round(v)).join('/');
  });
  await irA(p, 0.45);
  const bajando = await pose();
  await irA(p, 0.8);
  await irA(p, 0.45);
  const subiendo = await pose();
  /* Se compara con una tolerancia de metro y medio, y no por comodidad: la
     cámara lleva una RESPIRACIÓN deliberada de medio metro que va con el
     tiempo, no con el scroll, así que nunca puede repetir al milímetro. Lo que
     sí es exacto —la pose como función pura del progreso— se comprueba en
     `pruebas-guion.mjs`, sin navegador y sin amortiguación de por medio. */
  const dif = bajando.split('/').map(Number)
    .reduce((m, v, i) => Math.max(m, Math.abs(v - Number(subiendo.split('/')[i]))), 0);
  dif <= 1.5
    ? ok(`bajar y volver a subir dan la misma cámara (${bajando}, desvío ${dif} m)`)
    : fallo('pose', `${bajando} ≠ ${subiendo}`);

  // Recargar a media página tiene que aterrizar en el mismo capítulo
  const y = await p.evaluate(() => scrollY);
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(4000);
  await p.evaluate((v) => scrollTo(0, v), y);
  await fotogramas(p, 10);
  const tras = await p.evaluate(() => document.querySelector('#nav-capitulos a[data-activa]')?.dataset.cap);
  // 0,45 del recorrido cae en aduanas: los tramos no son iguales entre sí
  tras === 'aduanas'
    ? ok(`recargar a media página aterriza en su capítulo («${tras}»)`)
    : fallo('recarga', `esperaba aduanas, salió ${tras}`);
  await p.close();
}

/* ── Anclas y botones ─────────────────────────────────────────────── */
console.log('\nNAVEGACIÓN');
{
  const p = await abrir();
  await p.getByRole('link', { name: /seguir el envío/i }).first().click({ timeout: 8000 }).catch(() => {});
  await p.waitForFunction(() => scrollY > 500, null, { timeout: 30000, polling: 200 }).catch(() => {});
  const y = await p.evaluate(() => Math.round(scrollY));
  y > 500 ? ok(`el botón principal navega (0 → ${y})`) : fallo('CTA', String(y));

  await p.locator('#nav-capitulos a[data-cap="entrega"]').click({ timeout: 8000 }).catch(() => {});
  await p.waitForFunction(() => scrollY > 8000, null, { timeout: 30000, polling: 200 }).catch(() => {});
  const y2 = await p.evaluate(() => Math.round(scrollY));
  y2 > 8000 ? ok(`la navegación por capítulos salta (→ ${y2})`) : fallo('navegación', String(y2));

  // El lienzo no puede robarle los clics a la interfaz
  const pe = await p.evaluate(() => getComputedStyle(document.getElementById('lienzo')).pointerEvents);
  pe === 'none' ? ok('el lienzo 3D no captura el ratón') : fallo('lienzo', pe);

  // Teclado
  const paradas = [];
  for (let i = 0; i < 12; i++) {
    await p.keyboard.press('Tab');
    paradas.push(await p.evaluate(() => document.activeElement?.tagName));
  }
  paradas.filter((t) => t !== 'BODY').length >= 8
    ? ok(`el tabulador recorre la interfaz (${paradas.filter((t) => t !== 'BODY').length} paradas)`)
    : fallo('teclado', paradas.join(','));

  // El formulario es demostración: no envía nada
  await p.evaluate(() => document.getElementById('solicitud').scrollIntoView());
  await p.waitForTimeout(600);
  await p.locator('#form-solicitud button[type=submit]').click({ timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(500);
  const aviso = await p.evaluate(() => document.getElementById('form-aviso').textContent);
  /no se envía/i.test(aviso) ? ok('el formulario declara que no envía nada') : fallo('formulario', aviso);
  await p.close();
}

/* ── Móvil ────────────────────────────────────────────────────────── */
console.log('\nMÓVIL');
{
  const p = await abrir({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const desborde = await p.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  desborde <= 1 ? ok('sin desbordamiento horizontal') : fallo('desbordamiento', `${desborde}px`);
  const montada = await p.evaluate(() => !!window.__escenaNX);
  montada ? ok('la escena se monta en móvil') : fallo('escena móvil', 'no se montó');
  const nivel = await p.evaluate(() => document.documentElement.dataset.nivel);
  nivel === 'bajo' || nivel === 'minimo'
    ? ok(`el nivel de calidad baja solo en móvil («${nivel}»)`)
    : fallo('nivel', String(nivel));
  await p.close();
}

/* ── Movimiento reducido y pausa ──────────────────────────────────── */
console.log('\nACCESIBILIDAD');
{
  const p = await abrir({ reducedMotion: 'reduce' });
  const e = await p.evaluate(() => ({
    anima: document.documentElement.dataset.anima,
    movimiento: document.documentElement.dataset.movimiento,
    control: document.getElementById('control-movimiento').disabled,
    ocultos: [...document.querySelectorAll('[data-revela],[data-aparece]')]
      .filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.9).length,
  }));
  !e.anima ? ok('se retira el estado de partida de las animaciones') : fallo('reducido', 'sigue animando');
  e.movimiento === 'quieto' ? ok('el movimiento automático está detenido') : fallo('reducido', e.movimiento);
  e.control ? ok('el control explica que no hay nada que pausar') : fallo('control', 'sigue activo');
  e.ocultos === 0 ? ok('todo el contenido es visible sin animación') : fallo('contenido', `${e.ocultos} ocultos`);
  await p.close();

  const q = await abrir();
  await q.locator('#control-movimiento').click();
  await q.waitForTimeout(500);
  const pausado = await q.evaluate(() => document.documentElement.dataset.movimiento);
  pausado === 'quieto' ? ok('el control detiene el movimiento') : fallo('pausa', String(pausado));
  await q.close();
}

/* ── Sin WebGL ────────────────────────────────────────────────────── */
console.log('\nSIN WEBGL');
{
  const p = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  await p.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, ...r) {
      return String(t).includes('webgl') ? null : orig.call(this, t, ...r);
    };
  });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.waitForTimeout(4000);
  const e = await p.evaluate(() => ({
    alternativa: getComputedStyle(document.getElementById('sin-webgl')).display !== 'none',
    lienzo: !!document.querySelector('.lienzo canvas'),
    capitulos: document.querySelectorAll('.cap').length,
    texto: document.body.innerText.length,
    carga: (() => {
      const c = document.getElementById('carga');
      return !c || (c.hasAttribute('data-listo') && getComputedStyle(c).visibility === 'hidden');
    })(),
  }));
  e.alternativa ? ok('se pinta el fondo de respaldo en CSS') : fallo('alternativa', JSON.stringify(e));
  !e.lienzo ? ok('no se intenta crear el lienzo 3D') : fallo('lienzo', 'se creó igualmente');
  e.carga ? ok('la pantalla de carga se retira igual') : fallo('carga sin webgl', 'sigue puesta');
  e.capitulos === 8 && e.texto > 2000
    ? ok(`todo el contenido sigue accesible (${e.texto} caracteres de texto)`)
    : fallo('contenido', JSON.stringify(e));
  await p.close();
}

/* ── El panel ─────────────────────────────────────────────────────── */
console.log('\nPANEL DE AJUSTES');
{
  const p = await abrir();
  (await p.locator('.pnl').count()) === 0
    ? ok('el panel NO sale en la visita normal')
    : fallo('panel', 'aparece sin pedirlo');
  await p.close();

  const q = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  q.on('pageerror', (e) => fallo('error de página (panel)', e.message.split('\n')[0]));
  await q.addInitScript(() => { window.__debugNX = true; });
  await q.goto(`${URL}?ajustes`, { waitUntil: 'networkidle' });
  await q.waitForTimeout(4500);
  const mandos = await q.locator('.pnl input[type=range]').count();
  const confs = await q.locator('.pnl__config button').count();
  mandos >= 16 ? ok(`el panel sale con ?ajustes (${mandos} mandos)`) : fallo('panel', `${mandos} mandos`);
  confs === 4 ? ok('con las cuatro configuraciones comparables') : fallo('configuraciones', String(confs));
  // Cambiar una configuración tiene que mover los ajustes de verdad
  await q.locator('.pnl__config button').nth(2).click();
  await q.waitForTimeout(400);
  const cambiado = await q.evaluate(() => window.__escenaNX?.AJUSTES?.particulas);
  cambiado === 0.3 ? ok('las configuraciones cambian los ajustes vivos') : fallo('configuración', String(cambiado));
  await q.close();
}

/* ── Rendimiento y descenso automático de calidad ─────────────────── */
console.log('\nRENDIMIENTO');
{
  const p = await abrir();
  await p.waitForTimeout(14000);
  const f = await p.evaluate(() => window.__escenaNX.freno);
  console.log(`  · fotograma medio ${f.medioFotograma} ms bajo renderizado por software`);
  f.escalon > 0
    ? ok(`el freno automático baja la calidad cuando hace falta (escalón ${f.escalon})`)
    : ok('el equipo aguanta sin bajar calidad');
  const avanza = await p.evaluate(() => new Promise((res) => {
    const a = window.__escenaNX.fotogramas;
    setTimeout(() => res(window.__escenaNX.fotogramas - a), 3000);
  }));
  avanza > 2 ? ok(`la escena sigue pintando (${avanza} fotogramas en 3 s)`) : fallo('render', String(avanza));
  await p.close();
}

await navegador.close();
console.log(fallos.length ? `\nFALLOS (${fallos.length}): ${[...new Set(fallos)].join(', ')}` : '\nTodo correcto.');
process.exit(fallos.length ? 1 : 0);
