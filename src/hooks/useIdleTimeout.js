// ─────────────────────────────────────────────
//  src/hooks/useIdleTimeout.js
//  Detecta inactividad del usuario y dispara
//  el callback `onIdle` tras `idleTime` ms
// ─────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

const useIdleTimeout = (onIdle, user, idleTime = 900_000) => {
  const timerRef = useRef(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!user) return;

    const resetTimer = () => {
      clearTimeout(timerRef.current);
      setExpired(false);
      timerRef.current = setTimeout(() => {
        setExpired(true);
        setTimeout(onIdle, 4_000);
      }, idleTime);
    };

    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, resetTimer));
    window.addEventListener('beforeunload', onIdle);
    resetTimer();

    return () => {
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, resetTimer));
      window.removeEventListener('beforeunload', onIdle);
      clearTimeout(timerRef.current);
    };
  }, [user, idleTime, onIdle]);

  return expired;
};

export default useIdleTimeout;
