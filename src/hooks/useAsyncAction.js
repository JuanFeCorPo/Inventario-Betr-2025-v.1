import { useState, useRef, useCallback } from 'react';

// Ejecuta una acción de un formulario (guardar, dar de baja, eliminar…) con las
// tres garantías que antes faltaban: no se puede lanzar dos veces (doble clic o
// doble Enter), un fallo nunca deja el botón "trabajando" para siempre, y el
// error queda a la vista para mostrarlo dentro del modal.
const MENSAJE_POR_DEFECTO = 'No se pudo completar la acción. Revisa tu conexión e inténtalo de nuevo.';

const useAsyncAction = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);

  // Devuelve true si la acción terminó bien, false si falló o ya estaba en curso.
  const run = useCallback(async (action, mensaje = MENSAJE_POR_DEFECTO) => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      return true;
    } catch (err) {
      console.error(err);
      setError(mensaje);
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  const reset = useCallback(() => { setBusy(false); setError(''); running.current = false; }, []);

  return { busy, error, run, reset };
};

export default useAsyncAction;
