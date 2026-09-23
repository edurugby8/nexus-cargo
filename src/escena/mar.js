/**
 * El mar y el cielo.
 *
 * El agua es una malla desplazada en el VÉRTICE, en la GPU: la CPU sólo
 * actualiza un uniforme de tiempo por fotograma, así que una superficie de
 * tres kilómetros con ciento sesenta divisiones cuesta lo mismo que un plano
 * quieto.
 *
 * Nada de reflejos planares ni de sondas de entorno: son dos pasadas de
 * render extra y en un móvil se notan de inmediato. Lo que hace creíble al
 * agua aquí es otra cosa —que el color cambie con el ÁNGULO DE VISIÓN—: mirada
 * de canto devuelve el cielo, mirada desde arriba se ve su propia profundidad.
 * Eso es Fresnel, cuesta cuatro operaciones y es lo que el ojo lee como agua.
 */

import * as THREE from 'three';
import { texturaMar, texturaNubes } from './texturas.js';
import { MEDIDAS } from './ruta.js';

/* OJO con los acentos graves dentro de estos literales: uno solo, aunque esté
   dentro de un comentario de GLSL, CIERRA la cadena de JavaScript y rompe la
   compilación. Y falla de una forma fácil de no ver si uno mira el final de la
   salida en vez del código de salida: se sirve el `dist` anterior y todo
   parece ir bien mientras se prueba una versión vieja. Aquí dentro, los
   nombres de función van sin comillas. */

const VERTICE = /* glsl */ `
  uniform float uTiempo;
  uniform float uOleaje;
  uniform float uCostaZ;

  varying vec3 vMundo;
  varying vec3 vNormal;
  varying vec2 vUv;

  /* Tres trenes de ola cruzados. Con uno solo se ve el patrón al instante;
     con tres de periodos que no son múltiplos entre sí, no se repite nunca a
     la vista. */
  float ola(vec2 p, float t) {
    float h = 0.0;
    h += sin(p.x * 0.055 + t * 0.85) * cos(p.y * 0.041 + t * 0.6) * 1.0;
    h += sin(p.x * 0.14 - p.y * 0.11 + t * 1.35) * 0.42;
    h += sin(p.y * 0.31 + t * 2.1) * cos(p.x * 0.27 - t * 0.9) * 0.16;
    return h;
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    vec4 mundo = modelMatrix * vec4(pos, 1.0);
    float t = uTiempo;
    /* ABRIGO DE PUERTO.
       La ola llega a 1,58 m de cresta y la explanada del muelle está a 0,60:
       las crestas asomaban POR ENCIMA del pavimento, y desde el aire se veían
       como manchas blancas de espuma repartidas por el asfalto del patio. El
       mar es un solo plano y pasa por debajo de todo el puerto, así que
       bastaba con que la ola subiera más que el muelle.
       Se apaga la ola al pasar la línea de costa. Además de tapar el fallo es
       lo que hace el agua de verdad: dentro de una dársena, abrigada por el
       muelle, no hay oleaje. */
    /* El abrigo no llega a CERO, y ahí está el matiz. Apagando la ola del todo
       la dársena quedaba como una lámina de plástico azul —peor que el fallo
       que venía a arreglar—. Dentro de un puerto no hay mar de fondo, pero sí
       rizado: el agua se mueve, sólo que unos centímetros. Se deja un 14 %,
       que son 22 cm de cresta: suficiente para que el agua viva y muy por
       debajo de los 60 cm del pavimento. */
    float abrigo = mix(0.14, 1.0, smoothstep(uCostaZ - 4.0, uCostaZ + 12.0, mundo.z));
    float h = ola(mundo.xz, t) * uOleaje * abrigo;
    pos.z += h;

    // Normal por diferencias finitas sobre la misma función de ola: así el
    // sombreado no puede desincronizarse de la forma.
    float e = 1.6;
    float hx = ola(mundo.xz + vec2(e, 0.0), t) * uOleaje * abrigo;
    float hz = ola(mundo.xz + vec2(0.0, e), t) * uOleaje * abrigo;
    vec3 n = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
    vNormal = n;

    vec4 desplazado = modelMatrix * vec4(pos, 1.0);
    vMundo = desplazado.xyz;
    gl_Position = projectionMatrix * viewMatrix * desplazado;
  }
`;

const FRAGMENTO = /* glsl */ `
  uniform vec3 uHondo;
  uniform vec3 uSomero;
  uniform vec3 uCielo;
  uniform vec3 uSol;
  uniform vec3 uDirSol;
  uniform float uReflejos;
  uniform float uNiebla;
  uniform vec3 uColorNiebla;
  uniform sampler2D uDetalle;
  uniform float uTiempo;

  varying vec3 vMundo;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    vec3 V = normalize(cameraPosition - vMundo);
    vec3 N = normalize(vNormal);

    /* Rizado en DOS ESCALAS, y ésta es la razón por la que el mar se veía
       como un papel azul desde arriba.
       Había una sola capa repetida catorce veces sobre una malla de varios
       kilómetros: sus rasgos medían doscientos metros. Eso no es rizado, es
       mancha, y encima a esa escala no la mueve nada. Un mar visto desde
       doscientos metros de altura se reconoce por el CENTELLEO: miles de
       caras pequeñas que devuelven el sol cada una a su aire. Así que la
       segunda capa va veinte veces más fina y en otra dirección, y es la que
       pone ese temblor. */
    vec3 rizo = texture2D(uDetalle, vUv * 14.0 + vec2(uTiempo * 0.004, uTiempo * 0.003)).rgb;
    vec3 fino = texture2D(uDetalle, vUv * 290.0 - vec2(uTiempo * 0.021, uTiempo * -0.014)).rgb;
    N = normalize(N
      + vec3((rizo.r - 0.5) * 0.35, 0.0, (rizo.b - 0.5) * 0.35)
      + vec3((fino.r - 0.5) * 0.30, 0.0, (fino.b - 0.5) * 0.30));

    // Fresnel: de canto el agua es un espejo, desde arriba es un cuerpo opaco
    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    fres = mix(0.03, 1.0, fres) * uReflejos;

    /* El color del agua tampoco es uno. Un mar de verdad tiene rodales: más
       oscuro donde el viento riza y más claro donde está plano. Con un solo
       color, la superficie no tiene escala y lo que se ve es una lámina. */
    /* Rodales MUY suaves. A escala 3 y con un 30 % de rango, lo que se veía no
       eran rodales de viento sino el GRANO de la propia textura: manchas
       oscuras de veinte metros repartidas por la dársena, como si el agua
       tuviera sombras flotando. Un mar en calma varía, pero poco y en grande:
       a escala 1,2 las manchas miden cincuenta metros y con un 14 % de rango
       se notan sin que se puedan contar. */
    float rodal = texture2D(uDetalle, vUv * 1.2 + vec2(uTiempo * 0.0011, 0.0)).g;
    vec3 agua = mix(uHondo, uSomero, max(dot(N, vec3(0.0, 1.0, 0.0)), 0.0));
    agua *= 0.93 + rodal * 0.14;
    vec3 color = mix(agua, uCielo, fres);

    // Reflejo especular del sol sobre el agua: el destello es lo que hace que
    // se lea la hora del día
    vec3 H = normalize(uDirSol + V);
    float nh = max(dot(N, H), 0.0);
    // El destello duro: puntos sueltos, los que centellean
    color += uSol * pow(nh, 220.0) * 2.6 * uReflejos;
    /* Y el CAMINO DE LUZ. Estaba en exponente 16 y al 10 %: invisible. Es lo
       que dibuja sobre el agua la franja brillante que va del horizonte al
       observador, y sin él un mar iluminado y un mar en sombra se pintan
       igual. Con 34 y al 45 % la franja aparece sin quemar el resto. */
    color += uSol * pow(nh, 34.0) * 0.45 * uReflejos;
    color += uSol * pow(nh, 6.0) * 0.06 * uReflejos;

    /* Niebla exponencial, con la fórmula CORRECTA.
       La primera versión hacía exp(-d*d*densidad), que no es lo que calcula
       FogExp2: es exp(-(densidad*d)^2). Con la densidad al cuadrado fuera
       del paréntesis, a quinientos metros el exponente valía −117 y todo el
       mundo salía al cien por cien de niebla: el mar, el cielo y el buque
       eran la misma mancha parda. */
    float d = length(cameraPosition - vMundo);
    float niebla = 1.0 - exp(-pow(uNiebla * d, 2.0));
    color = mix(color, uColorNiebla, clamp(niebla, 0.0, 1.0));

    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function crearMar({ caps }) {
  const lado = 3600;
  /* La geometría se queda en el plano XY SIN rotar, y la que se tumba es la
     malla. Así el desplazamiento del sombreador va en +Z local, que tras la
     rotación de la malla es +Y del mundo: la ola sube, que es lo suyo.
     (Rotando también la geometría acababa mirando hacia abajo.) */
  const geo = new THREE.PlaneGeometry(lado, lado, caps.mar, caps.mar);

  const detalle = texturaMar();
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERTICE,
    fragmentShader: FRAGMENTO,
    uniforms: {
      uTiempo: { value: 0 },
      uOleaje: { value: 1 },
      uCostaZ: { value: MEDIDAS.muelle },
      /* Un mar demasiado oscuro se come las siluetas. Lo que hace legible a
         un buque a contraluz no es iluminarlo más, es que el agua de detrás
         sea más clara que él. */
      uHondo: { value: new THREE.Color(0x12304a) },
      uSomero: { value: new THREE.Color(0x2f6489) },
      uCielo: { value: new THREE.Color(0x7d96ad) },
      uSol: { value: new THREE.Color(0xffd7a0) },
      uDirSol: { value: new THREE.Vector3(0.4, 0.5, 0.6) },
      uReflejos: { value: 0.85 },
      uNiebla: { value: 0.0000012 },
      uColorNiebla: { value: new THREE.Color(0xb9b0a2) },
      uDetalle: { value: detalle },
    },
  });

  const malla = new THREE.Mesh(geo, mat);
  malla.rotation.x = -Math.PI / 2;
  malla.position.y = 0;
  /* EL MAR EMPIEZA EN EL MUELLE Y VA HACIA FUERA.
     Estaba centrado en el origen, o sea que sus 3.600 metros se repartían la
     mitad hacia el mar y la otra mitad TIERRA ADENTRO: mil ochocientos metros
     de agua por debajo del puerto, de la carretera y del centro logístico. No
     se veía porque la explanada del puerto, que llegaba igual de lejos, lo
     tapaba entero; en cuanto el puerto deja de cubrir la salida, el agua
     asoma por el hueco y la carretera aparece flotando sobre el mar.
     La costa está en el canto del muelle. Seis metros por dentro para que el
     agua se meta bajo el cantil y no quede junta, y el resto hacia fuera. */
  malla.position.z = MEDIDAS.muelle - 6 + lado / 2;
  malla.renderOrder = -1;
  malla.frustumCulled = false;

  malla.userData.actualizar = (mundo, reloj, ajustes, dt, sol) => {
    mat.uniforms.uTiempo.value = reloj;
    mat.uniforms.uOleaje.value = ajustes.oleaje;
    mat.uniforms.uReflejos.value = ajustes.reflejos;
    mat.uniforms.uNiebla.value = mundo.ambiente.niebla * ajustes.niebla * 0.8;
    mat.uniforms.uColorNiebla.value.setHex(mundo.ambiente.cieloHorizonte);
    mat.uniforms.uCielo.value.setHex(mundo.ambiente.cieloHorizonte);
    mat.uniforms.uSol.value.setHex(mundo.ambiente.colorLuz);
    mat.uniforms.uDirSol.value.copy(sol);
  };
  malla.userData.liberar = () => { geo.dispose(); mat.dispose(); detalle.dispose(); };
  return malla;
}

/**
 * El cielo.
 *
 * Una esfera invertida con un degradado de dos colores y un disco de sol. No
 * necesita más: la mayor parte del encuadre la ocupan el puerto, el buque o la
 * carretera, y el cielo sólo tiene que dar la hora y el color de rebote.
 */
/**
 * @param {number} radio  tiene que caber DENTRO del plano lejano de la cámara.
 *   Estuvo en 2400 con el plano lejano en 2200 y el domo se recortaba entero:
 *   el cielo salía negro y lo que parecía cielo era el mar con niebla. Un error
 *   que no da ningún aviso, sólo un encuadre a oscuras.
 */
export function crearCielo(radio = 1800) {
  const geo = new THREE.SphereGeometry(radio, 24, 16);
  const nubes = texturaNubes();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uAlto: { value: new THREE.Color(0x1b3555) },
      uHorizonte: { value: new THREE.Color(0xb9a48c) },
      uSol: { value: new THREE.Color(0xffd7a0) },
      uDirSol: { value: new THREE.Vector3(0.4, 0.4, 0.6) },
      uNubes: { value: nubes },
      uTiempo: { value: 0 },
      uNubosidad: { value: 0.85 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uAlto;
      uniform vec3 uHorizonte;
      uniform vec3 uSol;
      uniform vec3 uDirSol;
      uniform sampler2D uNubes;
      uniform float uTiempo;
      uniform float uNubosidad;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y * 1.25 + 0.06, -1.0, 1.0);
        /* Curva del degradado. Con exponente 0,52 el color del horizonte subía
           casi hasta el cénit y el cielo entero salía de un gris lavado. A 0,9
           la franja clara se queda donde tiene que estar —pegada al
           horizonte— y arriba manda el azul. */
        float t = pow(clamp(h, 0.0, 1.0), 0.9);
        vec3 color = mix(uHorizonte, uAlto, t);
        // Por debajo del horizonte el cielo se apaga, para casar con el mar
        color = mix(color * 0.72, color, smoothstep(-0.12, 0.02, h));
        // El sol y su halo
        float d = max(dot(normalize(vDir), normalize(uDirSol)), 0.0);

        /* NUBES, proyectadas sobre un plano.
           La máscara no se envuelve sobre la esfera: se proyecta como si
           hubiera una capa de nubes plana a cierta altura, dividiendo la
           dirección por su componente vertical. Eso es lo que hace que las
           nubes se APELMACEN hacia el horizonte y se abran sobre la cabeza,
           que es la perspectiva real de un cielo cubierto; envueltas sobre la
           esfera salen todas del mismo tamaño y parecen papel pintado.
           Dos capas a distinta escala y a distinta deriva: la lenta es la masa
           y la rápida deshace el borde. */
        if (h > 0.0) {
          vec2 uvN = vDir.xz / max(vDir.y, 0.075);
          float n1 = texture2D(uNubes, uvN * 0.055 + vec2(uTiempo * 0.00035, 0.0)).r;
          float n2 = texture2D(uNubes, uvN * 0.145 - vec2(uTiempo * 0.00080, uTiempo * 0.00022)).r;
          float nube = clamp(n1 * 0.85 + n2 * 0.45 - 0.26, 0.0, 1.0);
          /* Y se desvanecen en la última franja sobre el horizonte: ahí la
             proyección se estira hasta el infinito y sin esto aparece una
             banda de rayas radiales. */
          nube *= smoothstep(0.015, 0.20, vDir.y);
          /* El color de la nube: su cara iluminada mira al sol, así que va del
             gris del horizonte al blanco según lo cerca que esté de él. */
          vec3 claro = mix(uHorizonte, vec3(1.0), 0.45) + uSol * pow(d, 5.0) * 0.55;
          vec3 oscuro = mix(uHorizonte, uAlto, 0.55) * 0.82;
          color = mix(color, mix(oscuro, claro, clamp(nube * 1.6, 0.0, 1.0)), nube * uNubosidad);
        }

        // Disco, corona y resplandor. El tercer término iba a la 3.ª potencia
        // y teñía medio cielo: a la 8.ª se queda donde tiene que estar.
        color += uSol * pow(d, 1400.0) * 3.2;
        color += uSol * pow(d, 60.0) * 0.28;
        color += uSol * pow(d, 8.0) * 0.05;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const malla = new THREE.Mesh(geo, mat);
  malla.frustumCulled = false;
  malla.renderOrder = -2;
  malla.userData.actualizar = (mundo, reloj, ajustes, dt, sol) => {
    mat.uniforms.uAlto.value.setHex(mundo.ambiente.cieloAlto);
    mat.uniforms.uHorizonte.value.setHex(mundo.ambiente.cieloHorizonte);
    mat.uniforms.uSol.value.setHex(mundo.ambiente.colorLuz);
    mat.uniforms.uDirSol.value.copy(sol);
    mat.uniforms.uTiempo.value = reloj;
  };
  malla.userData.liberar = () => { geo.dispose(); mat.dispose(); nubes.dispose(); };
  return malla;
}
