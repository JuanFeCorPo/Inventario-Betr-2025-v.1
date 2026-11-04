// ─────────────────────────────────────────────
//  Importar las hojas de vida de Excel (una sola vez).
//  1) Elegir plan-importacion.json (lo genera scripts/hojas-de-vida/preparar-importacion.mjs)
//  2) Revisar el resumen y los avisos contra el inventario en vivo
//  3) Escribir en lotes, con progreso
// ─────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { FileJson, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Modal, Button, FormActions, Spinner } from '../ui';
import useAsyncAction from '../../hooks/useAsyncAction';
import { hoyLocal } from '../../utils/format';
import { prepararImportacion, validarPlan } from '../../utils/importarHojas';

const Cifra = ({ valor, texto }) => (
  <div className="bg-brand-bg rounded-xl px-3 py-2.5">
    <p className="text-lg font-bold text-brand-ink tabular-nums">{valor}</p>
    <p className="text-xs text-brand-slate">{texto}</p>
  </div>
);

const ImportarHojasModal = ({ isOpen, onClose, items, onImportar }) => {
  const [plan, setPlan] = useState(null);
  const [archivo, setArchivo] = useState('');
  const [errorArchivo, setErrorArchivo] = useState('');
  const [progreso, setProgreso] = useState(null);
  const { busy, error, run, reset } = useAsyncAction();

  useEffect(() => {
    if (!isOpen) return;
    setPlan(null); setArchivo(''); setErrorArchivo(''); setProgreso(null); reset();
  }, [isOpen, reset]);

  // Se recalcula con el inventario en vivo (si alguien edita mientras tanto, se ve aquí)
  const resultado = useMemo(() => (plan ? prepararImportacion(plan, items, hoyLocal()) : null), [plan, items]);

  const elegirArchivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorArchivo('');
    try {
      const data = JSON.parse(await file.text());
      if (!validarPlan(data)) throw new Error('formato');
      setPlan(data); setArchivo(file.name);
    } catch {
      setPlan(null);
      setErrorArchivo('Ese archivo no es un plan de importación. Elige plan-importacion.json de la carpeta de hojas de vida.');
    }
  };

  const importar = async (e) => {
    e.preventDefault();
    const ok = await run(
      () => onImportar(resultado, (hecho, total) => setProgreso({ hecho, total })),
      'La importación se detuvo a mitad. No la repitas: avisa a quien preparó el plan para revisarla.',
    );
    if (ok) onClose(resultado.resumen);
  };

  const cerrar = () => { if (!busy) onClose(null); };
  const r = resultado?.resumen;

  return (
    <Modal isOpen={isOpen} onClose={cerrar} title="Importar hojas de vida" size="md">
      <form noValidate onSubmit={importar}>
        <label className="flex items-center gap-3 border border-dashed border-brand-border hover:border-brand-orange/60 rounded-xl px-4 py-3 cursor-pointer transition">
          <FileJson size={18} className="text-brand-slate flex-shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-brand-ink truncate">{archivo || 'Elegir plan-importacion.json'}</span>
            <span className="block text-xs text-brand-gray">Está en la carpeta de las hojas de vida</span>
          </span>
          <input type="file" accept=".json,application/json" className="sr-only" onChange={elegirArchivo} disabled={busy} autoFocus />
        </label>
        {errorArchivo && <p role="alert" className="mt-2 text-xs text-rose-700">{errorArchivo}</p>}

        {r && (
          <div className="mt-5 space-y-4 animate-reveal">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Cifra valor={r.puestos} texto="puestos" />
              <Cifra valor={r.equiposEnPuestos} texto="equipos en puestos" />
              <Cifra valor={r.equiposCreados} texto="equipos nuevos" />
              <Cifra valor={r.equiposActualizados} texto="equipos actualizados" />
              <Cifra valor={r.registrosPuestos} texto="registros en puestos" />
              <Cifra valor={r.registrosEquipos} texto="registros en equipos" />
            </div>

            {resultado.avisos.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle size={13} /> {resultado.avisos.length} aviso{resultado.avisos.length !== 1 ? 's' : ''}
                </p>
                <ul className="max-h-44 overflow-y-auto bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 space-y-1 text-xs text-brand-ink">
                  {resultado.avisos.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}

            {r.cargadores > 0 && (
              <p className="text-xs text-brand-slate">
                {r.cargadores} portátil{r.cargadores !== 1 ? 'es quedan' : ' queda'} con su cargador en la casilla nueva (sale de sus Observaciones).
              </p>
            )}

            <p className="text-xs text-brand-slate flex gap-1.5">
              <CheckCircle2 size={13} className="flex-shrink-0 mt-px text-brand-gray" />
              Se hace una sola vez. Antes, exporta el inventario como respaldo.
            </p>

            {progreso && (
              <div aria-live="polite">
                <div className="h-1.5 bg-brand-bg rounded-full overflow-hidden">
                  <div className="h-full bg-brand-orange origin-left transition-transform"
                    style={{ transform: `scaleX(${progreso.hecho / progreso.total})` }} />
                </div>
                <p className="mt-1 text-xs text-brand-gray tabular-nums">Lote {progreso.hecho} de {progreso.total}</p>
              </div>
            )}
          </div>
        )}

        <FormActions error={error}>
          <Button variant="secondary" type="button" onClick={cerrar} disabled={busy}>Cancelar</Button>
          <Button type="submit" disabled={!r || busy} className="flex items-center gap-2">
            {busy && <Spinner size="sm" tone="dark" />}
            {busy ? 'Importando…' : 'Importar'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
};

export default ImportarHojasModal;
