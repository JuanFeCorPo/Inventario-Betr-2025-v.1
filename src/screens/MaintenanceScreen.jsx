import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Laptop, Cpu } from 'lucide-react';
import { Modal, Button, EmptyState, Field, FormActions, Spinner, ToastHost } from '../components/ui';
import { formatFecha, hoyLocal } from '../utils/format';
import { fieldClass } from '../components/ui/fieldClasses';
import useInventory from '../hooks/useInventory';
import useAsyncAction from '../hooks/useAsyncAction';
import useToast from '../hooks/useToast';
import { groupMaintenanceByUrgency, GRUPOS_URGENCIA } from '../utils/maintenance';

const URGENCIA_STYLES = {
  'vencido':     { dot: 'bg-rose-500',    text: 'text-rose-600' },
  'esta-semana': { dot: 'bg-amber-500',   text: 'text-amber-600' },
  'este-mes':    { dot: 'bg-violet-500',  text: 'text-violet-600' },
  'proximo':     { dot: 'bg-emerald-500', text: 'text-emerald-600' },
};

// Texto corto para la línea compacta: "Hace 4 d", "Hoy", "12 d"
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

const RegisterMaintenanceModal = ({ isOpen, onClose, onConfirm, itemName }) => {
  const [fecha, setFecha] = useState('');
  const [notas, setNotas] = useState('');
  const [fechaError, setFechaError] = useState('');
  const { busy, error, run, reset } = useAsyncAction();

  useEffect(() => {
    if (isOpen) { setFecha(hoyLocal()); setNotas(''); setFechaError(''); reset(); }
  }, [isOpen, reset]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fecha) { setFechaError('Elige la fecha del mantenimiento.'); return; }
    if (fecha > hoyLocal()) { setFechaError('La fecha no puede ser futura.'); return; }
    setFechaError('');
    run(() => onConfirm(fecha, notas), 'No se pudo registrar el mantenimiento. Revisa tu conexión e inténtalo de nuevo.');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar mantenimiento" size="sm">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <p className="text-brand-slate text-sm">
          Equipo: <span className="font-semibold text-brand-ink">{itemName}</span>
        </p>
        <Field label="Fecha del mantenimiento" required error={fechaError}>
          <input type="date" value={fecha} max={hoyLocal()} onChange={e => { setFecha(e.target.value); setFechaError(''); }}
            autoFocus aria-required="true" aria-invalid={!!fechaError} className={fieldClass} />
        </Field>
        <Field label="Notas (opcional)">
          <textarea value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Ej: limpieza interna, cambio de pasta térmica…" className={`${fieldClass} h-24 resize-none`} />
        </Field>
        <FormActions error={error}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={busy} className="flex items-center gap-2">
            {busy && <Spinner size="sm" tone="dark" />}
            {busy ? 'Guardando…' : 'Registrar'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
};

// Una columna por nivel de urgencia: total en grande y una línea por equipo.
// El administrador toca la línea para registrar el mantenimiento.
const UrgencyColumn = ({ group, isAdmin, onRegister }) => {
  const style = URGENCIA_STYLES[group.key];
  const { rows } = group;
  return (
    <section className="bg-white border border-brand-border rounded-2xl shadow-card overflow-hidden">
      <header className="px-4 pt-3 pb-2.5 border-b border-brand-border">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${style.dot}`} />
          <h2 className="text-xs font-semibold text-brand-slate uppercase tracking-wider">{group.label}</h2>
        </div>
        <div className="flex items-baseline justify-between gap-2 mt-1">
          <p className={`text-3xl font-bold tabular-nums leading-none ${rows.length ? style.text : 'text-brand-gray/40'}`}>{rows.length}</p>
          {rows[0] && <p className="text-xs text-brand-gray">próximo {formatFecha(rows[0].info.proximaFecha)}</p>}
        </div>
      </header>
      <ul className="py-1">
        {rows.length === 0 && <li className="text-xs text-brand-gray text-center py-4">Nada aquí.</li>}
        {rows.map(({ item, info }) => {
          const Icon = item.categoria === 'CPU' ? Cpu : Laptop;
          const tooltip = `${item.nombre} · Nº ${item.numeroInventario} · ${item.personaEncargada || 'Sin asignar'} — ${diasLargo(info.diasRestantes)} (${formatFecha(info.proximaFecha)})`;
          const content = (
            <>
              <Icon size={13} className="text-brand-gray flex-shrink-0" />
              <span className="text-[13px] text-brand-ink truncate flex-1">{item.nombre}</span>
              <span className={`text-xs font-semibold tabular-nums whitespace-nowrap ${style.text}`}>{diasCorto(info.diasRestantes)}</span>
            </>
          );
          return (
            <li key={item.id}>
              {isAdmin ? (
                <button type="button" onClick={() => onRegister(item)} title={`${tooltip}. Toca para registrar.`}
                  className="w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-brand-bg/70 transition-colors">
                  {content}
                </button>
              ) : (
                <div title={tooltip} className="flex items-center gap-2 px-4 py-1.5">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

const MaintenanceScreen = ({ db, user, onBack }) => {
  const isAdmin = user.role === 'Administrador';
  const { items, loading, registerMaintenance } = useInventory(db, user);
  const [target, setTarget] = useState(null);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();

  const groups = useMemo(() => {
    const found = groupMaintenanceByUrgency(items);
    return GRUPOS_URGENCIA.map(g => found.find(f => f.key === g.key) ?? { ...g, rows: [] });
  }, [items]);
  const totalRelevantes = useMemo(() => groups.reduce((n, g) => n + g.rows.length, 0), [groups]);

  // Si falla, el error se propaga al modal (que lo muestra y deja reintentar).
  const handleConfirmRegister = async (fecha, notas) => {
    const nombre = target.nombre;
    await registerMaintenance(target.id, fecha, notas);
    setTarget(null);
    showToast(`Mantenimiento de ${nombre} registrado`);
  };

  return (
    <div className="min-h-screen bg-brand-bg font-sans">
      <div className="fixed inset-0 bg-glow pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        <header className="flex items-center gap-4 mb-8">
          <button onClick={onBack} aria-label="Volver al inventario" title="Volver al inventario"
            className="p-2.5 bg-white hover:bg-brand-bg border border-brand-border rounded-xl transition shadow-sm text-brand-slate hover:text-brand-ink">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-brand-ink">Mantenimientos preventivos</h1>
            <p className="text-xs text-brand-gray mt-0.5">Laptops y CPU, ordenados por urgencia</p>
          </div>
        </header>

        {loading ? (
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

      <RegisterMaintenanceModal isOpen={!!target} onClose={() => setTarget(null)} onConfirm={handleConfirmRegister} itemName={target?.nombre} />
      <ToastHost toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default MaintenanceScreen;
