import { AlertTriangle, Clock, X, Bell, MessageSquareWarning } from 'lucide-react';
import { usePopover } from '../hooks/usePopover';

// Avisos: todo lo que pide atención en un solo lugar (solicitudes + inventario).
// `alerts` ya viene filtrada por el padre (sin las descartadas en los últimos
// 15 días). Las de solicitudes no se pueden descartar: se van al atenderlas.
const AlertsBell = ({ alerts, onGoTo, onDismiss, botonClassName = 'w-10 h-10 vidrio text-brand-slate shadow-sm hover:shadow-md' }) => {
  const { open, setOpen, ref, shown } = usePopover();

  if (alerts.length === 0) return null;
  const etiqueta = `Avisos: ${alerts.length} ${alerts.length === 1 ? 'pide' : 'piden'} atención`;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(p => !p)} aria-label={etiqueta} title="Avisos" aria-expanded={open} aria-haspopup="true"
        className={`relative flex items-center justify-center rounded-xl transition ${botonClassName}`}>
        <Bell size={16} aria-hidden="true" />
        <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[11px] font-bold rounded-full bg-brand-orange text-brand-cocoa">
          {alerts.length}
        </span>
      </button>

      {shown && (
        <div role="dialog" aria-label="Avisos" className={`fixed inset-x-4 top-20 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-96 z-50 bg-white border border-brand-border rounded-2xl shadow-xl shadow-brand-ink/10 overflow-hidden ${open ? 'animate-pop-in' : 'animate-pop-out'}`}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-border bg-brand-bg/50">
            <Bell size={14} className="text-brand-ember" aria-hidden="true" />
            <p className="text-sm font-semibold text-brand-ink">Avisos</p>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto p-2 space-y-2">
            {alerts.map(alert => {
              const isHigh = alert.severity === 'high';
              const esTicket = alert.tipo === 'solicitudes';
              const clickable = !!alert.filterCategory || !!alert.navigateTo;
              const Icon = esTicket ? MessageSquareWarning : isHigh ? AlertTriangle : Clock;
              return (
                <li key={alert.id}
                  className={`flex items-start gap-3 rounded-xl p-3 border ${isHigh ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
                  <Icon size={16} className={`flex-shrink-0 mt-0.5 ${isHigh ? 'text-rose-600' : 'text-amber-700'}`} aria-hidden="true" />
                  <p className={`text-sm flex-1 ${isHigh ? 'text-rose-700' : 'text-amber-800'}`}>
                    {alert.message}
                    {clickable && (
                      <button onClick={() => { onGoTo(alert); setOpen(false); }} className="ml-2 font-semibold underline hover:no-underline">
                        Ver
                      </button>
                    )}
                  </p>
                  {!alert.noDescartable && (
                    <button onClick={() => onDismiss(alert.id)} aria-label="Descartar aviso por 15 días" title="Descartar por 15 días"
                      className={`flex-shrink-0 w-6 h-6 -m-1 flex items-center justify-center rounded-md ${isHigh ? 'text-rose-400 hover:text-rose-600' : 'text-amber-600 hover:text-amber-800'}`}>
                      <X size={14} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AlertsBell;
