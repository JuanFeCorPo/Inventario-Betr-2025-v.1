import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { ChevronDown } from 'lucide-react';
import { Modal, Button } from '../ui';
import { CATEGORIAS, ESTADOS, CONDICIONES, CATEGORIAS_CON_MANTENIMIENTO, FRECUENCIA_MANTENIMIENTO_MESES_DEFAULT, CATEGORIAS_CON_ESPECIFICACIONES, CAMPOS_ESPECIFICACIONES } from '../../config/constants';
import { findDuplicateConflicts } from '../../utils/duplicates';
import { DuplicateWarningModal } from './OtherModals';

// Select nativo (mantiene validación/teclado del navegador) con flecha propia
// en vez de la del sistema operativo, que se veía enorme e inconsistente.
const SelectField = ({ className = '', children, ...props }) => (
  <div className="relative self-start w-full">
    <select {...props} className={`${className} appearance-none pr-9 cursor-pointer`}>
      {children}
    </select>
    <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray" />
  </div>
);

const ItemFormModal = ({ isOpen, onClose, onSave, currentItem, items = [], encargados = [], onAddEncargado }) => {
  const [item, setItem] = useState({});
  const [motivoEstado, setMotivoEstado] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [specsOpen, setSpecsOpen] = useState(false);
  const f = 'bg-brand-bg border border-brand-border text-brand-ink placeholder-brand-gray p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all w-full';

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSaving(false);
    setMotivoEstado('');
    setConflicts([]);
    setSpecsOpen(!!currentItem && CAMPOS_ESPECIFICACIONES.some(({ key }) => currentItem[key]));
    setItem(currentItem
      ? { ...currentItem, condicion: currentItem.condicion ?? 'Usado', fechaIngreso: currentItem.fechaIngreso?.toDate().toISOString().split('T')[0] ?? '' }
      : { nombre:'', categoria:CATEGORIAS[0], estado:'Disponible', condicion:'Nuevo', fechaIngreso:new Date().toISOString().split('T')[0], numeroSerial:'', numeroInventario:'', observaciones:'', personaEncargada:'' }
    );
  }, [isOpen, currentItem]);

  const handleChange = e => setItem(prev => ({
    ...prev,
    [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
  }));
  const estadoChanged = currentItem && item.estado !== currentItem.estado;

  // Al enviar se revisa la duplicidad: si hay choque se muestra el aviso con
  // el equipo culpable (puede estar dado de baja y no verse en el listado).
  const handleSave = (e) => {
    e.preventDefault();
    setError('');

    const found = findDuplicateConflicts(items, currentItem, item);
    if (found.length > 0) { setConflicts(found); return; }

    persist();
  };

  const persist = async () => {
    setConflicts([]);
    setSaving(true);
    try {
      const data = { ...item };
      if (data.fechaIngreso) data.fechaIngreso = Timestamp.fromDate(new Date(data.fechaIngreso));
      if (CATEGORIAS_CON_MANTENIMIENTO.includes(data.categoria)) {
        data.sinMantenimiento = data.sinMantenimiento === true;
        data.frecuenciaMantenimientoMeses = Number(data.frecuenciaMantenimientoMeses) || FRECUENCIA_MANTENIMIENTO_MESES_DEFAULT;
      } else {
        delete data.frecuenciaMantenimientoMeses;
        delete data.sinMantenimiento;
      }
      if (!CATEGORIAS_CON_ESPECIFICACIONES.includes(data.categoria)) {
        CAMPOS_ESPECIFICACIONES.forEach(({ key }) => delete data[key]);
      }
      if (data.personaEncargada?.trim()) await onAddEncargado?.(data.personaEncargada);
      await onSave(data, motivoEstado);
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar. Verifica tu conexión o permisos.');
      setSaving(false);
    }
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={currentItem ? 'Modificar Equipo' : 'Añadir Nuevo Equipo'}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input name="nombre" value={item.nombre??''} onChange={handleChange} placeholder="Nombre del Equipo" className={f} required />
          <SelectField name="categoria" value={item.categoria??''} onChange={handleChange} className={f}>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </SelectField>
          <input name="numeroSerial" value={item.numeroSerial??''} onChange={handleChange} placeholder="Número de Serial" className={f} />
          <input name="numeroInventario" value={item.numeroInventario??''} onChange={handleChange} placeholder="Número de Inventario" className={f} required />
          <input type="date" name="fechaIngreso" value={item.fechaIngreso??''} onChange={handleChange} className={f} required />
          <SelectField name="estado" value={item.estado??'Disponible'} onChange={handleChange} className={f}>
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </SelectField>
          <SelectField name="condicion" value={item.condicion??'Nuevo'} onChange={handleChange} className={f}>
            {CONDICIONES.map(c => <option key={c} value={c}>{c}</option>)}
          </SelectField>
          {CATEGORIAS_CON_MANTENIMIENTO.includes(item.categoria) && (
            <div>
              {!item.sinMantenimiento && (<>
                <label className="text-xs font-semibold text-brand-gray mb-1 block">
                  Frecuencia de mantenimiento (meses)
                </label>
                <input type="number" name="frecuenciaMantenimientoMeses" min="1"
                  value={item.frecuenciaMantenimientoMeses ?? FRECUENCIA_MANTENIMIENTO_MESES_DEFAULT}
                  onChange={handleChange} className={f} />
              </>)}
              <label className="flex items-start gap-2 mt-2 cursor-pointer">
                <input type="checkbox" name="sinMantenimiento" checked={item.sinMantenimiento === true}
                  onChange={handleChange}
                  className="mt-0.5 w-4 h-4 rounded border-brand-border text-brand-orange focus:ring-2 focus:ring-brand-orange/50 flex-shrink-0" />
                <span className="text-xs text-brand-slate leading-tight">
                  No requiere mantenimiento preventivo
                  <span className="block text-brand-gray">Ej. equipos en backup sin uso.</span>
                </span>
              </label>
            </div>
          )}
          {CATEGORIAS_CON_ESPECIFICACIONES.includes(item.categoria) && (
            <div className="md:col-span-2 border border-brand-border rounded-xl overflow-hidden">
              <button type="button" onClick={() => setSpecsOpen(p => !p)}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-semibold text-brand-ink hover:bg-brand-bg/70 transition-colors">
                <span>
                  Especificaciones técnicas
                  <span className="text-brand-gray font-normal ml-1.5">(opcional)</span>
                </span>
                <ChevronDown size={15} className={`text-brand-gray transition-transform duration-200 ${specsOpen ? 'rotate-180' : ''}`} />
              </button>
              {specsOpen && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-3.5 pb-3.5 pt-1">
                  {CAMPOS_ESPECIFICACIONES.map(({ key, label }) => (
                    <input key={key} name={key} value={item[key] ?? ''} onChange={handleChange}
                      placeholder={label} className={f} />
                  ))}
                </div>
              )}
            </div>
          )}
          <textarea name="observaciones" value={item.observaciones??''} onChange={handleChange}
            placeholder="Observaciones" className={`${f} md:col-span-2 h-24 resize-none`} />
          <input name="personaEncargada" value={item.personaEncargada??''} onChange={handleChange}
            placeholder="Persona a Cargo" list="encargados-sugeridos" autoComplete="off"
            className={`${f} md:col-span-2`} />
          <datalist id="encargados-sugeridos">
            {encargados.map(nombre => <option key={nombre} value={nombre} />)}
          </datalist>
        </div>

        {estadoChanged && (
          <div className="bg-brand-orange/8 border border-brand-orange/20 rounded-xl p-3">
            <label className="text-xs font-semibold text-brand-ink mb-1.5 block">
              Motivo del cambio de estado (opcional)
            </label>
            <textarea value={motivoEstado} onChange={e => setMotivoEstado(e.target.value)}
              placeholder="Ej: Se envió a mantenimiento por falla de pantalla…"
              className={`${f} h-16 resize-none`} />
            <p className="text-xs text-brand-gray mt-1.5">
              Se guarda en la trazabilidad del equipo, sin modificar las observaciones actuales.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          {error && (
            <p className="text-rose-600 text-xs flex-1 flex items-center">{error}</p>
          )}
          <Button variant="secondary" type="button" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={saving} className="flex items-center gap-2">
            {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Modal>

    <DuplicateWarningModal
      isOpen={conflicts.length > 0}
      onClose={() => setConflicts([])}
      onConfirm={persist}
      conflicts={conflicts}
    />
    </>
  );
};

export default ItemFormModal;
