import { useEffect, useMemo, useState } from 'react';
import { PieChart } from 'lucide-react';

// Paleta categórica validada (8 tonos, orden fijo — ver dataviz skill / palette.md).
// "Otros" no es una categoría real, así que usa un gris neutro fuera de la paleta.
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7'];
const OTROS_COLOR = '#898781';

const SIZE   = 168;
const STROKE = 26;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC   = 2 * Math.PI * RADIUS;

// ── Distribución de equipos activos por categoría (dona animada) ──
const CategoryChart = ({ items, onSelectCategory }) => {
  const [mounted, setMounted] = useState(false);

  const { slices, total } = useMemo(() => {
    const counts = {};
    items.forEach(i => {
      if (i.estado === 'De Baja') return;
      counts[i.categoria] = (counts[i.categoria] ?? 0) + 1;
    });
    const rows = Object.entries(counts).map(([categoria, count]) => ({ categoria, count }));
    rows.sort((a, b) => b.count - a.count);

    const top  = rows.slice(0, 7);
    const rest = rows.slice(7);
    const restTotal = rest.reduce((sum, r) => sum + r.count, 0);
    const total = rows.reduce((sum, r) => sum + r.count, 0);

    const slices = top.map((r, i) => ({ ...r, color: PALETTE[i] }));
    if (restTotal > 0) slices.push({ categoria: 'Otras categorías', count: restTotal, color: OTROS_COLOR, isOther: true });

    return { slices, total };
  }, [items]);

  // Animación de entrada: se dispara cada vez que este panel vuelve a montarse
  // (ej. al entrar al dashboard tras iniciar sesión o volver de la pantalla de Usuarios).
  useEffect(() => {
    setMounted(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    return () => cancelAnimationFrame(id);
  }, [slices.length]);

  let acc = 0;

  return (
    <div className="bg-white border border-brand-border rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <PieChart size={15} className="text-brand-orange" />
        <p className="text-sm font-semibold text-brand-ink">Distribución por Categoría</p>
      </div>

      {total === 0 ? (
        <p className="text-center text-sm text-brand-gray italic py-6">Sin equipos activos para mostrar.</p>
      ) : (
        <div className="flex flex-col items-center gap-5">
          <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
              <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="#F0F2F4" strokeWidth={STROKE} />
              {slices.map((s) => {
                const frac       = s.count / total;
                const dash       = frac * CIRC;
                const dashOffset = -acc;
                acc += dash;
                return (
                  <circle key={s.categoria}
                    cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none"
                    stroke={s.color} strokeWidth={STROKE} strokeLinecap="butt"
                    strokeDasharray={mounted ? `${dash} ${CIRC - dash}` : `0 ${CIRC}`}
                    strokeDashoffset={dashOffset}
                    className="cursor-pointer hover:opacity-80"
                    style={{ transition: 'stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1)', transitionDelay: `${slices.indexOf(s) * 70}ms` }}
                    onClick={() => !s.isOther && onSelectCategory(s.categoria)}
                  >
                    <title>{`${s.categoria}: ${s.count} (${Math.round((s.count / total) * 100)}%)`}</title>
                  </circle>
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-2xl font-bold text-brand-ink leading-none">{total}</p>
              <p className="text-[10px] text-brand-gray mt-1">equipos</p>
            </div>
          </div>

          <div className="w-full space-y-1.5">
            {slices.map(s => (
              <button key={s.categoria} onClick={() => !s.isOther && onSelectCategory(s.categoria)}
                disabled={s.isOther}
                className="w-full flex items-center gap-2 text-left group disabled:cursor-default">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-xs text-brand-slate truncate flex-1 group-hover:text-brand-ink transition-colors">{s.categoria}</span>
                <span className="text-xs font-semibold text-brand-ink flex-shrink-0">{s.count}</span>
                <span className="text-[10px] text-brand-gray flex-shrink-0 w-8 text-right">{Math.round((s.count / total) * 100)}%</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryChart;
