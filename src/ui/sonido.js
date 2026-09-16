/**
 * Sonido ambiental.
 *
 * Empieza SILENCIADO y no suena hasta que el visitante lo pide. No es sólo
 * cortesía: los navegadores bloquean el audio sin interacción, así que
 * cualquier otra cosa sería una promesa rota.
 *
 * Todo está sintetizado con WebAudio —ruido filtrado y osciladores— por la
 * misma razón que la geometría: ni un archivo descargado, ni una licencia que
 * verificar. El mar es ruido rosa con un filtro que se abre y se cierra; el
 * motor, dos ondas graves; la grúa, un zumbido metálico.
 */

const CAPAS = {
  mar:       { desde: 0.00, hasta: 0.30, tipo: 'ruido', corte: 480, q: 0.7, vol: 0.34, lfo: 0.09 },
  puerto:    { desde: 0.18, hasta: 0.52, tipo: 'ruido', corte: 900, q: 1.1, vol: 0.14, lfo: 0.05 },
  grua:      { desde: 0.24, hasta: 0.40, tipo: 'tono', frec: 78, vol: 0.05, lfo: 0.7 },
  motor:     { desde: 0.48, hasta: 1.00, tipo: 'tono', frec: 54, vol: 0.09, lfo: 1.6 },
  carretera: { desde: 0.52, hasta: 0.92, tipo: 'ruido', corte: 1500, q: 0.6, vol: 0.2, lfo: 0.14 },
  almacen:   { desde: 0.76, hasta: 1.00, tipo: 'ruido', corte: 620, q: 1.4, vol: 0.1, lfo: 0.06 },
};

export function montarSonido() {
  let ctx = null;
  const capas = {};
  let maestro = null;
  let activo = false;

  function ruidoRosa(contexto) {
    const largo = contexto.sampleRate * 3;
    const buffer = contexto.createBuffer(1, largo, contexto.sampleRate);
    const d = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < largo; i++) {
      const blanco = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + blanco * 0.099;
      b1 = 0.963 * b1 + blanco * 0.2965;
      b2 = 0.57 * b2 + blanco * 1.0526;
      d[i] = (b0 + b1 + b2 + blanco * 0.1848) * 0.16;
    }
    return buffer;
  }

  function crear() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    maestro = ctx.createGain();
    maestro.gain.value = 0;
    maestro.connect(ctx.destination);
    const buffer = ruidoRosa(ctx);

    for (const [nombre, c] of Object.entries(CAPAS)) {
      const g = ctx.createGain();
      g.gain.value = 0;
      let fuente;
      if (c.tipo === 'ruido') {
        fuente = ctx.createBufferSource();
        fuente.buffer = buffer;
        fuente.loop = true;
        const filtro = ctx.createBiquadFilter();
        filtro.type = 'lowpass';
        filtro.frequency.value = c.corte;
        filtro.Q.value = c.q;
        fuente.connect(filtro);
        filtro.connect(g);
        // El filtro respira: un mar con el corte fijo suena a estática
        const lfo = ctx.createOscillator();
        const lfoG = ctx.createGain();
        lfo.frequency.value = c.lfo;
        lfoG.gain.value = c.corte * 0.45;
        lfo.connect(lfoG);
        lfoG.connect(filtro.frequency);
        lfo.start();
      } else {
        fuente = ctx.createOscillator();
        fuente.type = 'sawtooth';
        fuente.frequency.value = c.frec;
        const filtro = ctx.createBiquadFilter();
        filtro.type = 'lowpass';
        filtro.frequency.value = c.frec * 6;
        fuente.connect(filtro);
        filtro.connect(g);
      }
      fuente.start();
      g.connect(maestro);
      capas[nombre] = { g, c };
    }
  }

  return {
    get activo() { return activo; },
    alternar() {
      if (!ctx) crear();
      if (ctx.state === 'suspended') ctx.resume();
      activo = !activo;
      maestro.gain.setTargetAtTime(activo ? 0.5 : 0, ctx.currentTime, 0.4);
      return activo;
    },
    /** Mezcla según dónde vaya el recorrido. */
    actualizar(p, marcha = 1) {
      if (!ctx || !activo) return;
      const t = ctx.currentTime;
      for (const { g, c } of Object.values(capas)) {
        const dentro = p >= c.desde && p <= c.hasta;
        const borde = Math.min(p - c.desde, c.hasta - p) / 0.06;
        const v = dentro ? Math.min(1, Math.max(0, borde)) * c.vol : 0;
        g.gain.setTargetAtTime(v * (c.tipo === 'tono' ? marcha : 1), t, 0.5);
      }
    },
    silenciar() {
      if (!ctx || !activo) return;
      activo = false;
      maestro.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    },
  };
}
