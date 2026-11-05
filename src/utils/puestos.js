// ─────────────────────────────────────────────
//  Puestos de trabajo y hoja de vida (formato F-MAN-02).
//  Lógica pura, sin React ni Firebase.
//
//  Un puesto ("Optimización #1", "Administración - Coor. Contable") agrupa
//  equipos del inventario mediante `equipo.puestoId`. La hoja de vida no se
//  guarda aparte: se arma con el puesto, sus equipos y su historial.
// ─────────────────────────────────────────────

import { getMaintenanceInfo } from './maintenance';

export const AREAS = ['Operaciones', 'Administrativos'];

// Tipos de evento del historial del puesto (columna "Tipo" de la hoja de vida)
export const TIPOS_EVENTO = {
  preventivo: { label: 'Preventivo', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  correctivo: { label: 'Correctivo', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  cambio:     { label: 'Cambio',     cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  novedad:    { label: 'Novedad',    cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  nota:       { label: 'Nota',       cls: 'bg-brand-bg text-brand-slate border-brand-border' },
};

// ── Casillas del formato F-MAN-02 ──
// Un puesto se arma con estas casillas (las columnas de COMPONENTES de la hoja).
// La casilla de un equipo sale de su categoría (y del nombre, para separar
// teclado de mouse); `equipo.casilla` la fija a mano cuando se asigna a una.
export const CASILLAS = [
  { key: 'principal',  label: 'CPU / Portátil', hoja: 'CPU' },
  { key: 'monitor',    label: 'Monitor',        hoja: 'MONITOR' },
  { key: 'ups',        label: 'UPS',            hoja: 'UPS' },
  { key: 'teclado',    label: 'Teclado',        hoja: 'TECLADO' },
  { key: 'mouse',      label: 'Mouse',          hoja: 'MOUSE' },
  { key: 'celular',    label: 'Celular',        hoja: 'CELULAR' },
  { key: 'audifonos',  label: 'Audífonos',      hoja: 'AUDIFONOS' },
  { key: 'accesorios', label: 'Accesorios',     hoja: 'ACCESORIOS' },
];
const CLAVES_CASILLA = new Set(CASILLAS.map(c => c.key));
export const etiquetaCasilla = (key) => CASILLAS.find(c => c.key === key)?.label ?? 'Accesorios';

// Casilla a partir de un texto (nombre del equipo o descripción del historial).
export const casillaPorTexto = (texto = '') => {
  const t = String(texto).toLowerCase();
  if (/\bcpu\b|port[aá]til|laptop|macbook|all in one/.test(t)) return 'principal';
  if (/teclado|keyboard|combo/.test(t)) return 'teclado';
  if (/mouse|rat[oó]n/.test(t)) return 'mouse';
  if (/monitor|pantalla/.test(t) && !/soporte|base/.test(t)) return 'monitor';
  if (/\bups\b|estabilizador/.test(t)) return 'ups';
  if (/celular|smartphone|tel[eé]fono m[oó]vil/.test(t)) return 'celular';
  if (/aud[ií]fono|auricular|diadema|headset/.test(t)) return 'audifonos';
  return 'accesorios';
};

export const casillaDe = (e) => {
  if (!e) return 'accesorios';
  if (CLAVES_CASILLA.has(e.casilla)) return e.casilla;
  switch (e.categoria) {
    case 'CPU': case 'Laptops': return 'principal';
    case 'Monitores': return 'monitor';
    case 'UPS': case 'Estabilizadores': return 'ups';
    case 'Smartphones': return 'celular';
    case 'Audio': return /micr[oó]fono|interfaz|parlante|bafle/i.test(e.nombre ?? '') ? 'accesorios' : 'audifonos';
    case 'Periféricos': {
      const c = casillaPorTexto(e.nombre);
      return c === 'teclado' || c === 'mouse' ? c : 'accesorios';
    }
    default: return 'accesorios';
  }
};

// { principal: [equipos], monitor: [...], … } con todas las casillas presentes.
export const equiposPorCasilla = (equipos) => {
  const out = Object.fromEntries(CASILLAS.map(c => [c.key, []]));
  for (const e of equipos) out[casillaDe(e)].push(e);
  return out;
};

// Casillas básicas vacías: un puesto con CPU necesita monitor, teclado y mouse;
// uno con portátil (o sin equipo principal) solo necesita el equipo principal.
export const casillasVacias = (equipos) => {
  const por = equiposPorCasilla(equipos);
  const conCpu = por.principal.some(e => e.categoria === 'CPU');
  const basicas = conCpu ? ['principal', 'monitor', 'teclado', 'mouse'] : ['principal'];
  return basicas.filter(k => por[k].length === 0);
};

// "SN - 0ACH…", "S/N:UD24…" → solo el serial (para no repetir "SN").
export const serialLimpio = (s) => {
  // Separador con (?:-|:|.) y no con una clase de caracteres: Tailwind la confundía con una clase CSS
  const t = String(s ?? '').replace(/^\s*S\s*\/?\s*N\s*(?:-|:|\.)?\s*/i, '').trim();
  return /^(N\/?A|NO APLICA|-)$/i.test(t) ? '' : t;
};

// Estado de un puesto para listas y para Inicio: falla, lo que le falta y mantenimiento.
// `gravedad`: 3 = equipo con falla, 2 = le falta algo, 1 = mantenimiento vencido, 0 = al día.
export const resumenPuesto = (puesto, equipos) => {
  const principal = equipoPrincipal(equipos);
  const mant = principal ? getMaintenanceInfo(principal) : null;
  const conFalla = equipos.filter(e => e.estado === 'Fuera de Servicio' || e.estado === 'En Mantenimiento').length;
  const compartido = grupoDe(puesto).nombre === 'Compartidos';
  const faltan = compartido || equipos.length === 0 ? [] : casillasVacias(equipos);
  const vencido = !!mant && mant.diasRestantes < 0;
  const gravedad = conFalla > 0 ? 3 : faltan.length ? 2 : vencido ? 1 : 0;
  return { principal, mant, conFalla, vencido, faltan, gravedad, pendiente: gravedad > 0 };
};

// ── Equipo de trabajo (la carpeta de Drive: "1. Optimización", "5. Diseño"…) ──
// Si el puesto no lo tiene guardado, sale del archivo importado
// ("1. Hoja de Vida - Equipos de Optimización/EQUIPO #1….xlsx").
export const SIN_GRUPO = 'Sin equipo de trabajo';
export const grupoDe = (p) => {
  if (p?.grupo) return { nombre: p.grupo, orden: p.grupoOrden ?? 500 };
  if (/compartidos$/i.test(p?.nombre ?? '')) return { nombre: 'Compartidos', orden: 900 };
  const carpeta = String(p?.hojaOriginal ?? '').split('/').slice(-2, -1)[0];
  if (carpeta) {
    const orden = +(carpeta.match(/^(\d+)\./)?.[1] ?? 500);
    const nombre = carpeta
      .replace(/^\d+\.\s*/, '')
      .replace(/^hoja de vida\s*-\s*/i, '')
      .replace(/^equipos\s+(de\s+)?/i, '')
      .trim();
    if (nombre) return { nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1), orden };
  }
  return { nombre: SIN_GRUPO, orden: 999 };
};

// [{ area, grupos: [{ nombre, orden, puestos }] }] en el orden de las carpetas de Drive.
export const agruparPuestos = (puestos) => {
  const areas = [...AREAS, ...new Set(puestos.map(p => p.area).filter(a => !AREAS.includes(a)))];
  return areas.map(area => {
    const delArea = puestos.filter(p => (p.area ?? AREAS[0]) === area);
    const grupos = new Map();
    for (const p of delArea) {
      const g = grupoDe(p);
      if (!grupos.has(g.nombre)) grupos.set(g.nombre, { ...g, puestos: [] });
      grupos.get(g.nombre).puestos.push(p);
    }
    return {
      area,
      grupos: [...grupos.values()]
        .sort((a, b) => a.orden - b.orden || natural(a.nombre, b.nombre))
        .map(g => ({ ...g, puestos: g.puestos.sort((a, b) => natural(a.nombre, b.nombre)) })),
    };
  }).filter(a => a.grupos.length);
};

// Equipos de trabajo ya usados en un área (para elegir al crear o editar un puesto).
export const gruposDelArea = (puestos, area) => {
  const m = new Map();
  for (const p of puestos.filter(x => x.area === area)) { const g = grupoDe(p); if (g.nombre !== SIN_GRUPO) m.set(g.nombre, g.orden); }
  return [...m].sort((a, b) => a[1] - b[1] || natural(a[0], b[0])).map(([nombre, orden]) => ({ nombre, orden }));
};

// Orden de los componentes en la ficha: el equipo principal primero y luego
// como en la hoja de Excel (monitor, UPS, periféricos, celular, audio…).
const ORDEN_CATEGORIA = [
  'CPU', 'Laptops', 'Monitores', 'UPS', 'Estabilizadores', 'Periféricos', 'Smartphones',
  'Audio', 'Cámaras', 'Luces', 'Adaptadores', 'Bases y Soportes', 'Servidores y Red',
  'Electrodomésticos', 'Otros',
];
const rangoCategoria = (c) => { const i = ORDEN_CATEGORIA.indexOf(c); return i < 0 ? ORDEN_CATEGORIA.length : i; };

// Comparación "natural": "Diseño #2" antes que "Diseño #10".
const natural = (a = '', b = '') => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });

export const equiposDelPuesto = (items, puestoId) =>
  items
    .filter(i => i.puestoId === puestoId && i.estado !== 'De Baja')
    .sort((a, b) => rangoCategoria(a.categoria) - rangoCategoria(b.categoria) || natural(a.numeroInventario, b.numeroInventario));

// El equipo que identifica la hoja de vida (CPU o portátil). Si no hay, null.
export const equipoPrincipal = (equipos) =>
  equipos.find(e => e.categoria === 'CPU') ?? equipos.find(e => e.categoria === 'Laptops') ?? null;

export const ordenarPuestos = (puestos) =>
  [...puestos].sort((a, b) =>
    AREAS.indexOf(a.area) - AREAS.indexOf(b.area) || natural(a.nombre, b.nombre));

// Normaliza para buscar sin tildes ni mayúsculas.
const plano = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Equipos que se pueden asignar a un puesto: activos y que no estén ya en él.
// Busca por Nº de inventario, serial o nombre. Los que están libres van primero.
export const buscarEquiposAsignables = (items, term, puestoId, limite = 30) => {
  const q = plano(term).trim();
  if (!q) return [];
  const digitos = q.replace(/\D/g, '');
  return items
    .filter(i => i.estado !== 'De Baja' && i.puestoId !== puestoId)
    .filter(i => {
      const inv = plano(i.numeroInventario);
      return inv.includes(q)
        || (digitos.length >= 3 && inv.replace(/\D/g, '').endsWith(digitos))
        || plano(i.numeroSerial).includes(q)
        || plano(i.cargador).includes(q)
        || plano(i.nombre).includes(q);
    })
    .sort((a, b) => Number(!!a.puestoId) - Number(!!b.puestoId) || natural(a.numeroInventario, b.numeroInventario))
    .slice(0, limite);
};

// Candidatos para una casilla, sin tener que escribir:
//  - disponibles: estado Disponible y sin puesto (lo primero que se ofrece)
//  - enUso: en otro puesto o asignados sin puesto (se pueden traer con aviso)
// `todos` quita el filtro por tipo (para un equipo mal clasificado).
export const candidatosParaCasilla = (items, { casilla, puestoId, term = '', todos = false, limite = 60 }) => {
  const q = plano(term).trim();
  const digitos = q.replace(/\D/g, '');
  const coincide = (i) => {
    if (!q) return true;
    const inv = plano(i.numeroInventario);
    return inv.includes(q) || (digitos.length >= 3 && inv.replace(/\D/g, '').endsWith(digitos))
      || plano(i.numeroSerial).includes(q) || plano(i.nombre).includes(q) || plano(i.personaEncargada).includes(q);
  };
  const base = items
    .filter(i => i.estado !== 'De Baja' && i.puestoId !== puestoId)
    .filter(i => todos || !casilla || casillaDe(i) === casilla)
    .filter(coincide)
    .sort((a, b) => natural(a.numeroInventario, b.numeroInventario));
  const disponibles = base.filter(i => !i.puestoId && i.estado === 'Disponible');
  const enUso = base.filter(i => !disponibles.includes(i));
  return { disponibles: disponibles.slice(0, limite), enUso: enUso.slice(0, limite), total: base.length };
};

// Texto corto de un equipo para el historial: "Teclado Logitech (BM-INV-0599)".
export const etiquetaEquipo = (e) =>
  e ? `${e.nombre}${e.numeroInventario ? ` (${e.numeroInventario})` : ''}` : '';

// Personas a cargo: limpia filas vacías y normaliza correos.
export const limpiarPersonas = (personas = []) =>
  personas
    .map(p => ({ nombre: String(p.nombre ?? '').trim(), correo: String(p.correo ?? '').trim().toLowerCase() }))
    .filter(p => p.nombre || p.correo);

export const correoValido = (c) => !c || /^\S+@\S+\.\S+$/.test(c);

// ── Dónde está un equipo, para nombrarlo en listas ──
// "CPU" no dice nada: en Mantenimientos y en Hoy cada equipo se nombra por su
// puesto ("Optimización #1"), o por el encargado si no tiene, o "En stock".
// `grupo` es el equipo de trabajo del puesto, para agrupar las listas.
export const EN_STOCK = 'En stock (Betrmedia)';
export const ubicacionEquipo = (item, puestosPorId) => {
  const puesto = item?.puestoId ? puestosPorId.get(item.puestoId) ?? null : null;
  if (puesto) {
    const g = grupoDe(puesto);
    return { puesto, titulo: puesto.nombre, grupo: g.nombre === SIN_GRUPO ? (puesto.area ?? 'Otros') : g.nombre, orden: g.orden };
  }
  const enc = String(item?.personaEncargada ?? '').trim();
  if (!enc || /^betrmedia$/i.test(enc)) return { puesto: null, titulo: EN_STOCK, grupo: 'En stock', orden: 1000 };
  return { puesto: null, titulo: enc, grupo: 'Sin puesto', orden: 950 };
};

// ── Orden del historial ──
// Por día (no por hora: los mantenimientos se guardan a mediodía y los cambios de
// componentes con la hora real) y, el mismo día, el último registrado primero.
const diaDe = (v) => {
  const d = v?.toDate ? v.toDate() : v instanceof Date ? v : null;
  return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() : 0;
};
const msDe = (v) => v?.toMillis?.() ?? (v instanceof Date ? v.getTime() : 0);
export const recientesPrimero = (a, b) =>
  diaDe(b.fecha) - diaDe(a.fecha) || msDe(b.timestamp) - msDe(a.timestamp) || msDe(b.fecha) - msDe(a.fecha);
