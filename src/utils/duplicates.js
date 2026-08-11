// ─────────────────────────────────────────────
//  src/utils/duplicates.js
//  Detección de seriales / números de inventario repetidos.
// ─────────────────────────────────────────────

const clean = (value) => (value ?? '').toString().trim();

const CAMPOS_UNICOS = [
  { field: 'numeroInventario', label: 'número de inventario' },
  { field: 'numeroSerial',     label: 'número de serial' },
];

// Devuelve todos los choques encontrados: [{ field, label, value, item }].
//
// Se revisa siempre, incluso si el valor no cambió, para que un duplicado que
// ya venía en los datos salga a la luz en vez de quedarse escondido. La
// búsqueda recorre todos los equipos, incluidos los dados de baja — que son
// justo los que no aparecen en el listado con el filtro en "Activos".
export function findDuplicateConflicts(items = [], currentItem, values = {}) {
  const conflicts = [];

  for (const { field, label } of CAMPOS_UNICOS) {
    const value = clean(values[field]);
    if (!value) continue;

    const match = items.find(i =>
      i.id !== currentItem?.id &&
      clean(i[field]).toLowerCase() === value.toLowerCase()
    );
    if (match) conflicts.push({ field, label, value, item: match });
  }

  return conflicts;
}
