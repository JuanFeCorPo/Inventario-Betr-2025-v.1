import { useState, useRef, useEffect, useCallback } from 'react';

// Aviso breve de resultado ("Equipo guardado"), con una acción opcional (Deshacer).
const useToast = () => {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((message, { action, ms = 5000 } = {}) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, action });
    timer.current = setTimeout(() => setToast(null), ms);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, show, dismiss };
};

export default useToast;
