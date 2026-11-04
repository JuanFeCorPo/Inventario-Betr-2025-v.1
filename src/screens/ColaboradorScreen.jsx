// ─────────────────────────────────────────────
//  Inicio del Colaborador (cuenta de Google de la empresa).
//  Ve su puesto y sus equipos, reporta problemas a T.I. y sigue sus
//  solicitudes. Nunca ve el inventario: firestore.rules solo le deja leer
//  su puesto (su correo en "correos"), los equipos de ese puesto y sus solicitudes.
// ─────────────────────────────────────────────

import { useState, useMemo, useEffect, useRef } from 'react';
import { LogOut, MessageSquareWarning, Loader2, ChevronRight, Inbox } from 'lucide-react';
import { LOGO_URL, SUPPORT_EMAIL } from '../config/constants';
import { Modal, ToastHost } from '../components/ui';
import { CASILLAS, equiposPorCasilla, serialLimpio } from '../utils/puestos';
import { tituloTicket, ordenarTickets, haceCuanto, estaAbierto } from '../utils/tickets';
import { useMiPuesto, useMisTickets } from '../hooks/useTickets';
import useToast from '../hooks/useToast';
import { iconoCasilla } from '../components/puestos/casillaIcons';
import ReportarModal from '../components/tickets/ReportarModal';
import { EstadoTicket, Conversacion, CampoMensaje, PuntoNuevo } from '../components/tickets/TicketUI';

const Tarjeta = ({ titulo, accion, children }) => (
  <section className="bg-white border border-brand-border rounded-2xl shadow-card">
    <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-brand-border">
      <h2 className="text-xs font-semibold text-brand-slate uppercase tracking-wider">{titulo}</h2>
      {accion}
    </header>
    {children}
  </section>
);

const MiPuesto = ({ puesto, equipos }) => {
  const por = equiposPorCasilla(equipos);
  return (
    <div className="px-5 py-4">
      <p className="text-base font-semibold text-brand-ink">{puesto.nombre}</p>
      {equipos.length === 0 ? (
        <p className="text-sm text-brand-gray mt-1">Aún no hay equipos registrados en tu puesto.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CASILLAS.flatMap(c => por[c.key].map(e => {
            const Icon = iconoCasilla(c.key, [e]);
            return (
              <li key={e.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-brand-bg/60">
                <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-white border border-brand-border text-brand-slate">
                  <Icon size={15} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-brand-ink truncate">{e.nombre}</span>
                  <span className="block text-xs text-brand-gray truncate">
                    <span className="font-mono">{e.numeroInventario}</span>{serialLimpio(e.numeroSerial) ? ` · SN ${serialLimpio(e.numeroSerial)}` : ''}
                  </span>
                </span>
              </li>
            );
          }))}
        </ul>
      )}
    </div>
  );
};

const ColaboradorScreen = ({ db, user, onLogout }) => {
  const primerNombre = (user.nombre || '').trim().split(/\s+/)[0];
  const { puestos, equipos, loading: cargandoPuesto } = useMiPuesto(db, user);
  const { tickets, loading: cargandoTickets, crear, comentar, marcarVisto } = useMisTickets(db, user);
  const [reportarOpen, setReportarOpen] = useState(false);
  const [abiertoId, setAbiertoId] = useState(null);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();

  const lista = useMemo(() => ordenarTickets(tickets), [tickets]);
  const abierto = tickets.find(t => t.id === abiertoId);
  const marcar = useRef(marcarVisto);
  marcar.current = marcarVisto;
  const idPorMarcar = abierto?.vistoPorColaborador === false ? abierto.id : null;
  useEffect(() => { if (idPorMarcar) marcar.current({ id: idPorMarcar, vistoPorColaborador: false }); }, [idPorMarcar]);

  const handleEnviar = async (datos) => {
    const codigo = await crear(datos);
    setReportarOpen(false);
    showToast(`Ticket ${codigo} enviado a T.I.`);
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-ink font-sans">
      <div className="fixed inset-0 bg-glow pointer-events-none" />

      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <header className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <img src={LOGO_URL} alt="Betrmedia" className="h-8 sm:h-10 w-auto object-contain flex-shrink-0" />
            <div className="border-l border-brand-border pl-3 min-w-0">
              <p className="text-sm sm:text-base font-bold text-brand-ink leading-tight truncate tracking-wide">BETR MEDIA TECH</p>
              <p className="text-xs text-brand-gray truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión"
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center vidrio hover:!bg-rose-50 hover:!border-rose-200 text-brand-gray hover:text-rose-600 rounded-xl transition">
            <LogOut size={16} />
          </button>
        </header>

        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-content-in">
          <div>
            <h1 className="text-2xl font-bold text-brand-ink tracking-tight">{primerNombre ? `Hola, ${primerNombre}` : 'Hola'}</h1>
            <p className="text-sm text-brand-slate mt-0.5">¿Algo no funciona? Cuéntale a T.I. y sigue aquí cómo va.</p>
          </div>
          <button type="button" onClick={() => setReportarOpen(true)}
            className="flex items-center justify-center gap-2 vidrio-naranja font-semibold px-5 h-12 rounded-xl transition flex-shrink-0">
            <MessageSquareWarning size={17} aria-hidden="true" /> Reportar un problema
          </button>
        </section>

        <div className="space-y-4">
          <Tarjeta titulo="Mis tickets">
            {cargandoTickets ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-brand-ember" /></div>
            ) : lista.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
                <Inbox size={26} className="text-brand-gray/50" aria-hidden="true" />
                <p className="text-sm text-brand-gray">Aún no has reportado nada.</p>
              </div>
            ) : (
              <ul className="divide-y divide-brand-border">
                {lista.map(t => (
                  <li key={t.id}>
                    <button type="button" onClick={() => setAbiertoId(t.id)}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-brand-bg/70 transition-colors ${estaAbierto(t) ? '' : 'opacity-80'}`}>
                      {t.vistoPorColaborador === false ? <PuntoNuevo label="Respuesta nueva de T.I." /> : <span className="w-2" aria-hidden="true" />}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-brand-ink truncate">{tituloTicket(t)}</span>
                        <span className="block text-xs text-brand-gray truncate">{t.codigo} · {haceCuanto(t.actualizado ?? t.creadoAt)} · {t.descripcion}</span>
                      </span>
                      <EstadoTicket estado={t.estado} />
                      <ChevronRight size={16} className="text-brand-gray flex-shrink-0" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta titulo={puestos.length > 1 ? 'Mis puestos' : 'Mi puesto'}>
            {cargandoPuesto ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-brand-ember" /></div>
            ) : puestos.length === 0 ? (
              <p className="px-5 py-4 text-sm text-brand-slate">
                Todavía no tienes un puesto asignado. Igual puedes reportar problemas; si quieres verlo aquí, escribe a <a className="font-medium text-brand-ember underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
              </p>
            ) : (
              <div className="divide-y divide-brand-border">
                {puestos.map(p => <MiPuesto key={p.id} puesto={p} equipos={equipos[p.id] ?? []} />)}
              </div>
            )}
          </Tarjeta>
        </div>
      </main>

      <ReportarModal isOpen={reportarOpen} onClose={() => setReportarOpen(false)} puestos={puestos} equipos={equipos} onEnviar={handleEnviar} />

      <Modal isOpen={!!abierto} onClose={() => setAbiertoId(null)} title={abierto ? tituloTicket(abierto) : 'Ticket'}>
        {abierto && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap text-xs text-brand-gray">
              <EstadoTicket estado={abierto.estado} />
              <span>{abierto.codigo}</span>
              {abierto.puestoNombre && <span>· {abierto.puestoNombre}</span>}
              {abierto.tomadoPor && estaAbierto(abierto) && <span>· La atiende {abierto.tomadoPor}</span>}
            </div>
            <Conversacion ticket={abierto} yo="colaborador" />
            {estaAbierto(abierto)
              ? <CampoMensaje onEnviar={(texto) => comentar(abierto, texto)} placeholder="Agrega un detalle o responde a T.I." />
              : <p className="text-xs text-brand-gray text-center">Este ticket está resuelto. Si el problema vuelve, repórtalo de nuevo.</p>}
          </div>
        )}
      </Modal>
      <ToastHost toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default ColaboradorScreen;
