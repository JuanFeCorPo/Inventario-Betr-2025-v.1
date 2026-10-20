import { useState } from 'react';
import { Modal, Button, Field, FormActions, Spinner } from '../ui';
import { fieldClass } from '../ui/fieldClasses';
import { gatherPeriodEntries } from '../../utils/report';
import { exportPeriodReport } from '../../utils/excel';
import { hoyLocal, haceUnMesLocal } from '../../utils/format';
import useAsyncAction from '../../hooks/useAsyncAction';
import { FileSpreadsheet } from 'lucide-react';

const ReportModal = ({ isOpen, onClose, db, items }) => {
  const [start, setStart]     = useState(haceUnMesLocal());
  const [end, setEnd]         = useState(hoyLocal());
  const [format, setFormat]   = useState('xlsx');
  const [rangeError, setRangeError] = useState('');
  const [result, setResult]   = useState(null); // cantidad de movimientos del último reporte generado
  const { busy, error, run } = useAsyncAction();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult(null);
    if (!start || !end || start > end) {
      setRangeError('Revisa las fechas: la de inicio debe ser anterior o igual a la de fin.');
      return;
    }
    setRangeError('');
    await run(async () => {
      const entries = await gatherPeriodEntries(db, items, start, end);
      await exportPeriodReport(entries, start, end, format);
      setResult(entries.length);
    }, 'No se pudo generar el reporte. Verifica tu conexión o permisos.');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generar reporte por periodo" size="sm">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <p className="text-brand-slate text-sm">
          Descarga todos los movimientos del inventario (altas, ediciones, bajas, notas) en el rango de fechas y formato que elijas.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde" required>
            <input type="date" value={start} max={end || hoyLocal()} onChange={e => { setStart(e.target.value); setRangeError(''); }}
              autoFocus aria-invalid={!!rangeError} className={fieldClass} />
          </Field>
          <Field label="Hasta" required>
            <input type="date" value={end} max={hoyLocal()} onChange={e => { setEnd(e.target.value); setRangeError(''); }}
              aria-invalid={!!rangeError} className={fieldClass} />
          </Field>
        </div>
        {rangeError && <p role="alert" className="text-xs text-rose-700 -mt-2">{rangeError}</p>}

        <fieldset>
          <legend className="text-xs font-semibold text-brand-slate mb-1.5">Formato</legend>
          <div className="grid grid-cols-2 gap-2">
            {[{ value: 'xlsx', label: 'Excel (.xlsx)' }, { value: 'csv', label: 'CSV (.csv)' }].map(opt => (
              <button key={opt.value} type="button" onClick={() => setFormat(opt.value)} aria-pressed={format === opt.value}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition ${
                  format === opt.value
                    ? 'bg-brand-orange/10 border-brand-orange text-brand-ember'
                    : 'bg-brand-bg border-brand-border text-brand-slate hover:border-brand-orange/40'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </fieldset>

        {result !== null && !error && (
          <p role="status" className="text-emerald-700 text-xs bg-emerald-50 border border-emerald-200 rounded-lg py-2 px-3 animate-reveal">
            Reporte descargado con {result} movimiento{result !== 1 ? 's' : ''}.
          </p>
        )}

        <FormActions error={error}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>Cerrar</Button>
          <Button variant="primary" type="submit" disabled={busy} className="flex items-center gap-2">
            {busy ? <Spinner size="sm" tone="dark" /> : <FileSpreadsheet size={14} />}
            {busy ? 'Generando…' : 'Generar reporte'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
};

export default ReportModal;
