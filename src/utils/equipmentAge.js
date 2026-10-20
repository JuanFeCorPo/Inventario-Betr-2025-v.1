// ─────────────────────────────────────────────
//  src/utils/equipmentAge.js
//  Distribución del inventario activo por antigüedad (fechaIngreso)
// ─────────────────────────────────────────────

const MS_POR_ANIO = 365.25 * 86_400_000;

// Una sola escala de tono (más oscuro = más antiguo). A propósito no reutiliza los
// colores de estado (verde, azul, rojo…), para que la gráfica no se confunda con ellos.
// `frase` completa la oración "El N % …" del resumen de la tarjeta.
export const BUCKETS_ANTIGUEDAD = [
  { key: 'menos-1', label: '< 1 año',    frase: 'tiene menos de 1 año',    min: 0, max: 1,        color: '#7D8E9C' },
  { key: '1-2',     label: '1 - 2 años', frase: 'tiene entre 1 y 2 años',  min: 1, max: 2,        color: '#64778A' },
  { key: '2-3',     label: '2 - 3 años', frase: 'tiene entre 2 y 3 años',  min: 2, max: 3,        color: '#4C5F72' },
  { key: '3-5',     label: '3 - 5 años', frase: 'tiene entre 3 y 5 años',  min: 3, max: 5,        color: '#35475A' },
  { key: 'mas-5',   label: '5+ años',    frase: 'tiene más de 5 años',     min: 5, max: Infinity, color: '#1C2B35' },
];

function toDate(value) {
  return value?.toDate ? value.toDate() : null;
}

// Devuelve los buckets con equipos (los vacíos se omiten) y el total activo.
// Los equipos "De Baja" se excluyen, igual que en las demás métricas del dashboard.
export function getAgeBuckets(items, now = new Date()) {
  const counts = BUCKETS_ANTIGUEDAD.map(b => ({ ...b, count: 0 }));
  let sinFecha = 0;
  let total = 0;

  items.forEach(item => {
    if (item.estado === 'De Baja') return;
    total++;

    const fecha = toDate(item.fechaIngreso);
    if (!fecha) { sinFecha++; return; }

    const anios = Math.max(0, (now.getTime() - fecha.getTime()) / MS_POR_ANIO);
    const bucket = counts.find(b => anios >= b.min && anios < b.max) ?? counts[counts.length - 1];
    bucket.count++;
  });

  const buckets = counts.filter(b => b.count > 0);
  if (sinFecha > 0) {
    buckets.push({ key: 'sin-fecha', label: 'Sin fecha registrada', frase: 'no tiene fecha de ingreso', count: sinFecha, color: '#B3BCC4' });
  }

  return { buckets, total };
}
