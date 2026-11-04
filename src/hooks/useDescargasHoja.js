// Descargar una hoja de vida en Excel (plantilla F-MAN) o PDF, con aviso si algo falla.
import { useState } from 'react';
import { descargarExcel, imprimirHoja } from '../utils/hojaDeVidaExport';

const useDescargasHoja = (crearDatos) => {
  const [aviso, setAviso] = useState('');
  const [generando, setGenerando] = useState(false);
  const excel = async () => {
    if (generando) return;
    setAviso(''); setGenerando(true);
    try { await descargarExcel(crearDatos()); }
    catch (e) { console.error(e); setAviso('No se pudo generar el Excel. Intenta de nuevo.'); }
    finally { setGenerando(false); }
  };
  const pdf = () => {
    setAviso('');
    if (!imprimirHoja(crearDatos())) setAviso('El navegador bloqueó la ventana: permite las ventanas emergentes para este sitio.');
  };
  return { excel, pdf, aviso, generando };
};

export default useDescargasHoja;
