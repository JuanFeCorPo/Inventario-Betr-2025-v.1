import { useState } from 'react';
import { AlertTriangle, Clock, X, BellRing } from 'lucide-react';

const AlertsBanner = ({ alerts, onGoTo }) => {
  const [dismissed, setDismissed] = useState(new Set());
  const visible = alerts.filter(a => !dismissed.has(a.id));

  if (visible.length === 0) return null;

  const dismiss = (id) => setDismissed(prev => new Set(prev).add(id));

  return (
    <div className="bg-white border border-brand-border rounded-2xl p-4 mb-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <BellRing size={15} className="text-brand-orange" />
        <p className="text-sm font-semibold text-brand-ink">Alertas del inventario</p>
      </div>
      <div className="space-y-2">
        {visible.map(alert => {
          const isHigh = alert.severity === 'high';
          const clickable = !!alert.filterCategory;
          return (
            <div key={alert.id}
              className={`flex items-start gap-3 rounded-xl p-3 border ${isHigh ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
              {isHigh
                ? <AlertTriangle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
                : <Clock size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              }
              <p className={`text-sm flex-1 ${isHigh ? 'text-rose-700' : 'text-amber-800'}`}>
                {alert.message}
                {clickable && (
                  <button onClick={() => onGoTo(alert)} className="ml-2 font-semibold underline hover:no-underline">
                    Ver
                  </button>
                )}
              </p>
              <button onClick={() => dismiss(alert.id)} aria-label="Descartar alerta"
                className={`flex-shrink-0 ${isHigh ? 'text-rose-400 hover:text-rose-600' : 'text-amber-500 hover:text-amber-700'}`}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AlertsBanner;
