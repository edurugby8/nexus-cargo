/**
 * Texturas, dibujadas en lienzo 2D al arrancar.
 *
 * Ninguna se descarga. No es una limitación: es una decisión. Un modelo o una
 * textura de terceros obliga a verificar procedencia, autor y licencia, y sin
 * esa verificación no se puede publicar nada. Generándolo todo por código la
 * licencia es limpia por construcción, la carga es mínima y —lo que más
 * importa aquí— se controla la escala exacta de cada detalle.
 *
 * El tamaño de cada lienzo va con el nivel del equipo: la misma imagen, menos
 * píxeles.
 */

import * as THREE from 'three';
import { azarCon } from '../lib/util.js';

let LADO = 512;
export const fijarResolucion = (px) => { LADO = px; };

function lienzo(w, h, pintar) {
  const c = document.createElement('canvas');
  c.width = Math.max(4, Math.round(w));
  c.height = Math.max(4, Math.round(h));
  const ctx = c.getContext('2d');
  if (ctx) pintar(ctx, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const repetir = (t, x = 1, y = 1) => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(x, y);
  return t;
};

/** Grano y suciedad: lo que separa una superficie pintada de una de verdad. */
function desgaste(ctx, w, h, azar, fuerza = 1) {
  for (let i = 0; i < 900 * fuerza; i++) {
    const x = azar() * w;
    const y = azar() * h;
    const r = azar() * (w * 0.006) + 0.4;
    ctx.fillStyle = azar() > 0.5
      ? `rgba(255,255,255,${azar() * 0.05 * fuerza})`
      : `rgba(0,0,0,${azar() * 0.09 * fuerza})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 6.283);
    ctx.fill();
  }
  // Churretes: la lluvia baja por el metal y deja marca
  for (let i = 0; i < 26 * fuerza; i++) {
    const x = azar() * w;
    const alto = h * (0.1 + azar() * 0.45);
    const g = ctx.createLinearGradient(0, 0, 0, alto);
    g.addColorStop(0, `rgba(40,34,26,${0.1 + azar() * 0.13})`);
    g.addColorStop(1, 'rgba(40,34,26,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, azar() * h * 0.5, 1 + azar() * (w * 0.004), alto);
  }
}

/** Chapa de acero pintada. Base de casi todo lo metálico del puerto. */
export function texturaChapa(color = '#4a5563', semilla = 1, oxido = 0.5) {
  return repetir(lienzo(LADO, LADO, (ctx, w, h) => {
    const azar = azarCon(semilla * 977);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    // Juntas de chapa: la escala se lee por las costuras, no por el color
    ctx.strokeStyle = 'rgba(0,0,0,.22)';
    ctx.lineWidth = Math.max(1, w * 0.003);
    for (let i = 1; i < 6; i++) {
      ctx.beginPath(); ctx.moveTo(0, (h / 6) * i); ctx.lineTo(w, (h / 6) * i); ctx.stroke();
    }
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo((w / 3) * i, 0); ctx.lineTo((w / 3) * i, h); ctx.stroke();
    }
    // Óxido en las juntas, que es por donde empieza siempre
    for (let i = 0; i < 40 * oxido; i++) {
      const x = azar() * w;
      const y = Math.round(azar() * 6) * (h / 6);
      const r = w * (0.01 + azar() * 0.03);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(122,66,32,${0.18 + azar() * 0.2})`);
      g.addColorStop(1, 'rgba(122,66,32,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
    }
    desgaste(ctx, w, h, azar, 0.8);
  }));
}

/** Hormigón del muelle, con juntas de dilatación y manchas de neumático. */
export function texturaHormigon() {
  return repetir(lienzo(LADO, LADO, (ctx, w, h) => {
    const azar = azarCon(3121);
    ctx.fillStyle = '#8e9094';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2400; i++) {
      const v = azar();
      ctx.fillStyle = v > 0.5 ? `rgba(255,255,255,${azar() * 0.12})` : `rgba(0,0,0,${azar() * 0.16})`;
      ctx.fillRect(azar() * w, azar() * h, azar() * 3 + 1, azar() * 3 + 1);
    }
    ctx.strokeStyle = 'rgba(0,0,0,.3)';
    ctx.lineWidth = Math.max(1, w * 0.004);
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo((w / 4) * i, 0); ctx.lineTo((w / 4) * i, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (h / 4) * i); ctx.lineTo(w, (h / 4) * i); ctx.stroke();
    }
    /* Manchas de aceite y rodadura. Van POCAS y SUAVES.
       Eran treinta al 18 % y, con la tesela repitiéndose cien veces a lo ancho
       de la explanada, formaban una cuadrícula regular de lamparones que se
       veía desde el aire más que el propio pavimento. Una textura que se repite
       mucho tiene que ser casi lisa: lo que se note será el patrón, no la
       mancha. */
    for (let i = 0; i < 9; i++) {
      const cx = azar() * w;
      const cy = azar() * h;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.16);
      g.addColorStop(0, 'rgba(26,26,28,.09)');
      g.addColorStop(1, 'rgba(26,26,28,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }), 26, 26);
}

/** Asfalto con su línea discontinua ya pintada en el sitio exacto. */
export function texturaAsfalto() {
  return repetir(lienzo(LADO / 2, LADO * 2, (ctx, w, h) => {
    const azar = azarCon(7717);
    ctx.fillStyle = '#31343a';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) {
      const v = azar();
      ctx.fillStyle = v > 0.55 ? `rgba(190,190,195,${azar() * 0.12})` : `rgba(0,0,0,${azar() * 0.25})`;
      ctx.fillRect(azar() * w, azar() * h, azar() * 2.2 + 0.6, azar() * 2.2 + 0.6);
    }
    // Rodadas: el asfalto se pule por donde pasan las ruedas
    const rodada = ctx.createLinearGradient(0, 0, w, 0);
    rodada.addColorStop(0, 'rgba(0,0,0,0)');
    rodada.addColorStop(0.26, 'rgba(120,124,130,.1)');
    rodada.addColorStop(0.5, 'rgba(0,0,0,.12)');
    rodada.addColorStop(0.74, 'rgba(120,124,130,.1)');
    rodada.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rodada;
    ctx.fillRect(0, 0, w, h);
    // Eje discontinuo
    ctx.fillStyle = 'rgba(226,226,222,.82)';
    const trazo = h * 0.12;
    for (let y = 0; y < h; y += trazo * 2.4) ctx.fillRect(w * 0.485, y, w * 0.03, trazo);
  }), 1, 40);
}

/** Mar: la textura sólo pone el detalle fino; la forma la pone la malla. */
export function texturaMar() {
  return repetir(lienzo(LADO, LADO, (ctx, w, h) => {
    const azar = azarCon(5501);
    ctx.fillStyle = '#12314d';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      const x = azar() * w;
      const y = azar() * h;
      const l = w * (0.006 + azar() * 0.03);
      ctx.strokeStyle = `rgba(180,206,224,${azar() * 0.16})`;
      ctx.lineWidth = Math.max(1, w * 0.0016);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + l, y + (azar() - 0.5) * 3); ctx.stroke();
    }
  }), 40, 40);
}

/**
 * El costado del contenedor protagonista.
 *
 * Aquí está el trabajo de identidad: el código NXCU 482019, el logotipo y las
 * marcas normalizadas. Es lo que permite reconocer NUESTRO contenedor entre
 * todos los demás durante todo el recorrido, que es de lo que va la pieza.
 */
export function texturaContenedor(codigo = 'NXCU 482019', marca = 'NEXUS CARGO') {
  const w = Math.max(512, LADO * 2);
  const h = Math.round(w * 0.24);
  return lienzo(w, h, (ctx, W, H) => {
    const azar = azarCon(482019);
    ctx.fillStyle = '#c85a1e';
    ctx.fillRect(0, 0, W, H);
    // Variación de tono entre chapas: ninguna pintura industrial es plana
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(${azar() > 0.5 ? '255,255,255' : '0,0,0'},${azar() * 0.045})`;
      ctx.fillRect((W / 30) * i, 0, W / 30, H);
    }
    // Logotipo
    ctx.fillStyle = 'rgba(246,248,250,.96)';
    ctx.font = `700 ${H * 0.13}px Inter Tight, system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = `${H * 0.02}px`;
    ctx.fillText(marca, W * 0.055, H * 0.3);
    // Barra de acento bajo el logotipo
    ctx.fillStyle = 'rgba(246,248,250,.5)';
    ctx.fillRect(W * 0.055, H * 0.4, ctx.measureText(marca).width, H * 0.012);
    // Código de identificación, que es lo que se sigue durante todo el viaje
    ctx.fillStyle = 'rgba(248,250,252,.97)';
    ctx.font = `600 ${H * 0.115}px Inter Tight, system-ui, sans-serif`;
    ctx.letterSpacing = `${H * 0.035}px`;
    ctx.fillText(codigo, W * 0.055, H * 0.58);
    // Marcas normalizadas, pequeñas y en su sitio
    ctx.font = `500 ${H * 0.045}px Inter Tight, system-ui, sans-serif`;
    ctx.letterSpacing = `${H * 0.006}px`;
    ctx.fillStyle = 'rgba(248,250,252,.72)';
    ctx.fillText('MAX GROSS 32 500 KG', W * 0.055, H * 0.74);
    ctx.fillText('TARE 3 900 KG', W * 0.055, H * 0.81);
    ctx.fillText('NET 28 600 KG', W * 0.055, H * 0.88);
    ctx.fillText('45 G 1 · 40′ HIGH CUBE', W * 0.63, H * 0.74);
    ctx.fillText('CU FT 2 694 · CU M 76,3', W * 0.63, H * 0.81);
    // Placa del propietario
    ctx.strokeStyle = 'rgba(248,250,252,.5)';
    ctx.lineWidth = Math.max(1, H * 0.006);
    ctx.strokeRect(W * 0.845, H * 0.12, W * 0.1, H * 0.2);
    ctx.font = `600 ${H * 0.05}px Inter Tight, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(248,250,252,.8)';
    ctx.fillText('NXCU', W * 0.862, H * 0.22);
    desgaste(ctx, W, H, azar, 0.85);
  });
}

/** Costado de un contenedor cualquiera de la pila: sin código legible. */
export function texturaContenedorGenerico(color, semilla) {
  const w = Math.max(256, LADO);
  const h = Math.round(w * 0.24);
  return lienzo(w, h, (ctx, W, H) => {
    const azar = azarCon(semilla * 331 + 7);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = `rgba(${azar() > 0.5 ? '255,255,255' : '0,0,0'},${azar() * 0.05})`;
      ctx.fillRect((W / 24) * i, 0, W / 24, H);
    }
    // Manchas claras donde iría la rotulación: se lee a distancia, no de cerca
    ctx.fillStyle = 'rgba(240,242,245,.5)';
    ctx.fillRect(W * 0.07, H * 0.24, W * (0.1 + azar() * 0.14), H * 0.1);
    ctx.fillStyle = 'rgba(240,242,245,.32)';
    ctx.fillRect(W * 0.07, H * 0.52, W * 0.16, H * 0.06);
    desgaste(ctx, W, H, azar, 1);
  });
}

/** Panel de nave industrial: chapa grecada horizontal. */
export function texturaNave(color = '#aeb6bd') {
  return repetir(lienzo(LADO / 2, LADO / 2, (ctx, w, h) => {
    const azar = azarCon(9091);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    const paso = h / 16;
    for (let i = 0; i < 16; i++) {
      const g = ctx.createLinearGradient(0, i * paso, 0, (i + 1) * paso);
      g.addColorStop(0, 'rgba(255,255,255,.13)');
      g.addColorStop(0.45, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,.17)');
      ctx.fillStyle = g;
      ctx.fillRect(0, i * paso, w, paso);
    }
    desgaste(ctx, w, h, azar, 0.4);
  }), 8, 4);
}

/** Mancha suave, para luces, estela, polvo y halos. */
export function texturaMancha(dureza = 0.25) {
  return lienzo(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(dureza, 'rgba(255,255,255,.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Cielo: degradado vertical. El color lo pone el ambiente en cada momento. */
export function texturaCielo() {
  const t = lienzo(4, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#000000');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
