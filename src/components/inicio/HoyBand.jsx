// ─────────────────────────────────────────────
//  "Hoy": lo primero que ve T.I. al abrir la app. Tres bloques con lo que pide
//  acción: solicitudes (las urgentes arriba, con Tomar), puestos con
//  pendientes (falla > falta algo > mantenimiento) y mantenimientos vencidos
//  agrupados por puesto. Si no hay nada, lo dice en una línea.
// ─────────────────────────────────────────────

import { useMemo, useState } from 'react';
import { MessageSquareWarning, Monitor, Wrench, ChevronRight, AlertOctagon, CheckCircle2, Hand } from 'lucide-react';
import { Skeleton, Spinner } from '../ui';
import { useTicketsTI } from '../../hooks/useTickets';
import usePuestos from '../../hooks/usePuestos';
import { tituloTicket, ordenarTickets, haceCuanto, estaAbierto } from '../../utils/tickets';
import { equiposDelPuesto, resumenPuesto, etiquetaCasilla, ubicacionEquipo } from '../../utils/puestos';
import { getMaintenanceInfo } from '../../utils/maintenance';
import { EstadoTicket } from '../tickets/TicketUI';

const Bloque = ({ titulo, icon: Icon, total, detalle, accion, onAccion, children, id }) => (
  <section aria-labelledby={id} className="bg-white border border-brand-border rounded-2xl shadow-card flex flex-col min-w-0">
    <header className="flex items-center gap-2.5 px-4 pt-4 pb-3">
      <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-brand-bg text-brand-slate flex-shrink-0" aria-hidden="true"><Icon size={16} /></span>
      <div className="min-w-0 flex-1">
        <h2 id={id} className="text-sm font-semibold text-brand-ink">{titulo}</h2>
        <p className="text-xs text-brand-gray truncate">{detalle}</p>
      </div>
      {total > 0 && <span className="text-2xl font-bold text-brand-ink tabular-nums leading-none">{total}</span>}
    </header>
    <div className="flex-1">{children}</div>
    <button type="button" onClick={onAccion}
      className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-brand-border text-sm font-medium text-brand-ember hover:bg-brand-bg/60 rounded-b-2xl transition-colors">
      {accion} <ChevronRight size={15} aria-hidden="true" />
    </button>
  </section>
);

const Calma = ({ texto }) => (
  <p className="flex items-center gap-2 px-4 pb-4 text-sm text-brand-slate">
    <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" aria-hidden="true" /> {texto}
  </p>
);

const Cargando = () => (
  <div className="px-4 pb-4 space-y-2.5" aria-hidden="true">
    {[0, 1, 2].map(i => <Skeleton key={i} className="h-9 rounded-lg" />)}
  </div>
);

const Fila = ({ onClick, children, label }) => (
  <li>
    <button type="button" onClick={onClick} aria-label={label}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-brand-bg/60 transition-colors">
      {children}
    </button>
  </li>
);

// Mantenimientos vencidos de CPU y portátiles, agrupados por puesto (o por encargado si no tiene).
const vencidosPorPuesto = (items, puestos) => {
  const porId = new Map(puestos.map(p => [p.id, p]));
  const grupos = new Map();
  for (const item of items) {
    const info = getMaintenanceInfo(item);
    if (info?.urgencia !== 'vencido') continue;
    const u = ubicacionEquipo(item, porId);
    const clave = u.titulo;
    const g = grupos.get(clave) ?? { clave, puesto: u.puesto, equipos: [], dias: 0 };
    g.equipos.push(item);
    g.dias = Math.max(g.dias, -info.diasRestantes);
    grupos.set(clave, g);
  }
  return [...grupos.values()].sort((a, b) => b.dias - a.dias);
};

// "en 3 puestos · 1 en stock"
const detalleVencidos = (vencidos) => {
  const enPuesto = vencidos.filter(g => g.puesto).length;
  const otros = vencidos.length - enPuesto;
  return [enPuesto && `en ${enPuesto} puesto${enPuesto === 1 ? '' : 's'}`, otros && `${otros} sin puesto`].filter(Boolean).join(' · ');
};

const HoyBand = ({ db, user, items, loading, onNavigate }) => {
  const isAdmin = user.role === 'Administrador';
  const { tickets, loading: cargandoTickets, tomar } = useTicketsTI(db, user);
  const { puestos, loading: cargandoPuestos } = usePuestos(db, user);
  const [tomando, setTomando] = useState(null);

  const abiertas = useMemo(() => ordenarTickets(tickets.filter(estaAbierto)), [tickets]);
  const bloquean = abiertas.filter(t => t.urgencia === 'bloquea').length;
  const sinTomar = abiertas.filter(t => t.estado === 'recibido').length;

  const pendientes = useMemo(() => puestos
    .map(p => ({ p, r: resumenPuesto(p, equiposDelPuesto(items, p.id)) }))
    .filter(x => x.r.pendiente)
    .sort((a, b) => b.r.gravedad - a.r.gravedad || a.p.nombre.localeCompare(b.p.nombre, 'es', { numeric: true })), [puestos, items]);
  const conFalla = pendientes.filter(x => x.r.gravedad === 3).length;

  const vencidos = useMemo(() => vencidosPorPuesto(items, puestos), [items, puestos]);
  const totalVencidos = vencidos.reduce((s, g) => s + g.equipos.length, 0);

  const motivo = (r) => (r.conFalla > 0 ? { txt: `${r.conFalla} con falla`, cls: 'text-rose-700 font-semibold' }
    : r.faltan.length ? { txt: `Falta ${r.faltan.map(k => etiquetaCasilla(k).toLowerCase().replace('cpu / portátil', 'CPU')).join(', ')}`, cls: 'text-amber-800' }
      : { txt: 'Mant. vencido', cls: 'text-rose-700' });

  const handleTomar = async (e, t) => {
    e.stopPropagation();
    setTomando(t.id);
    try { await tomar(t); } finally { setTomando(null); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
      <Bloque id="hoy-solicitudes" titulo="Tickets" icon={MessageSquareWarning} total={abiertas.length}
        detalle={cargandoTickets ? 'Cargando…' : abiertas.length === 0 ? 'Nada pendiente' : bloquean ? `${bloquean} no ${bloquean === 1 ? 'puede' : 'pueden'} trabajar · ${sinTomar} sin tomar` : `${sinTomar} sin tomar`}
        accion={abiertas.length > 3 ? `Ver las ${abiertas.length}` : 'Ir a tickets'} onAccion={() => onNavigate('solicitudes')}>
        {cargandoTickets ? <Cargando /> : abiertas.length === 0 ? <Calma texto="Sin tickets pendientes." /> : (
          <ul className="divide-y divide-brand-border border-t border-brand-border">
            {abiertas.slice(0, 3).map(t => (
              <li key={t.id} className="flex items-center gap-2 pr-3 hover:bg-brand-bg/60 transition-colors">
                <button type="button" onClick={() => onNavigate('solicitudes', { ticketId: t.id })}
                  className="flex-1 min-w-0 flex items-center gap-3 pl-4 py-2.5 text-left">
                  {t.urgencia === 'bloquea'
                    ? <AlertOctagon size={15} className="text-rose-600 flex-shrink-0" aria-label="No puede trabajar" role="img" />
                    : <span className="w-[15px] flex-shrink-0" aria-hidden="true" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-brand-ink truncate">{tituloTicket(t)}</span>
                    <span className="block text-xs text-brand-gray truncate">{t.creadoPor?.nombre}{t.puestoNombre ? ` · ${t.puestoNombre}` : ''} · {haceCuanto(t.creadoAt)}</span>
                  </span>
                </button>
                {isAdmin && t.estado === 'recibido' ? (
                  <button type="button" onClick={(e) => handleTomar(e, t)} disabled={tomando === t.id}
                    aria-label={`Tomar el ticket de ${t.creadoPor?.nombre ?? ''}`}
                    className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold vidrio-naranja transition flex-shrink-0 disabled:opacity-60">
                    {tomando === t.id ? <Spinner size="sm" tone="dark" /> : <Hand size={13} aria-hidden="true" />} Tomar
                  </button>
                ) : <EstadoTicket estado={t.estado} />}
              </li>
            ))}
          </ul>
        )}
      </Bloque>

      <Bloque id="hoy-puestos" titulo="Puestos con pendientes" icon={Monitor} total={pendientes.length}
        detalle={cargandoPuestos ? 'Cargando…' : pendientes.length === 0 ? `${puestos.length} puestos al día` : `de ${puestos.length} puestos${conFalla ? ` · ${conFalla} con falla` : ''}`}
        accion="Ver puestos y hojas de vida" onAccion={() => onNavigate('puestos')}>
        {cargandoPuestos || loading ? <Cargando /> : pendientes.length === 0 ? <Calma texto="Todos los puestos están completos y al día." /> : (
          <ul className="divide-y divide-brand-border border-t border-brand-border">
            {pendientes.slice(0, 3).map(({ p, r }) => {
              const m = motivo(r);
              return (
                <Fila key={p.id} onClick={() => onNavigate('puestos', { puestoId: p.id })} label={`${p.nombre}: ${m.txt}. Abrir hoja de vida`}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-brand-ink truncate">{p.nombre}</span>
                    <span className={`block text-xs truncate ${m.cls}`}>{m.txt}</span>
                  </span>
                  <ChevronRight size={15} className="text-brand-gray flex-shrink-0" aria-hidden="true" />
                </Fila>
              );
            })}
          </ul>
        )}
      </Bloque>

      <Bloque id="hoy-mantenimientos" titulo="Mantenimientos vencidos" icon={Wrench} total={totalVencidos}
        detalle={loading ? 'Cargando…' : totalVencidos === 0 ? 'Al día' : detalleVencidos(vencidos)}
        accion="Ver mantenimientos" onAccion={() => onNavigate('maintenance')}>
        {loading ? <Cargando /> : totalVencidos === 0 ? <Calma texto="Ningún mantenimiento vencido." /> : (
          <ul className="divide-y divide-brand-border border-t border-brand-border">
            {vencidos.slice(0, 3).map(g => (
              <Fila key={g.clave} onClick={() => (g.puesto ? onNavigate('puestos', { puestoId: g.puesto.id }) : onNavigate('maintenance'))}
                label={`${g.clave}: ${g.equipos.length} vencido${g.equipos.length === 1 ? '' : 's'}, el más antiguo hace ${g.dias} días (${g.equipos.map(e => e.numeroInventario || e.nombre).join(', ')}). ${g.puesto ? 'Abrir hoja de vida' : 'Ver mantenimientos'}`}>
                <span className="w-2 h-2 rounded-full bg-rose-600 flex-shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-brand-ink truncate">{g.clave}</span>
                  <span className="block text-xs text-brand-gray truncate">{g.equipos.map(e => e.numeroInventario || e.nombre).join(', ')}</span>
                </span>
                <span className="text-xs text-brand-slate tabular-nums whitespace-nowrap">hace {g.dias} d</span>
              </Fila>
            ))}
          </ul>
        )}
      </Bloque>
    </div>
  );
};

export default HoyBand;
