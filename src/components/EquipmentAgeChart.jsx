import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { getAgeBuckets } from '../utils/equipmentAge';
import { Skeleton } from './ui';

// ── Distribución de equipos activos por antigüedad (fechaIngreso) ──
// Reemplaza la dona por categoría: esa información ya vivía en el filtro
// de categoría, mientras que la antigüedad no se veía en ningún lado y
// ayuda a planear renovación/presupuesto.
const EquipmentAgeChart = ({ items, loading = false }) => {
  const [mounted, setMounted] = useState(false);
  const { buckets, total } = useMemo(() => getAgeBuckets(items), [items]);
  const max = useMemo(() => Math.max(...buckets.map(b => b.count), 1), [buckets]);
  // El dato clave en una frase: qué parte del parque cae en el tramo más grande
  const dominante = useMemo(() => buckets.reduce((a, b) => (b.count > (a?.count ?? 0) ? b : a), null), [buckets]);

  useEffect(() => {
    setMounted(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    return () => cancelAnimationFrame(id);
  }, [buckets.length]);

  return (
    <div className="bg-white border border-brand-border rounded-2xl p-4 sm:p-5 shadow-card">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={15} className="text-brand-ember" />
        <p className="text-sm font-semibold text-brand-ink">Antigüedad del parque</p>
      </div>

      {loading ? (
        <div aria-busy="true" className="mt-3 space-y-4">
          <Skeleton className="h-3 w-48" />
          {[0, 1, 2].map(i => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : total === 0 ? (
        <p className="text-center text-sm text-brand-gray italic py-6">Sin equipos activos para mostrar.</p>
      ) : (
        <>
          <p className="text-xs text-brand-gray mb-4">
            {total} equipo{total !== 1 ? 's' : ''} activo{total !== 1 ? 's' : ''}
            {dominante && <> · el <span className="font-semibold text-brand-slate">{Math.round((dominante.count / total) * 100)} %</span> {dominante.frase}</>}
          </p>
          <div className="space-y-3">
            {buckets.map(b => (
              <div key={b.key} title={`${b.label}: ${b.count} equipo${b.count !== 1 ? 's' : ''} (${Math.round((b.count / total) * 100)}%)`}>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-xs text-brand-slate truncate">{b.label}</span>
                  <span className="text-xs font-semibold text-brand-ink flex-shrink-0">{b.count}</span>
                </div>
                <div className="h-2 bg-brand-bg rounded-full overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{
                      width: `${(b.count / max) * 100}%`,
                      backgroundColor: b.color,
                      transformOrigin: 'left',
                      transform: mounted ? 'scaleX(1)' : 'scaleX(0)',
                      transition: 'transform 0.5s cubic-bezier(0.23,1,0.32,1)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default EquipmentAgeChart;
