import { useState, useMemo, useRef } from 'react';
import { Modal, Button, StatusBadge, NewBadge } from '../ui';
import HistoryTimeline from '../HistoryTimeline';
import { exportItemHistory } from '../../utils/excel';
import useEquipoHistorial from '../../hooks/useEquipoHistorial';
import { getMaintenanceInfo } from '../../utils/maintenance';
import { formatFecha } from '../../utils/format';
import { fieldClassSm } from '../ui/fieldClasses';
import { CATEGORIAS_CON_ESPECIFICACIONES, CAMPOS_ESPECIFICACIONES } from '../../config/constants';
import { Edit, Archive, Trash2, StickyNote, Download, Loader2 } from 'lucide-react';

const Field = ({ label, value }) => (
  <div>
    <p className="text-xs text-brand-gray mb-0.5">{label}</p>
    <p className="text-brand-ink font-medium text-sm">{value || '—'}</p>
  </div>
);

const PreviewModal = ({ isOpen, onClose, item: itemProp, isAdmin, db, onEdit, onDeactivate, onDelete, onAddNote }) => {
  const [noteOpen,   setNoteOpen]   = useState(false);
  const [note,       setNote]       = useState('');
  const [savingNote, setSavingNote] = useState(false);

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

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    await onAddNote(item.id, note.trim());
    setNote('');
    setNoteOpen(false);
    setSavingNote(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalle del Equipo" size="lg">
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
          <Field label="N° Inventario" value={item.numeroInventario} />
          <Field label="N° Serial" value={item.numeroSerial} />
          <Field label="Persona Encargada" value={item.personaEncargada} />
          <Field label="Fecha de Ingreso" value={item.fechaIngreso?.toDate ? formatFecha(item.fechaIngreso.toDate()) : '—'} />
          {item.estado === 'De Baja' && (
            <Field label="Fecha de Baja" value={item.fecha_baja?.toDate ? formatFecha(item.fecha_baja.toDate()) : '—'} />
          )}
          {item.motivo_baja && <Field label="Motivo de Baja" value={item.motivo_baja} />}
          {maintenanceInfo && (
            <Field label="Próximo Mantenimiento"
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
                <button onClick={() => setNoteOpen(p => !p)}
                  className="flex items-center gap-1.5 text-xs text-brand-orange bg-brand-orange/10 px-3 py-1.5 rounded-lg font-medium hover:bg-brand-orange/20 transition-colors">
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
            <div className="flex items-center gap-2 mb-3 animate-reveal">
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Escribe una nota…"
                onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                className={`${fieldClassSm} flex-1 !py-2`} />
              <Button variant="primary" size="sm" className="flex items-center gap-1.5" disabled={savingNote || !note.trim()} onClick={handleAddNote}>
                {savingNote && <Loader2 size={13} className="animate-spin" />} Guardar
              </Button>
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
                <Archive size={14} /> Dar de Baja
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
