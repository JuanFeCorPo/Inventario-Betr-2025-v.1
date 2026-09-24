import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { getAgeBuckets } from '../utils/equipmentAge';

// ── Distribución de equipos activos por antigüedad (fechaIngreso) ──
// Reemplaza la dona por categoría: esa información ya vivía en el filtro
// de categoría, mientras que la antigüedad no se veía en ningún lado y
// ayuda a planear renovación/presupuesto.
const EquipmentAgeChart = ({ items }) => {
  const [mounted, setMounted] = useState(false);
  const { buckets, total } = useMemo(() => getAgeBuckets(items), [items]);
  const max = useMemo(() => Math.max(...buckets.map(b => b.count), 1), [buckets]);

  useEffect(() => {
    setMounted(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    return () => cancelAnimationFrame(id);
  }, [buckets.length]);

  return (
    <div className="bg-white border border-brand-border rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={15} className="text-brand-orange" />
        <p className="text-sm font-semibold text-brand-ink">Antigüedad del Parque</p>
      </div>

      {total === 0 ? (
        <p className="text-center text-sm text-brand-gray italic py-6">Sin equipos activos para mostrar.</p>
      ) : (
        <>
          <p className="text-xs text-brand-gray mb-4">{total} equipo{total !== 1 ? 's' : ''} activos</p>
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
                      width: mounted ? `${(b.count / max) * 100}%` : '0%',
                      backgroundColor: b.color,
                      transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
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
