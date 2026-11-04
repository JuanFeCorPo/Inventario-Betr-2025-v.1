// Descargar una hoja de vida (F-MAN-02 / F-MAN-03) en Excel o PDF.
// `crearDatos` arma los datos en el momento del clic (con lo último del inventario).

import { FileSpreadsheet, FileText } from 'lucide-react';
import { Spinner } from '../ui';
import useDescargasHoja from '../../hooks/useDescargasHoja';

const estilos = {
  md: 'gap-2 text-sm px-3 h-10 rounded-xl shadow-sm border border-brand-border bg-white hover:bg-brand-bg',
  sm: 'gap-1.5 text-xs px-3 py-1.5 rounded-lg vidrio font-medium',
};

const DescargarHoja = ({ crearDatos, size = 'md', disabled = false }) => {
  const { excel, pdf, aviso, generando } = useDescargasHoja(crearDatos);
  const base = `flex items-center text-brand-slate hover:text-brand-ink transition disabled:opacity-50 ${estilos[size]}`;
  const icono = size === 'sm' ? 12 : 14;
  return (
    <>
      <button type="button" onClick={excel} disabled={disabled || generando} className={base} title="Descargar la hoja de vida en Excel (formato F-MAN)">
        {generando ? <Spinner size="sm" /> : <FileSpreadsheet size={icono} />} Excel
      </button>
      <button type="button" onClick={pdf} disabled={disabled} className={base} title="Abrir la hoja de vida para imprimir o guardar como PDF">
        <FileText size={icono} /> PDF
      </button>
      {aviso && <p role="alert" className="basis-full text-xs text-rose-700">{aviso}</p>}
    </>
  );
};

export default DescargarHoja;
