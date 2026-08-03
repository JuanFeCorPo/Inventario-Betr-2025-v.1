import { useState } from 'react';
import { Modal, Button } from '../ui';
import { gatherPeriodEntries } from '../../utils/report';
import { exportPeriodReport } from '../../utils/excel';
import { Loader2, FileSpreadsheet } from 'lucide-react';

const todayStr = () => new Date().toISOString().split('T')[0];
const monthAgoStr = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split('T')[0];
};

const ReportModal = ({ isOpen, onClose, db, items }) => {
  const [start, setStart]     = useState(monthAgoStr());
  const [end, setEnd]         = useState(todayStr());
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [result, setResult]   = useState(null); // cantidad de movimientos del último reporte generado

  const fieldClass = 'w-full bg-brand-bg border border-brand-border text-brand-ink px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all text-sm';

  const handleGenerate = async () => {
    setError('');
    setResult(null);
    if (!start || !end || start > end) { setError('Revisa las fechas: la de inicio debe ser anterior o igual a la de fin.'); return; }

    setLoading(true);
    try {
      const entries = await gatherPeriodEntries(db, items, start, end);
      await exportPeriodReport(entries, start, end);
      setResult(entries.length);
    } catch (err) {
      console.error(err);
      setError('No se pudo generar el reporte. Verifica tu conexión o permisos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generar Reporte por Periodo" size="sm">
      <div className="space-y-4">
        <p className="text-brand-slate text-sm">
          Descarga un Excel con todos los movimientos del inventario (altas, ediciones, bajas, notas) en el rango de fechas que elijas.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-brand-slate mb-1.5 block">Desde</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-slate mb-1.5 block">Hasta</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} className={fieldClass} />
          </div>
        </div>

        {error && (
          <p className="text-rose-600 text-xs text-center bg-rose-50 border border-rose-200 rounded-lg py-2 px-3">{error}</p>
        )}
        {result !== null && !error && (
          <p className="text-emerald-700 text-xs text-center bg-emerald-50 border border-emerald-200 rounded-lg py-2 px-3">
            Reporte descargado con {result} movimiento{result !== 1 ? 's' : ''}.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cerrar</Button>
          <Button variant="primary" onClick={handleGenerate} disabled={loading} className="flex items-center gap-2">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            {loading ? 'Generando…' : 'Generar Reporte'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ReportModal;
