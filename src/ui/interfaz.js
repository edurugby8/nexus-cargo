/**
 * La interfaz: navegación por capítulos, panel de seguimiento, contenido
 * generado y revelados de texto.
 *
 * Regla que no se rompe: **ScrollTrigger revela texto; NO mueve la cámara**.
 * La cámara la mueve el guion, que es función pura del desplazamiento. Mezclar
 * las dos cosas es lo que produce esas páginas en las que, al subir, la escena
 * va por un sitio y el texto por otro.
 */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CAPITULOS, SERVICIOS, RUTA, ENVIO } from '../datos.js';
import { TRAMOS } from '../escena/ruta.js';

gsap.registerPlugin(ScrollTrigger);
/* Por defecto GSAP congela su reloj cuando un fotograma tarda más de medio
   segundo. En un equipo lento eso deja los revelados a medio camino para
   siempre, y no se recuperan solos. */
gsap.ticker.lagSmoothing(0);

/** Alturas de cada capítulo, desde la única fuente de verdad. */
export function medirCapitulos() {
  for (const cap of TRAMOS) {
    const el = document.getElementById(cap.id);
    if (el) el.style.setProperty('--tramo', String(cap.tramo));
  }
}

/** Navegación por capítulos: saltar a uno es saltar a su tramo de scroll. */
export function montarNavegacion() {
  const lista = document.getElementById('nav-capitulos');
  if (!lista) return () => {};
  lista.innerHTML = '';
  for (const cap of TRAMOS) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${cap.id}`;
    a.dataset.cap = cap.id;
    a.innerHTML = `<span>${cap.numero}</span>${cap.rotulo}`;
    li.appendChild(a);
    lista.appendChild(li);
  }
  const enlaces = [...lista.querySelectorAll('a')];
  return (id) => {
    for (const a of enlaces) a.toggleAttribute('data-activa', a.dataset.cap === id);
  };
}

/** Lista de servicios y resumen de ruta. */
export function montarContenido() {
  const servicios = document.getElementById('servicios-lista');
  if (servicios) {
    servicios.innerHTML = SERVICIOS.map((s, i) => `
      <li>
        <i>${String(i + 1).padStart(2, '0')}</i>
        <b>${s.nombre}</b>
        <span>${s.pie}</span>
      </li>`).join('');
  }
  const ruta = document.getElementById('ruta-resumen');
  if (ruta) {
    ruta.innerHTML = RUTA.map((r) => `
      <li><div><b>${r.lugar}</b><span>${r.pie}</span></div></li>`).join('');
  }
  const anio = document.getElementById('anio');
  if (anio) anio.textContent = String(new Date().getFullYear());
}

/**
 * El panel de seguimiento.
 *
 * Muestra las cifras del capítulo en curso. Es el hilo que mantiene presente
 * al contenedor aunque la cámara esté mirando a otra cosa: el visitante nunca
 * pierde de vista QUÉ está siguiendo.
 */
export function montarHud() {
  const hud = document.getElementById('hud');
  const datos = document.getElementById('hud-datos');
  const estado = document.getElementById('hud-estado');
  const num = document.getElementById('hud-num');
  const rotulo = document.getElementById('hud-rotulo');
  const barra = document.getElementById('hud-barra');
  if (!hud || !datos) return () => {};
  let ultimo = null;

  return (id, mundo, local = 0) => {
    const cap = CAPITULOS.find((c) => c.id === id);
    if (id !== ultimo) {
      ultimo = id;
      const filas = cap?.datos || [
        ['Envío', ENVIO.codigo],
        ['Origen', ENVIO.origen],
        ['Destino', ENVIO.destino],
      ];
      datos.innerHTML = filas.map(([k, v, e]) => `
        <div><dt>${k}</dt><dd${e ? ' data-estado="ok"' : ''}>${v}</dd></div>`).join('');
      if (num) num.textContent = cap?.numero || '01';
      if (rotulo) rotulo.textContent = cap?.rotulo || '';
      // En la portada no se enseña: todavía no se está siguiendo nada
      hud.toggleAttribute('data-visible', id !== 'oceano');
    }
    // El avance dentro del capítulo, cada fotograma: es barato y no parpadea
    barra?.style.setProperty('--local', local.toFixed(3));
    if (estado && mundo) {
      /* El estado cuenta lo que está pasando AHORA, no lo que pone en la
         ficha. Durante la descarga eso es el paso de la grúa en curso: es el
         hilo que permite seguir trece pasos sin perderse, y el único sitio de
         la página donde se nombran. */
      const entregado = mundo.camion.entregado;
      const paso = id === 'grua' ? PASO_LEGIBLE[mundo.grua.fase] : null;
      estado.textContent = entregado
        ? 'Entrega confirmada'
        : (paso || cap?.servicio || 'En tránsito');
      estado.dataset.estado = entregado ? 'entregado' : 'transito';
    }
  };
}

/** Los trece pasos de la descarga, dichos como los diría un operador. */
const PASO_LEGIBLE = {
  espera: 'Grúa en espera',
  aproxima: 'Carro sobre el buque',
  bajaVacio: 'Spreader descendiendo',
  alinea: 'Alineando sobre la carga',
  posa: 'Contacto',
  encaja: 'Cerrando twistlocks',
  tensa: 'Tensando cables',
  despega: 'Despegando de la pila',
  iza: 'Izando',
  traslada: 'Traslado a tierra',
  frena: 'Frenando el carro',
  arria: 'Arriando sobre el remolque',
  asienta: 'Asentando la carga',
  suelta: 'Liberando twistlocks',
  hecho: 'Descarga completada',
};

/**
 * Revelados.
 *
 * Cada bloque entra cuando su capítulo llega al centro de la pantalla. Se
 * dispara UNA vez y se queda: un texto que se va y vuelve al subir convierte
 * la lectura en un parpadeo.
 */
export function montarRevelados({ reducido }) {
  if (reducido) return { refrescar() {}, entrada() {} };
  const raiz = document.documentElement;

  const animar = (bloque) => {
    const lineas = bloque.querySelectorAll('[data-revela] .linea__int');
    const revelados = [...bloque.querySelectorAll('[data-revela]')]
      .filter((e) => !e.querySelector('.linea__int'));
    const aparecen = bloque.querySelectorAll('[data-aparece]');
    const t = gsap.timeline();
    if (lineas.length) {
      /* Se anulan las DOS componentes, `y` e `yPercent`.
         El CSS parte de `translateY(105%)`, y GSAP eso no lo lee como un 105 %
         suyo: lo convierte a píxeles y lo guarda en `y`. Animando sólo
         `yPercent` se ponía esa componente a cero y la de píxeles seguía
         intacta, así que el titular se quedaba escondido bajo su propio
         recorte mientras el resto del bloque aparecía con normalidad. */
      t.to(lineas, { y: 0, yPercent: 0, duration: 1.05, ease: 'power3.out', stagger: 0.07 }, 0);
    }
    if (revelados.length) {
      t.to(revelados, { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out', stagger: 0.06 }, 0);
    }
    aparecen.forEach((el) => {
      const r = Number(el.dataset.retardo || 0);
      t.to(el, { opacity: 1, y: 0, duration: 0.85, ease: 'power2.out' }, 0.12 + r * 0.09);
    });
    return t;
  };

  const disparadores = [];
  document.querySelectorAll('.cap, .servicios, .solicitud').forEach((bloque) => {
    disparadores.push(ScrollTrigger.create({
      trigger: bloque,
      start: 'top 62%',
      once: true,
      onEnter: () => animar(bloque),
    }));
  });

  return {
    refrescar: () => ScrollTrigger.refresh(),
    /* La portada se anima al CARGAR, no con ScrollTrigger: su disparador nunca
       se dispararía porque ya está en pantalla desde el primer momento. */
    entrada() {
      const portada = document.getElementById('oceano');
      if (portada) animar(portada);
      raiz.dataset.listo = 'si';
    },
  };
}

/** El formulario de demostración. No envía nada, y lo dice. */
export function montarFormulario() {
  const form = document.getElementById('form-solicitud');
  const aviso = document.getElementById('form-aviso');
  if (!form || !aviso) return;
  form.addEventListener('submit', (e) => {
    /* Se corta el envío SIEMPRE y a propósito. No hay destino configurado, y
       mandar datos de un visitante a un sitio que no ha elegido no se hace. */
    e.preventDefault();
    const correo = form.querySelector('[name="correo"]');
    if (correo && correo.value && !correo.value.includes('@')) {
      aviso.textContent = 'Revisa el correo de contacto.';
      aviso.removeAttribute('data-ok');
      correo.focus();
      return;
    }
    aviso.textContent = 'Recibido — en la demostración no se envía nada a ningún servicio.';
    aviso.setAttribute('data-ok', '');
    form.querySelectorAll('input').forEach((i) => { i.value = ''; });
  });
}

/** Barra de avance del recorrido. */
export function montarAvance() {
  const barra = document.getElementById('avance');
  return (p) => { barra?.style.setProperty('--avance', p.toFixed(4)); };
}
