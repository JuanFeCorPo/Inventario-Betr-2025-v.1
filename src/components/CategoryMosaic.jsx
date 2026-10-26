import { useEffect, useMemo, useRef } from 'react';
import { Package, List } from 'lucide-react';
import { Button, StatusBar, StatusDot, Skeleton } from './ui';
import { CATEGORY_ICONS } from '../config/categoryIcons';
import { STATUS_DOT } from '../config/constants';
import { groupByCategory, statusCounts } from '../utils/inventoryGroups';

// Estados que piden acción: en cada tarjeta se escriben con letra ("7 fuera de servicio"),
// no solo como franja de color. Lo normal (Disponible, En uso) queda como punto y número.
const ATENCION = {
  'Fuera de Servicio': { texto: 'fuera de servicio', clase: 'text-rose-700' },
  'En Mantenimiento':  { texto: 'en mantenimiento',  clase: 'text-violet-700' },
};

const LEYENDA = ['Disponible', 'En Uso', 'En Mantenimiento', 'Fuera de Servicio'];

const GRID = { gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))' };

// La entrada escalonada solo ocurre la primera vez que se ve el mosaico en la sesión:
// volver desde una categoría es una acción de decenas de veces al día y no debe animarse.
let yaAnimado = false;

// Mientras llegan los datos: tarjetas fantasma con la misma forma que las reales
const MosaicoCargando = () => (
  <div aria-busy="true" aria-label="Cargando categorías">
    <div className="flex items-center justify-between gap-3 mb-2 px-1">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="h-8 w-36 rounded-xl" />
    </div>
    <div className="flex gap-4 mb-3 px-1">
      {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-3 w-20" />)}
    </div>
    <div className="grid gap-3" style={GRID}>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="bg-white border border-brand-border rounded-2xl p-4 shadow-card flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="h-3.5 w-24" />
          </div>
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  </div>
);

// Primer nivel del inventario: una tarjeta por categoría con su total y la salud
// de sus equipos. Elegir una equivale a filtrar por esa categoría.
const CategoryMosaic = ({ items = [], onSelect, onShowAll, actions, loading = false }) => {
  const groups = useMemo(() => groupByCategory(items), [items]);
  const animar = useRef(!yaAnimado).current;

  useEffect(() => { if (!loading) yaAnimado = true; }, [loading]);

  if (loading) return <MosaicoCargando />;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2 px-1">
        <p className="text-xs text-brand-gray tabular-nums">
          {groups.length} categoría{groups.length !== 1 ? 's' : ''} · {items.length} equipo{items.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-1">
          {actions}
          {actions && <span className="hidden sm:block w-px h-5 bg-brand-border mx-1.5" aria-hidden="true" />}
          <Button variant="outline" size="sm" onClick={onShowAll} className="flex items-center gap-1.5">
            <List size={13} /> Ver lista completa
          </Button>
        </div>
      </div>

      {/* Leyenda: el color nunca es la única pista */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 px-1" aria-label="Significado de los colores">
        {LEYENDA.map(s => <StatusDot key={s} status={s} />)}
      </div>

      <div className="grid gap-3" style={GRID}>
        {groups.map(({ categoria, rows }, i) => {
          const counts = statusCounts(rows);
          const Icon = CATEGORY_ICONS[categoria] ?? Package;
          return (
            <button key={categoria} type="button" onClick={() => onSelect(categoria)}
              style={animar ? { animationDelay: `${Math.min(i, 8) * 30}ms` } : undefined}
              className={`press-soft group text-left bg-white border border-brand-border rounded-2xl p-4 shadow-card hover:shadow-card-hover hover:border-brand-orange/40 transition flex flex-col gap-3 ${animar ? 'animate-reveal' : ''}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-8 h-8 rounded-lg bg-brand-bg text-brand-slate group-hover:bg-brand-orange/10 group-hover:text-brand-ember flex items-center justify-center flex-shrink-0 transition-colors">
                  <Icon size={16} />
                </span>
                <p className="font-semibold text-sm text-brand-ink truncate">{categoria}</p>
              </div>
              <p className="text-3xl font-bold text-brand-ink tabular-nums leading-none">{rows.length}</p>
              <StatusBar counts={counts} />
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {counts.map(([s, n]) => {
                  const atencion = ATENCION[s];
                  return atencion ? (
                    <span key={s} className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${atencion.clase}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} />{n} {atencion.texto}
                    </span>
                  ) : (
                    <span key={s} className="inline-flex items-center gap-1 text-xs text-brand-slate tabular-nums" title={s}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s]}`} />{n}
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryMosaic;
