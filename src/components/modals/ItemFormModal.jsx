import { useState, useEffect, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { ChevronDown } from 'lucide-react';
import { Modal, Button, Spinner, Field, FormActions } from '../ui';
import { fieldClass } from '../ui/fieldClasses';
import { CATEGORIAS, ESTADOS, CONDICIONES, CATEGORIAS_CON_MANTENIMIENTO, FRECUENCIA_MANTENIMIENTO_MESES_DEFAULT, CATEGORIAS_CON_ESPECIFICACIONES, CAMPOS_ESPECIFICACIONES } from '../../config/constants';
import { findDuplicateConflicts } from '../../utils/duplicates';
import { hoyLocal } from '../../utils/format';
import { DuplicateWarningModal, DiscardChangesModal } from './OtherModals';

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

const SectionTitle = ({ children }) => (
  <h3 className="md:col-span-2 text-sm font-bold text-brand-ink pt-2 border-t border-brand-border first:border-t-0 first:pt-0">{children}</h3>
);

const ItemFormModal = ({ isOpen, onClose, onSave, currentItem, items = [], encargados = [], onAddEncargado }) => {
  const [item, setItem] = useState({});
  const [motivoEstado, setMotivoEstado] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [specsOpen, setSpecsOpen] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const initial = useRef('');
  const formRef = useRef(null);
  const f = fieldClass;

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setErrors({});
    setSaving(false);
    setMotivoEstado('');
    setConflicts([]);
    setSpecsOpen(!!currentItem && CAMPOS_ESPECIFICACIONES.some(({ key }) => currentItem[key]));
    setAskDiscard(false);
    const next = currentItem
      ? { ...currentItem, condicion: currentItem.condicion ?? 'Usado', fechaIngreso: currentItem.fechaIngreso?.toDate().toISOString().split('T')[0] ?? '' }
      : { nombre:'', categoria:CATEGORIAS[0], estado:'Disponible', condicion:'Nuevo', fechaIngreso:hoyLocal(), numeroSerial:'', numeroInventario:'', observaciones:'', personaEncargada:'' };
    setItem(next);
    initial.current = JSON.stringify(next);
  }, [isOpen, currentItem]);

  const handleChange = e => {
    const { name, type, checked, value } = e.target;
    setItem(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };
  const estadoChanged = currentItem && item.estado !== currentItem.estado;
  const reactivando = currentItem?.estado === 'De Baja' && item.estado !== 'De Baja';
  // Un equipo dado de baja se edita mostrando su estado real ("De Baja"), no el primero de la lista.
  const estadoOptions = currentItem?.estado === 'De Baja' ? ['De Baja', ...ESTADOS] : ESTADOS;

  // Cerrar con cambios sin guardar pide confirmación (Escape, X y Cancelar pasan por aquí)
  const isDirty = JSON.stringify(item) !== initial.current || motivoEstado !== '';
  const requestClose = () => { if (isDirty && !saving) setAskDiscard(true); else onClose(); };

  // Validación propia (formulario con noValidate): el mensaje sale junto al campo y se anuncia.
  const validate = () => {
    const next = {};
    const fechaOriginal = initial.current ? JSON.parse(initial.current).fechaIngreso : '';
    if (!item.nombre?.trim()) next.nombre = 'Escribe el nombre del equipo.';
    if (!item.numeroInventario?.trim()) next.numeroInventario = 'Escribe el número de inventario.';
    if (!item.fechaIngreso) next.fechaIngreso = 'Elige la fecha de ingreso.';
    else if (item.fechaIngreso > hoyLocal() && item.fechaIngreso !== fechaOriginal) next.fechaIngreso = 'La fecha no puede ser futura.';
    return next;
  };

  // Al enviar se revisa la duplicidad: si hay choque se muestra el aviso con
  // el equipo culpable (puede estar dado de baja y no verse en el listado).
  const handleSave = (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }

    const duplicates = findDuplicateConflicts(items, currentItem, item);
    if (duplicates.length > 0) { setConflicts(duplicates); return; }

    persist();
  };

  const persist = async () => {
    if (saving) return;
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
      setError('No se pudo guardar. Revisa tu conexión o tus permisos e inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={requestClose} title={currentItem ? 'Modificar equipo' : 'Añadir equipo'}>
      <form ref={formRef} onSubmit={handleSave} noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <SectionTitle>Identificación</SectionTitle>
          <Field label="Nombre del equipo" required error={errors.nombre} className="md:col-span-2">
            <input name="nombre" value={item.nombre??''} onChange={handleChange} placeholder="Ej: Laptop Lenovo ThinkPad E14"
              autoFocus aria-required="true" aria-invalid={!!errors.nombre} className={f} />
          </Field>
          <Field label="Categoría" required>
            <SelectField name="categoria" value={item.categoria??''} onChange={handleChange} className={f}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </SelectField>
          </Field>
          <Field label="Nº de inventario" required error={errors.numeroInventario}>
            <input name="numeroInventario" value={item.numeroInventario??''} onChange={handleChange} placeholder="Ej: BTR-0123"
              autoComplete="off" aria-required="true" aria-invalid={!!errors.numeroInventario} className={f} />
          </Field>
          <Field label="Nº de serial" className="md:col-span-2">
            <input name="numeroSerial" value={item.numeroSerial??''} onChange={handleChange} autoComplete="off" className={f} />
          </Field>

          <SectionTitle>Estado y asignación</SectionTitle>
          <Field label="Estado" hint={reactivando ? 'Al cambiar el estado, el equipo vuelve al inventario activo.' : undefined}>
            <SelectField name="estado" value={item.estado??'Disponible'} onChange={handleChange} className={f}>
              {estadoOptions.map(e => <option key={e} value={e}>{e}</option>)}
            </SelectField>
          </Field>
          <Field label="Condición">
            <SelectField name="condicion" value={item.condicion??'Nuevo'} onChange={handleChange} className={f}>
              {CONDICIONES.map(c => <option key={c} value={c}>{c}</option>)}
            </SelectField>
          </Field>
          <Field label="Encargado" hint="Persona que tiene el equipo. Déjalo vacío si no está asignado.">
            <input name="personaEncargada" value={item.personaEncargada??''} onChange={handleChange}
              list="encargados-sugeridos" autoComplete="off" className={f} />
            <datalist id="encargados-sugeridos">
              {encargados.map(nombre => <option key={nombre} value={nombre} />)}
            </datalist>
          </Field>
          <Field label="Fecha de ingreso" required error={errors.fechaIngreso}>
            <input type="date" name="fechaIngreso" value={item.fechaIngreso??''} max={hoyLocal()} onChange={handleChange}
              aria-required="true" aria-invalid={!!errors.fechaIngreso} className={f} />
          </Field>

          {estadoChanged && (
            <div className="md:col-span-2 bg-brand-orange/10 border border-brand-orange/20 rounded-xl p-3 animate-reveal">
              <Field label="Motivo del cambio de estado (opcional)" hint="Se guarda en la trazabilidad del equipo, sin modificar las observaciones.">
                <textarea value={motivoEstado} onChange={e => setMotivoEstado(e.target.value)}
                  placeholder="Ej: se envió a mantenimiento por falla de pantalla…"
                  className={`${f} h-16 resize-none`} />
              </Field>
            </div>
          )}

          {CATEGORIAS_CON_MANTENIMIENTO.includes(item.categoria) && (<>
            <SectionTitle>Mantenimiento</SectionTitle>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              {!item.sinMantenimiento && (
                <Field label="Frecuencia de mantenimiento (meses)">
                  <input type="number" name="frecuenciaMantenimientoMeses" min="1"
                    value={item.frecuenciaMantenimientoMeses ?? FRECUENCIA_MANTENIMIENTO_MESES_DEFAULT}
                    onChange={handleChange} className={f} />
                </Field>
              )}
              <label className="flex items-start gap-2 cursor-pointer pb-2.5">
                <input type="checkbox" name="sinMantenimiento" checked={item.sinMantenimiento === true}
                  onChange={handleChange} className="mt-0.5 w-4 h-4 rounded border-brand-border flex-shrink-0" />
                <span className="text-sm text-brand-slate leading-tight">
                  No requiere mantenimiento preventivo
                  <span className="block text-xs text-brand-gray mt-0.5">Ej. equipos en backup sin uso.</span>
                </span>
              </label>
            </div>
          </>)}

          {CATEGORIAS_CON_ESPECIFICACIONES.includes(item.categoria) && (
            <div className="md:col-span-2 border border-brand-border rounded-xl overflow-hidden">
              <button type="button" onClick={() => setSpecsOpen(p => !p)} aria-expanded={specsOpen}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm font-semibold text-brand-ink hover:bg-brand-bg/70 transition-colors">
                <span>
                  Especificaciones técnicas
                  <span className="text-brand-gray font-normal ml-1.5">(opcional)</span>
                </span>
                <ChevronDown size={15} className={`text-brand-gray transition-transform duration-200 ${specsOpen ? 'rotate-180' : ''}`} />
              </button>
              {specsOpen && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-3.5 pb-3.5 pt-1 animate-reveal">
                  {CAMPOS_ESPECIFICACIONES.map(({ key, label }) => (
                    <Field key={key} label={label}>
                      <input name={key} value={item[key] ?? ''} onChange={handleChange} autoComplete="off" className={f} />
                    </Field>
                  ))}
                </div>
              )}
            </div>
          )}

          <SectionTitle>Notas</SectionTitle>
          <Field label="Observaciones" className="md:col-span-2">
            <textarea name="observaciones" value={item.observaciones??''} onChange={handleChange}
              className={`${f} h-24 resize-none`} />
          </Field>
        </div>

        <FormActions error={error}>
          <Button variant="secondary" type="button" onClick={requestClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={saving} className="flex items-center gap-2">
            {saving && <Spinner size="sm" tone="dark" />}
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </FormActions>
      </form>
    </Modal>

    <DiscardChangesModal isOpen={askDiscard} onClose={() => setAskDiscard(false)} onConfirm={() => { setAskDiscard(false); onClose(); }} />
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
