import { useMemo } from 'react';
import { Wrench, ChevronRight } from 'lucide-react';
import { getUpcomingMaintenance } from '../utils/maintenance';

const URGENCIA_DOT = {
  'vencido':     'bg-rose-500',
  'esta-semana': 'bg-amber-500',
  'este-mes':    'bg-violet-500',
  'proximo':     'bg-emerald-500',
};

const formatDiasRestantes = (dias) => {
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} d`;
  if (dias === 0) return 'Hoy';
  return `En ${dias} d`;
};

// ── Adelanto de los próximos mantenimientos preventivos en el dashboard ──
// Evita tener que entrar a la pantalla de Mantenimientos solo para ver
// qué sigue; "Ver todos" lleva a la pantalla completa para registrar.
const UpcomingMaintenanceCard = ({ items, onNavigate }) => {
  const upcoming = useMemo(() => getUpcomingMaintenance(items, 5), [items]);

  return (
    <div className="bg-white border border-brand-border rounded-2xl p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Wrench size={15} className="text-brand-orange" />
          <p className="text-sm font-semibold text-brand-ink">Próximos Mantenimientos</p>
        </div>
        <button onClick={() => onNavigate('maintenance')}
          className="text-xs text-brand-orange font-medium hover:underline flex items-center gap-0.5 flex-shrink-0">
          Ver todos <ChevronRight size={12} />
        </button>
      </div>

      {upcoming.length === 0 ? (
        <p className="text-center text-sm text-brand-gray italic py-4">Sin mantenimientos pendientes.</p>
      ) : (
        <ul className="space-y-2.5">
          {upcoming.map(({ item, info }) => (
            <li key={item.id} className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${URGENCIA_DOT[info.urgencia]}`} />
              <span className="text-xs text-brand-slate truncate flex-1">{item.nombre}</span>
              <span className="text-xs font-medium text-brand-ink flex-shrink-0">{formatDiasRestantes(info.diasRestantes)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UpcomingMaintenanceCard;
