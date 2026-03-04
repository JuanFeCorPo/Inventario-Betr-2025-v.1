import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button } from '../ui';

const fieldClass = 'w-full bg-[#F0F2F4] border border-[#E8EAED] text-[#1C2B35] placeholder-[#8D8D8D] p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E68E00]/50 transition-all';

export const DeactivateModal = ({ isOpen, onClose, onDeactivate }) => {
  const [reason, setReason] = useState('');
  const [fecha, setFecha]   = useState('');
  useEffect(() => { if (isOpen) { setReason(''); setFecha(new Date().toISOString().split('T')[0]); } }, [isOpen]);
  const handleConfirm = () => { if (!reason.trim() || !fecha) { alert('Completa el motivo y la fecha.'); return; } onDeactivate(reason, fecha); };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dar de Baja Equipo" size="sm">
      <div className="space-y-4">
        <p className="text-[#5E6A74] text-sm">Especifica el motivo y la fecha de baja.</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Ej: Pantalla rota, equipo obsoleto…" className={`${fieldClass} h-28 resize-none`} />
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={fieldClass} />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="warning" onClick={handleConfirm}>Confirmar Baja</Button>
        </div>
      </div>
    </Modal>
  );
};

export const HistoryModal = ({ isOpen, onClose, item }) => {
  const sorted = useMemo(() => {
    if (!item?.history) return [];
    return [...item.history].sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
  }, [item]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Historial — ${item?.nombre ?? ''}`} size="md">
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {sorted.length === 0 ? (
          <p className="text-center italic text-[#8D8D8D] py-8">Sin historial de modificaciones.</p>
        ) : sorted.map((entry, i) => (
          <div key={i} className="bg-[#F0F2F4] border border-[#E8EAED] p-4 rounded-xl">
            <p className="font-medium text-[#1C2B35] whitespace-pre-line text-sm">{entry.action}</p>
            {entry.fechaBaja && <p className="text-xs text-[#5E6A74] mt-1">Fecha de baja: {entry.fechaBaja.toDate().toLocaleDateString()}</p>}
            {entry.changes?.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-xs">
                {entry.changes.map((c, j) => (
                  <li key={j}><span className="capitalize text-[#5E6A74] font-medium">{c.field}:</span>{' '}
                    <span className="text-rose-500">'{c.from}'</span> → <span className="text-emerald-600">'{c.to}'</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-[#8D8D8D] mt-2 text-right">
              {entry.timestamp?.toDate().toLocaleString()} · <span className="text-[#E68E00] font-medium">{entry.user}</span>
            </p>
          </div>
        ))}
      </div>
    </Modal>
  );
};

export const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, itemName }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="Eliminar equipo" size="sm">
    <div className="space-y-4">
      <p className="text-rose-500 font-medium">Esta acción es irreversible.</p>
      <p className="text-[#5E6A74] text-sm">¿Eliminar permanentemente <span className="font-bold text-[#1C2B35]">{itemName}</span>?</p>
      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant="danger" onClick={onConfirm}>Sí, Eliminar</Button>
      </div>
    </div>
  </Modal>
);
