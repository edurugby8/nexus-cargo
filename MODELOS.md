# Modelos y licencias

El encargo de la segunda fase pedía, textualmente, sustituir la geometría
primitiva por **modelos GLB/glTF con licencia documentada**, y añadía una
condición y una alternativa:

> No utilices modelos sin licencia conocida. […] Si no encuentras un recurso
> válido, construye una versión propia mejorada, pero no mantengas una
> geometría de bloques si no alcanza el nivel visual necesario.

Esto documenta la búsqueda, por qué terminó donde terminó, y qué se hizo en su
lugar.

## Qué se buscó

Cinco piezas, que son las que el recorrido enseña de cerca:

| Pieza | Qué haría falta |
|---|---|
| Portacontenedores | ~294 m de eslora, 9 400 TEU |
| Grúa pórtico de muelle | STS de 82 m, 52 m de luz, 78 de voladizo |
| Contenedor 40′ High Cube | 12,192 × 2,438 × 2,896 m |
| Tractora + semirremolque portacontenedores | conjunto de 16,5 m |
| Nave de distribución con muelles de carga | ~168 × 72 × 13,5 m |

## Reverificado en la tercera fase

El encargo de la tercera fase autoriza explícitamente modelos GLB/glTF «con
licencia gratuita y comercial», así que la comprobación se repitió entera. El
resultado es el mismo, y se deja la fecha para que se pueda volver a mirar:

| Origen | 17 SEP 2026 |
|---|---|
| `api.sketchfab.com` | CONNECT rechazado |
| `api.polyhaven.com` | CONNECT rechazado |
| `cdn.jsdelivr.net` | CONNECT rechazado |
| `ambientcg.com` | CONNECT rechazado |
| `raw.githubusercontent.com` | HTTP 200 |

Sigue sin haber ninguna fuente alcanzable que documente licencia por archivo y
contenga alguna de las cinco piezas. Se mantiene la alternativa prevista en el
encargo, y el proyecto queda preparado para cambiar de idea: ver el último
apartado.

## Qué se encontró

Las fuentes habituales de modelos 3D con licencia clara **no son alcanzables
desde el entorno en el que se construye este proyecto**. Comprobado, no
supuesto:

| Origen | Resultado |
|---|---|
| `api.sketchfab.com` | CONNECT rechazado por la política de red |
| `api.polyhaven.com` | CONNECT rechazado por la política de red |
| `cdn.jsdelivr.net` | CONNECT rechazado por la política de red |
| `raw.githubusercontent.com` | accesible (HTTP 200) |

Es decir: el único origen accesible es GitHub en crudo. Y ahí el problema es el
otro: los repositorios que sirven modelos glTF **no documentan la licencia por
archivo** de forma verificable sin abrir páginas web que tampoco son
alcanzables, y ninguno de los catálogos con licencia realmente auditable
—`KhronosGroup/glTF-Sample-Assets`, los `examples/models` de three.js— contiene
ninguna de las cinco piezas. Son cajas de prueba, cascos de motorista, coches
deportivos y patos: nada de logística.

Descargar un GLB de un repositorio cualquiera porque el archivo está ahí
**habría incumplido la instrucción explícita** de no usar modelos sin licencia
conocida. Un repositorio público no es una licencia, y un `LICENSE` en la raíz
no cubre necesariamente los binarios que alguien metió en `assets/`.

## Qué se hizo, entonces

La alternativa que el propio encargo prevé: **versión propia, mejorada**. Y con
una ventaja que conviene decir, porque no es un consuelo sino una razón técnica
de peso:

- **Las medidas casan.** Toda la geometría se genera a partir de `MEDIDAS` en
  `src/escena/ruta.js`, en metros reales. La corrugación de un contenedor cae
  cada 28 cm porque el contenedor mide 12,192 m, no porque una imagen viniera
  así. Un modelo descargado habría que escalarlo a ojo contra el resto, y la
  escala es justamente de lo que vive este proyecto.
- **No pesa.** Cero bytes de descarga. Un GLB decente de un portacontenedores
  con sus texturas son varios megas; cinco de esos habrían multiplicado por
  diez el peso de la página, que hoy entra en 760 kB.
- **Cero riesgo de licencia**, ahora y dentro de dos años.
- **Se anima.** Las trece fases de la descarga mueven el carro, el spreader,
  los twistlocks y los cuatro cables por separado. Un modelo importado habría
  que despiezarlo para conseguir lo mismo.

## En qué consistió «mejorada»

No es la misma geometría con más polígonos. Lo que cambió, pieza por pieza:

**Contenedor** (`src/escena/contenedor.js`)
- Corrugado generado desde un **perfil trapezoidal** barrido en altura, con las
  normales por faceta —sin promediar— para que las aristas queden vivas. Es lo
  que dibuja las rayas verticales de un contenedor de verdad.
- **Bastidor**: cuatro largueros y cuatro pilares que SOBRESALEN 3 cm de la
  chapa. Ese escalón es lo que hace que la caja se lea como una estructura.
- Ocho **corner castings** con chaflán, en acero desnudo.
- **Puertas** completas: dos hojas, cuatro barras de cierre con manetas y
  guías, seis bisagras, bolsas de carretilla.
- Techo con **combadura** para evacuar agua.
- Corregido: los dos testeros estaban girados al revés y se veía el interior.

**Grúa** (`src/escena/grua.js`)
- Cordones de celosía de 0,5 → **1,5 m**, diagonales de 0,3 → 0,65, patas de
  1,7 → 2,6. A la distancia a la que se ve, medio metro es menos de un píxel:
  el pórtico se leía como un alambre.
- El **spreader** estaba enterrado dentro de la tapa del contenedor —a 1,75 m
  del centro de la carga, cuando la tapa está a 1,448—. Ahora va por encima y
  se ve en toda la operación.

**Camión** (`src/escena/camion.js`)
- Cabina por **perfil extruido con bisel** en lugar de tres cajas apiladas:
  frontal echado adelante, parabrisas muy inclinado, techo que cae. Es la
  silueta lateral lo único que se ve a cincuenta metros.
- Deflector separado de la cabina, con su hueco; aletas laterales; visera;
  retrovisores con brazo; estribos; guardabarros.
- Cristales **opacos y reflectantes**, no translúcidos.

**Centro logístico** (`src/escena/tierra.js`)
- **Marquesina** sobre los muelles, cubierta a dos aguas, bloque de oficinas
  acristalado, diez muelles con andén, placa niveladora, topes de goma,
  número y foco, semirremolques estacionados, torres de alumbrado, marcas de
  patio, valla perimetral y control de acceso.

**Carretera** (`src/escena/tierra.js`)
- Marcas viales al paso real (5 m de raya, 12 de vano), quitamiedos continuo,
  hitos de arista cada 12 m, taludes y cuatro pórticos de señalización.

**Materiales** (`src/escena/materiales.js`, nuevo)
- Biblioteca PBR con mapas de **normales y rugosidad generados por código**:
  acero pintado, acero desnudo, hormigón, asfalto, goma, cristal, pintura de
  señalización y superficies emisivas. Los mapas de altura se convierten a
  normales de verdad, no se usan como `bumpMap`, porque el bump se rompe en
  superficies rasantes y aquí las hay continuamente.

## Si algún día hubiera acceso

Lo que haría falta para cambiar de idea, por si se retoma:

1. Un origen con licencia **por archivo** (CC0, CC-BY con atribución, o una
   licencia comercial comprada).
2. Guardar el `.glb` en `public/modelos/` junto a su `LICENCIA.txt` con autor,
   licencia, URL y fecha de descarga.
3. Cargar con `GLTFLoader` y `DRACOLoader`, y **escalar contra `MEDIDAS`**, no
   a ojo.
4. Mantener la versión propia como alternativa para el nivel de equipo bajo: un
   GLB de varios megas no se le sirve a un móvil de gama de entrada.

El código está preparado para eso: cada `crear*()` devuelve un `THREE.Group`
con su `userData.actualizar` y su `userData.liberar`, así que sustituir el
interior de cualquiera de ellos no toca ni la escena ni el guion.
