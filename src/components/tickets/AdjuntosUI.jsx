// Archivos adjuntos de un ticket: botón para elegirlos, fichas de lo elegido y
// cómo se ven dentro de la conversación (miniatura de imagen o tarjeta de PDF).
// Los archivos se guardan en Firestore (utils/adjuntos.js): máx. 5 MB por mensaje, 3 archivos.

import { useRef, useState, useEffect } from 'react';
import { Paperclip, X, FileText, Download, Loader2 } from 'lucide-react';
import { Spinner } from '../ui';
import { ACEPTAR, esImagen, formatoTamano } from '../../utils/adjuntos';

// Botón + fichas de lo elegido. `adj` viene de useAdjuntos().
export const SelectorAdjuntos = ({ adj, disabled = false, compacto = false }) => {
  const input = useRef(null);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => input.current?.click()} disabled={disabled || adj.procesando}
          className={`flex items-center gap-2 vidrio text-brand-slate hover:text-brand-ink text-sm font-medium rounded-xl transition disabled:opacity-50 ${compacto ? 'h-11 w-11 justify-center' : 'h-9 px-3'}`}
          aria-label="Adjuntar un archivo" title="Adjuntar PDF o imagen (máx. 5 MB)">
          {adj.procesando ? <Spinner size="sm" tone="dark" /> : <Paperclip size={15} aria-hidden="true" />}
          {!compacto && <span>{adj.procesando ? 'Preparando…' : 'Adjuntar'}</span>}
        </button>
        {!compacto && !adj.archivos.length && <span className="text-xs text-brand-gray">PDF o imagen · máx. 5 MB</span>}
        <input ref={input} type="file" accept={ACEPTAR} multiple className="sr-only" tabIndex={-1} aria-hidden="true"
          onChange={(e) => { adj.agregar(e.target.files); e.target.value = ''; }} />
      </div>

      {adj.archivos.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Archivos para adjuntar">
          {adj.archivos.map(a => (
            <li key={a.id} className="flex items-center gap-2 max-w-full pl-2.5 pr-1 h-8 rounded-lg bg-brand-bg border border-brand-border text-xs text-brand-ink">
              {esImagen(a.tipo)
                ? <img src={`data:${a.tipo};base64,${a.base64}`} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
                : <FileText size={14} className="text-rose-600 flex-shrink-0" aria-hidden="true" />}
              <span className="truncate max-w-[160px]">{a.nombre}</span>
              <span className="text-brand-gray tabular-nums flex-shrink-0">{formatoTamano(a.tamano)}</span>
              <button type="button" onClick={() => adj.quitar(a.id)} aria-label={`Quitar ${a.nombre}`}
                className="w-6 h-6 flex items-center justify-center rounded-md text-brand-gray hover:text-rose-600 hover:bg-white transition-colors flex-shrink-0">
                <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {adj.error && <p role="alert" className="text-xs text-rose-700">{adj.error}</p>}
    </div>
  );
};

// Abre el Blob en otra pestaña; si el navegador lo bloquea, lo descarga.
// (Sin "noopener": con él window.open siempre devuelve null y no se sabría si se bloqueó.
// El archivo es un blob: creado aquí mismo, del mismo origen.)
const abrir = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    const a = document.createElement('a');
    a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

const Miniatura = ({ adjunto, cargar }) => {
  const [estado, setEstado] = useState({ url: '', blob: null, error: false });
  useEffect(() => {
    let vivo = true; let url = '';
    cargar(adjunto).then(blob => { if (!vivo) return; url = URL.createObjectURL(blob); setEstado({ url, blob, error: false }); })
      .catch(() => { if (vivo) setEstado({ url: '', blob: null, error: true }); });
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [adjunto, cargar]);
  if (estado.error) return <span className="text-xs italic opacity-80">No se pudo cargar {adjunto.nombre}</span>;
  if (!estado.url) return <span className="flex items-center justify-center w-40 h-28 rounded-lg bg-black/10"><Loader2 size={18} className="animate-spin opacity-60" aria-label="Cargando imagen" /></span>;
  return (
    <button type="button" onClick={() => abrir(estado.blob, adjunto.nombre)} aria-label={`Abrir ${adjunto.nombre}`} className="block rounded-lg overflow-hidden">
      <img src={estado.url} alt={adjunto.nombre} className="max-h-48 max-w-full object-cover rounded-lg" />
    </button>
  );
};

const TarjetaPdf = ({ adjunto, cargar, oscuro }) => {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const click = async () => {
    setCargando(true); setError('');
    try { abrir(await cargar(adjunto), adjunto.nombre); } catch (e) { setError(e.message || 'No se pudo abrir.'); } finally { setCargando(false); }
  };
  return (
    <div>
      <button type="button" onClick={click} disabled={cargando} aria-label={`Abrir ${adjunto.nombre}, PDF de ${formatoTamano(adjunto.tamano)}`}
        className={`flex items-center gap-2.5 w-full max-w-[280px] text-left px-2.5 py-2 rounded-lg border transition-colors ${oscuro ? 'bg-white/10 border-white/20 hover:bg-white/15' : 'bg-white border-brand-border hover:bg-brand-bg'}`}>
        <span className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0"><FileText size={17} aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className={`block text-xs font-medium truncate ${oscuro ? 'text-white' : 'text-brand-ink'}`}>{adjunto.nombre}</span>
          <span className={`block text-[11px] ${oscuro ? 'text-white/70' : 'text-brand-gray'}`}>PDF · {formatoTamano(adjunto.tamano)}</span>
        </span>
        {cargando ? <Loader2 size={15} className="animate-spin flex-shrink-0" aria-hidden="true" /> : <Download size={15} className="flex-shrink-0 opacity-70" aria-hidden="true" />}
      </button>
      {error && <p role="alert" className="text-[11px] mt-1 opacity-90">{error}</p>}
    </div>
  );
};

// Los adjuntos de un mensaje dentro de su burbuja. `cargar(adjunto)` devuelve un Blob.
export const AdjuntosDelMensaje = ({ adjuntos = [], cargar, oscuro = false }) => {
  if (!adjuntos.length || !cargar) return null;
  return (
    <div className="mt-2 space-y-2">
      {adjuntos.map(a => (esImagen(a.tipo)
        ? <Miniatura key={a.id} adjunto={a} cargar={cargar} />
        : <TarjetaPdf key={a.id} adjunto={a} cargar={cargar} oscuro={oscuro} />))}
    </div>
  );
};
