// ─────────────────────────────────────────────
//  Solicitudes de soporte (bandeja de T.I.).
//  Lista a la izquierda (abiertas primero, las que impiden trabajar arriba) y
//  el detalle a la derecha: conversación, tomar, responder y resolver.
//  Al resolver, queda en la hoja de vida del puesto (Novedad + Correctivo).
// ─────────────────────────────────────────────

import { useState, useMemo, useEffect, useRef } from 'react';
import { ArrowLeft, Search, Loader2, Inbox, AlertOctagon, CheckCircle2, RotateCcw, Hand, X } from 'lucide-react';
import { Button, Field, Spinner, ToastHost } from '../components/ui';
import { fieldClass } from '../components/ui/fieldClasses';
import useAsyncAction from '../hooks/useAsyncAction';
import useToast from '../hooks/useToast';
import { useTicketsTI } from '../hooks/useTickets';
import { tituloTicket, ordenarTickets, haceCuanto, estaAbierto, pendientesTI, URGENCIAS, CATEGORIAS_TICKET } from '../utils/tickets';
import { formatFechaHora } from '../utils/format';
import { EstadoTicket, Conversacion, CampoMensaje, PuntoNuevo } from '../components/tickets/TicketUI';

const plano = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const FILTROS = [['abiertas', 'Abiertas'], ['resueltas', 'Resueltas'], ['todas', 'Todas']];
const ESTADOS_FINALES = ['En Uso', 'Disponible', 'Fuera de Servicio'];

const Fila = ({ t, activa, onClick }) => (
  <li>
    <button type="button" onClick={onClick} aria-current={activa ? 'true' : undefined}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${activa ? 'bg-brand-orange/10' : 'hover:bg-brand-bg/70'}`}>
      <span className="pt-1.5 w-2 flex-shrink-0">{pendientesTI([t]).length > 0 && <PuntoNuevo label="Pide atención" />}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          {t.urgencia === 'bloquea' && estaAbierto(t) && <AlertOctagon size={13} className="text-rose-600 flex-shrink-0" aria-label="No puede trabajar" />}
          <span className="text-sm font-semibold text-brand-ink truncate">{tituloTicket(t)}</span>
        </span>
        <span className="block text-xs text-brand-slate truncate">{t.creadoPor?.nombre || t.creadoPor?.email}{t.puestoNombre ? ` · ${t.puestoNombre}` : ''}</span>
        <span className="block text-xs text-brand-gray truncate">{t.descripcion}</span>
      </span>
      <span className="flex flex-col items-end gap-1 flex-shrink-0">
        <EstadoTicket estado={t.estado} />
        <span className="text-[11px] text-brand-gray whitespace-nowrap">{haceCuanto(t.creadoAt)}</span>
      </span>
    </button>
  </li>
);

const Dato = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-xs text-brand-gray">{label}</dt>
    <dd className="text-sm text-brand-ink mt-0.5 break-words">{children || '—'}</dd>
  </div>
);

// Acciones según el estado: tomar, resolver, reabrir.
const Acciones = ({ t, acciones, onAviso }) => {
  const [mantenimiento, setMantenimiento] = useState(false);
  const [resolviendo, setResolviendo] = useState(false);
  const [solucion, setSolucion] = useState('');
  const [registrar, setRegistrar] = useState(true);
  const [estadoFinal, setEstadoFinal] = useState('En Uso');
  const [errorSol, setErrorSol] = useState('');
  const { busy, error, run } = useAsyncAction();

  useEffect(() => { setMantenimiento(false); setResolviendo(false); setSolucion(''); setRegistrar(true); setEstadoFinal('En Uso'); setErrorSol(''); }, [t.id]);

  if (t.estado === 'resuelto') {
    return (
      <Button variant="secondary" size="sm" disabled={busy} className="flex items-center gap-1.5"
        onClick={() => run(async () => { await acciones.reabrir(t); onAviso('Ticket reabierto'); }, 'No se pudo reabrir.')}>
        <RotateCcw size={13} /> Reabrir
      </Button>
    );
  }

  const resolver = (e) => {
    e.preventDefault();
    if (solucion.trim().length < 3) { setErrorSol('Escribe qué se hizo para solucionarlo.'); return; }
    run(async () => {
      await acciones.resolver(t, { solucion, registrarEnHoja: registrar, estadoEquipo: estadoFinal });
      onAviso(registrar && t.puestoId ? `Resuelta y registrada en la hoja de vida de ${t.puestoNombre}` : 'Ticket resuelto');
    }, 'No se pudo resolver. Revisa tu conexión e inténtalo de nuevo.');
  };

  return (
    <div className="space-y-3">
      {t.estado === 'recibido' && !resolviendo && (
        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" disabled={busy} className="flex items-center gap-1.5"
            onClick={() => run(async () => { await acciones.tomar(t, { mantenimiento }); onAviso('Ticket en proceso'); }, 'No se pudo tomar el ticket.')}>
            {busy ? <Spinner size="sm" tone="dark" /> : <Hand size={14} />} Tomar ticket
          </Button>
          {t.equipoId && (
            <label className="flex items-center gap-2 text-xs text-brand-slate cursor-pointer">
              <input type="checkbox" checked={mantenimiento} onChange={e => setMantenimiento(e.target.checked)} className="w-4 h-4 rounded border-brand-border" />
              Enviar {t.equipoNombre || 'el equipo'} a mantenimiento
            </label>
          )}
        </div>
      )}

      {!resolviendo ? (
        <Button variant="secondary" size="sm" className="flex items-center gap-1.5" onClick={() => setResolviendo(true)}>
          <CheckCircle2 size={14} /> Resolver
        </Button>
      ) : (
        <form onSubmit={resolver} noValidate className="space-y-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 animate-reveal">
          <Field label="¿Qué se hizo?" required error={errorSol}>
            <textarea value={solucion} onChange={e => { setSolucion(e.target.value); setErrorSol(''); }} autoFocus
              placeholder="Ej: se cambió el mouse por el BM-INV-0538 y quedó funcionando." className={`${fieldClass} h-20 resize-none bg-white`} />
          </Field>
          {t.puestoId && (
            <label className="flex items-start gap-2 text-xs text-brand-slate cursor-pointer">
              <input type="checkbox" checked={registrar} onChange={e => setRegistrar(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-brand-border" />
              <span>Registrar en la hoja de vida de <b>{t.puestoNombre}</b> (el reporte como Novedad y esto como Correctivo)</span>
            </label>
          )}
          {t.equipoEnMantenimiento && (
            <Field label={`${t.equipoNombre || 'El equipo'} queda`}>
              <select value={estadoFinal} onChange={e => setEstadoFinal(e.target.value)} className={`${fieldClass} bg-white`}>
                {ESTADOS_FINALES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setResolviendo(false)} disabled={busy}>Cancelar</Button>
            <Button type="submit" size="sm" disabled={busy} className="flex items-center gap-1.5">
              {busy ? <Spinner size="sm" tone="dark" /> : <CheckCircle2 size={14} />} Marcar como resuelta
            </Button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    </div>
  );
};

const Detalle = ({ t, isAdmin, acciones, onCerrar, onAviso, onVerPuesto }) => (
  <article className="bg-white border border-brand-border rounded-2xl shadow-card">
    <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-brand-border">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <EstadoTicket estado={t.estado} />
          <span className="text-xs text-brand-gray font-mono">{t.codigo}</span>
          {t.urgencia === 'bloquea' && estaAbierto(t) && <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700"><AlertOctagon size={12} aria-hidden="true" /> No puede trabajar</span>}
        </div>
        <h2 className="text-lg font-bold text-brand-ink leading-tight break-words">{tituloTicket(t)}</h2>
      </div>
      <button type="button" onClick={onCerrar} aria-label="Cerrar detalle" className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg vidrio text-brand-gray hover:text-brand-ink">
        <X size={16} />
      </button>
    </header>
    <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 px-5 py-4 border-b border-brand-border">
      <Dato label="Reporta">{t.creadoPor?.nombre}<span className="block text-xs text-brand-gray break-all">{t.creadoPor?.email}</span></Dato>
      <Dato label="Puesto">
        {t.puestoNombre}
        {t.puestoId && onVerPuesto && (
          <button type="button" onClick={() => onVerPuesto(t.puestoId)}
            className="block text-xs font-medium text-brand-ember underline underline-offset-2 decoration-brand-ember/40 hover:decoration-brand-ember mt-0.5">
            Ver hoja de vida
          </button>
        )}
      </Dato>
      <Dato label="Tipo">{CATEGORIAS_TICKET[t.categoria]?.corto}{t.equipoCodigo ? <span className="block text-xs font-mono text-brand-gray">{t.equipoCodigo}</span> : null}</Dato>
      <Dato label="Recibida">{formatFechaHora(t.creadoAt?.toDate?.())}</Dato>
      <Dato label="Urgencia">{URGENCIAS[t.urgencia]?.label}</Dato>
      <Dato label={t.estado === 'resuelto' ? 'Resuelta por' : 'La atiende'}>{t.estado === 'resuelto' ? t.resueltoPor : t.tomadoPor}</Dato>
    </dl>
    <div className="px-5 py-4 space-y-4">
      <Conversacion ticket={t} yo="ti" />
      {isAdmin && estaAbierto(t) && <CampoMensaje onEnviar={(texto) => acciones.responder(t, texto)} placeholder={`Responder a ${t.creadoPor?.nombre?.split(' ')[0] || 'la persona'}…`} />}
      {isAdmin && <div className="pt-1 border-t border-brand-border"><div className="pt-3"><Acciones t={t} acciones={acciones} onAviso={onAviso} /></div></div>}
    </div>
  </article>
);

const SolicitudesScreen = ({ db, user, onBack, onNavigate, ticketInicial = null }) => {
  const isAdmin = user.role === 'Administrador';
  const { tickets, loading, ...acciones } = useTicketsTI(db, user);
  const [filtro, setFiltro] = useState('abiertas');
  const [term, setTerm] = useState('');
  // Desde Inicio se llega con la solicitud ya abierta
  const [selId, setSelId] = useState(ticketInicial);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();

  const abiertas = tickets.filter(estaAbierto).length;
  const nuevas = pendientesTI(tickets).length;
  const lista = useMemo(() => {
    const q = plano(term).trim();
    return ordenarTickets(tickets.filter(t =>
      (filtro === 'todas' || (filtro === 'abiertas' ? estaAbierto(t) : !estaAbierto(t)))
      && (!q || [t.codigo, t.descripcion, t.creadoPor?.nombre, t.creadoPor?.email, t.puestoNombre, t.equipoNombre, t.equipoCodigo].some(v => plano(v).includes(q)))));
  }, [tickets, filtro, term]);

  const sel = tickets.find(t => t.id === selId);
  // En pantalla grande se abre la primera; al abrir una, se marca como vista
  useEffect(() => { if (!selId && lista.length && window.matchMedia('(min-width: 1024px)').matches) setSelId(lista[0].id); }, [lista, selId]);
  const marcar = useRef(acciones.marcarVisto);
  marcar.current = acciones.marcarVisto;
  const idPorMarcar = sel && isAdmin && sel.vistoPorTI === false ? sel.id : null;
  useEffect(() => { if (idPorMarcar) marcar.current({ id: idPorMarcar, vistoPorTI: false }); }, [idPorMarcar]);

  return (
    <div className="min-h-screen bg-brand-bg font-sans">
      <div className="fixed inset-0 bg-glow pointer-events-none" />
      <main className="relative z-10 max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <header className="flex items-center gap-3 sm:gap-4 mb-5">
          {onBack && <button onClick={onBack} aria-label="Volver al inventario" title="Volver al inventario"
            className="w-10 h-10 flex items-center justify-center vidrio rounded-xl transition text-brand-slate hover:text-brand-ink flex-shrink-0">
            <ArrowLeft size={18} />
          </button>}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-brand-ink">Tickets</h1>
            <p className="text-xs text-brand-gray mt-0.5">
              {loading ? 'Cargando…' : `${abiertas} abierta${abiertas === 1 ? '' : 's'}${nuevas ? ` · ${nuevas} piden atención` : ''} · lo que reportan los colaboradores`}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)] gap-4 items-start">
          <section className={`bg-white border border-brand-border rounded-2xl shadow-card overflow-clip ${sel ? 'hidden lg:block' : ''}`}>
            <div className="p-3 border-b border-brand-border space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray pointer-events-none" aria-hidden="true" />
                <input value={term} onChange={e => setTerm(e.target.value)} placeholder="Buscar persona, puesto, equipo o código"
                  aria-label="Buscar tickets" className={`${fieldClass} pl-9`} />
              </div>
              <div role="radiogroup" aria-label="Mostrar" className="grid grid-cols-3 gap-1 p-1 vidrio rounded-xl">
                {FILTROS.map(([k, label]) => (
                  <button key={k} type="button" role="radio" aria-checked={filtro === k} onClick={() => setFiltro(k)}
                    className={`h-8 rounded-lg text-sm font-medium transition ${filtro === k ? 'bg-white text-brand-ink shadow-card' : 'text-brand-slate hover:text-brand-ink'}`}>
                    {label}{k === 'abiertas' && abiertas ? ` · ${abiertas}` : ''}
                  </button>
                ))}
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-brand-ember" /></div>
            ) : lista.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 px-4 text-center">
                <Inbox size={26} className="text-brand-gray/50" aria-hidden="true" />
                <p className="text-sm text-brand-gray">{filtro === 'abiertas' && !term ? 'No hay tickets abiertos.' : 'Ningún ticket coincide.'}</p>
              </div>
            ) : (
              <ul className="divide-y divide-brand-border max-h-[calc(100vh-220px)] overflow-y-auto">
                {lista.map(t => <Fila key={t.id} t={t} activa={t.id === selId} onClick={() => setSelId(t.id)} />)}
              </ul>
            )}
          </section>

          <div className={sel ? '' : 'hidden lg:block'}>
            {sel ? (
              <Detalle t={sel} isAdmin={isAdmin} acciones={acciones} onCerrar={() => setSelId(null)} onAviso={(m) => showToast(m)}
                onVerPuesto={onNavigate ? (puestoId) => onNavigate('puestos', { puestoId }) : undefined} />
            ) : (
              <div className="bg-white/60 border border-dashed border-brand-border rounded-2xl py-16 text-center text-sm text-brand-gray">Elige un ticket para verlo.</div>
            )}
          </div>
        </div>
      </main>
      <ToastHost toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default SolicitudesScreen;
