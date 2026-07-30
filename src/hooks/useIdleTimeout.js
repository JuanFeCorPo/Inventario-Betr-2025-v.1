// ─────────────────────────────────────────────
//  src/hooks/useIdleTimeout.js
//  Detecta inactividad del usuario y dispara
//  el callback `onIdle` tras `idleTime` ms
// ─────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

const useIdleTimeout = (onIdle, user, idleTime = 900_000, warningTime = 20_000) => {
  const timerRef     = useRef(null);
  const countdownRef = useRef(null);
  const [expired,   setExpired]   = useState(false);
  const [countdown, setCountdown] = useState(Math.ceil(warningTime / 1000));

  useEffect(() => {
    if (!user) return;

    const resetTimer = () => {
      clearTimeout(timerRef.current);
      clearInterval(countdownRef.current);
      setExpired(false);
      setCountdown(Math.ceil(warningTime / 1000));

      timerRef.current = setTimeout(() => {
        setExpired(true);
        let remaining = Math.ceil(warningTime / 1000);
        setCountdown(remaining);
        countdownRef.current = setInterval(() => {
          remaining -= 1;
          setCountdown(remaining);
          if (remaining <= 0) {
            clearInterval(countdownRef.current);
            onIdle();
          }
        }, 1_000);
      }, idleTime);
    };

    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, resetTimer));
    window.addEventListener('beforeunload', onIdle);
    resetTimer();

    return () => {
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, resetTimer));
      window.removeEventListener('beforeunload', onIdle);
      clearTimeout(timerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [user, idleTime, warningTime, onIdle]);

  return { expired, countdown };
};

export default useIdleTimeout;
