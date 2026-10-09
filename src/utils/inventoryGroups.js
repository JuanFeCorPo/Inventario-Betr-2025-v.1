import { STATUS_ORDER } from '../config/constants';

// Agrupa equipos por categoría, de la más numerosa a la menos (empate: alfabético).
export const groupByCategory = (items) => {
  const map = new Map();
  items.forEach(it => map.set(it.categoria, [...(map.get(it.categoria) ?? []), it]));
  return [...map.entries()]
    .map(([categoria, rows]) => ({ categoria, rows }))
    .sort((a, b) => b.rows.length - a.rows.length || a.categoria.localeCompare(b.categoria));
};

// [[estado, cantidad], …] en el orden de STATUS_ORDER, solo con los estados presentes.
export const statusCounts = (rows) =>
  STATUS_ORDER.map(s => [s, rows.filter(r => r.estado === s).length]).filter(([, n]) => n > 0);
