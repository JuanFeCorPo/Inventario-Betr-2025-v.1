import { useState, useRef, useEffect } from 'react';
import { AlertTriangle, Clock, X, Bell } from 'lucide-react';

// `alerts` ya viene filtrada por el padre (sin las descartadas en los
// últimos 15 días) — ver useDismissedAlerts / utils/dismissedAlerts.
// Vive como icono en el header en vez de un banner fijo: menos invasivo,
// se revisa solo cuando el usuario quiere.
const AlertsBell = ({ alerts, onGoTo, onDismiss }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (alerts.length === 0) return null;
  const hasHigh = alerts.some(a => a.severity === 'high');

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(p => !p)} aria-label="Alertas del inventario" title="Alertas del inventario"
        className="relative p-2.5 bg-white hover:bg-brand-bg border border-brand-border text-brand-slate rounded-full transition-all shadow-sm hover:shadow-md">
        <Bell size={16} />
        <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white rounded-full ${hasHigh ? 'bg-rose-500' : 'bg-amber-500'}`}>
          {alerts.length}
        </span>
      </button>

      {open && (
        <div className="fixed inset-x-4 top-20 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-80 z-50 bg-white border border-brand-border rounded-2xl shadow-xl shadow-brand-ink/10 overflow-hidden animate-modal-in">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-border bg-brand-bg/50">
            <Bell size={14} className="text-brand-orange" />
            <p className="text-sm font-semibold text-brand-ink">Alertas del inventario</p>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2 space-y-2">
            {alerts.map(alert => {
              const isHigh = alert.severity === 'high';
              const clickable = !!alert.filterCategory || !!alert.navigateTo;
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
                      <button onClick={() => { onGoTo(alert); setOpen(false); }} className="ml-2 font-semibold underline hover:no-underline">
                        Ver
                      </button>
                    )}
                  </p>
                  <button onClick={() => onDismiss(alert.id)} aria-label="Descartar alerta"
                    className={`flex-shrink-0 ${isHigh ? 'text-rose-400 hover:text-rose-600' : 'text-amber-500 hover:text-amber-700'}`}>
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsBell;
