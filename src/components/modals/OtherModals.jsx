import { useState, useEffect } from 'react';
import { Archive, AlertTriangle } from 'lucide-react';
import { Modal, Button, StatusBadge, Spinner, Field, FormActions } from '../ui';
import { fieldClass } from '../ui/fieldClasses';
import HistoryTimeline from '../HistoryTimeline';
import useAsyncAction from '../../hooks/useAsyncAction';
import { hoyLocal } from '../../utils/format';

// Los formularios de este archivo siguen una sola anatomía: <form> (Enter envía),
// campos con etiqueta, validación propia con mensaje junto al campo, acción
// bloqueada mientras trabaja y el error de la acción visible dentro del modal.

export const DeactivateModal = ({ isOpen, onClose, onDeactivate }) => {
  const [reason, setReason] = useState('');
  const [fecha, setFecha]   = useState('');
  const [errors, setErrors] = useState({});
  const { busy, error, run, reset } = useAsyncAction();

  useEffect(() => {
    if (isOpen) { setReason(''); setFecha(hoyLocal()); setErrors({}); reset(); }
  }, [isOpen, reset]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!reason.trim()) next.reason = 'Escribe el motivo de la baja.';
    if (!fecha) next.fecha = 'Elige la fecha de la baja.';
    else if (fecha > hoyLocal()) next.fecha = 'La fecha no puede ser futura.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    run(() => onDeactivate(reason.trim(), fecha), 'No se pudo dar de baja el equipo. Revisa tu conexión e inténtalo de nuevo.');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dar de baja equipo" size="sm">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Motivo de la baja" required error={errors.reason}>
          <textarea value={reason} onChange={e => { setReason(e.target.value); setErrors(p => ({ ...p, reason: '' })); }}
            placeholder="Ej: pantalla rota, equipo obsoleto…" autoFocus aria-required="true"
            aria-invalid={!!errors.reason} className={`${fieldClass} h-28 resize-none`} />
        </Field>
        <Field label="Fecha de la baja" required error={errors.fecha}>
          <input type="date" value={fecha} max={hoyLocal()} onChange={e => { setFecha(e.target.value); setErrors(p => ({ ...p, fecha: '' })); }}
            aria-required="true" aria-invalid={!!errors.fecha} className={fieldClass} />
        </Field>
        <FormActions error={error}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="warning" type="submit" disabled={busy} className="flex items-center gap-2">
            {busy && <Spinner size="sm" tone="dark" />}
            {busy ? 'Guardando…' : 'Confirmar baja'}
          </Button>
        </FormActions>
      </form>
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
              aparece al buscarlo con el filtro en “Activos”. Cambia el estado a “Todos” para encontrarlo y corregirlo.
            </p>
          </div>
        )}

        <FormActions>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="warning" onClick={onConfirm}>Guardar de todos modos</Button>
        </FormActions>
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
  const { busy, error, run, reset } = useAsyncAction();

  useEffect(() => { if (isOpen) { setConfirmText(''); reset(); } }, [isOpen, reset]);
  const matches = confirmText.trim().toLowerCase() === (itemName ?? '').trim().toLowerCase();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!matches) return;
    run(() => onConfirm(), 'No se pudo eliminar el equipo. Revisa tu conexión e inténtalo de nuevo.');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Eliminar equipo" size="sm">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <p className="text-brand-slate text-sm">
          El equipo sale del inventario. Tendrás unos segundos para deshacerlo.
        </p>
        <Field label={`Escribe «${itemName ?? ''}» para confirmar`}>
          <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
            placeholder="Nombre del equipo" autoFocus autoComplete="off" className={fieldClass} />
        </Field>
        <FormActions error={error}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="danger" type="submit" disabled={!matches || busy} className="flex items-center gap-2">
            {busy && <Spinner size="sm" tone="light" />}
            {busy ? 'Eliminando…' : 'Sí, eliminar'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
};

// ── Confirmar descartar un formulario con cambios sin guardar ──
export const DiscardChangesModal = ({ isOpen, onClose, onConfirm }) => (
  <Modal isOpen={isOpen} onClose={onClose} title="¿Descartar los cambios?" size="sm">
    <p className="text-brand-slate text-sm">Lo que escribiste en este formulario no se ha guardado.</p>
    <FormActions>
      <Button variant="secondary" onClick={onClose}>Seguir editando</Button>
      <Button variant="danger" onClick={onConfirm}>Descartar</Button>
    </FormActions>
  </Modal>
);
