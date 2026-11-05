// ─────────────────────────────────────────────
//  Mantenimientos preventivos (CPU y portátiles), en 4 columnas por urgencia.
//  Cada equipo se nombra por su puesto ("Optimización #1") con su Nº debajo,
//  agrupado por equipo de trabajo: "CPU" a secas no dice cuál es.
//  Registrar usa lo mismo que la hoja de vida: si el equipo está en un puesto,
//  queda también en el historial del puesto (F-MAN-02).
// ─────────────────────────────────────────────

import { useState, useMemo } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Laptop, Cpu } from 'lucide-react';
import { EmptyState, ToastHost } from '../components/ui';
import { formatFecha } from '../utils/format';
import useInventory from '../hooks/useInventory';
import usePuestos from '../hooks/usePuestos';
import useToast from '../hooks/useToast';
import { groupMaintenanceByUrgency, GRUPOS_URGENCIA, proximoTrasRegistrar } from '../utils/maintenance';
import { ubicacionEquipo } from '../utils/puestos';
import { MantenimientoModal } from '../components/puestos/PuestoModals';

const URGENCIA_STYLES = {
  'vencido':     { dot: 'bg-rose-500',    text: 'text-rose-600' },
  'esta-semana': { dot: 'bg-amber-500',   text: 'text-amber-600' },
  'este-mes':    { dot: 'bg-violet-500',  text: 'text-violet-600' },
  'proximo':     { dot: 'bg-emerald-500', text: 'text-emerald-600' },
};

// Texto corto para la línea: "Hace 4 d", "Hoy", "12 d" (el lector de pantalla oye el largo)
const diasCorto = (dias) => {
  if (dias < 0) return `Hace ${Math.abs(dias)} d`;
  if (dias === 0) return 'Hoy';
  return `${dias} d`;
};

const diasLargo = (dias) => {
  if (dias < 0) return `vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`;
  if (dias === 0) return 'vence hoy';
  return `vence en ${dias} día${dias !== 1 ? 's' : ''}`;
};

// En el grupo "En stock" todas dirían "En stock (Betrmedia)": ahí se nombra el equipo.
const conTituloDeFila = (item, ubic) => (ubic.puesto || ubic.grupo !== 'En stock' ? ubic : { ...ubic, titulo: item.nombre || ubic.titulo });

// Agrupa las filas de una columna por equipo de trabajo, en el orden de urgencia
// (el grupo con el equipo más urgente va primero).
const porGrupo = (rows) => {
  const m = new Map();
  for (const r of rows) (m.get(r.ubic.grupo) ?? m.set(r.ubic.grupo, []).get(r.ubic.grupo)).push(r);
  return [...m];
};

const UrgencyColumn = ({ group, isAdmin, onRegister }) => {
  const style = URGENCIA_STYLES[group.key];
  const { rows } = group;
  const resumen = !rows[0] ? null
    : group.key === 'vencido' ? `el más antiguo, ${diasLargo(rows[0].info.diasRestantes).replace('vencido ', '')}`
      : `próximo ${formatFecha(rows[0].info.proximaFecha)}`;
  return (
    <section aria-label={`${group.label}: ${rows.length}`} className="bg-white border border-brand-border rounded-2xl shadow-card overflow-hidden">
      <header className="px-4 pt-3 pb-2.5 border-b border-brand-border">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${style.dot}`} aria-hidden="true" />
          <h2 className="text-xs font-semibold text-brand-slate uppercase tracking-wider">{group.label}</h2>
        </div>
        <div className="flex items-baseline justify-between gap-2 mt-1">
          <p className={`text-3xl font-bold tabular-nums leading-none ${rows.length ? style.text : 'text-brand-gray/40'}`}>{rows.length}</p>
          {resumen && <p className="text-xs text-brand-gray text-right">{resumen}</p>}
        </div>
      </header>
      {rows.length === 0 ? <p className="text-xs text-brand-gray text-center py-4">Nada aquí.</p> : porGrupo(rows).map(([grupo, filas]) => (
        <div key={grupo}>
          <h3 className="px-4 pt-2.5 pb-1 text-[11px] font-semibold text-brand-gray uppercase tracking-wider truncate">
            {grupo} <span className="font-normal tabular-nums">· {filas.length}</span>
          </h3>
          <ul className="pb-1">
            {filas.map(({ item, info, ubic }) => {
              const Icon = item.categoria === 'CPU' ? Cpu : Laptop;
              const content = (
                <>
                  <Icon size={14} className="text-brand-gray flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-brand-ink truncate">{ubic.titulo}</span>
                    <span className="block text-xs text-brand-gray truncate">
                      {item.categoria === 'Laptops' ? 'Portátil' : 'CPU'} · <span className="font-mono">{item.numeroInventario || item.nombre}</span>
                    </span>
                  </span>
                  <span className={`text-xs font-semibold tabular-nums whitespace-nowrap ${style.text}`} aria-hidden="true">{diasCorto(info.diasRestantes)}</span>
                  <span className="sr-only">, {diasLargo(info.diasRestantes)}</span>
                </>
              );
              return (
                <li key={item.id}>
                  {isAdmin ? (
                    <button type="button" onClick={() => onRegister({ item, info, ubic })} title={`${formatFecha(info.proximaFecha)} · Toca para registrar el mantenimiento`}
                      className="w-full min-h-[44px] flex items-center gap-2.5 px-4 py-1.5 text-left hover:bg-brand-bg/70 transition-colors">
                      {content}
                    </button>
                  ) : (
                    <div className="min-h-[44px] flex items-center gap-2.5 px-4 py-1.5">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
};

const MaintenanceScreen = ({ db, user, onBack }) => {
  const isAdmin = user.role === 'Administrador';
  const { items, loading, registrarEvento: registrarEnEquipo } = useInventory(db, user);
  const { puestos, loading: cargandoPuestos, registrarEvento: registrarEnPuesto } = usePuestos(db, user);
  const [target, setTarget] = useState(null); // { item, info, ubic }
  const { toast, show: showToast, dismiss: dismissToast } = useToast();

  const groups = useMemo(() => {
    const porId = new Map(puestos.map(p => [p.id, p]));
    const found = groupMaintenanceByUrgency(items).map(g => ({
      ...g, rows: g.rows.map(r => ({ ...r, ubic: conTituloDeFila(r.item, ubicacionEquipo(r.item, porId)) })),
    }));
    return GRUPOS_URGENCIA.map(g => found.find(f => f.key === g.key) ?? { ...g, rows: [] });
  }, [items, puestos]);
  const totalRelevantes = useMemo(() => groups.reduce((n, g) => n + g.rows.length, 0), [groups]);

  // Si falla, el error se propaga al modal (que lo muestra y deja reintentar).
  const handleConfirm = async (ev) => {
    const { item, ubic } = target;
    if (ubic.puesto) await registrarEnPuesto(ubic.puesto, ev, item);
    else await registrarEnEquipo(item, ev);
    setTarget(null);
    showToast(`Mantenimiento de ${ubic.titulo} registrado · próximo ${formatFecha(proximoTrasRegistrar(item, ev.fecha))}`);
  };

  return (
    <div className="min-h-screen bg-brand-bg font-sans">
      <div className="fixed inset-0 bg-glow pointer-events-none" />

      <div className="relative z-10 max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">

        <header className="flex items-center gap-4 mb-8">
          {onBack && <button onClick={onBack} aria-label="Volver al inventario" title="Volver al inventario"
            className="p-2.5 vidrio rounded-xl transition text-brand-slate hover:text-brand-ink">
            <ArrowLeft size={18} />
          </button>}
          <div>
            <h1 className="text-xl font-bold text-brand-ink">Mantenimientos preventivos</h1>
            <p className="text-xs text-brand-gray mt-0.5">
              CPU y portátiles por urgencia, agrupados por equipo de trabajo{isAdmin ? '. Toca uno para registrarlo.' : ''}
            </p>
          </div>
        </header>

        {loading || cargandoPuestos ? (
          <div className="flex flex-col items-center gap-3 py-16 text-brand-gray">
            <Loader2 size={24} className="animate-spin text-brand-ember" />
            <span className="text-sm">Cargando equipos…</span>
          </div>
        ) : totalRelevantes === 0 ? (
          <div className="bg-white border border-brand-border rounded-2xl">
            <EmptyState icon={<CheckCircle2 size={32} className="text-emerald-400" />} title="No hay mantenimientos pendientes por ahora." />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
            {groups.map(group => (
              <UrgencyColumn key={group.key} group={group} isAdmin={isAdmin} onRegister={setTarget} />
            ))}
          </div>
        )}
      </div>

      <MantenimientoModal isOpen={!!target} onClose={() => setTarget(null)} onConfirm={handleConfirm}
        equipo={target?.item} ubicacion={target?.ubic.titulo} proximaFecha={target?.info.proximaFecha} conPuesto={!!target?.ubic.puesto} />
      <ToastHost toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default MaintenanceScreen;
