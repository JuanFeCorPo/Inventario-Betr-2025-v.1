// ─────────────────────────────────────────────
//  src/config/constants.js
//  Paleta Betrmedia · Categorías · Estados
// ─────────────────────────────────────────────

export const CATEGORIAS = [
  'Periféricos', 'Monitores', 'Laptops', 'CPU', 'Cámaras', 'Luces',
  'Audio', 'Electrodomésticos', 'Smartphones', 'Adaptadores', 'UPS',
  'Bases y Soportes', 'Estabilizadores', 'Servidores y Red', 'Otros',
];

// Categorías con mantenimiento preventivo programado (ver src/utils/maintenance.js)
export const CATEGORIAS_CON_MANTENIMIENTO = ['Laptops', 'CPU'];
export const FRECUENCIA_MANTENIMIENTO_MESES_DEFAULT = 6;

// Categorías con especificaciones técnicas (componentes) editables
export const CATEGORIAS_CON_ESPECIFICACIONES = ['Laptops', 'CPU'];
export const CAMPOS_ESPECIFICACIONES = [
  { key: 'marca',            label: 'Marca' },
  { key: 'modelo',           label: 'Modelo' },
  { key: 'procesador',       label: 'Procesador' },
  { key: 'ram',              label: 'Memoria RAM' },
  { key: 'almacenamiento',   label: 'Almacenamiento' },
  { key: 'tarjetaGrafica',   label: 'Tarjeta Gráfica' },
  { key: 'sistemaOperativo', label: 'Sistema Operativo' },
];

export const ESTADOS = ['Disponible', 'En Uso', 'En Mantenimiento', 'Fuera de Servicio'];

// Nuevo = nunca ha sido asignado a nadie. Usado = ya tuvo al menos un uso,
// aunque haya vuelto a quedar "Disponible" (ej. renuncia de un colaborador).
export const CONDICIONES = ['Nuevo', 'Usado'];

// Badges por estado — fondo suave + texto de color.
// Rojo y violeta son los estados que piden acción; verde y azul son lo normal; el ámbar queda solo para avisos.
export const ESTADO_STYLES = {
  'Disponible':         'bg-emerald-100  text-emerald-700  border border-emerald-200',
  'En Uso':             'bg-blue-100     text-blue-800     border border-blue-200',
  'En Mantenimiento':   'bg-violet-100   text-violet-700   border border-violet-200',
  'Fuera de Servicio':  'bg-rose-100     text-rose-700     border border-rose-200',
  'De Baja':            'bg-gray-100     text-gray-500     border border-gray-200',
};

// Punto de color por estado (listas densas, mosaico de categorías)
export const STATUS_DOT = {
  'Disponible':        'bg-emerald-500',
  'En Uso':            'bg-blue-500',
  'En Mantenimiento':  'bg-violet-500',
  'Fuera de Servicio': 'bg-rose-500',
  'De Baja':           'bg-gray-400',
};
export const STATUS_ORDER = ['Disponible', 'En Uso', 'En Mantenimiento', 'Fuera de Servicio', 'De Baja'];

// Logo propio (public/): antes se descargaba de un sitio externo en cada visita y el login dependía de él
export const LOGO_URL = '/logo-betrmedia.png';
export const IDLE_TIME_MS    = 900_000;   // 15 minutos
export const IDLE_WARNING_MS = 40_000;    // aviso 40 s antes del cierre
