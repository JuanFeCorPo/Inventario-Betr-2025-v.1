// ─────────────────────────────────────────────
//  src/utils/maintenance.js
//  Cálculo de mantenimiento preventivo (Laptops / CPU)
// ─────────────────────────────────────────────

import { CATEGORIAS_CON_MANTENIMIENTO, FRECUENCIA_MANTENIMIENTO_MESES_DEFAULT } from '../config/constants';

const MS_POR_DIA = 86_400_000;

export const GRUPOS_URGENCIA = [
  { key: 'vencido',     label: 'Vencidos' },
  { key: 'esta-semana', label: 'Esta semana' },
  { key: 'este-mes',    label: 'Este mes' },
  { key: 'proximo',     label: 'Próximos' },
];

export function aplicaMantenimiento(item) {
  return CATEGORIAS_CON_MANTENIMIENTO.includes(item?.categoria) && item?.estado !== 'De Baja';
}

function toDate(value) {
  return value?.toDate ? value.toDate() : null;
}

// Devuelve null si el equipo no aplica o no tiene fecha base para calcular.
export function getMaintenanceInfo(item, now = new Date()) {
  if (!aplicaMantenimiento(item)) return null;

  const baseDate = toDate(item.ultimoMantenimiento) ?? toDate(item.fechaIngreso) ?? toDate(item.createdAt);
  if (!baseDate) return null;

  const frecuenciaMeses = item.frecuenciaMantenimientoMeses ?? FRECUENCIA_MANTENIMIENTO_MESES_DEFAULT;

  const proximaFecha = new Date(baseDate);
  proximaFecha.setMonth(proximaFecha.getMonth() + frecuenciaMeses);

  const diasRestantes = Math.floor((proximaFecha.getTime() - now.getTime()) / MS_POR_DIA);

  let urgencia;
  if (diasRestantes < 0) urgencia = 'vencido';
  else if (diasRestantes <= 7) urgencia = 'esta-semana';
  else if (diasRestantes <= 30) urgencia = 'este-mes';
  else urgencia = 'proximo';

  return { proximaFecha, diasRestantes, urgencia, frecuenciaMeses, ultimaFecha: baseDate };
}

// Agrupa los equipos aplicables por nivel de urgencia, ordenados por fecha más próxima primero.
export function groupMaintenanceByUrgency(items, now = new Date()) {
  const conInfo = items
    .map(item => ({ item, info: getMaintenanceInfo(item, now) }))
    .filter(({ info }) => info !== null)
    .sort((a, b) => a.info.proximaFecha - b.info.proximaFecha);

  return GRUPOS_URGENCIA
    .map(grupo => ({ ...grupo, rows: conInfo.filter(({ info }) => info.urgencia === grupo.key) }))
    .filter(grupo => grupo.rows.length > 0);
}

export function countOverdueMaintenance(items, now = new Date()) {
  return items.reduce((count, item) => {
    const info = getMaintenanceInfo(item, now);
    return info?.urgencia === 'vencido' ? count + 1 : count;
  }, 0);
}
