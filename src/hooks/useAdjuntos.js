// ─────────────────────────────────────────────
//  Archivos que la persona va a adjuntar a un mensaje o ticket: los prepara
//  (reduce las fotos, valida tipo y peso) y lleva la lista con su error.
//  El límite es de 5 MB por mensaje y 3 archivos (utils/adjuntos.js).
// ─────────────────────────────────────────────

import { useCallback, useRef, useState } from 'react';
import { prepararArchivo, errorDeConjunto } from '../utils/adjuntos';

const useAdjuntos = () => {
  const [archivos, setArchivos] = useState([]);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const actual = useRef([]);
  actual.current = archivos;

  const agregar = useCallback(async (lista) => {
    setError('');
    setProcesando(true);
    const nuevos = [];
    let aviso = '';
    for (const f of Array.from(lista ?? [])) {
      try { nuevos.push(await prepararArchivo(f)); } catch (e) { aviso = aviso || e.message; }
    }
    const unidos = [...actual.current, ...nuevos];
    const excede = errorDeConjunto(unidos);
    if (excede) setError(excede);
    else { setArchivos(unidos); setError(aviso); }
    setProcesando(false);
  }, []);

  const quitar = useCallback((id) => { setArchivos(prev => prev.filter(a => a.id !== id)); setError(''); }, []);
  const limpiar = useCallback(() => { setArchivos([]); setError(''); }, []);

  return { archivos, procesando, error, agregar, quitar, limpiar };
};

export default useAdjuntos;
