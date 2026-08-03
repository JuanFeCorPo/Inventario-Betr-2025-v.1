import { collectionGroup, query, where, getDocs, Timestamp } from 'firebase/firestore';

// Junta los movimientos de todos los equipos en un rango de fechas, desde
// dos fuentes: la subcolección `historial` (consulta collectionGroup) y el
// historial legado embebido + la entrada de creación sintética de cada
// equipo (ya cargados en `items`). Ver useInventory.js para el porqué de
// las dos fuentes.
export async function gatherPeriodEntries(db, items, startDateStr, endDateStr) {
  const start = Timestamp.fromDate(new Date(`${startDateStr}T00:00:00`));
  const end   = Timestamp.fromDate(new Date(`${endDateStr}T23:59:59`));

  const itemsById = new Map(items.map(i => [i.id, i]));
  const entries = [];

  const snap = await getDocs(query(
    collectionGroup(db, 'historial'),
    where('timestamp', '>=', start),
    where('timestamp', '<=', end),
  ));
  snap.docs.forEach(d => {
    const equipoId = d.ref.parent.parent.id;
    const equipo = itemsById.get(equipoId);
    entries.push({ ...d.data(), equipoNombre: equipo?.nombre, equipoInv: equipo?.numeroInventario });
  });

  items.forEach(item => {
    (item.history ?? []).forEach(h => {
      if (h.timestamp && h.timestamp.toMillis() >= start.toMillis() && h.timestamp.toMillis() <= end.toMillis()) {
        entries.push({ ...h, equipoNombre: item.nombre, equipoInv: item.numeroInventario });
      }
    });
    if (item.createdAt && item.createdAt.toMillis() >= start.toMillis() && item.createdAt.toMillis() <= end.toMillis()) {
      entries.push({
        timestamp: item.createdAt,
        user: item.addedByEmail ?? '—',
        action: 'Equipo creado en el inventario.',
        equipoNombre: item.nombre,
        equipoInv: item.numeroInventario,
      });
    }
  });

  return entries;
}
