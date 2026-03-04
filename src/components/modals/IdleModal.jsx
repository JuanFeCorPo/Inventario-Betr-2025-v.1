import React from 'react';
import { ShieldOff } from 'lucide-react';

const IdleModal = () => (
  <div className="fixed inset-0 bg-[#1C2B35]/60 backdrop-blur-md z-50 flex items-center justify-center">
    <div className="bg-white border border-[#E8EAED] p-10 rounded-2xl shadow-2xl text-center max-w-sm mx-4">
      <ShieldOff className="mx-auto text-[#E68E00] mb-4" size={40} strokeWidth={1.5} />
      <h2 className="text-xl font-bold mb-2 text-[#1C2B35]">Sesión cerrada por inactividad</h2>
      <p className="text-[#8D8D8D] text-sm">Por seguridad se cerrará tu sesión.</p>
    </div>
  </div>
);

export default IdleModal;
