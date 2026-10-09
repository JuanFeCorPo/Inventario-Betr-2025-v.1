import { useMemo } from 'react';
import { Package } from 'lucide-react';
import { StatusBar } from './ui';
import { CATEGORY_ICONS } from '../config/categoryIcons';
import { STATUS_DOT } from '../config/constants';
import { groupByCategory, statusCounts } from '../utils/inventoryGroups';

// Primer nivel del inventario: una tarjeta por categoría con su total y la salud
// de sus equipos. Elegir una equivale a filtrar por esa categoría.
const CategoryMosaic = ({ items, onSelect, onShowAll }) => {
  const groups = useMemo(() => groupByCategory(items), [items]);

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2 px-1">
        <p className="text-xs text-brand-gray tabular-nums">
          {groups.length} categoría{groups.length !== 1 ? 's' : ''} · {items.length} equipo{items.length !== 1 ? 's' : ''}
        </p>
        <button type="button" onClick={onShowAll} className="text-xs font-medium text-brand-orange hover:underline">
          Ver lista completa
        </button>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))' }}>
        {groups.map(({ categoria, rows }) => {
          const counts = statusCounts(rows);
          const Icon = CATEGORY_ICONS[categoria] ?? Package;
          return (
            <button key={categoria} type="button" onClick={() => onSelect(categoria)}
              className="group text-left bg-white border border-brand-border rounded-2xl p-4 shadow-sm hover:border-brand-orange/40 hover:shadow-md transition flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="w-9 h-9 rounded-xl bg-brand-bg text-brand-slate group-hover:bg-brand-orange/10 group-hover:text-brand-orange flex items-center justify-center transition-colors">
                  <Icon size={17} />
                </span>
                <span className="text-2xl font-bold text-brand-ink tabular-nums leading-none">{rows.length}</span>
              </div>
              <p className="font-semibold text-sm text-brand-ink truncate">{categoria}</p>
              <StatusBar counts={counts} />
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {counts.map(([s, n]) => (
                  <span key={s} className="inline-flex items-center gap-1 text-xs text-brand-slate tabular-nums" title={s}>
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} />{n}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryMosaic;
