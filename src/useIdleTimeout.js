import { useEffect, useRef } from 'react';

const useIdleTimeout = (onIdle, user, idleTime = 900000) => {
    const timerRef = useRef(null);
    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    useEffect(() => {
        if (!user) return;

        const resetTimer = () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                console.log("Sesión cerrada por inactividad");
                onIdle();
            }, idleTime);
        };

        const handleActivity = () => resetTimer();

        events.forEach(event => window.addEventListener(event, handleActivity));
        resetTimer();

        return () => {
            events.forEach(event => window.removeEventListener(event, handleActivity));
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [user, idleTime, onIdle]);
};

export default useIdleTimeout;