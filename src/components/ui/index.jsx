// ─────────────────────────────────────────────
//  src/components/ui/index.jsx
//  Átomos con paleta de marca Betrmedia
// ─────────────────────────────────────────────

import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { ESTADO_STYLES } from '../../config/constants';

// ── Modal base ───────────────────────────────
export const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  if (!isOpen) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 bg-[#1C2B35]/50 backdrop-blur-sm flex justify-center items-center z-50 animate-modal-in p-4">
      <div className={`bg-white rounded-2xl shadow-2xl p-8 w-full ${sizes[size]} relative`}>
        <button onClick={onClose}
          className="absolute top-4 right-4 text-[#8D8D8D] hover:text-[#1C2B35] transition-colors p-1 rounded-lg hover:bg-[#F0F2F4]">
          <X size={20} />
        </button>
        <h2 className="text-xl font-bold mb-6 text-[#1C2B35]">{title}</h2>
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
    className="group w-full text-left bg-white border border-[#E8EAED] p-3 sm:p-5 rounded-2xl flex items-center gap-3 sm:gap-4 transition-all duration-200 hover:border-[#E68E00]/40 hover:shadow-md hover:shadow-[#E68E00]/10 focus:outline-none focus:ring-2 focus:ring-[#E68E00]/40">
    <div className={`p-3 rounded-xl ${accent} flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[#8D8D8D] text-xs font-medium truncate">{title}</p>
      <p className="text-[#1C2B35] text-xl sm:text-2xl font-bold leading-none mt-0.5">{value}</p>
    </div>
  </button>
);

// ── Input estilizado ─────────────────────────
export const Input = ({ className = '', ...props }) => (
  <input
    className={`w-full bg-[#F0F2F4] border border-[#E8EAED] text-[#1C2B35] placeholder-[#8D8D8D] p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E68E00]/50 focus:border-[#E68E00]/40 transition-all ${className}`}
    {...props}
  />
);

// ── Select estilizado ────────────────────────
export const Select = ({ children, className = '', ...props }) => (
  <select
    className={`bg-[#F0F2F4] border border-[#E8EAED] text-[#1C2B35] p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E68E00]/50 transition-all ${className}`}
    {...props}
  >
    {children}
  </select>
);

// ── Textarea estilizado ──────────────────────
export const Textarea = ({ className = '', ...props }) => (
  <textarea
    className={`w-full bg-[#F0F2F4] border border-[#E8EAED] text-[#1C2B35] placeholder-[#8D8D8D] p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E68E00]/50 transition-all resize-none ${className}`}
    {...props}
  />
);

// ── Botones ──────────────────────────────────
export const Button = ({ variant = 'primary', className = '', children, ...props }) => {
  const variants = {
    primary:   'bg-[#E68E00] hover:bg-[#EDAA00] text-white font-semibold shadow-md hover:shadow-[#E68E00]/30',
    secondary: 'bg-[#F0F2F4] hover:bg-[#E8EAED] text-[#5E6A74] border border-[#E8EAED]',
    danger:    'bg-rose-500 hover:bg-rose-600 text-white font-semibold',
    warning:   'bg-[#EDAA00] hover:bg-[#E68E00] text-white font-semibold',
    ghost:     'text-[#5E6A74] hover:text-[#1C2B35] hover:bg-[#F0F2F4]',
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
        className="flex items-center justify-between gap-3 min-w-[160px] bg-[#F0F2F4] border border-[#E8EAED] hover:border-[#E68E00]/50 text-[#1C2B35] text-sm px-4 py-2.5 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-[#E68E00]/40">
        <span>{label}</span>
        <ChevronDown size={14} className={`text-[#8D8D8D] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full min-w-[180px] bg-white border border-[#E8EAED] rounded-xl shadow-xl shadow-[#1C2B35]/10 overflow-hidden animate-modal-in">
          {options.map(opt => {
            const val = opt.value ?? opt;
            const lbl = opt.label ?? opt;
            const isActive = val === value;
            return (
              <button key={val} type="button"
                onClick={() => { onChange(val); setOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-2
                  ${isActive
                    ? 'bg-[#E68E00]/10 text-[#E68E00] font-semibold'
                    : 'text-[#1C2B35] hover:bg-[#F0F2F4]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-[#E68E00]' : 'opacity-0'}`} />
                {lbl}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
