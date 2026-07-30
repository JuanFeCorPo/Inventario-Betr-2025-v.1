// ─────────────────────────────────────────────
//  src/components/ui/index.jsx
//  Átomos con paleta de marca Betrmedia
// ─────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { ESTADO_STYLES } from '../../config/constants';

// ── Modal base ───────────────────────────────
export const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 bg-brand-ink/50 backdrop-blur-sm flex justify-center items-center z-50 animate-modal-in p-4">
      <div className={`bg-white rounded-2xl shadow-2xl p-8 w-full ${sizes[size]} relative`}>
        <button onClick={onClose} aria-label="Cerrar"
          className="absolute top-4 right-4 text-brand-gray hover:text-brand-ink transition-colors p-1 rounded-lg hover:bg-brand-bg">
          <X size={20} />
        </button>
        <h2 className="text-xl font-bold mb-6 text-brand-ink">{title}</h2>
        {children}
      </div>
    </div>
  );
};

// ── Badge de estado ──────────────────────────
export const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${ESTADO_STYLES[status] ?? 'bg-gray-100 text-gray-500'}`}>
    {status}
  </span>
);

// ── Tarjeta de estadística ───────────────────
export const StatCard = ({ title, value, icon, accent, onClick }) => (
  <button onClick={onClick}
    className="group w-full text-left bg-white border border-brand-border p-3 sm:p-5 rounded-2xl flex items-center gap-3 sm:gap-4 transition-all duration-200 hover:border-brand-orange/40 hover:shadow-md hover:shadow-brand-orange/10 focus:outline-none focus:ring-2 focus:ring-brand-orange/40">
    <div className={`p-3 rounded-xl ${accent} flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-brand-gray text-xs font-medium truncate">{title}</p>
      <p className="text-brand-ink text-xl sm:text-2xl font-bold leading-none mt-0.5">{value}</p>
    </div>
  </button>
);

// ── Input estilizado ─────────────────────────
export const Input = ({ className = '', ...props }) => (
  <input
    className={`w-full bg-brand-bg border border-brand-border text-brand-ink placeholder-brand-gray p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/40 transition-all ${className}`}
    {...props}
  />
);

// ── Select estilizado ────────────────────────
export const Select = ({ children, className = '', ...props }) => (
  <select
    className={`bg-brand-bg border border-brand-border text-brand-ink p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all ${className}`}
    {...props}
  >
    {children}
  </select>
);

// ── Textarea estilizado ──────────────────────
export const Textarea = ({ className = '', ...props }) => (
  <textarea
    className={`w-full bg-brand-bg border border-brand-border text-brand-ink placeholder-brand-gray p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all resize-none ${className}`}
    {...props}
  />
);

// ── Botones ──────────────────────────────────
export const Button = ({ variant = 'primary', className = '', children, ...props }) => {
  const variants = {
    primary:   'bg-brand-orange hover:bg-brand-amber text-white font-semibold shadow-md hover:shadow-brand-orange/30',
    secondary: 'bg-brand-bg hover:bg-brand-border text-brand-slate border border-brand-border',
    danger:    'bg-rose-500 hover:bg-rose-600 text-white font-semibold',
    warning:   'bg-brand-amber hover:bg-brand-orange text-white font-semibold',
    ghost:     'text-brand-slate hover:text-brand-ink hover:bg-brand-bg',
  };
  return (
    <button className={`px-5 py-2.5 rounded-xl transition-all duration-200 ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

// ── Dropdown custom ──────────────────────────
export const Dropdown = ({ value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => (o.value ?? o) === value);
  const label = selected?.label ?? selected ?? value;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="flex items-center justify-between gap-3 min-w-[160px] bg-brand-bg border border-brand-border hover:border-brand-orange/50 text-brand-ink text-sm px-4 py-2.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-brand-orange/40">
        <span>{label}</span>
        <ChevronDown size={14} className={`text-brand-gray transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full min-w-[180px] bg-white border border-brand-border rounded-xl shadow-xl shadow-brand-ink/10 overflow-hidden animate-modal-in">
          {options.map(opt => {
            const val = opt.value ?? opt;
            const lbl = opt.label ?? opt;
            const isActive = val === value;
            return (
              <button key={val} type="button"
                onClick={() => { onChange(val); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2
                  ${isActive
                    ? 'bg-brand-orange/10 text-brand-orange font-semibold'
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
