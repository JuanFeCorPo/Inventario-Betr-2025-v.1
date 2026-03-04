import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Modal, Button } from '../ui';
import { CATEGORIAS, ESTADOS } from '../../config/constants';

const ItemFormModal = ({ isOpen, onClose, onSave, currentItem }) => {
  const [item, setItem] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const f = 'bg-[#F0F2F4] border border-[#E8EAED] text-[#1C2B35] placeholder-[#8D8D8D] p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E68E00]/50 transition-all w-full';

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSaving(false);
    setItem(currentItem
      ? { ...currentItem, fechaIngreso: currentItem.fechaIngreso?.toDate().toISOString().split('T')[0] ?? '' }
      : { nombre:'', categoria:CATEGORIAS[0], estado:'Disponible', fechaIngreso:new Date().toISOString().split('T')[0], numeroSerial:'', numeroInventario:'', observaciones:'', personaEncargada:'' }
    );
  }, [isOpen, currentItem]);

  const handleChange = e => setItem(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = { ...item };
      if (data.fechaIngreso) data.fechaIngreso = Timestamp.fromDate(new Date(data.fechaIngreso));
      await onSave(data);
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
          <textarea name="observaciones" value={item.observaciones??''} onChange={handleChange}
            placeholder="Observaciones" className={`${f} md:col-span-2 h-24 resize-none`} />
          <input name="personaEncargada" value={item.personaEncargada??''} onChange={handleChange}
            placeholder="Persona a Cargo" className={`${f} md:col-span-2`} />
        </div>
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
