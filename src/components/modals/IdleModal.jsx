import { ShieldOff } from 'lucide-react';

const IdleModal = ({ countdown }) => (
  <div className="fixed inset-0 bg-brand-ink/60 backdrop-blur-md z-50 flex items-center justify-center">
    <div className="bg-white border border-brand-border p-10 rounded-2xl shadow-2xl text-center max-w-sm mx-4">
      <ShieldOff className="mx-auto text-brand-orange mb-4" size={40} strokeWidth={1.5} />
      <h2 className="text-xl font-bold mb-2 text-brand-ink">Tu sesión está por cerrarse</h2>
      <p className="text-brand-gray text-sm">
        Por seguridad se cerrará en{' '}
        <span className="font-semibold text-brand-orange">{countdown}</span> segundo{countdown === 1 ? '' : 's'} por inactividad.
      </p>
      <p className="text-brand-gray text-xs mt-3">Mueve el mouse o presiona una tecla para continuar.</p>
    </div>
  </div>
);

export default IdleModal;
