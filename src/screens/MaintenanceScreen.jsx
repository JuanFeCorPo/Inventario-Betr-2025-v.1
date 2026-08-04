import { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Wrench, CheckCircle2, Loader2 } from 'lucide-react';
import { Modal, Button, StatusBadge } from '../components/ui';
import useInventory from '../hooks/useInventory';
import { groupMaintenanceByUrgency } from '../utils/maintenance';

const URGENCIA_STYLES = {
  'vencido':     { label: 'Vencidos',    dot: 'bg-rose-500',    text: 'text-rose-600',    bg: 'bg-rose-50 border-rose-100' },
  'esta-semana': { label: 'Esta semana', dot: 'bg-amber-500',   text: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100' },
  'este-mes':    { label: 'Este mes',    dot: 'bg-violet-500',  text: 'text-violet-600',  bg: 'bg-violet-50 border-violet-100' },
  'proximo':     { label: 'Próximos',    dot: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
};

const fieldClass = 'w-full bg-brand-bg border border-brand-border text-brand-ink placeholder-brand-gray p-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all';

const formatDiasRestantes = (dias) => {
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`;
  if (dias === 0) return 'Vence hoy';
  return `En ${dias} día${dias !== 1 ? 's' : ''}`;
};

const RegisterMaintenanceModal = ({ isOpen, onClose, onConfirm, itemName }) => {
  const [fecha, setFecha] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) { setFecha(new Date().toISOString().split('T')[0]); setNotas(''); setSaving(false); }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!fecha) return;
    setSaving(true);
    await onConfirm(fecha, notas);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Mantenimiento" size="sm">
      <div className="space-y-4">
        <p className="text-brand-slate text-sm">
          Equipo: <span className="font-semibold text-brand-ink">{itemName}</span>
        </p>
        <div>
          <label className="text-xs font-semibold text-brand-slate mb-1.5 block">Fecha del mantenimiento</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label className="text-xs font-semibold text-brand-slate mb-1.5 block">Notas (opcional)</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Ej: Limpieza interna, cambio de pasta térmica…" className={`${fieldClass} h-24 resize-none`} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleConfirm} disabled={saving || !fecha} className="flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Guardando…' : 'Registrar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const MaintenanceRow = ({ item, info, isAdmin, onRegister }) => {
  const style = URGENCIA_STYLES[info.urgencia];
  return (
    <li className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-brand-ink text-sm">{item.nombre}</p>
          <StatusBadge status={item.estado} />
        </div>
        <p className="text-xs text-brand-gray mt-0.5">
          {item.categoria} · Nº {item.numeroInventario} {item.personaEncargada ? `· ${item.personaEncargada}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${style.bg} ${style.text}`}>
          {formatDiasRestantes(info.diasRestantes)}
        </div>
        <span className="text-xs text-brand-gray whitespace-nowrap hidden sm:inline">
          {info.proximaFecha.toLocaleDateString()}
        </span>
        {isAdmin && (
          <Button variant="secondary" onClick={() => onRegister(item)} className="!px-3 !py-2 text-xs flex items-center gap-1.5 flex-shrink-0">
            <Wrench size={13} /> <span className="hidden sm:inline">Registrar</span>
          </Button>
        )}
      </div>
    </li>
  );
};

const MaintenanceScreen = ({ db, user, onBack }) => {
  const isAdmin = user.role === 'Administrador';
  const { items, loading, registerMaintenance } = useInventory(db, user);
  const [target, setTarget] = useState(null);

  const groups = useMemo(() => groupMaintenanceByUrgency(items), [items]);
  const totalRelevantes = useMemo(() => groups.reduce((n, g) => n + g.rows.length, 0), [groups]);

  const handleConfirmRegister = async (fecha, notas) => {
    await registerMaintenance(target.id, fecha, notas);
    setTarget(null);
  };

  return (
    <div className="min-h-screen bg-brand-bg font-sans">
      <div className="fixed top-0 right-0 w-[600px] h-[400px] bg-brand-orange/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        <header className="flex items-center gap-4 mb-8">
          <button onClick={onBack}
            className="p-2.5 bg-white hover:bg-brand-bg border border-brand-border rounded-xl transition-all shadow-sm text-brand-slate hover:text-brand-ink">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-brand-ink">Mantenimientos Preventivos</h1>
            <p className="text-xs text-brand-gray mt-0.5">Laptops y CPU, ordenados por urgencia</p>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-brand-gray">
            <Loader2 size={24} className="animate-spin text-brand-orange" />
            <span className="text-sm">Cargando equipos…</span>
          </div>
        ) : totalRelevantes === 0 ? (
          <div className="text-center py-16 text-brand-gray bg-white border border-brand-border rounded-2xl">
            <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-400" />
            <p className="text-sm">No hay mantenimientos pendientes por ahora.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(group => {
              const style = URGENCIA_STYLES[group.key];
              return (
                <div key={group.key}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    <h2 className="text-sm font-bold text-brand-ink">{group.label}</h2>
                    <span className="text-xs text-brand-gray">({group.rows.length})</span>
                  </div>
                  <ul className="bg-white border border-brand-border rounded-2xl shadow-sm divide-y divide-brand-border overflow-hidden">
                    {group.rows.map(({ item, info }) => (
                      <MaintenanceRow key={item.id} item={item} info={info} isAdmin={isAdmin} onRegister={setTarget} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RegisterMaintenanceModal isOpen={!!target} onClose={() => setTarget(null)} onConfirm={handleConfirmRegister} itemName={target?.nombre} />
    </div>
  );
};

export default MaintenanceScreen;
