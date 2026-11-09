// Completar cargadores: pasa a la casilla "Cargador" los números que estaban escritos en
// Observaciones. Muestra lo que va a pasar y solo guarda lo que quede marcado; las
// Observaciones no se tocan. Sirve para portátiles y celulares, las veces que haga falta.

import { useState, useMemo, useEffect } from 'react';
import { PlugZap, AlertTriangle } from 'lucide-react';
import { Modal, Button, FormActions } from '../ui';
import useAsyncAction from '../../hooks/useAsyncAction';
import { proponerCargadores } from '../../utils/cargadores';

const CargadoresModal = ({ isOpen, onClose, items, onConfirm }) => {
  const { propuestas, sinNumero } = useMemo(() => proponerCargadores(items), [items]);
  const [marcados, setMarcados] = useState(new Set());
  const { busy, error, run, reset } = useAsyncAction();

  // Al abrir: va marcado todo lo que no tiene avisos
  useEffect(() => {
    if (!isOpen) return;
    setMarcados(new Set(propuestas.filter(p => p.avisos.length === 0).map(p => p.item.id)));
    reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [isOpen]);

  const alternar = (id) => setMarcados(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const elegidos = propuestas.filter(p => marcados.has(p.item.id));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!elegidos.length) return;
    run(async () => { await onConfirm(elegidos.map(p => ({ id: p.item.id, nombre: p.item.nombre, cargador: p.cargador }))); onClose(); },
      'No se pudieron guardar los cargadores. Revisa tu conexión e inténtalo de nuevo.');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Completar cargadores">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {propuestas.length === 0 ? (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
            <PlugZap size={18} className="text-emerald-700 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-brand-ink">No hay cargadores por completar: ningún portátil ni celular tiene un Nº de cargador solo en Observaciones.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-brand-slate">
              Estos equipos tienen el Nº del cargador escrito en <b>Observaciones</b>. Al guardar pasa a la casilla <b>Cargador</b>; las Observaciones se quedan como están.
            </p>
            <ul className="border border-brand-border rounded-xl divide-y divide-brand-border max-h-80 overflow-y-auto">
              {propuestas.map(({ item, cargador, encontrado, avisos }) => (
                <li key={item.id}>
                  <label className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-brand-bg/60 transition-colors">
                    <input type="checkbox" checked={marcados.has(item.id)} onChange={() => alternar(item.id)} className="mt-1 w-4 h-4 rounded border-brand-border flex-shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-brand-ink truncate">{item.nombre} <span className="font-mono text-xs text-brand-gray">{item.numeroInventario}</span></span>
                      <span className="block text-xs text-brand-slate">
                        Cargador <span className="font-mono font-semibold text-brand-ink">{cargador}</span>
                        {encontrado && <span className="text-brand-gray"> · en el inventario: {encontrado.nombre} ({encontrado.categoria})</span>}
                      </span>
                      {avisos.map(a => (
                        <span key={a} className="flex items-center gap-1 text-xs text-amber-800 mt-0.5"><AlertTriangle size={11} aria-hidden="true" /> {a}</span>
                      ))}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-xs text-brand-gray">Los que tienen un aviso vienen sin marcar: revísalos antes de incluirlos.</p>
          </>
        )}

        {sinNumero.length > 0 && (
          <div className="text-xs text-brand-slate bg-brand-bg rounded-lg px-3 py-2.5">
            <p className="font-medium text-brand-ink">{sinNumero.length} equipo{sinNumero.length === 1 ? '' : 's'} dice{sinNumero.length === 1 ? '' : 'n'} “cargador” pero sin número, y se quedan igual:</p>
            <p className="mt-0.5 break-words">{sinNumero.map(i => `${i.nombre} (${i.numeroInventario || 'sin Nº'})`).join(' · ')}</p>
            <p className="mt-1 text-brand-gray">Cuando tengan su número, escríbelo en el campo Cargador del equipo.</p>
          </div>
        )}

        <FormActions error={error}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>{propuestas.length === 0 ? 'Cerrar' : 'Cancelar'}</Button>
          {propuestas.length > 0 && (
            <Button variant="primary" type="submit" disabled={busy || elegidos.length === 0}>
              {busy ? 'Guardando…' : `Guardar ${elegidos.length} cargador${elegidos.length === 1 ? '' : 'es'}`}
            </Button>
          )}
        </FormActions>
      </form>
    </Modal>
  );
};

export default CargadoresModal;
