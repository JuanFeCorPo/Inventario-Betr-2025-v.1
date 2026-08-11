import { useState, useEffect } from 'react';
import { Archive, AlertTriangle } from 'lucide-react';
import { Modal, Button, StatusBadge } from '../ui';
import HistoryTimeline from '../HistoryTimeline';

const fieldClass = 'w-full bg-brand-bg border border-brand-border text-brand-ink placeholder-brand-gray p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all';

export const DeactivateModal = ({ isOpen, onClose, onDeactivate }) => {
  const [reason, setReason] = useState('');
  const [fecha, setFecha]   = useState('');
  const [error, setError]   = useState('');
  useEffect(() => { if (isOpen) { setReason(''); setFecha(new Date().toISOString().split('T')[0]); setError(''); } }, [isOpen]);
  const handleConfirm = () => {
    if (!reason.trim() || !fecha) { setError('Completa el motivo y la fecha.'); return; }
    onDeactivate(reason, fecha);
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dar de Baja Equipo" size="sm">
      <div className="space-y-4">
        <p className="text-brand-slate text-sm">Especifica el motivo y la fecha de baja.</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Ej: Pantalla rota, equipo obsoleto…" className={`${fieldClass} h-28 resize-none`} />
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={fieldClass} />
        {error && (
          <p className="text-rose-600 text-xs text-center bg-rose-50 border border-rose-200 rounded-lg py-2 px-3">{error}</p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="warning" onClick={handleConfirm}>Confirmar Baja</Button>
        </div>
      </div>
    </Modal>
  );
};

// Aviso de duplicidad al guardar. No bloquea: informa cuál es el equipo con
// el que choca (con su Nº de inventario y estado) para poder corregirlo, y
// deja seguir si el duplicado es intencional.
export const DuplicateWarningModal = ({ isOpen, onClose, onConfirm, conflicts = [] }) => {
  const hayDeBaja = conflicts.some(c => c.item?.estado === 'De Baja');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Este equipo está duplicado" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-brand-slate text-sm">
            Los siguientes datos ya están registrados en {conflicts.length === 1 ? 'otro equipo' : 'otros equipos'}:
          </p>
        </div>

        <div className="space-y-2">
          {conflicts.map(({ field, label, value, item }) => (
            <div key={field} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-800">
                Mismo {label}: <span className="font-mono font-semibold">{value}</span>
              </p>
              <div className="flex items-center gap-2 flex-wrap mt-2">
                <span className="font-semibold text-brand-ink text-sm">{item.nombre}</span>
                <StatusBadge status={item.estado} />
              </div>
              <p className="text-xs text-brand-gray mt-1 font-mono">Nº {item.numeroInventario || '—'}</p>
            </div>
          ))}
        </div>

        {hayDeBaja && (
          <div className="bg-brand-bg border border-brand-border rounded-xl p-3 flex items-start gap-2.5">
            <Archive size={15} className="text-brand-gray flex-shrink-0 mt-0.5" />
            <p className="text-xs text-brand-slate">
              Ese equipo está <span className="font-semibold text-brand-ink">dado de baja</span>, por eso no
              aparece al buscarlo con el filtro en “Activos”. Cambia el filtro a “Todos” para encontrarlo y corregirlo.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="warning" onClick={onConfirm}>Guardar de todos modos</Button>
        </div>
      </div>
    </Modal>
  );
};

export const HistoryModal = ({ isOpen, onClose, item }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={`Historial — ${item?.nombre ?? ''}`} size="md">
    <div className="max-h-[60vh] overflow-y-auto pr-1">
      <HistoryTimeline history={item?.history} />
    </div>
  </Modal>
);

export const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, itemName }) => {
  const [confirmText, setConfirmText] = useState('');
  useEffect(() => { if (isOpen) setConfirmText(''); }, [isOpen]);
  const matches = confirmText.trim().toLowerCase() === (itemName ?? '').trim().toLowerCase();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Eliminar equipo" size="sm">
      <div className="space-y-4">
        <p className="text-rose-500 font-medium">Esta acción es irreversible.</p>
        <p className="text-brand-slate text-sm">
          Para confirmar, escribe el nombre exacto: <span className="font-bold text-brand-ink">{itemName}</span>
        </p>
        <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
          placeholder="Escribe el nombre del equipo" className={fieldClass} />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={onConfirm} disabled={!matches}>Sí, Eliminar</Button>
        </div>
      </div>
    </Modal>
  );
};
