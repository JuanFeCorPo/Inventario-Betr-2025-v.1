import { useEffect, useRef, useState } from 'react';

const useIdleTimeout = (onIdle, user, idleTime = 900000) => {
    const timerRef = useRef(null);
    const [showModal, setShowModal] = useState(false);
    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    useEffect(() => {
        if (!user) return;

        const resetTimer = () => {
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                setShowModal(true);
                setTimeout(() => {
                    onIdle();
                }, 4000); // Mostrar modal antes de cerrar sesión
            }, idleTime);
        };

        const handleActivity = () => {
            setShowModal(false);
            resetTimer();
        };

        events.forEach(event => window.addEventListener(event, handleActivity));
        resetTimer();

        // Cierre en recarga o cierre de pestaña
        const handleBeforeUnload = () => {
            onIdle();
        };
        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            events.forEach(event => window.removeEventListener(event, handleActivity));
            window.removeEventListener("beforeunload", handleBeforeUnload);
            clearTimeout(timerRef.current);
        };
    }, [user, idleTime, onIdle]);

    // Modal bonito con Tailwind
    return showModal ? (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
            <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl text-white text-center max-w-md">
                <h2 className="text-2xl font-bold mb-4 text-orange-400">Sesión cerrada por inactividad</h2>
                <p>Has estado inactivo por un tiempo. Por seguridad, se cerrará tu sesión.</p>
            </div>
        </div>
    ) : null;
};

export default useIdleTimeout;
