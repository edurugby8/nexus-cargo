/**
 * El contenedor.
 *
 * La pieza que el visitante va a mirar más de cerca y durante más tiempo, así
 * que es la que más detalle merece. Un contenedor de 40 pies High Cube mide
 * 12,192 × 2,438 × 2,896 metros: esas son las medidas reales y son las que se
 * usan, porque toda la sensación de escala del puerto depende de que ésta sea
 * la unidad correcta.
 *
 * El corrugado va en GEOMETRÍA, no en textura. Es la decisión que más se nota:
 * la cámara llega a pasar a dos metros del costado, y a esa distancia un
 * corrugado pintado se delata al instante porque no proyecta sombra ni cambia
 * con la luz. Son unos cientos de triángulos por contenedor y se comparten
 * entre todos.
 */

import * as THREE from 'three';
import { MEDIDAS } from './ruta.js';
import { texturaContenedor, texturaContenedorGenerico, texturaChapa } from './texturas.js';

const { largo: L, ancho: A, alto: H } = { largo: 12.192, ancho: 2.438, alto: 2.896 };

/**
 * Perfil corrugado de un costado.
 *
 * Se construye como una tira de quads siguiendo el perfil en zigzag, con las
 * normales bien puestas para que cada pliegue coja la luz por un lado y la
 * pierda por el otro. Eso es lo que dibuja las rayas verticales de un
 * contenedor de verdad, y sólo aparece si hay geometría y luz.
 */
function costadoCorrugado(ancho, alto, profundidad, ondas) {
  const posiciones = [];
  const normales = [];
  const uvs = [];
  const paso = ancho / ondas;
  const marco = alto * 0.055;          // franjas lisas arriba y abajo

  const empuja = (x0, z0, x1, z1, u0, u1) => {
    const nx = (z1 - z0);
    const nz = -(x1 - x0);
    const len = Math.hypot(nx, nz) || 1;
    const n = [nx / len, 0, nz / len];
    const y0 = -alto / 2 + marco;
    const y1 = alto / 2 - marco;
    posiciones.push(x0, y0, z0, x1, y0, z1, x1, y1, z1, x0, y0, z0, x1, y1, z1, x0, y1, z0);
    for (let i = 0; i < 6; i++) normales.push(n[0], n[1], n[2]);
    uvs.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
  };

  for (let i = 0; i < ondas; i++) {
    const x = -ancho / 2 + i * paso;
    const u0 = i / ondas;
    const u1 = (i + 1) / ondas;
    const um = (u0 + u1) / 2;
    // Cada onda: plano hundido, rampa, plano saliente, rampa
    empuja(x, 0, x + paso * 0.34, 0, u0, u0 + (u1 - u0) * 0.34);
    empuja(x + paso * 0.34, 0, x + paso * 0.5, profundidad, u0 + (u1 - u0) * 0.34, um);
    empuja(x + paso * 0.5, profundidad, x + paso * 0.84, profundidad, um, u0 + (u1 - u0) * 0.84);
    empuja(x + paso * 0.84, profundidad, x + paso, 0, u0 + (u1 - u0) * 0.84, u1);
  }
  // Franjas lisas de remate, arriba y abajo
  const remate = (yc, h) => {
    posiciones.push(-ancho / 2, yc - h / 2, 0, ancho / 2, yc - h / 2, 0, ancho / 2, yc + h / 2, 0,
      -ancho / 2, yc - h / 2, 0, ancho / 2, yc + h / 2, 0, -ancho / 2, yc + h / 2, 0);
    for (let i = 0; i < 6; i++) normales.push(0, 0, -1);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  };
  remate(-alto / 2 + marco / 2, marco);
  remate(alto / 2 - marco / 2, marco);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normales, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}

/** Las cuatro esquinas: los castings por los que se agarra todo. */
function esquinas(material) {
  const grupo = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.34, 0.24, 0.24);
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const m = new THREE.Mesh(geo, material);
        m.position.set(sx * (L / 2 - 0.17), sy * (H / 2 - 0.12), sz * (A / 2 - 0.12));
        grupo.add(m);
      }
    }
  }
  grupo.userData.geo = geo;
  return grupo;
}

/**
 * Construye un contenedor.
 * @param {object} op
 * @param {boolean} op.protagonista  si lleva el código y el logotipo
 * @param {string}  op.color
 * @param {number}  op.semilla
 * @param {boolean} op.detalle  puertas y herrajes (sólo el protagonista)
 */
export function crearContenedor({ protagonista = false, color = '#c85a1e', semilla = 1, detalle = false } = {}) {
  const grupo = new THREE.Group();
  const aDesechar = [];

  const mapa = protagonista ? texturaContenedor() : texturaContenedorGenerico(color, semilla);
  const matCostado = new THREE.MeshStandardMaterial({
    map: mapa, roughness: 0.74, metalness: 0.22,
  });
  const matTecho = new THREE.MeshStandardMaterial({
    color: protagonista ? 0x9d4517 : color, roughness: 0.82, metalness: 0.2,
  });
  const matHerraje = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.55, metalness: 0.75 });
  aDesechar.push(mapa, matCostado, matTecho, matHerraje);

  // Costados largos, corrugados
  const ondas = protagonista ? 34 : 20;
  const geoLargo = costadoCorrugado(L, H, 0.055, ondas);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(geoLargo, matCostado);
    m.position.z = s * (A / 2);
    m.rotation.y = s > 0 ? Math.PI : 0;
    m.castShadow = true;
    m.receiveShadow = true;
    grupo.add(m);
  }

  // Testeros: el de atrás liso, el de delante con las dos hojas de puerta
  const geoCorto = costadoCorrugado(A, H, 0.045, 7);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(geoCorto, matCostado);
    m.position.x = s * (L / 2);
    m.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    m.castShadow = true;
    grupo.add(m);
  }

  // Techo y suelo
  const geoTapa = new THREE.BoxGeometry(L, 0.06, A);
  const techo = new THREE.Mesh(geoTapa, matTecho);
  techo.position.y = H / 2;
  techo.castShadow = true;
  techo.receiveShadow = true;
  grupo.add(techo);
  const suelo = new THREE.Mesh(geoTapa, matTecho);
  suelo.position.y = -H / 2;
  grupo.add(suelo);

  const esq = esquinas(matHerraje);
  grupo.add(esq);
  aDesechar.push(geoLargo, geoCorto, geoTapa, esq.userData.geo);

  if (detalle) {
    // Barras de cierre de las puertas: cuatro por hoja, con sus manetas
    const geoBarra = new THREE.CylinderGeometry(0.038, 0.038, H * 0.92, 7);
    const geoManeta = new THREE.BoxGeometry(0.06, 0.34, 0.11);
    aDesechar.push(geoBarra, geoManeta);
    for (let i = 0; i < 4; i++) {
      const z = (-1.5 + i) * (A / 4.4);
      const barra = new THREE.Mesh(geoBarra, matHerraje);
      barra.position.set(L / 2 + 0.055, 0, z);
      barra.castShadow = true;
      grupo.add(barra);
      const maneta = new THREE.Mesh(geoManeta, matHerraje);
      maneta.position.set(L / 2 + 0.11, H * 0.06, z);
      grupo.add(maneta);
    }
  }

  grupo.userData.liberar = () => aDesechar.forEach((o) => o.dispose?.());
  grupo.userData.medidas = { L, A, H };
  return grupo;
}

/**
 * Las pilas del puerto, en UNA sola llamada de dibujo por color.
 *
 * Son cientos de contenedores y todos comparten geometría; instanciarlos es la
 * diferencia entre cuatrocientas llamadas y cuatro. La geometría es la simple
 * —sin corrugado— porque la cámara nunca se acerca a ellos: lo que aportan es
 * masa, color y escala, y eso se lee de lejos.
 */
export function crearPilas({ cuantos, semilla = 1, zonas }) {
  const grupo = new THREE.Group();
  const aDesechar = [];
  const COLORES = ['#2e5d86', '#7d2f2a', '#3f6b4a', '#8a6a24', '#4a4f57', '#6b3a5e'];
  const porColor = Math.ceil(cuantos / COLORES.length);
  const geo = new THREE.BoxGeometry(L, H, A);
  const dummy = new THREE.Object3D();
  aDesechar.push(geo);

  COLORES.forEach((color, ci) => {
    const mapa = texturaContenedorGenerico(color, semilla + ci);
    const mat = new THREE.MeshStandardMaterial({ map: mapa, roughness: 0.8, metalness: 0.18 });
    aDesechar.push(mapa, mat);
    const malla = new THREE.InstancedMesh(geo, mat, porColor);
    malla.castShadow = true;
    malla.receiveShadow = true;
    for (let n = 0; n < porColor; n++) {
      const zona = zonas[(n + ci) % zonas.length];
      const fila = Math.floor(n / 5) % zona.filas;
      const col = n % 5;
      const altura = (n * 7 + ci * 3) % zona.altura;
      dummy.position.set(
        zona.x + (col - 2) * (L + 0.9),
        H / 2 + altura * (H + 0.06) + zona.y,
        zona.z + fila * (A + 0.7),
      );
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      malla.setMatrixAt(n, dummy.matrix);
    }
    malla.instanceMatrix.needsUpdate = true;
    malla.frustumCulled = false;
    grupo.add(malla);
  });

  grupo.userData.liberar = () => aDesechar.forEach((o) => o.dispose?.());
  return grupo;
}
