import { useState, useRef, useEffect } from 'react';

// ── Presencia, Escape y menús desplegables ───
// Mantiene montado un elemento unos ms después de cerrarlo para que alcance
// a animar la salida (la salida es más corta que la entrada).
export const usePresence = (open, ms = 150) => {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) { setMounted(true); return undefined; }
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return open || mounted;
};

// Escape cierra solo lo que está más arriba (un modal sobre otro, un menú dentro de un modal).
const escapeStack = [];
export const useEscape = (active, onClose) => {
  const cb = useRef(onClose);
  cb.current = onClose;
  useEffect(() => {
    if (!active) return undefined;
    const entry = {};
    escapeStack.push(entry);
    const handler = (e) => {
      if (e.key === 'Escape' && escapeStack[escapeStack.length - 1] === entry) cb.current?.();
    };
    document.addEventListener('keydown', handler);
    return () => {
      escapeStack.splice(escapeStack.indexOf(entry), 1);
      document.removeEventListener('keydown', handler);
    };
  }, [active]);
};

// Bloquea el scroll de la página mientras haya algún modal abierto (cuenta modales apilados).
let scrollLocks = 0;
export const useScrollLock = (active) => {
  useEffect(() => {
    if (!active) return undefined;
    if (scrollLocks++ === 0) document.body.style.overflow = 'hidden';
    return () => {
      if (--scrollLocks === 0) document.body.style.overflow = '';
    };
  }, [active]);
};

// Menú desplegable: abrir/cerrar, clic fuera, Escape y salida animada.
export const usePopover = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);
  useEscape(open, () => setOpen(false));
  const shown = usePresence(open, 120);
  return { open, setOpen, ref, shown };
};
