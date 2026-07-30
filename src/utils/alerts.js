const STALE_DAYS_THRESHOLD  = 30;
const MANY_OOS_THRESHOLD    = 3;

// ── ¿Hace cuántos días está el equipo en su estado actual? ──
function daysInCurrentState(item) {
  const history = item.history ?? [];
  const relevant = history
    .filter(h => h.changes?.some(c => c.field === 'estado' && c.to === item.estado))
    .sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());

  const since = relevant[0]?.timestamp?.toDate() ?? item.createdAt?.toDate();
  if (!since) return null;
  return Math.floor((Date.now() - since.getTime()) / 86_400_000);
}

// ── Calcula las alertas activas a partir del inventario actual ──
export function computeAlerts(items) {
  const alerts = [];

  // 1) Categorías con muchos equipos fuera de servicio
  const byCategoria = {};
  items.forEach(i => {
    if (i.estado === 'Fuera de Servicio') {
      byCategoria[i.categoria] = (byCategoria[i.categoria] ?? 0) + 1;
    }
  });
  Object.entries(byCategoria).forEach(([categoria, count]) => {
    if (count >= MANY_OOS_THRESHOLD) {
      alerts.push({
        id: `oos-${categoria}`,
        severity: 'high',
        message: `${categoria}: ${count} equipos fuera de servicio.`,
        filterCategory: categoria,
        filterStatus: 'Fuera de Servicio',
      });
    }
  });

  // 2) Equipos estancados (mucho tiempo en Mantenimiento / Fuera de Servicio)
  const stale = items
    .filter(i => ['En Mantenimiento', 'Fuera de Servicio'].includes(i.estado))
    .map(i => ({ item: i, days: daysInCurrentState(i) }))
    .filter(x => x.days !== null && x.days >= STALE_DAYS_THRESHOLD);

  if (stale.length > 0) {
    alerts.push({
      id: 'stale-items',
      severity: 'medium',
      message: `${stale.length} equipo${stale.length !== 1 ? 's' : ''} llevan más de ${STALE_DAYS_THRESHOLD} días sin salir de Mantenimiento/Fuera de Servicio.`,
      filterStatus: null, // se resuelve en el dashboard mostrando ambos estados
      staleFilter: true,
    });
  }

  return alerts;
}
