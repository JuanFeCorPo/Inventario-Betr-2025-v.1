// Piezas compartidas de las solicitudes: estado, conversación y campo para escribir.
import { useState } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { Spinner } from '../ui';
import { fieldClass } from '../ui/fieldClasses';
import useAsyncAction from '../../hooks/useAsyncAction';
import useAdjuntos from '../../hooks/useAdjuntos';
import { SelectorAdjuntos, AdjuntosDelMensaje } from './AdjuntosUI';
import { ESTADOS_TICKET, haceCuanto } from '../../utils/tickets';
import { formatFechaHora } from '../../utils/format';

export const EstadoTicket = ({ estado }) => {
  const e = ESTADOS_TICKET[estado] ?? ESTADOS_TICKET.recibido;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${e.cls}`}>{e.label}</span>;
};

export const PuntoNuevo = ({ label = 'Sin leer' }) => (
  <span className="inline-flex w-2 h-2 rounded-full bg-brand-orange flex-shrink-0" title={label} aria-label={label} role="img" />
);

// Conversación: el reporte inicial y luego los mensajes. `yo` = 'ti' o 'colaborador'.
// `cargarAdjunto(adjunto)` devuelve el Blob de un archivo adjunto (leerAdjunto de useTickets).
export const Conversacion = ({ ticket, yo, cargarAdjunto }) => {
  const burbuja = (m, i) => {
    const mio = m.autor === yo;
    return (
      <li key={i} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${m.resolucion ? 'bg-emerald-50 border border-emerald-200 text-brand-ink' : mio ? 'bg-brand-ink text-white' : 'bg-brand-bg text-brand-ink'}`}>
          {m.resolucion && <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-1"><CheckCircle2 size={13} aria-hidden="true" /> Solución</p>}
          {m.texto && <p className="whitespace-pre-line break-words">{m.texto}</p>}
          <AdjuntosDelMensaje adjuntos={m.adjuntos} cargar={cargarAdjunto} oscuro={mio && !m.resolucion} />
          <p className={`text-[11px] mt-1 ${mio && !m.resolucion ? 'text-white/70' : 'text-brand-gray'}`} title={formatFechaHora(m.fecha?.toDate?.())}>
            {m.nombre} · {haceCuanto(m.fecha)}
          </p>
        </div>
      </li>
    );
  };
  const inicial = { autor: 'colaborador', nombre: ticket.creadoPor?.nombre || ticket.creadoPor?.email, texto: ticket.descripcion, fecha: ticket.creadoAt, adjuntos: ticket.adjuntos };
  return <ol className="space-y-2.5">{[inicial, ...(ticket.mensajes ?? [])].map(burbuja)}</ol>;
};

// Campo para responder (Enter + Ctrl/Cmd envía), con archivos adjuntos opcionales.
// `onEnviar(texto, archivos)`: se puede enviar solo un archivo, sin texto.
export const CampoMensaje = ({ onEnviar, placeholder = 'Escribe un mensaje…', disabled = false }) => {
  const [texto, setTexto] = useState('');
  const { busy, error, run } = useAsyncAction();
  const adj = useAdjuntos();
  const hayAlgo = !!texto.trim() || adj.archivos.length > 0;
  const enviar = async (e) => {
    e?.preventDefault();
    if (!hayAlgo || busy || adj.procesando) return;
    const ok = await run(() => onEnviar(texto, adj.archivos), 'No se pudo enviar. Revisa tu conexión.');
    if (ok) { setTexto(''); adj.limpiar(); }
  };
  return (
    <form onSubmit={enviar} className="space-y-1.5">
      <div className="flex items-end gap-2">
        <textarea value={texto} onChange={e => setTexto(e.target.value)} placeholder={placeholder} rows={2} disabled={disabled}
          aria-label={placeholder} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) enviar(e); }}
          className={`${fieldClass} resize-none flex-1`} />
        <button type="submit" disabled={!hayAlgo || busy || adj.procesando || disabled} aria-label="Enviar mensaje"
          className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl vidrio-tinta disabled:opacity-40 transition">
          {busy ? <Spinner size="sm" tone="light" /> : <Send size={16} />}
        </button>
      </div>
      <SelectorAdjuntos adj={adj} disabled={busy || disabled} />
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    </form>
  );
};
