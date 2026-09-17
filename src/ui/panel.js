/**
 * Panel de ajustes.
 *
 * Adaptación en JavaScript a secas de la idea de `tweaks-panel.jsx`
 * (starter-components, CC0): un panel flotante agrupado por secciones, con
 * deslizadores que muestran su valor y configuraciones comparables. No se
 * copia el código —aquél es React y esta pieza no lo lleva—, se copia el
 * concepto: afinar EN CALIENTE viendo el resultado, en vez de editar un
 * número, recompilar y volver a mirar.
 *
 * NO forma parte del paquete principal: se carga con `import()` dinámico y
 * sólo si la dirección lleva `?ajustes`.
 */

import { AJUSTES, AJUSTES_BASE, CONFIGURACIONES } from '../ajustes.js';

const CSS = `
.pnl{position:fixed;right:14px;top:14px;z-index:9000;width:272px;
  max-height:calc(100dvh - 28px);display:flex;flex-direction:column;
  background:rgba(8,16,25,.88);color:#eef3f8;
  -webkit-backdrop-filter:blur(20px) saturate(150%);backdrop-filter:blur(20px) saturate(150%);
  border:1px solid rgba(226,112,31,.3);border-radius:13px;
  box-shadow:0 18px 50px rgba(0,0,0,.55);
  font:11.5px/1.45 'Inter Tight',system-ui,sans-serif;overflow:hidden}
.pnl[data-plegado] .pnl__cuerpo,.pnl[data-plegado] .pnl__pie{display:none}
.pnl__cab{display:flex;align-items:center;justify-content:space-between;
  padding:9px 8px 9px 13px;user-select:none;border-bottom:1px solid rgba(255,255,255,.08)}
.pnl__cab b{font-size:10.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#ff9142}
.pnl__x{appearance:none;border:0;background:transparent;color:rgba(238,243,248,.6);
  width:24px;height:24px;border-radius:7px;cursor:pointer;font-size:14px;line-height:1}
.pnl__x:hover{background:rgba(255,255,255,.1);color:#fff}
.pnl__cuerpo{padding:4px 13px 12px;display:flex;flex-direction:column;gap:9px;
  overflow-y:auto;min-height:0;scrollbar-width:thin}
.pnl__sec{font-size:9.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  color:rgba(92,207,224,.8);padding:10px 0 0}
.pnl__sec:first-child{padding-top:2px}
.pnl__fila{display:flex;flex-direction:column;gap:3px}
.pnl__et{display:flex;justify-content:space-between;align-items:baseline;gap:8px;
  color:rgba(238,243,248,.8)}
.pnl__val{color:#ff9142;font-variant-numeric:tabular-nums;font-size:10.5px}
.pnl input[type=range]{appearance:none;-webkit-appearance:none;width:100%;height:3px;margin:4px 0;
  border-radius:99px;background:rgba(255,255,255,.16);outline:none;cursor:pointer}
.pnl input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
  width:13px;height:13px;border-radius:50%;background:#eef3f8;border:0;
  box-shadow:0 1px 4px rgba(0,0,0,.6);cursor:pointer}
.pnl input[type=range]::-moz-range-thumb{width:13px;height:13px;border-radius:50%;
  background:#eef3f8;border:0;box-shadow:0 1px 4px rgba(0,0,0,.6);cursor:pointer}
.pnl input[type=range]:focus-visible{outline:2px solid #ff9142;outline-offset:3px}
.pnl__config{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding-top:3px}
.pnl__config button,.pnl__pie button{appearance:none;border:1px solid rgba(255,255,255,.15);
  background:rgba(255,255,255,.05);color:inherit;font:inherit;font-size:10.5px;
  padding:6px 4px;border-radius:7px;cursor:pointer;text-align:center}
.pnl__config button:hover,.pnl__pie button:hover{background:rgba(255,255,255,.13)}
.pnl__config button[aria-pressed=true]{background:rgba(226,112,31,.24);
  border-color:rgba(226,112,31,.6);color:#ff9142}
.pnl__pie{display:flex;gap:6px;padding:10px 13px 12px;border-top:1px solid rgba(255,255,255,.08)}
.pnl__pie button{flex:1}
.pnl__info{padding:0 13px 10px;font-size:10px;color:rgba(238,243,248,.45);
  font-variant-numeric:tabular-nums}
@media (max-width:640px){.pnl{left:14px;right:14px;width:auto;top:auto;bottom:14px;max-height:56dvh}}
`;

export function montarPanel(escena) {
  const estilo = document.createElement('style');
  estilo.textContent = CSS;
  document.head.appendChild(estilo);

  const panel = document.createElement('aside');
  panel.className = 'pnl';
  panel.setAttribute('aria-label', 'Ajustes de la experiencia');
  panel.innerHTML = `
    <div class="pnl__cab"><b>Ajustes</b>
      <button class="pnl__x" type="button" aria-label="Plegar panel">—</button></div>
    <div class="pnl__cuerpo"></div>
    <p class="pnl__info" id="pnl-info"></p>
    <div class="pnl__pie">
      <button type="button" data-copiar>Copiar valores</button>
      <button type="button" data-reiniciar>Restablecer</button>
    </div>`;
  const cuerpo = panel.querySelector('.pnl__cuerpo');

  const seccion = (texto) => {
    const h = document.createElement('div');
    h.className = 'pnl__sec';
    h.textContent = texto;
    cuerpo.appendChild(h);
  };

  const desliz = (clave, etiqueta, min, max, paso, formato = (v) => v.toFixed(2)) => {
    const fila = document.createElement('div');
    fila.className = 'pnl__fila';
    const id = `pnl-${clave}`;
    fila.innerHTML = `<label class="pnl__et" for="${id}"><span>${etiqueta}</span>
      <span class="pnl__val"></span></label>
      <input id="${id}" type="range" min="${min}" max="${max}" step="${paso}">`;
    const input = fila.querySelector('input');
    const val = fila.querySelector('.pnl__val');
    const pintar = () => {
      input.value = String(AJUSTES[clave]);
      val.textContent = formato(Number(AJUSTES[clave]));
    };
    input.addEventListener('input', () => {
      AJUSTES[clave] = Number(input.value);
      val.textContent = formato(Number(input.value));
    });
    pintar();
    fila.__pintar = pintar;
    cuerpo.appendChild(fila);
    return fila;
  };

  seccion('Ritmo');
  desliz('velocidad', 'Velocidad general', 0.3, 2.2, 0.02);
  desliz('movimiento', 'Intensidad del movimiento', 0, 2, 0.02);

  seccion('Mar y buque');
  desliz('oleaje', 'Oleaje', 0, 2.5, 0.02);
  desliz('balanceo', 'Balanceo del buque', 0, 2.5, 0.02);
  desliz('reflejos', 'Reflejos del agua', 0, 1.6, 0.02);

  seccion('Grúa y carga');
  desliz('velocidadGrua', 'Velocidad de la grúa', 0.4, 2, 0.02);
  desliz('oscilacion', 'Oscilación del contenedor', 0, 2.5, 0.02);

  seccion('Camión');
  desliz('velocidadCamion', 'Velocidad del camión', 0.4, 2, 0.02);
  desliz('suspension', 'Suspensión', 0, 2.2, 0.02);
  desliz('trafico', 'Tráfico secundario', 0, 2, 0.02);

  seccion('Cámara y encuadre');
  desliz('distanciaCamara', 'Distancia de cámara', 0.6, 1.6, 0.02);
  /* Los dos mandos de la compensación de pantalla. Se ven mejor que en ningún
     sitio estrechando la ventana: a 0 de retroceso y con el tope de ángulo
     bajo, en vertical se pierde medio encuadre, que es lo que pasaba antes. */
  desliz('fovMaximo', 'Tope de ángulo vertical', 46, 80, 1, (v) => `${v.toFixed(0)}°`);
  desliz('retrocesoMaximo', 'Retroceso máximo', 1, 3, 0.05, (v) => `×${v.toFixed(2)}`);

  seccion('Luz y aire');
  desliz('niebla', 'Niebla', 0, 2.5, 0.02);
  desliz('luz', 'Intensidad de luz', 0.3, 2, 0.02);
  desliz('exposicion', 'Exposición', 0.5, 1.6, 0.02);
  desliz('particulas', 'Partículas', 0, 2, 0.02);
  desliz('detalle', 'Nivel de detalle', 0.2, 1.6, 0.02);
  desliz('giroSol', 'Giro del sol por capítulos', 0, 1.6, 0.02);
  desliz('rebote', 'Rebote del cielo', 0.2, 2, 0.02);
  desliz('relleno', 'Luz de relleno', 0, 2.2, 0.02);

  /* Configuraciones comparables. La pública es UNA sola —«equilibrada»—; las
     otras tres están para ver de un vistazo qué cambia cada familia. */
  seccion('Configuraciones');
  const conf = document.createElement('div');
  conf.className = 'pnl__config';
  const NOMBRES = {
    equilibrada: 'Equilibrada', cinematografica: 'Cinemat.',
    rendimiento: 'Rendimiento', presentacion: 'Present.',
  };
  let elegida = 'equilibrada';
  Object.keys(CONFIGURACIONES).forEach((clave) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = NOMBRES[clave] || clave;
    b.addEventListener('click', () => {
      Object.assign(AJUSTES, CONFIGURACIONES[clave]);
      elegida = clave;
      repintar();
    });
    conf.appendChild(b);
  });
  cuerpo.appendChild(conf);

  const pintarConfig = () => {
    [...conf.children].forEach((b, i) => {
      b.setAttribute('aria-pressed', String(Object.keys(CONFIGURACIONES)[i] === elegida));
    });
  };
  const repintar = () => {
    cuerpo.querySelectorAll('.pnl__fila').forEach((f) => f.__pintar?.());
    pintarConfig();
  };
  pintarConfig();

  panel.querySelector('[data-copiar]').addEventListener('click', async (e) => {
    const texto = `export const AJUSTES = ${JSON.stringify(AJUSTES, null, 2)};`;
    try {
      await navigator.clipboard.writeText(texto);
      e.target.textContent = '¡Copiado!';
    } catch {
      console.log(texto);
      e.target.textContent = 'En la consola';
    }
    setTimeout(() => { e.target.textContent = 'Copiar valores'; }, 1600);
  });
  panel.querySelector('[data-reiniciar]').addEventListener('click', () => {
    Object.assign(AJUSTES, AJUSTES_BASE);
    elegida = 'equilibrada';
    repintar();
  });
  panel.querySelector('.pnl__x').addEventListener('click', () => {
    panel.toggleAttribute('data-plegado');
  });

  document.body.appendChild(panel);

  // Diagnóstico en vivo: progreso, capítulo y escalón del freno automático
  const info = panel.querySelector('#pnl-info');
  let ultimo = 0;
  const tic = () => {
    const ahora = performance.now();
    if (ahora - ultimo > 400 && escena) {
      ultimo = ahora;
      const d = window.__escenaNX;
      const f = d?.freno;
      info.textContent = `progreso ${(escena.progreso * 100).toFixed(1)} %`
        + (f ? ` · ${f.medioFotograma} ms · calidad ${3 - f.escalon}/3` : '');
    }
    requestAnimationFrame(tic);
  };
  requestAnimationFrame(tic);

  return { panel, repintar, quitar: () => { panel.remove(); estilo.remove(); } };
}
