import React from 'react';

const IdleModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl text-white text-center max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-orange-400">Sesión cerrada por inactividad</h2>
            <p>Has estado inactivo por un tiempo. Por seguridad, se cerrará tu sesión.</p>
        </div>
    </div>
);

export default IdleModal;