import { useState, useMemo, useRef } from 'react';
import { Modal, Button, StatusBadge, NewBadge, FormError, Spinner } from '../ui';
import HistoryTimeline from '../HistoryTimeline';
import { exportItemHistory } from '../../utils/excel';
import useEquipoHistorial from '../../hooks/useEquipoHistorial';
import { getMaintenanceInfo } from '../../utils/maintenance';
import { formatFecha } from '../../utils/format';
import { fieldClass } from '../ui/fieldClasses';
import useAsyncAction from '../../hooks/useAsyncAction';
import { CATEGORIAS_CON_ESPECIFICACIONES, CAMPOS_ESPECIFICACIONES } from '../../config/constants';
import { Edit, Archive, Trash2, StickyNote, Download } from 'lucide-react';

const Field = ({ label, value }) => (
  <div>
    <p className="text-xs text-brand-gray mb-0.5">{label}</p>
    <p className="text-brand-ink font-medium text-sm">{value || '—'}</p>
  </div>
);

const PreviewModal = ({ isOpen, onClose, item: itemProp, isAdmin, db, onEdit, onDeactivate, onDelete, onAddNote }) => {
  const [noteOpen,   setNoteOpen]   = useState(false);
  const [note,       setNote]       = useState('');
  const { busy: savingNote, error: noteError, run: runNote, reset: resetNote } = useAsyncAction();

  // Al cerrar, el padre limpia el equipo: se conserva el último para que la salida animada tenga contenido.
  const lastItem = useRef(itemProp);
  if (itemProp) lastItem.current = itemProp;
  const item = itemProp ?? lastItem.current;

  const historial = useEquipoHistorial(db, item?.id);

  // El historial se arma de tres fuentes: la entrada de creación (sintetizada,
  // nunca se escribe en Firestore), el historial legado embebido (equipos
  // antiguos) y la subcolección nueva — ver useInventory.js.
  const combinedHistory = useMemo(() => {
    if (!item) return [];
    const synthetic = item.createdAt
      ? [{ timestamp: item.createdAt, user: item.addedByEmail ?? '—', action: 'Equipo creado en el inventario.' }]
      : [];
    return [...synthetic, ...(item.history ?? []), ...historial];
  }, [item, historial]);

  if (!item) return null;

  const maintenanceInfo = getMaintenanceInfo(item);

  const handleAddNote = () => {
    if (!note.trim()) return;
    runNote(async () => {
      await onAddNote(item.id, note.trim());
      setNote('');
      setNoteOpen(false);
    }, 'No se pudo guardar la nota. Revisa tu conexión e inténtalo de nuevo.');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalle del equipo" size="lg">
      <div className="space-y-5">
        {/* Encabezado */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-brand-ink">{item.nombre}</h3>
            <p className="text-xs text-brand-gray font-mono mt-0.5">{item.numeroInventario}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <StatusBadge status={item.estado} />
            {item.condicion === 'Nuevo' && <NewBadge />}
          </div>
        </div>

        {/* Ficha de datos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-brand-bg/60 border border-brand-border rounded-xl p-4">
          <Field label="Categoría" value={item.categoria} />
          <Field label="Condición" value={item.condicion ?? 'Usado'} />
          <Field label="Nº de inventario" value={item.numeroInventario} />
          <Field label="Nº de serial" value={item.numeroSerial} />
          <Field label="Encargado" value={item.personaEncargada} />
          <Field label="Fecha de ingreso" value={item.fechaIngreso?.toDate ? formatFecha(item.fechaIngreso.toDate()) : '—'} />
          {item.estado === 'De Baja' && (
            <Field label="Fecha de baja" value={item.fecha_baja?.toDate ? formatFecha(item.fecha_baja.toDate()) : '—'} />
          )}
          {item.motivo_baja && <Field label="Motivo de baja" value={item.motivo_baja} />}
          {maintenanceInfo && (
            <Field label="Próximo mantenimiento"
              value={`${formatFecha(maintenanceInfo.proximaFecha)} ${maintenanceInfo.urgencia === 'vencido' ? '(vencido)' : ''}`} />
          )}
          {item.sinMantenimiento === true && (
            <Field label="Mantenimiento" value="Excluido (sin uso)" />
          )}
        </div>

        {/* Especificaciones técnicas */}
        {CATEGORIAS_CON_ESPECIFICACIONES.includes(item.categoria) && (
          <div>
            <p className="text-xs text-brand-gray mb-1">Especificaciones técnicas</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-brand-bg/60 border border-brand-border rounded-xl p-4">
              {CAMPOS_ESPECIFICACIONES.map(({ key, label }) => (
                <Field key={key} label={label} value={item[key]} />
              ))}
            </div>
          </div>
        )}

        {/* Observaciones */}
        <div>
          <p className="text-xs text-brand-gray mb-1">Observaciones</p>
          <p className="text-brand-slate text-sm bg-brand-bg/60 border border-brand-border rounded-xl p-3">
            {item.observaciones || <span className="italic text-brand-gray">Sin observaciones.</span>}
          </p>
        </div>

        {/* Trazabilidad */}
        <div>
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <p className="text-sm font-semibold text-brand-ink">Trazabilidad</p>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button onClick={() => { setNoteOpen(p => !p); resetNote(); }} aria-expanded={noteOpen}
                  className="flex items-center gap-1.5 text-xs text-brand-ember bg-brand-orange/10 px-3 py-1.5 rounded-lg font-medium hover:bg-brand-orange/20 transition-colors">
                  <StickyNote size={12} /> Agregar nota
                </button>
              )}
              <button onClick={() => exportItemHistory({ ...item, history: combinedHistory })}
                className="flex items-center gap-1.5 text-xs text-brand-slate bg-brand-bg px-3 py-1.5 rounded-lg font-medium hover:bg-brand-border transition-colors">
                <Download size={12} /> Exportar
              </button>
            </div>
          </div>

          {noteOpen && (
            <div className="mb-3 animate-reveal space-y-2">
              <div className="flex items-center gap-2">
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Escribe una nota…"
                  aria-label="Nota para la trazabilidad" autoFocus autoComplete="off"
                  onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                  className={`${fieldClass} flex-1`} />
                <Button variant="primary" size="sm" className="flex items-center gap-1.5" disabled={savingNote || !note.trim()} onClick={handleAddNote}>
                  {savingNote && <Spinner size="sm" tone="dark" />} Guardar
                </Button>
              </div>
              <FormError>{noteError}</FormError>
            </div>
          )}

          <div className="max-h-[35vh] overflow-y-auto pr-1">
            <HistoryTimeline history={combinedHistory} />
          </div>
        </div>

        {/* Acciones */}
        {isAdmin && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-border flex-wrap">
            <Button variant="dangerGhost" onClick={onDelete} className="flex items-center gap-1.5 mr-auto">
              <Trash2 size={14} /> Eliminar
            </Button>
            {item.estado !== 'De Baja' && (
              <Button variant="secondary" onClick={onDeactivate} className="flex items-center gap-1.5">
                <Archive size={14} /> Dar de baja
              </Button>
            )}
            <Button variant="primary" onClick={onEdit} className="flex items-center gap-1.5">
              <Edit size={14} /> Editar
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PreviewModal;
