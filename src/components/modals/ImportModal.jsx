import { useState } from 'react';
import { Modal, Button } from '../ui';
import { parseInventoryExcel } from '../../utils/excel';
import { Upload, AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';

const withDuplicateFlags = (rows, existingItems) => {
  const seenInv    = new Set();
  const seenSerial = new Set();
  return rows.map(row => {
    const warnings = [...row.warnings];
    const invNorm    = row.numeroInventario.toLowerCase();
    const serialNorm = row.numeroSerial.toLowerCase();

    if (invNorm) {
      const dup = existingItems.find(i => i.numeroInventario?.trim().toLowerCase() === invNorm);
      if (dup) warnings.push(`N° de inventario ya existe (${dup.nombre}).`);
      if (seenInv.has(invNorm)) warnings.push('N° de inventario repetido en este archivo.');
      seenInv.add(invNorm);
    }
    if (serialNorm) {
      const dup = existingItems.find(i => i.numeroSerial?.trim().toLowerCase() === serialNorm);
      if (dup) warnings.push(`N° de serial ya existe (${dup.nombre}).`);
      if (seenSerial.has(serialNorm)) warnings.push('N° de serial repetido en este archivo.');
      seenSerial.add(serialNorm);
    }
    return { ...row, warnings };
  });
};

const ImportModal = ({ isOpen, onClose, items, onImport }) => {
  const [step, setStep]     = useState('upload'); // upload | preview | importing | done
  const [rows, setRows]     = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [fileError, setFileError] = useState('');
  const [importedCount, setImportedCount] = useState(0);

  const reset = () => { setStep('upload'); setRows([]); setSelected(new Set()); setFileError(''); setImportedCount(0); };
  const handleClose = () => { reset(); onClose(); };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError('');
    try {
      const parsed = withDuplicateFlags(await parseInventoryExcel(file), items);
      setRows(parsed);
      setSelected(new Set(parsed.filter(r => r.errors.length === 0).map(r => r._row)));
      setStep('preview');
    } catch (err) {
      setFileError(err.message);
    } finally {
      e.target.value = '';
    }
  };

  const toggleRow = (row) => {
    if (row.errors.length > 0) return;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(row._row) ? next.delete(row._row) : next.add(row._row);
      return next;
    });
  };

  const handleConfirm = async () => {
    setStep('importing');
    const toImport = rows.filter(r => selected.has(r._row))
      .map(({ errors, warnings, _row, ...data }) => data);
    await onImport(toImport);
    setImportedCount(toImport.length);
    setStep('done');
  };

  const validCount   = rows.filter(r => r.errors.length === 0).length;
  const invalidCount = rows.length - validCount;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar Inventario desde Excel" size="lg">
      {step === 'upload' && (
        <div className="space-y-4">
          <p className="text-brand-slate text-sm">
            Sube un archivo Excel (.xlsx) con tu inventario. Puedes usar el botón <span className="font-medium text-brand-ink">Exportar</span> primero
            para descargar una plantilla con las columnas y valores válidos de categoría/estado.
          </p>
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-brand-border rounded-xl py-10 cursor-pointer hover:border-brand-orange/50 hover:bg-brand-bg/50 transition-all">
            <Upload size={28} className="text-brand-gray" />
            <span className="text-sm text-brand-slate">Haz clic para seleccionar un archivo .xlsx</span>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          </label>
          {fileError && (
            <p className="text-rose-600 text-xs text-center bg-rose-50 border border-rose-200 rounded-lg py-2 px-3">{fileError}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle2 size={15} /> {validCount} listos</span>
            {invalidCount > 0 && (
              <span className="flex items-center gap-1.5 text-rose-600"><XCircle size={15} /> {invalidCount} con errores (no se importarán)</span>
            )}
            <span className="text-brand-gray ml-auto">{selected.size} seleccionados</span>
          </div>

          <div className="max-h-[50vh] overflow-auto border border-brand-border rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-brand-bg">
                <tr>
                  <th className="px-3 py-2"></th>
                  <th className="px-3 py-2">Fila</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Categoría</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Condición</th>
                  <th className="px-3 py-2">N° Inv.</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {rows.map(row => (
                  <tr key={row._row} className={row.errors.length > 0 ? 'bg-rose-50/50' : row.warnings.length > 0 ? 'bg-amber-50/50' : ''}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(row._row)} disabled={row.errors.length > 0}
                        onChange={() => toggleRow(row)} />
                    </td>
                    <td className="px-3 py-2 text-brand-gray">{row._row}</td>
                    <td className="px-3 py-2 text-brand-ink font-medium">{row.nombre || '—'}</td>
                    <td className="px-3 py-2 text-brand-slate">{row.categoria}</td>
                    <td className="px-3 py-2 text-brand-slate">{row.estado}</td>
                    <td className="px-3 py-2 text-brand-slate">{row.condicion}</td>
                    <td className="px-3 py-2 text-brand-slate font-mono">{row.numeroInventario || '—'}</td>
                    <td className="px-3 py-2 text-brand-slate">{row.fechaIngreso || '—'}</td>
                    <td className="px-3 py-2">
                      {row.errors.map((e, i) => (
                        <div key={i} className="flex items-center gap-1 text-rose-600"><XCircle size={11} className="flex-shrink-0" />{e}</div>
                      ))}
                      {row.warnings.map((w, i) => (
                        <div key={i} className="flex items-center gap-1 text-amber-600"><AlertTriangle size={11} className="flex-shrink-0" />{w}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={handleClose}>Cancelar</Button>
            <Button variant="primary" disabled={selected.size === 0} onClick={handleConfirm}>
              Importar {selected.size} equipo{selected.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="flex flex-col items-center gap-3 py-16 text-brand-gray">
          <Loader2 size={28} className="animate-spin text-brand-orange" />
          <span className="text-sm">Importando equipos…</span>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <CheckCircle2 size={40} className="text-emerald-500" />
          <p className="text-brand-ink font-semibold">Se importaron {importedCount} equipo{importedCount !== 1 ? 's' : ''} correctamente.</p>
          <Button variant="primary" onClick={handleClose} className="mt-2">Cerrar</Button>
        </div>
      )}
    </Modal>
  );
};

export default ImportModal;
