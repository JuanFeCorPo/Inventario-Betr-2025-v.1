import * as XLSX from 'xlsx';
import { CATEGORIAS, ESTADOS } from '../config/constants';

export const COLUMNS = [
  { key: 'nombre',           label: 'Nombre' },
  { key: 'categoria',        label: 'Categoría' },
  { key: 'estado',           label: 'Estado' },
  { key: 'numeroInventario', label: 'N° Inventario' },
  { key: 'numeroSerial',     label: 'N° Serial' },
  { key: 'fechaIngreso',     label: 'Fecha de Ingreso' },
  { key: 'personaEncargada', label: 'Persona Encargada' },
  { key: 'observaciones',    label: 'Observaciones' },
];

const DIACRITICS_RE = /[̀-ͯ]/g;
const normalize = (s) =>
  (s ?? '').toString().trim().toLowerCase().normalize('NFD').replace(DIACRITICS_RE, '');

const matchFromList = (value, list) => {
  const norm = normalize(value);
  if (!norm) return null;
  const exact = list.find(o => normalize(o) === norm);
  if (exact) return exact;
  const partial = list.find(o => normalize(o).includes(norm) || norm.includes(normalize(o)));
  return partial ?? null;
};

const excelDateToISO = (value) => {
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString().split('T')[0];
  const str = (value ?? '').toString().trim();
  if (!str) return '';
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && /\d{4}/.test(str)) return parsed.toISOString().split('T')[0];
  return '';
};

// ── Exportar ──────────────────────────────────
export function exportInventory(items) {
  const rows = items.map(item => ({
    'Nombre': item.nombre ?? '',
    'Categoría': item.categoria ?? '',
    'Estado': item.estado ?? '',
    'N° Inventario': item.numeroInventario ?? '',
    'N° Serial': item.numeroSerial ?? '',
    'Fecha de Ingreso': item.fechaIngreso?.toDate ? item.fechaIngreso.toDate().toISOString().split('T')[0] : '',
    'Persona Encargada': item.personaEncargada ?? '',
    'Observaciones': item.observaciones ?? '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [Object.fromEntries(COLUMNS.map(c => [c.label, '']))]);
  ws['!cols'] = COLUMNS.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

  const refRows = Array.from({ length: Math.max(CATEGORIAS.length, ESTADOS.length) }, (_, i) => ({
    'Categorías válidas': CATEGORIAS[i] ?? '',
    'Estados válidos': ESTADOS[i] ?? '',
  }));
  const wsRef = XLSX.utils.json_to_sheet(refRows);
  wsRef['!cols'] = [{ wch: 24 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsRef, 'Referencia');

  XLSX.writeFile(wb, `inventario_betrmedia_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// ── Importar ──────────────────────────────────
const HEADER_MAP = {
  nombre: ['nombre'],
  categoria: ['categoria'],
  estado: ['estado'],
  numeroInventario: ['n inventario', 'numero inventario', 'no inventario'],
  numeroSerial: ['n serial', 'numero serial', 'serial'],
  fechaIngreso: ['fecha de ingreso', 'fecha ingreso', 'fecha'],
  personaEncargada: ['persona encargada', 'encargado', 'persona a cargo'],
  observaciones: ['observaciones', 'observacion'],
};

function findField(row, key) {
  const headers = Object.keys(row);
  const header = headers.find(h => HEADER_MAP[key].includes(normalize(h)));
  return header ? row[header] : '';
}

function parseRow(row, index) {
  const errors = [];
  const warnings = [];

  const nombre           = findField(row, 'nombre').toString().trim();
  const numeroInventario = findField(row, 'numeroInventario').toString().trim();
  const numeroSerial     = findField(row, 'numeroSerial').toString().trim();
  const personaEncargada = findField(row, 'personaEncargada').toString().trim();
  const observaciones    = findField(row, 'observaciones').toString().trim();

  const rawCategoria = findField(row, 'categoria');
  let categoria = matchFromList(rawCategoria, CATEGORIAS);
  if (!categoria) {
    categoria = 'Otros';
    if (rawCategoria) warnings.push(`Categoría "${rawCategoria}" no reconocida, se usó "Otros".`);
  }

  const rawEstado = findField(row, 'estado');
  let estado = matchFromList(rawEstado, ESTADOS);
  if (!estado) {
    estado = 'Disponible';
    if (rawEstado) warnings.push(`Estado "${rawEstado}" no reconocido, se usó "Disponible".`);
  }

  const fechaIngreso = excelDateToISO(findField(row, 'fechaIngreso'));

  if (!nombre) errors.push('Falta el nombre.');
  if (!numeroInventario) errors.push('Falta el número de inventario.');
  if (!fechaIngreso) errors.push('Falta o es inválida la fecha de ingreso.');

  return {
    _row: index + 2,
    nombre, categoria, estado, numeroInventario, numeroSerial,
    fechaIngreso, personaEncargada, observaciones,
    errors, warnings,
  };
}

export function parseInventoryExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        resolve(raw.map(parseRow));
      } catch {
        reject(new Error('El archivo no parece ser un Excel válido.'));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
