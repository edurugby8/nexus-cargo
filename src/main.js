/**
 * NEXUS CARGO · arranque.
 *
 * Orden de las cosas:
 *   1. Se mide el equipo y la preferencia de movimiento.
 *   2. Se reparte la altura del documento según los tramos del guion.
 *   3. Se monta la escena (o su alternativa plana si no hay WebGL).
 *   4. Se construye el contenido y se enciende la interfaz.
 *   5. La pantalla de carga se retira con el PRIMER FOTOGRAMA de la escena,
 *      no con un temporizador. Los temporizadores que quedan son la red de
 *      seguridad: pase lo que pase, la página se queda usable.
 */

import './estilos/estilo.css';

import { medirEquipo, reducido as pideReducido, clamp } from './lib/util.js';
import { montarEscena } from './escena/escena.js';
import {
  medirCapitulos, montarNavegacion, montarContenido, montarHud,
  montarRevelados, montarFormulario, montarAvance,
} from './ui/interfaz.js';
import { montarSonido } from './ui/sonido.js';

const raiz = document.documentElement;
const caps = medirEquipo();
const mqReducido = window.matchMedia('(prefers-reduced-motion: reduce)');
let reducido = pideReducido();

raiz.dataset.nivel = caps.nivel;
if (!reducido) raiz.dataset.anima = 'si';

/* ── Pantalla de carga ─────────────────────────────────────────────── */

const carga = document.getElementById('carga');
const avanceCarga = document.getElementById('carga-avance');
const pct = document.getElementById('carga-pct');
let progresoCarga = 0;
let cerrada = false;

function avanzarCarga(v) {
  progresoCarga = Math.max(progresoCarga, Math.min(1, v));
  const linea = carga?.querySelector('.carga__linea');
  linea?.style.setProperty('--p', progresoCarga.toFixed(3));
  if (pct) pct.textContent = `${Math.round(progresoCarga * 100)} %`;
}

function cerrarCarga() {
  if (cerrada) return;
  cerrada = true;
  avanzarCarga(1);
  setTimeout(() => {
    carga?.setAttribute('data-listo', '');
    escena?.entrar();
    revelados?.entrada();
    // Fuera del árbol, para que no atrape el foco al tabular
    setTimeout(() => carga?.remove(), 1000);
  }, reducido ? 0 : 320);
}

const reserva = setTimeout(cerrarCarga, 6000);

/* ── Alturas del documento ─────────────────────────────────────────── */

medirCapitulos();
avanzarCarga(0.12);

/* ── Escena ────────────────────────────────────────────────────────── */

const lienzo = document.getElementById('lienzo');
const sinWebgl = document.getElementById('sin-webgl');
const marcarCapitulo = montarNavegacion();
const refrescarHud = montarHud();
const marcarAvance = montarAvance();
let escena = null;
const sonido = montarSonido();

if (caps.webgl && lienzo) {
  try {
    escena = montarEscena({
      contenedor: lienzo,
      caps,
      reducido,
      alProgreso(p, cap, mundo, cambio) {
        marcarAvance(p);
        if (cambio) marcarCapitulo(cap.capitulo.id);
        refrescarHud(cap.capitulo.id, mundo);
        sonido.actualizar(p, mundo.camion.marcha);
      },
      alPintar: () => setTimeout(cerrarCarga, reducido ? 0 : 200),
    });
  } catch (e) {
    console.warn('No se pudo montar la escena 3D:', e);
  }
}
if (!escena) {
  lienzo?.remove();
  sinWebgl?.removeAttribute('hidden');
  // Sin escena no hay primer fotograma que esperar
  setTimeout(cerrarCarga, 400);
}
avanzarCarga(0.6);

/* ── Contenido e interfaz ──────────────────────────────────────────── */

montarContenido();
montarFormulario();
const revelados = montarRevelados({ reducido });
avanzarCarga(0.9);

/* ── Paralaje de puntero ───────────────────────────────────────────── */

if (!reducido && caps.punteroFino) {
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    escena?.puntero((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });
  window.addEventListener('pointerleave', () => escena?.puntero(0, 0));
}

/* ── Controles ─────────────────────────────────────────────────────── */

const control = document.getElementById('control-movimiento');
let pausado = false;

function aplicarMovimiento() {
  const quieto = pausado || reducido;
  raiz.dataset.movimiento = quieto ? 'quieto' : 'vivo';
  if (escena) escena.movimiento = !quieto;
  if (!control) return;
  control.setAttribute('aria-pressed', String(pausado));
  const texto = control.querySelector('.control__texto');
  if (reducido) {
    control.disabled = true;
    if (texto) texto.textContent = 'Movimiento detenido por tu sistema';
  } else if (texto) {
    texto.textContent = pausado ? 'Reanudar movimiento' : 'Pausar movimiento';
  }
}

control?.addEventListener('click', () => {
  pausado = !pausado;
  try { localStorage.setItem('nexus:movimiento', pausado ? 'quieto' : 'vivo'); } catch { /* modo privado */ }
  aplicarMovimiento();
});
try { pausado = localStorage.getItem('nexus:movimiento') === 'quieto'; } catch { pausado = false; }
aplicarMovimiento();

const controlSonido = document.getElementById('control-sonido');
controlSonido?.addEventListener('click', () => {
  const activo = sonido.alternar();
  controlSonido.setAttribute('aria-pressed', String(activo));
  const texto = controlSonido.querySelector('.control__texto');
  if (texto) texto.textContent = activo ? 'Silenciar' : 'Activar sonido';
});

mqReducido.addEventListener?.('change', (e) => {
  reducido = e.matches;
  if (reducido) { raiz.removeAttribute('data-anima'); sonido.silenciar(); }
  aplicarMovimiento();
});

/* ── Anclajes ──────────────────────────────────────────────────────────
   El desplazamiento es el NATIVO del navegador, a propósito. Suavizar la
   rueda obliga a interceptarla con `preventDefault`, y en cuanto se hace eso
   la página deja de responder como el visitante espera: se pelea con la barra,
   con el teclado y con el táctil. Lo que va amortiguado es la CÁMARA, que es
   donde se nota; la página, no se toca. */
document.querySelectorAll('a[href^="#"]').forEach((enlace) => {
  enlace.addEventListener('click', (e) => {
    const destino = document.querySelector(enlace.getAttribute('href'));
    if (!destino) return;
    e.preventDefault();
    const y = destino.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top: y, behavior: reducido ? 'auto' : 'smooth' });
  });
});

/* ── Panel de ajustes ──────────────────────────────────────────────────
   Carga dinámica y sólo si la dirección lo pide: no pesa un byte en la visita
   normal ni aparece en el paquete principal. */
if (new URLSearchParams(location.search).has('ajustes')) {
  import('./ui/panel.js')
    .then((m) => m.montarPanel(escena))
    .catch((e) => console.warn('Panel de ajustes no disponible:', e));
}

/* ── Cierre ────────────────────────────────────────────────────────── */

document.fonts?.ready.then(() => {
  escena?.medir();
  revelados?.refrescar();
});

window.addEventListener('load', () => {
  clearTimeout(reserva);
  escena?.medir();
  revelados?.refrescar();
  setTimeout(cerrarCarga, reducido ? 0 : 400);
});

setTimeout(cerrarCarga, 3000);

export { escena };
