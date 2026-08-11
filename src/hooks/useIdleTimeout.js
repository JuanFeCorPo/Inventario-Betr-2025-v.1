// ─────────────────────────────────────────────
//  src/hooks/useIdleTimeout.js
//  Detecta inactividad y avisa `warningTime` antes de cerrar la sesión.
//
//  No se apoya en que setTimeout dispare a tiempo: el navegador ralentiza
//  o congela los timers de las pestañas en segundo plano, que es justo
//  cuando el usuario se ausenta — por eso antes el aviso a veces no salía.
//  En su lugar se guarda la hora del último movimiento y en cada tick se
//  compara contra la hora real del reloj.
// ─────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { getIdleState } from '../utils/idle';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
const TICK_MS = 1_000;

const useIdleTimeout = (onIdle, user, idleTime = 900_000, warningTime = 20_000) => {
  const lastActivityRef = useRef(Date.now());
  const onIdleRef       = useRef(onIdle);
  const firedRef        = useRef(false);
  const [state, setState] = useState({ expired: false, countdown: Math.ceil(warningTime / 1000) });

  // El callback vive en una ref: así, cuando la app se vuelve a renderizar y
  // recrea la función, no se reinicia el temporizador a mitad de la cuenta.
  useEffect(() => { onIdleRef.current = onIdle; }, [onIdle]);

  useEffect(() => {
    if (!user) return;

    lastActivityRef.current = Date.now();
    firedRef.current = false;

    const markActivity = () => {
      if (firedRef.current) return;
      lastActivityRef.current = Date.now();
    };

    const check = () => {
      const { status, secondsLeft } = getIdleState(Date.now() - lastActivityRef.current, idleTime, warningTime);

      if (status === 'expired') {
        if (firedRef.current) return;
        firedRef.current = true;
        setState({ expired: true, countdown: 0 });
        onIdleRef.current?.();
        return;
      }

      // Solo se actualiza el estado si cambió algo, para no re-renderizar
      // la app entera una vez por segundo mientras la sesión está tranquila.
      const expired = status === 'warning';
      setState(prev => (prev.expired === expired && prev.countdown === secondsLeft)
        ? prev
        : { expired, countdown: secondsLeft });
    };

    // Cerrar o recargar la pestaña también cierra la sesión.
    const handleUnload = () => onIdleRef.current?.();

    const interval = setInterval(check, TICK_MS);
    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, markActivity, { passive: true }));
    // Al volver a la pestaña se recalcula de inmediato, sin esperar el tick.
    document.addEventListener('visibilitychange', check);
    window.addEventListener('beforeunload', handleUnload);
    check();

    return () => {
      clearInterval(interval);
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, markActivity));
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [user, idleTime, warningTime]);

  return { expired: state.expired, countdown: state.countdown };
};

export default useIdleTimeout;
