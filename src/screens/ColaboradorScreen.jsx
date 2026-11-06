// ─────────────────────────────────────────────
//  Inicio del Colaborador (cuenta de Google de la empresa).
//  Misma identidad que la app de T.I.: franja oscura de marca con el saludo y
//  el botón de reportar. Debajo, a la izquierda sus tickets (en curso arriba,
//  resueltos plegados) y a la derecha su puesto en un panel oscuro con sus
//  equipos, que se tocan para reportarlos.
//  Nunca ve el inventario: firestore.rules solo le deja leer su puesto (su
//  correo en "correos"), los equipos de ese puesto y sus tickets.
// ─────────────────────────────────────────────

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  LogOut, MessageSquareWarning, ChevronRight, ChevronDown, Wrench, MessageCircle, Check, AlertOctagon, Clock, CheckCircle2, BellRing,
} from 'lucide-react';
import { LOGO_URL, SUPPORT_EMAIL, CATEGORIAS_CON_MANTENIMIENTO } from '../config/constants';
import { Modal, ToastHost, Skeleton } from '../components/ui';
import { CASILLAS, equiposPorCasilla } from '../utils/puestos';
import { formatFecha } from '../utils/format';
import {
  CATEGORIAS_TICKET, ESTADOS_TICKET, haceCuanto, estaAbierto, quienAtiende, lineaParaColaborador, ordenarParaColaborador, tieneRespuestaNueva,
} from '../utils/tickets';
import { useMiPuesto, useMisTickets, leerAdjunto } from '../hooks/useTickets';
import useToast from '../hooks/useToast';
import useAvisosRespuesta from '../hooks/useAvisosRespuesta';
import { iconoCasilla } from '../components/puestos/casillaIcons';
import ReportarModal from '../components/tickets/ReportarModal';
import { Conversacion, CampoMensaje } from '../components/tickets/TicketUI';
import Avatar from '../components/shell/Avatar';

// Para el colaborador el título no lleva el Nº de inventario (eso es para T.I.)
const tituloColab = (t) => (t.categoria === 'equipo' && t.equipoNombre ? t.equipoNombre : CATEGORIAS_TICKET[t.categoria]?.label ?? 'Ticket');

const EtiquetaNueva = () => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-brand-orange text-brand-cocoa whitespace-nowrap">Respuesta nueva</span>
);

// Cada estado con su forma (no solo color): reloj, llave, chulo.
const GLIFO = {
  recibido:   { icon: Clock,        cls: 'bg-amber-50 text-amber-700' },
  en_proceso: { icon: Wrench,       cls: 'bg-blue-50 text-blue-700' },
  resuelto:   { icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700' },
};

const FilaTicket = ({ ticket: t, onAbrir }) => {
  const nueva = tieneRespuestaNueva(t);
  const g = GLIFO[t.estado] ?? GLIFO.recibido;
  const resuelto = t.estado === 'resuelto';
  return (
    <li>
      <button type="button" onClick={() => onAbrir(t.id)}
        className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-left hover:bg-brand-bg/70 transition-colors ${nueva ? 'bg-brand-orange/[0.07]' : ''}`}>
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${g.cls}`} aria-hidden="true">
          <g.icon size={18} />
        </span>
        <span className={`min-w-0 flex-1 ${resuelto && !nueva ? 'opacity-75' : ''}`}>
          <span className="sr-only">{ESTADOS_TICKET[t.estado]?.label}. </span>
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-brand-ink truncate">{tituloColab(t)}</span>
            {nueva && <EtiquetaNueva />}
          </span>
          <span className={`block text-xs mt-0.5 truncate ${t.estado === 'en_proceso' ? 'text-brand-slate font-medium' : 'text-brand-gray'}`}>{lineaParaColaborador(t)}</span>
          <span className="block text-xs text-brand-gray/90 mt-0.5 truncate">{t.descripcion}</span>
        </span>
        <ChevronRight size={16} className="text-brand-gray flex-shrink-0" aria-hidden="true" />
      </button>
    </li>
  );
};

// Mis tickets: lo abierto arriba; lo resuelto plegado para que no estorbe.
const MisTickets = ({ lista, cargando, onAbrir }) => {
  const abiertos = lista.filter(t => estaAbierto(t));
  const resueltos = lista.filter(t => !estaAbierto(t));
  return (
    <section aria-labelledby="mis-tickets" className="bg-white border border-brand-border rounded-2xl shadow-card overflow-hidden">
      <header className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3">
        <h2 id="mis-tickets" className="text-lg font-bold text-brand-ink">Mis tickets</h2>
        {!cargando && abiertos.length > 0 && <span className="text-sm text-brand-slate tabular-nums">{abiertos.length} en curso</span>}
      </header>

      {cargando ? (
        <div className="px-5 pb-5 space-y-3" aria-busy="true">
          {[0, 1].map(i => (
            <div key={i} className="flex items-center gap-3.5">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/2" /><Skeleton className="h-3 w-3/4" /></div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {abiertos.length > 0 ? (
            <ul className="divide-y divide-brand-border border-t border-brand-border">
              {abiertos.map(t => <FilaTicket key={t.id} ticket={t} onAbrir={onAbrir} />)}
            </ul>
          ) : (
            <div className="flex items-center gap-3.5 mx-5 mb-5 px-4 py-4 rounded-xl bg-emerald-50/70 border border-emerald-100">
              <span className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0" aria-hidden="true"><Check size={20} strokeWidth={2.5} /></span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-brand-ink">Todo en orden</p>
                <p className="text-xs text-brand-slate mt-0.5">No tienes tickets en curso. Cuando reportes algo, aquí verás quién lo atiende y sus respuestas.</p>
              </div>
            </div>
          )}

          {resueltos.length > 0 && (
            <details className="group border-t border-brand-border" open={abiertos.length === 0 && resueltos.some(tieneRespuestaNueva)}>
              <summary className="flex items-center justify-between gap-3 px-5 py-3 cursor-pointer list-none text-sm font-medium text-brand-slate hover:text-brand-ink hover:bg-brand-bg/60 transition-colors [&::-webkit-details-marker]:hidden">
                <span>Resueltos <span className="tabular-nums text-brand-gray font-normal">· {resueltos.length}</span></span>
                <ChevronDown size={16} className="transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <ul className="divide-y divide-brand-border border-t border-brand-border bg-brand-bg/40">
                {resueltos.map(t => <FilaTicket key={t.id} ticket={t} onAbrir={onAbrir} />)}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
};

// ── Seguimiento: Recibido → En proceso → Resuelto ──
const PASOS = ['recibido', 'en_proceso', 'resuelto'];
const Seguimiento = ({ ticket }) => {
  const actual = PASOS.indexOf(ticket.estado);
  const quien = quienAtiende(ticket);
  const detalle = {
    recibido: haceCuanto(ticket.creadoAt),
    en_proceso: actual >= 1 ? (quien ? `Lo atiende ${quien}` : 'T.I. lo atiende') : '',
    resuelto: actual === 2 ? haceCuanto(ticket.resueltoAt ?? ticket.actualizado) : '',
  };
  const etiqueta = { recibido: 'Recibido', en_proceso: 'En proceso', resuelto: 'Resuelto' };
  return (
    <ol className="grid grid-cols-3" aria-label="Seguimiento del ticket">
      {PASOS.map((p, i) => {
        const hecho = i < actual || (i === actual && p === 'resuelto');
        const ahora = i === actual && p !== 'resuelto';
        return (
          <li key={p} className="relative flex flex-col items-center text-center px-1" aria-current={ahora ? 'step' : undefined}>
            {i > 0 && <span className={`absolute top-3 right-1/2 w-full h-0.5 -translate-y-1/2 ${i <= actual ? 'bg-brand-ink' : 'bg-brand-border'}`} aria-hidden="true" />}
            <span className={`relative z-[1] w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold
              ${hecho ? 'bg-brand-ink text-white' : ahora ? 'bg-brand-orange text-brand-cocoa ring-4 ring-brand-orange/20' : 'bg-white border-2 border-brand-border text-brand-gray'}`}>
              {hecho ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : i + 1}
            </span>
            <span className={`mt-1.5 text-xs font-semibold ${i <= actual ? 'text-brand-ink' : 'text-brand-gray'}`}>{etiqueta[p]}</span>
            {detalle[p] && <span className="text-[11px] text-brand-gray leading-tight mt-0.5">{detalle[p]}</span>}
          </li>
        );
      })}
    </ol>
  );
};

// Último mantenimiento preventivo del computador del puesto (CPU o portátil).
// Si hay más de uno, cada uno con su fecha.
const UltimoMantenimiento = ({ equipos }) => {
  const computadores = equipos.filter(e => CATEGORIAS_CON_MANTENIMIENTO.includes(e.categoria));
  if (!computadores.length) return null;
  const fecha = (e) => (e.ultimoMantenimiento?.toDate ? formatFecha(e.ultimoMantenimiento.toDate()) : 'sin registro');
  const tipo = (e) => (e.categoria === 'Laptops' ? 'Portátil' : 'CPU');
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-sm text-white/70">
      <Wrench size={14} className="text-white/50 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <span>
        Último mantenimiento:{' '}
        {computadores.length === 1
          ? <span className="font-medium text-white">{fecha(computadores[0])}</span>
          : computadores.map((e, i) => (
            <span key={e.id}>{i > 0 && ' · '}{tipo(e)} <span className="font-medium text-white">{fecha(e)}</span></span>
          ))}
      </span>
    </p>
  );
};

// Estado del equipo que le importa al colaborador (lo normal no se dice)
const AVISO_EQUIPO = {
  'En Mantenimiento':  { txt: 'En mantenimiento con T.I.', cls: 'text-violet-300' },
  'Fuera de Servicio': { txt: 'Fuera de servicio', cls: 'text-rose-300' },
};

const MiPuesto = ({ puesto, equipos, onReportar }) => {
  const por = equiposPorCasilla(equipos);
  return (
    <div className="px-5 py-4">
      <p className="text-base font-semibold text-white">{puesto.nombre}</p>
      <UltimoMantenimiento equipos={equipos} />
      {equipos.length === 0 ? (
        <p className="text-sm text-white/60 mt-2">Aún no hay equipos registrados en tu puesto.</p>
      ) : (
        <>
          <p className="text-xs text-white/60 mt-3 mb-2">¿Falla alguno? Tócalo para reportarlo.</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
            {CASILLAS.flatMap(c => por[c.key].map(e => {
              const Icon = iconoCasilla(c.key, [e]);
              const aviso = AVISO_EQUIPO[e.estado];
              return (
                <li key={e.id}>
                  <button type="button" onClick={() => onReportar(e)}
                    aria-label={`${e.nombre}, número ${e.numeroInventario || 'sin número'}${aviso ? `, ${aviso.txt}` : ''}. Reportar un problema con este equipo`}
                    className="group w-full flex items-center gap-3 p-2.5 rounded-xl vidrio-oscuro text-left transition-[background-color,border-color]">
                    <span className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg bg-white/10 text-brand-amber">
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-white truncate">{e.nombre}</span>
                      <span className={`block text-xs truncate ${aviso ? `${aviso.cls} font-medium` : 'text-white/60'}`}>
                        {aviso ? aviso.txt : <>Nº <span className="font-mono">{e.numeroInventario || '—'}</span></>}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-brand-amber opacity-80 group-hover:opacity-100 transition-opacity flex-shrink-0" aria-hidden="true">
                      <MessageSquareWarning size={14} /><span className="hidden sm:inline">Reportar</span>
                    </span>
                  </button>
                </li>
              );
            }))}
          </ul>
        </>
      )}
    </div>
  );
};

const PanelPuesto = ({ puestos, equipos, cargando, onReportar }) => (
  <section aria-labelledby="mi-puesto" className="bg-nav-tech text-white rounded-2xl shadow-[0_10px_28px_rgba(21,33,42,0.22)] ring-1 ring-white/10 lg:sticky lg:top-6 overflow-hidden">
    <h2 id="mi-puesto" className="px-5 pt-4 pb-1 text-lg font-bold text-white">{puestos.length > 1 ? 'Mis puestos' : 'Mi puesto'}</h2>
    {cargando ? (
      <div className="px-5 pt-3 pb-5 space-y-3" aria-busy="true">
        <Skeleton className="h-4 w-2/3 !bg-white/10" /><Skeleton className="h-3 w-1/2 !bg-white/10" />
        <Skeleton className="h-12 w-full !bg-white/10" /><Skeleton className="h-12 w-full !bg-white/10" />
      </div>
    ) : puestos.length === 0 ? (
      <p className="px-5 pb-5 pt-2 text-sm text-white/75">
        Todavía no tienes un puesto asignado. Igual puedes reportar problemas; si quieres verlo aquí, escribe a <a className="font-medium text-brand-amber underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    ) : (
      <div className="divide-y divide-white/10">
        {puestos.map(p => <MiPuesto key={p.id} puesto={p} equipos={equipos[p.id] ?? []} onReportar={onReportar} />)}
      </div>
    )}
  </section>
);

const ColaboradorScreen = ({ db, user, onLogout }) => {
  const primerNombre = (user.nombre || '').trim().split(/\s+/)[0];
  const { puestos, equipos, loading: cargandoPuesto } = useMiPuesto(db, user);
  const { tickets, loading: cargandoTickets, crear, comentar, marcarVisto } = useMisTickets(db, user);
  const [reportar, setReportar] = useState({ open: false, equipoId: null });
  const [abiertoId, setAbiertoId] = useState(null);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();

  const lista = useMemo(() => ordenarParaColaborador(tickets), [tickets]);
  const conRespuesta = useMemo(() => lista.filter(tieneRespuestaNueva), [lista]);
  const abierto = tickets.find(t => t.id === abiertoId);
  const marcar = useRef(marcarVisto);
  marcar.current = marcarVisto;
  const idPorMarcar = abierto?.vistoPorColaborador === false ? abierto.id : null;
  useEffect(() => { if (idPorMarcar) marcar.current({ id: idPorMarcar, vistoPorColaborador: false }); }, [idPorMarcar]);

  const { permiso, pedirPermiso } = useAvisosRespuesta({ nuevas: conRespuesta, cargando: cargandoTickets, titulo: tituloColab, onAbrir: setAbiertoId });
  const activarAvisos = async () => {
    const p = await pedirPermiso();
    if (p === 'granted') showToast('Listo: te avisaremos cuando T.I. responda, mientras tengas esta pestaña abierta.');
  };

  // Los archivos de la conversación abierta se leen de su ticket
  const cargarAdjunto = useCallback((adj) => leerAdjunto(db, abiertoId, adj), [db, abiertoId]);

  const abrirReporte = (equipo = null) => setReportar({ open: true, equipoId: equipo?.id ?? null });

  const handleEnviar = async (datos) => {
    const codigo = await crear(datos);
    setReportar({ open: false, equipoId: null });
    showToast(`Ticket ${codigo} enviado a T.I. Aquí verás quién lo atiende.`);
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-ink font-sans">
      {/* Franja de marca: la misma de la app de T.I. */}
      <header className="relative bg-nav-tech text-white shadow-[0_8px_24px_rgba(21,33,42,0.18)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="h-[72px] flex items-center gap-3">
            <span className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.12] flex-shrink-0">
              <img src={LOGO_URL} alt="" className="h-6 w-auto object-contain" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm sm:text-[15px] font-bold tracking-[0.08em] leading-tight truncate">BETR MEDIA TECH</span>
              <span className="hidden sm:block text-[11px] text-white/60 leading-tight">Activos y soporte de T.I.</span>
            </span>
            <span className="hidden sm:block min-w-0 text-right">
              <span className="block text-sm font-semibold leading-tight truncate max-w-[220px]">{(user.nombre || '').trim() || (user.email || '').split('@')[0]}</span>
              <span className="block text-[11px] text-white/60 leading-tight truncate max-w-[220px]">{user.email}</span>
            </span>
            <Avatar user={user} size="lg" />
            <button type="button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión"
              className="h-11 px-3 sm:px-3.5 flex items-center gap-2 rounded-xl text-sm font-medium vidrio-oscuro transition flex-shrink-0">
              <LogOut size={16} aria-hidden="true" /><span className="hidden sm:inline">Salir</span>
            </button>
          </div>

          <div className="border-t border-white/[0.08] pt-6 pb-16 sm:pb-[4.5rem] stagger-in flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-[2rem] font-bold leading-tight tracking-tight text-balance">{primerNombre ? `Hola, ${primerNombre}` : 'Hola'}</h1>
              <p className="text-sm sm:text-base text-white/70 mt-1.5 max-w-xl text-pretty">¿Algo no funciona? Cuéntale a T.I. y sigue aquí cómo va.</p>
              {permiso === 'default' && (
                <button type="button" onClick={activarAvisos}
                  className="mt-3 inline-flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-medium vidrio-oscuro transition">
                  <BellRing size={14} className="text-brand-amber" aria-hidden="true" /> Avisarme cuando T.I. responda
                </button>
              )}
            </div>
            <button type="button" onClick={() => abrirReporte()}
              className="flex items-center justify-center gap-2 vidrio-naranja font-semibold px-5 h-12 rounded-xl transition flex-shrink-0">
              <MessageSquareWarning size={17} aria-hidden="true" /> Reportar un problema
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 -mt-8 pb-12">
        {/* T.I. respondió: lo primero que se ve */}
        {conRespuesta.length > 0 && (
          <div role="status" className="flex items-center gap-3 mb-4 px-4 py-3 rounded-2xl bg-white border border-brand-orange/50 shadow-card animate-reveal">
            <span className="w-10 h-10 flex-shrink-0 rounded-xl bg-brand-orange/15 text-brand-ember flex items-center justify-center" aria-hidden="true">
              <MessageCircle size={18} />
            </span>
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-semibold text-brand-ink">T.I. te respondió</span>
              <span className="block text-xs text-brand-slate truncate">
                {conRespuesta.length === 1 ? tituloColab(conRespuesta[0]) : `En ${conRespuesta.length} tickets`}
              </span>
            </p>
            <button type="button" onClick={() => setAbiertoId(conRespuesta[0].id)}
              className="flex items-center gap-1.5 vidrio-naranja text-sm font-semibold px-4 h-10 rounded-xl transition flex-shrink-0">
              Ver respuesta
            </button>
          </div>
        )}

        <div className="stagger-in grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4 lg:gap-6 items-start">
          <MisTickets lista={lista} cargando={cargandoTickets} onAbrir={setAbiertoId} />
          <PanelPuesto puestos={puestos} equipos={equipos} cargando={cargandoPuesto} onReportar={abrirReporte} />
        </div>
      </main>

      <ReportarModal isOpen={reportar.open} onClose={() => setReportar({ open: false, equipoId: null })}
        puestos={puestos} equipos={equipos} onEnviar={handleEnviar} equipoInicial={reportar.equipoId} />

      <Modal isOpen={!!abierto} onClose={() => setAbiertoId(null)} title={abierto ? tituloColab(abierto) : 'Ticket'}>
        {abierto && (
          <div className="space-y-4">
            <Seguimiento ticket={abierto} />
            <div className="flex items-center justify-center gap-x-2 gap-y-1 flex-wrap text-xs text-brand-gray">
              {abierto.urgencia === 'bloquea' && (
                <span className="inline-flex items-center gap-1 font-semibold text-rose-700"><AlertOctagon size={13} aria-hidden="true" /> Marcaste: no puedo trabajar ·</span>
              )}
              <span>Código <span className="font-mono">{abierto.codigo}</span></span>
              {abierto.puestoNombre && <span>· {abierto.puestoNombre}</span>}
            </div>
            <Conversacion ticket={abierto} yo="colaborador" cargarAdjunto={cargarAdjunto} />
            {estaAbierto(abierto)
              ? <CampoMensaje onEnviar={(texto, archivos) => comentar(abierto, texto, archivos)} placeholder="Agrega un detalle o responde a T.I." />
              : <p className="text-xs text-brand-gray text-center">Este ticket está resuelto. Si el problema vuelve, repórtalo de nuevo.</p>}
          </div>
        )}
      </Modal>
      <ToastHost toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default ColaboradorScreen;
