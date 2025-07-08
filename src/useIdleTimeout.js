import { useEffect, useRef, useState } from 'react';

const useIdleTimeout = (onIdle, user, idleTime = 900000) => {
    const timerRef = useRef(null);
    const [expired, setExpired] = useState(false);
    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    useEffect(() => {
        if (!user) return;

        const resetTimer = () => {
            clearTimeout(timerRef.current);
            setExpired(false);
            timerRef.current = setTimeout(() => {
                setExpired(true);
                setTimeout(() => {
                    onIdle();
                }, 4000);
            }, idleTime);
        };

        const handleActivity = () => resetTimer();

        events.forEach(event => window.addEventListener(event, handleActivity));
        resetTimer();

        window.addEventListener("beforeunload", onIdle);

        return () => {
            events.forEach(event => window.removeEventListener(event, handleActivity));
            window.removeEventListener("beforeunload", onIdle);
            clearTimeout(timerRef.current);
        };
    }, [user, idleTime, onIdle]);

    return expired;
};

export default useIdleTimeout;

