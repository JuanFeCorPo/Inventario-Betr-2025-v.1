import { Download, Upload, FileSpreadsheet } from 'lucide-react';

const accion = 'flex items-center gap-1.5 text-brand-slate hover:text-brand-ink text-xs font-medium px-2.5 h-8 rounded-lg hover:bg-white transition-colors';

// Acciones sobre los datos del inventario, a la vista junto a la lista (antes vivían escondidas
// en el menú "Más"). "Exportar" baja justo lo que se ve; Importar y Reporte son de Administrador.
// En celular se quedan en el menú ⋮ del encabezado (hay poco espacio); entre 640 y 768 px
// se muestran solo como icono.
const DataActions = ({ isAdmin, exportLabel, exportTitle, onExport, onImport, onReport }) => (
  <div className="hidden sm:flex items-center gap-0.5" role="group" aria-label="Acciones de datos">
    <button type="button" onClick={onExport} className={accion} aria-label={exportLabel} title={exportTitle}>
      <Download size={13} /> <span className="hidden md:inline">{exportLabel}</span>
    </button>
    {isAdmin && (<>
      <button type="button" onClick={onImport} className={accion} aria-label="Importar desde Excel" title="Carga varios equipos a la vez desde un archivo Excel">
        <Upload size={13} /> <span className="hidden md:inline">Importar</span>
      </button>
      <button type="button" onClick={onReport} className={accion} aria-label="Generar reporte por periodo" title="Descarga los movimientos del inventario entre dos fechas">
        <FileSpreadsheet size={13} /> <span className="hidden md:inline">Reporte</span>
      </button>
    </>)}
  </div>
);

export default DataActions;
