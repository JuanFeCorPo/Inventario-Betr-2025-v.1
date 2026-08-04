import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Modal, Button } from '../ui';
import { CATEGORIAS, ESTADOS, CONDICIONES, CATEGORIAS_CON_MANTENIMIENTO, FRECUENCIA_MANTENIMIENTO_MESES_DEFAULT } from '../../config/constants';

const ItemFormModal = ({ isOpen, onClose, onSave, currentItem, items = [], encargados = [], onAddEncargado }) => {
  const [item, setItem] = useState({});
  const [motivoEstado, setMotivoEstado] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const f = 'bg-brand-bg border border-brand-border text-brand-ink placeholder-brand-gray p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all w-full';

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSaving(false);
    setMotivoEstado('');
    setItem(currentItem
      ? { ...currentItem, condicion: currentItem.condicion ?? 'Usado', fechaIngreso: currentItem.fechaIngreso?.toDate().toISOString().split('T')[0] ?? '' }
      : { nombre:'', categoria:CATEGORIAS[0], estado:'Disponible', condicion:'Nuevo', fechaIngreso:new Date().toISOString().split('T')[0], numeroSerial:'', numeroInventario:'', observaciones:'', personaEncargada:'' }
    );
  }, [isOpen, currentItem]);

  const handleChange = e => setItem(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const estadoChanged = currentItem && item.estado !== currentItem.estado;

  const findDuplicate = (field, label) => {
    const value = item[field]?.trim();
    if (!value) return null;
    const dup = items.find(i => i.id !== currentItem?.id && i[field]?.trim().toLowerCase() === value.toLowerCase());
    return dup ? `Ya existe un equipo con ese ${label} (${dup.nombre}).` : null;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const dupError = findDuplicate('numeroInventario', 'número de inventario') || findDuplicate('numeroSerial', 'número de serial');
    if (dupError) { setError(dupError); return; }

    setSaving(true);
    try {
      const data = { ...item };
      if (data.fechaIngreso) data.fechaIngreso = Timestamp.fromDate(new Date(data.fechaIngreso));
      if (CATEGORIAS_CON_MANTENIMIENTO.includes(data.categoria)) {
        data.frecuenciaMantenimientoMeses = Number(data.frecuenciaMantenimientoMeses) || FRECUENCIA_MANTENIMIENTO_MESES_DEFAULT;
      } else {
        delete data.frecuenciaMantenimientoMeses;
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
    <Modal isOpen={isOpen} onClose={onClose} title={currentItem ? 'Modificar Equipo' : 'Añadir Nuevo Equipo'}>
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input name="nombre" value={item.nombre??''} onChange={handleChange} placeholder="Nombre del Equipo" className={f} required />
          <select name="categoria" value={item.categoria??''} onChange={handleChange} className={f}>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input name="numeroSerial" value={item.numeroSerial??''} onChange={handleChange} placeholder="Número de Serial" className={f} />
          <input name="numeroInventario" value={item.numeroInventario??''} onChange={handleChange} placeholder="Número de Inventario" className={f} required />
          <input type="date" name="fechaIngreso" value={item.fechaIngreso??''} onChange={handleChange} className={f} required />
          <select name="estado" value={item.estado??'Disponible'} onChange={handleChange} className={f}>
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select name="condicion" value={item.condicion??'Nuevo'} onChange={handleChange} className={f}>
            {CONDICIONES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {CATEGORIAS_CON_MANTENIMIENTO.includes(item.categoria) && (
            <div>
              <label className="text-xs font-semibold text-brand-gray mb-1 block">
                Frecuencia de mantenimiento (meses)
              </label>
              <input type="number" name="frecuenciaMantenimientoMeses" min="1"
                value={item.frecuenciaMantenimientoMeses ?? FRECUENCIA_MANTENIMIENTO_MESES_DEFAULT}
                onChange={handleChange} className={f} />
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
  );
};

export default ItemFormModal;
