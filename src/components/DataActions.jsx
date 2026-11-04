import { Download, Upload, FileSpreadsheet, Database, ChevronDown } from 'lucide-react';
import { usePopover } from '../hooks/usePopover';

// Acciones de datos del inventario (se usan de vez en cuando): un solo menú "Datos"
// junto al título del inventario, igual en computador y celular. "Exportar"
// baja justo lo que se ve; Importar y Reporte son de Administrador.
const DataActions = ({ isAdmin, exportLabel, exportTitle, onExport, onImport, onReport }) => {
  const { open, setOpen, ref, shown } = usePopover();
  const item = 'w-full flex items-start gap-2.5 px-3 py-2.5 text-sm text-left text-brand-ink hover:bg-brand-bg rounded-lg transition-colors';
  const elegir = (fn) => () => { setOpen(false); fn(); };
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        aria-label="Exportar, importar o generar reporte" title="Exportar, importar o generar reporte"
        className="h-10 px-3 flex items-center gap-1.5 vidrio text-brand-slate hover:text-brand-ink text-sm rounded-xl transition">
        <Database size={15} aria-hidden="true" /> <span className="hidden md:inline">Datos</span> <ChevronDown size={14} className={`text-brand-gray transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {shown && (
        <div role="menu" className={`absolute right-0 top-12 z-40 w-72 bg-white border border-brand-border rounded-2xl shadow-xl shadow-brand-ink/10 p-1.5 ${open ? 'animate-pop-in' : 'animate-pop-out'}`}>
          <button role="menuitem" type="button" className={item} onClick={elegir(onExport)}>
            <Download size={15} className="text-brand-slate mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span><span className="block">{exportLabel}</span><span className="block text-xs text-brand-gray">{exportTitle}</span></span>
          </button>
          {isAdmin && (<>
            <button role="menuitem" type="button" className={item} onClick={elegir(onImport)}>
              <Upload size={15} className="text-brand-slate mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span><span className="block">Importar desde Excel</span><span className="block text-xs text-brand-gray">Carga varios equipos a la vez</span></span>
            </button>
            <button role="menuitem" type="button" className={item} onClick={elegir(onReport)}>
              <FileSpreadsheet size={15} className="text-brand-slate mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span><span className="block">Reporte por periodo</span><span className="block text-xs text-brand-gray">Movimientos del inventario entre dos fechas</span></span>
            </button>
          </>)}
        </div>
      )}
    </div>
  );
};

export default DataActions;
