# NEXUS CARGO

El viaje completo de un contenedor, en una sola toma: alta mar, puerto, grúa,
aduanas, carretera, centro logístico y entrega. Ocho capítulos de scroll
narrativo sobre una sola escena WebGL continua.

**NEXUS CARGO no existe.** Es una marca ficticia creada como demostración de
diseño de CodeCraft. El puerto, el buque, la grúa, el camión y todos los datos
del envío están generados por código en el navegador: no hay ni un modelo ni
una fotografía descargados. El formulario del final no envía nada a ningún
sitio.

---

## Arrancar

```bash
npm install
npm run dev        # http://localhost:4400/nexus-cargo/
```

La ruta base es `/nexus-cargo/` también en desarrollo, a propósito: lo que se
ve en local es exactamente lo que se ve publicado.

```bash
npm run build      # compila a dist/
npm run preview    # sirve dist/ en el mismo puerto
npm run guion      # verifica el recorrido sin navegador (rápido)
npm run verificar  # compila + guion + recorrido funcional completo
```

### Publicar

Al empujar a `main`, el flujo de `.github/workflows/pages.yml` compila y
publica en GitHub Pages.

**Hace falta un clic una sola vez:** *Settings → Pages → Source → GitHub
Actions*. Hasta que se dé, el flujo falla en `configure-pages` con «Get Pages
site failed», que es exactamente lo que significa. El token del flujo no puede
activarlo por su cuenta: `enablement: true` se probó y falla por falta de
permiso de administración.

---

## La idea que lo sostiene todo

**El mundo entero es una función pura del desplazamiento.**

No hay estado acumulado en ninguna parte. La posición del buque, la altura del
spreader, el giro de las ruedas, el ángulo de la barrera y la pose de la cámara
se CALCULAN a partir de un único escalar `p ∈ [0,1]` sacado de `window.scrollY`.

De ahí salen gratis las cinco exigencias de un scroll narrativo:

- bajar y volver a subir recorren exactamente la misma curva;
- recargar a media página deja la escena en su capítulo;
- el texto y la cámara no pueden desincronizarse, porque leen lo mismo;
- saltar a un capítulo es asignar un número;
- y no hace falta secuestrar la rueda para nada.

Y una ventaja que no es obvia: **el guion se puede verificar sin navegador**.
`src/escena/ruta.js` no importa three.js, así que `npm run guion` comprueba en
una décima de segundo que la cámara no da saltos, que el camión no retrocede,
que la descarga recorre sus siete fases en orden y que el contenedor aterriza a
2,70 m —la altura exacta del remolque— antes de que exista un solo polígono.
Es la prueba más valiosa del proyecto y la más barata.

---

## Cómo está montado

```
index.html              el relato en HTML semántico: se lee entero sin JavaScript
vite.config.js          ruta base, servidores y reparto de trozos
public/                 favicon, imagen social, robots, sitemap y 404
src/
  main.js               arranque y orquestación
  ajustes.js            LOS MANDOS: todo lo ajustable, en un solo objeto
  datos.js              capítulos, servicios y datos del envío
  estilos/estilo.css    toda la dirección artística
  tipos/                Inter Tight (SIL OFL 1.1)
  lib/util.js           interpolación, curvas de aceleración, medida del equipo
  escena/
    ruta.js             EL GUION · el mundo como función pura del scroll
    escena.js           renderizador, luces, bucle y freno automático
    mar.js              agua con Fresnel y domo de cielo
    contenedor.js       el contenedor protagonista y las pilas instanciadas
    barco.js            el NX ORION, casco construido por secciones
    grua.js             grúa pórtico con carro, spreader y cables
    camion.js           tractora y semirremolque
    tierra.js           muelle, aduanas, carretera, centro logístico y destino
    texturas.js         todas las texturas, dibujadas en lienzo 2D
    ambiental.js        gaviotas, polvo y salpicadura, en la GPU
  ui/
    interfaz.js         navegación, panel de seguimiento, revelados, formulario
    sonido.js           ambiente sintetizado, silenciado por defecto
    panel.js            ?ajustes · carga dinámica, fuera del paquete principal
pruebas-guion.mjs       el recorrido, verificado en Node
pruebas.mjs             recorrido funcional en navegador
```

### Los capítulos

| # | Capítulo | Qué pasa | Servicio |
|---|----------|----------|----------|
| 01 | Alta mar | El NX ORION cruza el océano al amanecer | Transporte marítimo |
| 02 | Llegada a puerto | Aproximación y atraque de costado | Gestión portuaria |
| 03 | Descarga | Siete fases de la grúa, del buque al remolque | Operativa de terminal |
| 04 | Aduanas | Escáner, lectura, precinto y barrera | Despacho aduanero |
| 05 | Salida | Arranque con 24 toneladas detrás | Transporte terrestre |
| 06 | En ruta | Cinco posiciones de cámara, 318 km | Seguimiento en tiempo real |
| 07 | Centro logístico | Matrícula, muelle asignado, inventario | Almacenamiento |
| 08 | Entrega | Confirmación al atardecer | Última milla |

El reparto del scroll sale de `datos.js`: subir el `tramo` de un capítulo le da
más aire sin tocar nada más.

---

## Modelos y licencias

**No se usa ningún recurso externo.** La segunda fase pedía sustituir la
geometría por modelos GLB/glTF con licencia documentada; se buscaron y no fue
posible obtenerlos con la licencia verificada que el encargo exigía. El detalle
completo de la búsqueda —qué orígenes se probaron, cuáles respondieron y por
qué ninguno servía— está en **[`MODELOS.md`](MODELOS.md)**.

Se aplicó la alternativa que el propio encargo prevé: versión propia, mejorada.
Todo está generado por código:

| Elemento | Cómo se construye |
|---|---|
| Casco del buque | Por secciones a lo largo de la eslora, con la manga variando según una curva —como las cuadernas de un astillero— y lanzamiento de proa |
| Contenedor | Corrugado en **geometría** desde un perfil trapezoidal barrido, bastidor que sobresale 3 cm de la chapa, ocho *corner castings* con chaflán, puertas completas con barras, manetas, guías y bisagras |
| Grúa pórtico | Celosías de cordón y diagonal; carro, spreader con *twistlocks* y cuatro cables reconstruidos cada fotograma |
| Camión | Cabina por **perfil extruido con bisel** —no cajas apiladas—, deflector separado, visera, retrovisores, estribos; diez ruedas y suspensión amortiguada |
| Centro logístico | Marquesina sobre los muelles, cubierta a dos aguas, oficinas acristaladas, diez muelles con andén, niveladora y topes, semirremolques estacionados |
| Carretera | Marcas viales al paso real (5 m de raya, 12 de vano), quitamiedos continuo, hitos de arista cada 12 m, taludes y pórticos |
| Materiales | Biblioteca PBR con mapas de **normales y rugosidad generados por código** (`src/escena/materiales.js`) |
| Agua | Tres trenes de ola en el vértice y Fresnel en el fragmento |
| Sonido | WebAudio: ruido rosa filtrado y osciladores |

Dependencias: **three.js 0.160.1** (MIT), **GSAP 3.12.5** con ScrollTrigger
(licencia estándar de GreenSock, gratuita para este uso), **Inter Tight**
(SIL OFL 1.1, en `src/tipos/`).

La arquitectura queda preparada para sustituir cualquier pieza por un glTF:
cada módulo de `escena/` expone `crearX()` y un `userData.actualizar(mundo)`.

---

## Escala

Las medidas son las de verdad, y ésa es la razón de que la escena se sienta
monumental sin forzar los encuadres:

- contenedor 40′ High Cube: **12,192 × 2,438 × 2,896 m**
- buque: **294 m** de eslora, 48 de manga, 9 400 TEU
- grúa pórtico: **82 m** de alto, 78 de voladizo, 30,5 entre carriles
- tractora + semirremolque: **16,5 m**

---

## Los mandos

Todo lo ajustable está en `src/ajustes.js`. Para probar valores sin
recompilar, abre la página con `?ajustes`: salen dieciséis deslizadores en
cinco secciones y cuatro configuraciones comparables —`Equilibrada` (**la
publicada**), `Cinematográfica`, `Rendimiento` y `Presentación`—. Cuando el
ajuste esté bien, **Copiar valores** deja el objeto listo para pegar.

El panel se carga con `import()` dinámico y sólo si está el parámetro: no pesa
un byte en la visita normal.

---

## Las ideas que conviene no romper

- **La pose es una función pura del progreso.** Todo lo demás se deriva de eso.
- **ScrollTrigger revela texto; NO mueve la cámara.** Mezclarlo es lo que
  produce esas páginas en las que, al subir, la escena va por un sitio y el
  texto por otro.
- **Nada de secuestrar la rueda.** Para suavizarla hay que interceptarla con
  `preventDefault`, y en cuanto se hace eso la página deja de responder como el
  visitante espera. Lo amortiguado es la CÁMARA.
- **Los planos de cámara son DESPLAZAMIENTOS respecto a lo que siguen**, no
  puntos del mundo. Horneados en coordenadas absolutas coincidían con el camión
  sólo en los propios planos y entre medias se separaban decenas de metros: en
  el capítulo de carretera, sencillamente, no se veía el camión.
- **El delta de tiempo se acota por los dos lados.** Un delta negativo convierte
  la interpolación exponencial en una exponencial creciente.
- **La niebla exponencial es `exp(-(densidad·d)²)`,** no `exp(-d²·densidad)`.
  Con la segunda, a quinientos metros el exponente vale −117 y el mundo entero
  sale al cien por cien de niebla.
- **El domo del cielo tiene que caber dentro del plano lejano de la cámara.**
  Con radio mayor se recorta entero, el cielo sale negro y no hay ningún aviso.
- **Un `DirectionalLight` ilumina en la dirección que va de su posición a su
  OBJETIVO.** Olvidar mover el objetivo deja la luz rasante y los cascos negros.
- **Ni un acento grave dentro de los literales de sombreador.** Uno solo, aunque
  esté en un comentario de GLSL, cierra la cadena de JavaScript y la
  compilación falla de una forma fácil de no ver: se sirve el `dist` anterior y
  todo parece ir bien mientras se prueba una versión vieja.
- **`gsap.ticker.lagSmoothing(0)`.** Por defecto GSAP congela su reloj cuando un
  fotograma pasa de medio segundo, y los revelados se quedan a medias.
- **GSAP lee `translateY(105%)` del CSS como píxeles en `y`, no como
  `yPercent`.** Animar sólo `yPercent` deja la otra componente intacta y el
  titular no aparece.

---

## Rendimiento

- Cuatro niveles de calidad según núcleos, memoria y ancho de pantalla. Cambia
  la cantidad de geometría, partículas y resolución, **no el aspecto**.
- **Freno automático**: si el fotograma medio pasa de 34 ms durante dos
  segundos, baja un escalón —menos partículas, menos detalle, menos
  resolución—. Sólo baja, nunca sube: un sistema que oscila se nota más que ir
  un escalón por debajo.
- Instancias para los cientos de contenedores apilados y para el mobiliario de
  carretera; geometrías y materiales compartidos.
- Visibilidad por regiones: el mundo mide kilómetro y medio y no se paga entero
  en cada fotograma.
- El bucle se detiene con la pestaña oculta.
- Sin reflejos planares ni sondas de entorno: son pasadas de render extra. El
  agua convence por el Fresnel, que cuesta cuatro operaciones.

---

## Accesibilidad

- `prefers-reduced-motion`: sin entrada animada, sin revelados y sin recorrido
  de cámara. **Todo el contenido queda visible.**
- Control para pausar el movimiento, con la preferencia recordada.
- Sin WebGL se pinta un fondo en CSS y **el relato completo se lee igual**: la
  prosa está en el HTML, no generada por JavaScript.
- Enlace para saltar al contenido, foco visible, navegación por teclado.
- El lienzo no captura eventos del ratón.
- Descripción de la escena para lectores de pantalla.
- El sonido empieza silenciado y sólo se activa con una acción explícita.

---

## Pruebas

```bash
npm run verificar        # construye y pasa las cuatro suites
```

o por separado:

```bash
npm run guion            # el recorrido, en Node, sin navegador  (~0,1 s)
npm run texto            # desbordes y relevo de texto, 3 pantallas
npm run encuadre         # qué se ve de verdad, 3 relaciones de pantalla
npm run pruebas          # el recorrido funcional completo
```

Las tres últimas necesitan Playwright (`npx playwright install chromium`; si el
navegador está en otra ruta, se pasa en `CHROMIUM`).

**`pruebas-guion.mjs`** no importa three.js a propósito, así que corre en Node
en una décima de segundo. Comprueba que nada sea `undefined`, que la cámara no
salte, que la pose sea función pura del progreso, que el camión no retroceda y
que la descarga recorra sus **trece pasos en orden**. Dos comprobaciones nuevas
de esta fase, y la segunda merece explicación:

- **discontinuidades, no velocidad.** Comprobar «que entre dos muestras no se
  mueva más de X» mide en realidad la velocidad, y o deja pasar saltos pequeños
  o suspende movimientos legítimos. Lo que distingue un salto de un movimiento
  rápido es cómo se comportan al muestrear más fino: uno continuo reparte el
  recorrido entre el doble de muestras y su paso máximo cae a la mitad; una
  discontinuidad mide lo mismo por muchas muestras que se tomen. Así que se
  mide a N y a 2N y se compara la razón.
- **un techo de velocidad aparte**, porque sin discontinuidades pero con un
  tramo que baje cincuenta metros en un parpadeo, la maniobra tampoco se
  entiende. Fue esta comprobación la que obligó a darle al arriado sobre el
  remolque el 13 % del capítulo en vez del 8 %.

**`pruebas-encuadre.mjs`** es la prueba que faltaba. Las funcionales dicen si
la página responde; no dicen si se VE algo. Un plano puede cargar sin un error
en consola, pasar toda la navegación y tener el camión a ciento once grados
fuera del eje. Ésta proyecta la **caja envolvente** del sujeto de cada capítulo
sobre la pantalla y mide si está en cuadro, qué fracción ocupa, y a qué
distancia pasa la cámara de cualquier superficie —seis rayos— para que no se
meta dentro de la geometría. En tres relaciones de pantalla, porque el fallo de
móvil era justamente que nadie lo había medido en vertical.

**`texto.mjs`** comprueba que ningún capítulo desborde su caja pegada de una
altura de ventana, que ninguna línea de titular quede cortada por su propio
recorte de animación, y que el relevo entre capítulos sea un relevo y no un
amontonamiento. En 1440×900, 390×844 y **360×640**, que es donde falla.

**`pruebas.mjs`** cubre los ocho capítulos en orden, ida y vuelta del scroll,
recarga a mitad, anclas y botones, teclado, móvil, movimiento reducido, pausa,
alternativa sin WebGL, el panel con `?ajustes` y el descenso automático de
calidad.

Dos reglas de las pruebas que merece la pena conservar: donde hay que esperar a
que la escena se asiente **se cuentan fotogramas pintados, no milisegundos**, y
donde se espera a que pase algo **se espera a la condición**, no a un plazo.

---

## Piezas de referencia

De los componentes de arranque de **claude-design**
(`Anthropic/claude-design/starter-components`, **CC0 1.0 Universal**) se toman
cinco ideas, no código:

- `deck-stage.js` — la historia organizada en **capítulos** con su tramo.
- `three-d-stage.js` — la escena posee renderizador, luces, cámara y
  redimensionado; los objetos se montan encima.
- `animations-v3.jsx` — nada se mueve en crudo: el scroll y el puntero
  **empujan** valores que después se amortiguan.
- `image-slot.js` — colocación **en proporción al encuadre**, no en unidades
  fijas.
- `tweaks-panel.jsx` — afinar **en caliente** en vez de editar, recompilar y
  volver a mirar.
