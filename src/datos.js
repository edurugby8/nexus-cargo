/**
 * El contenido.
 *
 * Todos los textos, capítulos y datos del envío en un solo archivo. Cambiar la
 * historia se hace aquí, sin tocar ni la escena ni la interfaz.
 *
 * NEXUS CARGO es una MARCA FICTICIA creada como demostración de CodeCraft. Los
 * datos del envío, las rutas y los tiempos son inventados y coherentes entre
 * sí, pero no corresponden a ninguna operación real.
 */

export const MARCA = {
  nombre: 'NEXUS CARGO',
  lema: 'Movemos el mundo sin que el mundo se detenga.',
  aviso:
    'NEXUS CARGO no existe: es una marca ficticia creada para esta demostración '
    + 'de diseño de CodeCraft. El puerto, el buque, la grúa, el camión y todos '
    + 'los datos del envío están generados por código en tu propio navegador. '
    + 'No hay tienda, ni seguimiento, ni integraciones: el formulario del final '
    + 'no envía nada a ningún sitio.',
};

/** El contenedor protagonista. Se sigue durante todo el recorrido. */
export const ENVIO = {
  codigo: 'NXCU 482019',
  tipo: '40′ HC · Alta cubicación',
  origen: 'Shanghái · CNSHA',
  destino: 'Zaragoza · Plataforma Logística',
  puerto: 'Valencia · ESVLC',
  buque: 'NX ORION · IMO 9482019',
  peso: '24 180 kg',
  precinto: 'NX-7741208',
  temperatura: '4,2 °C',
  salida: '02 SEP · 06:40',
  atraque: '17 SEP · 05:12',
  descarga: '17 SEP · 07:28',
  aduana: '17 SEP · 08:55',
  entrega: '17 SEP · 19:40',
  millas: '9 214 millas náuticas',
};

/**
 * Los capítulos.
 *
 * Aquí va sólo lo que necesitan la escena y el panel de datos: cuánto scroll
 * ocupa cada capítulo y qué cifras muestra. La PROSA vive en `index.html`, no
 * aquí: así la página se lee entera sin JavaScript y un buscador la indexa.
 * Duplicar los textos en los dos sitios sería garantizar que se separen. El orden es el del recorrido y el reparto del
 * scroll sale de aquí: subir `tramo` da más aire a un capítulo sin tocar nada
 * más. La idea de organizar la historia por capítulos con su propio tramo es
 * de `deck-stage.js` (starter-components, CC0).
 */
export const CAPITULOS = [
  {
    id: 'oceano',
    numero: '01',
    rotulo: 'Alta mar',
    tramo: 2.2,
    servicio: 'Transporte marítimo',
  },
  {
    id: 'puerto',
    numero: '02',
    rotulo: 'Llegada a puerto',
    tramo: 2,
    servicio: 'Gestión portuaria',    datos: [
      ['Buque', 'NX ORION · IMO 9482019'],
      ['Eslora', '294 m · 9 400 TEU'],
      ['Atraque', 'Muelle 7 · Valencia'],
    ],
  },
  {
    id: 'grua',
    numero: '03',
    rotulo: 'Descarga',
    tramo: 2.6,
    servicio: 'Operativa de terminal',    datos: [
      ['Contenedor', 'NXCU 482019'],
      ['Puerto', 'Valencia · ESVLC'],
      ['Descarga', '17 SEP · 07:28'],
      ['Estado', 'Descarga completada', 'verde'],
    ],
  },
  {
    id: 'aduanas',
    numero: '04',
    rotulo: 'Aduanas',
    tramo: 2,
    servicio: 'Despacho aduanero',    datos: [
      ['Documentación', 'Verificada', 'verde'],
      ['Precinto', 'NX-7741208 · intacto', 'verde'],
      ['Temperatura', '4,2 °C · estable', 'verde'],
      ['Autorización', 'Concedida', 'verde'],
    ],
  },
  {
    id: 'salida',
    numero: '05',
    rotulo: 'Salida del recinto',
    tramo: 1.6,
    servicio: 'Transporte terrestre',  },
  {
    id: 'carretera',
    numero: '06',
    rotulo: 'En ruta',
    tramo: 2.8,
    servicio: 'Seguimiento en tiempo real',    datos: [
      ['Ubicación', 'A-3 · km 214'],
      ['Restantes', '318 km'],
      ['Estimada', '19:40'],
      ['Temperatura', '4,2 °C', 'verde'],
    ],
  },
  {
    id: 'centro',
    numero: '07',
    rotulo: 'Centro logístico',
    tramo: 2.2,
    servicio: 'Almacenamiento y distribución',    datos: [
      ['Matrícula', '4821 NXC'],
      ['Muelle', 'D-14 · asignado'],
      ['Inventario', 'Actualizado', 'verde'],
    ],
  },
  {
    id: 'entrega',
    numero: '08',
    rotulo: 'Entrega',
    tramo: 2,
    servicio: 'Última milla',
  },
];

/** Los servicios, repartidos por el recorrido en vez de en tarjetas sueltas. */
export const SERVICIOS = [
  { nombre: 'Transporte marítimo', pie: 'FCL y LCL · consolidación en origen' },
  { nombre: 'Gestión portuaria', pie: 'Atraque, estiba y depósito' },
  { nombre: 'Despacho aduanero', pie: 'Representación directa e indirecta' },
  { nombre: 'Transporte terrestre', pie: 'Flota propia y red de colaboradores' },
  { nombre: 'Almacenamiento', pie: '80 000 m² en cuatro plataformas' },
  { nombre: 'Seguimiento en tiempo real', pie: 'Telemetría cada 30 segundos' },
  { nombre: 'Cadena de frío', pie: 'De −25 °C a +25 °C, sin ruptura' },
  { nombre: 'Última milla', pie: 'Entrega concertada y prueba digital' },
];

/** Las paradas del recorrido, para el resumen de ruta del final. */
export const RUTA = [
  { lugar: 'Shanghái', pie: 'Salida · 02 SEP' },
  { lugar: 'Singapur', pie: 'Tránsito · 06 SEP' },
  { lugar: 'Suez', pie: 'Tránsito · 12 SEP' },
  { lugar: 'Valencia', pie: 'Atraque · 17 SEP' },
  { lugar: 'Zaragoza', pie: 'Entrega · 17 SEP' },
];
