// ─────────────────────────────────────────────
//  src/components/ui/index.jsx
//  Átomos con paleta de marca Betrmedia
// ─────────────────────────────────────────────

import { useRef, useEffect } from 'react';
import { X, ChevronDown, Sparkles } from 'lucide-react';
import { ESTADO_STYLES, STATUS_DOT } from '../../config/constants';
import { usePresence, useEscape, usePopover, useScrollLock } from '../../hooks/usePopover';
import { fieldClass } from './fieldClasses';
import useWasLoading from '../../hooks/useWasLoading';

// ── Spinner de carga ─────────────────────────
export const Spinner = ({ size = 'md', tone = 'brand' }) => {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  const tones = { brand: 'border-brand-orange/30 border-t-brand-orange', light: 'border-white/30 border-t-white', dark: 'border-brand-cocoa/25 border-t-brand-cocoa' };
  return <span role="status" aria-label="Cargando" className={`inline-block border-2 rounded-full animate-spin ${sizes[size]} ${tones[tone]}`} />;
};

// ── Modal base ───────────────────────────────
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const mounted = usePresence(isOpen, 150);
  const panelRef = useRef(null);
  useEscape(isOpen, onClose);
  useScrollLock(isOpen);

  // Al abrir: foco dentro del panel (salvo que un campo ya lo tomó con autoFocus).
  // Al cerrar: vuelve a quien lo abrió.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.activeElement;
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, [isOpen]);

  // Tab no se escapa del modal hacia la página de fondo
  const trapTab = (e) => {
    if (e.key !== 'Tab') return;
    const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)];
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  };

  if (!mounted) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' };
  return (
    <div data-state={isOpen ? 'open' : 'closed'}
      className="modal-overlay fixed inset-0 bg-brand-ink/50 backdrop-blur-sm flex justify-center items-center z-50 p-4 sm:p-8">
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onKeyDown={trapTab}
        className={`modal-panel bg-white rounded-2xl shadow-2xl p-5 sm:p-8 w-full ${sizes[size]} max-h-[85vh] overflow-y-auto relative outline-none`}>
        <button onClick={onClose} aria-label="Cerrar"
          className="absolute top-4 right-4 text-brand-gray hover:text-brand-ink transition-colors p-1 rounded-lg hover:bg-brand-bg">
          <X size={20} />
        </button>
        <h2 className="text-xl font-bold mb-6 pr-8 text-brand-ink">{title}</h2>
        {children}
      </div>
    </div>
  );
};

// ── Campo de formulario: etiqueta visible, ayuda y error ─────────────
// La etiqueta envuelve al control, así queda asociada sin necesidad de ids.
// Un asterisco marca los obligatorios; el error se anuncia a lectores de pantalla.
export const Field = ({ label, required = false, hint, error, className = '', children }) => (
  <label className={`block ${className}`}>
    <span className="text-xs font-semibold text-brand-slate mb-1.5 block">
      {label}
      {required && (<><span className="text-rose-600 ml-0.5" aria-hidden="true">*</span><span className="sr-only"> (obligatorio)</span></>)}
    </span>
    {children}
    {hint && !error && <span className="text-xs text-brand-gray mt-1.5 block">{hint}</span>}
    {error && <span role="alert" className="text-xs text-rose-700 mt-1.5 block">{error}</span>}
  </label>
);

// ── Error de un formulario o acción (se anuncia al aparecer) ──
export const FormError = ({ children, className = '' }) => (
  children ? (
    <p role="alert" className={`text-rose-700 text-xs bg-rose-50 border border-rose-200 rounded-lg py-2 px-3 animate-reveal ${className}`}>
      {children}
    </p>
  ) : null
);

// ── Barra de acciones del formulario: siempre a la vista al desplazar ──
export const FormActions = ({ children, error }) => (
  <div data-form-actions className="sticky bottom-0 -mx-5 sm:-mx-8 mt-6 px-5 sm:px-8 py-4 bg-white border-t border-brand-border rounded-b-2xl">
    {error && <FormError className="mb-3">{error}</FormError>}
    <div className="flex justify-end gap-3">{children}</div>
  </div>
);

// ── Estado vacío ─────────────────────────────
export const EmptyState = ({ icon, title, action }) => (
  <div className="flex flex-col items-center gap-3 py-16 px-4 text-center">
    {icon && <span className="text-brand-gray/50">{icon}</span>}
    <p className="text-sm text-brand-gray">{title}</p>
    {action}
  </div>
);

// ── Badge de estado ──────────────────────────
export const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${ESTADO_STYLES[status] ?? 'bg-gray-100 text-gray-500'}`}>
    {status}
  </span>
);

// ── Estado como punto + texto (listas largas: pesa menos que la insignia) ──
export const StatusDot = ({ status, withLabel = true }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={withLabel ? undefined : status}>
    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[status] ?? 'bg-gray-300'}`} />
    {withLabel && <span className="text-xs text-brand-slate">{status}</span>}
  </span>
);

// ── Barra segmentada con la proporción de cada estado ──
export const StatusBar = ({ counts, className = '' }) => (
  <div className={`flex h-2 rounded-full overflow-hidden bg-brand-bg gap-0.5 ${className}`}
    title={counts.map(([s, n]) => `${s}: ${n}`).join(' · ')}>
    {/* ancho mínimo: un estado raro (1 de 167) siempre se ve */}
    {counts.map(([s, n]) => <span key={s} className={`${STATUS_DOT[s]} min-w-[4px]`} style={{ flexGrow: n }} />)}
  </div>
);

// ── Placeholder de carga (reemplaza al número o al contenido hasta que llega el dato) ──
export const Skeleton = ({ className = '' }) => <span aria-hidden="true" className={`skeleton block ${className}`} />;

// ── Persona encargada: iniciales + nombre ──
export const Initials = ({ name }) => {
  if (!name) {
    return <span className="italic text-xs text-brand-gray">Sin asignar</span>;
  }
  const words = name.split(' ').filter(Boolean);
  const ini = (words.length > 1 ? words.slice(0, 2).map(w => w[0]).join('') : name.trim().slice(0, 2)).toUpperCase();
  return (
    <span className="flex items-center gap-2 min-w-0 max-w-full" title={name}>
      <span className="w-6 h-6 rounded-full bg-brand-ink/5 text-brand-ink text-xs font-semibold flex items-center justify-center flex-shrink-0">{ini}</span>
      <span className="text-sm text-brand-slate truncate">{name}</span>
    </span>
  );
};

// ── Badge "Nuevo" — equipo nunca antes asignado ──
export const NewBadge = () => (
  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap bg-brand-orange/10 text-brand-ember border border-brand-orange/25">
    <Sparkles size={10} /> Nuevo
  </span>
);

// ── Tarjeta de estadística ───────────────────
export const StatCard = ({ title, value, icon, accent, onClick, active = false, loading = false }) => {
  const venciaCarga = useWasLoading(loading);
  return (
    <button onClick={onClick} title={title} aria-pressed={active} aria-busy={loading}
      className={`press-soft group w-full text-left bg-white border p-3 sm:p-5 rounded-2xl flex items-center gap-3 sm:gap-4 shadow-card hover:shadow-card-hover transition duration-200 hover:border-brand-orange/40 focus:outline-none focus:ring-2 focus:ring-brand-orange/40
        ${active ? 'border-brand-orange/70 ring-1 ring-brand-orange/30' : 'border-brand-border'}`}>
      <div className={`p-3 rounded-xl ${accent} flex-shrink-0 transition-transform duration-200 group-hover:scale-105`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-brand-gray text-xs font-medium truncate">{title}</p>
        {loading
          ? <Skeleton className="h-6 sm:h-7 w-12 mt-1" />
          : <p className={`text-brand-ink text-xl sm:text-2xl font-bold leading-none mt-0.5 tabular-nums ${venciaCarga ? 'animate-content-in' : ''}`}>{value}</p>}
      </div>
    </button>
  );
};

// ── Input estilizado ─────────────────────────
export const Input = ({ className = '', ...props }) => (
  <input className={`${fieldClass} ${className}`} {...props} />
);

// ── Select estilizado ────────────────────────
export const Select = ({ children, className = '', ...props }) => (
  <select className={`${fieldClass} ${className}`} {...props}>
    {children}
  </select>
);

// ── Textarea estilizado ──────────────────────
export const Textarea = ({ className = '', ...props }) => (
  <textarea className={`${fieldClass} resize-none ${className}`} {...props} />
);

// ── Botones ──────────────────────────────────
export const Button = ({ variant = 'primary', size = 'md', className = '', children, ...props }) => {
  const variants = {
    primary:   'bg-brand-orange hover:bg-brand-amber text-brand-cocoa font-semibold shadow-md hover:shadow-brand-orange/30',
    secondary: 'bg-brand-bg hover:bg-brand-border text-brand-slate border border-brand-border',
    outline:   'bg-white hover:bg-brand-bg text-brand-slate border border-brand-border shadow-sm',
    danger:    'bg-rose-600 hover:bg-rose-700 text-white font-semibold',
    dangerGhost: 'text-rose-600 hover:bg-rose-50 font-medium',
    warning:   'bg-brand-amber hover:bg-brand-orange text-brand-cocoa font-semibold',
    ghost:     'text-brand-slate hover:text-brand-ink hover:bg-brand-bg',
  };
  const sizes = { md: 'px-5 py-2.5', sm: 'px-3 py-2 text-xs' };
  return (
    <button className={`${sizes[size]} rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

// ── Dropdown custom ──────────────────────────
export const Dropdown = ({ value, onChange, options, label: prefix }) => {
  const { open, setOpen, ref, shown } = usePopover();

  const selected = options.find(o => (o.value ?? o) === value);
  const label = selected?.label ?? selected ?? value;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(p => !p)} aria-expanded={open} aria-label={prefix ? `${prefix}: ${label}` : undefined}
        className="flex items-center justify-between gap-3 min-w-[160px] bg-brand-bg border border-brand-border hover:border-brand-orange/50 text-brand-ink text-sm px-4 py-2.5 rounded-xl transition focus:outline-none focus:ring-2 focus:ring-brand-orange/40">
        <span className="truncate">{prefix && <span className="text-brand-gray">{prefix}: </span>}{label}</span>
        <ChevronDown size={14} className={`text-brand-gray transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {shown && (
        <div className={`absolute z-50 mt-2 w-full min-w-[180px] bg-white border border-brand-border rounded-xl shadow-xl shadow-brand-ink/10 overflow-hidden ${open ? 'animate-pop-in-left' : 'animate-pop-out-left'}`}>
          {options.map(opt => {
            const val = opt.value ?? opt;
            const lbl = opt.label ?? opt;
            const isActive = val === value;
            return (
              <button key={val} type="button"
                onClick={() => { onChange(val); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2
                  ${isActive
                    ? 'bg-brand-orange/10 text-brand-ember font-semibold'
                    : 'text-brand-ink hover:bg-brand-bg'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-brand-orange' : 'opacity-0'}`} />
                {lbl}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Aviso de resultado con acción opcional (ver hooks/useToast) ──
// Entra y sale con el mismo cuidado: al cerrarse conserva su contenido mientras se desvanece.
export const ToastHost = ({ toast, onDismiss }) => {
  const ultimo = useRef(toast);
  if (toast) ultimo.current = toast;
  const visible = usePresence(!!toast, 140);
  const t = toast ?? ultimo.current;
  if (!visible || !t) return null;
  return (
    <div className="fixed bottom-4 inset-x-0 z-[60] flex justify-center px-4 pointer-events-none">
      <div key={t.id} role="status" aria-live="polite"
        className={`pointer-events-auto flex items-center gap-1 bg-brand-ink text-white text-sm pl-4 pr-1.5 py-1.5 rounded-xl shadow-xl max-w-full ${toast ? 'animate-reveal' : 'animate-toast-out'}`}>
        <span className="py-1.5 pr-2 min-w-0 truncate">{t.message}</span>
        {t.action && (
          <button type="button" onClick={() => { t.action.onClick(); onDismiss(); }}
            className="text-brand-yellow font-semibold px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
            {t.action.label}
          </button>
        )}
        <button type="button" onClick={onDismiss} aria-label="Cerrar aviso"
          className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
