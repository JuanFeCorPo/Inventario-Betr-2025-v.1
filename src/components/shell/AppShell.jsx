// ─────────────────────────────────────────────
//  Marco común del personal de T.I.: encabezado con pestañas (Inicio,
//  Solicitudes, Puestos, Mantenimientos), avisos y menú de usuario; en
//  celular, barra de pestañas abajo. Cada pestaña lleva cuántas cosas piden
//  atención. La barra es oscura (tinta de marca) con botones translúcidos.
// ─────────────────────────────────────────────

import { useState } from 'react';
import { Home, MessageSquareWarning, Monitor, Wrench, LogOut, Users, ChevronDown, ShieldCheck, Eye, PencilLine } from 'lucide-react';
import { LOGO_URL } from '../../config/constants';
import { usePopover } from '../../hooks/usePopover';
import AlertsBell from '../AlertsBell';

const PESTANAS = [
  { key: 'dashboard',   label: 'Inicio',         icon: Home,                 conteo: null,             aviso: '' },
  { key: 'solicitudes', label: 'Tickets',        icon: MessageSquareWarning, conteo: 'solicitudes',    aviso: 'sin atender', accion: true },
  { key: 'puestos',     label: 'Puestos',        icon: Monitor,              conteo: 'puestos',        aviso: 'con pendientes' },
  { key: 'maintenance', label: 'Mantenimientos', icon: Wrench,               conteo: 'mantenimientos', aviso: 'vencidos' },
];

// Botón translúcido de la barra oscura (vidrio sobre la tinta de marca)
export const VIDRIO = 'vidrio-oscuro';

// Naranja = pide acción (solicitudes); translúcida = para tener presente (puestos, mantenimientos)
const Insignia = ({ n, accion = false, className = '' }) => (n > 0 ? (
  <span aria-hidden="true" className={`min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center text-[11px] font-bold rounded-full tabular-nums ${accion ? 'bg-brand-orange text-brand-cocoa' : 'bg-white/15 text-white ring-1 ring-white/20'} ${className}`}>
    {n > 99 ? '99+' : n}
  </span>
) : null);

const etiquetaPestana = (p, n) => (n > 0 ? `${p.label}: ${n} ${p.aviso}` : p.label);
// Nombre visible: el del perfil; si no hay, la parte del correo antes de la @.
const nombreVisible = (user) => (user.nombre || '').trim() || (user.email || '').split('@')[0];
// Iniciales: primera letra del nombre y del apellido; sin nombre, la inicial del correo.
const iniciales = (user) => {
  const partes = (user.nombre || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length) return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
  return (user.email || '?')[0].toUpperCase();
};
const ROL = {
  Administrador: { icon: ShieldCheck, cls: 'bg-brand-orange/15 text-brand-ember' },
  Lector:        { icon: Eye,         cls: 'bg-blue-50 text-blue-700' },
};

// Foto de Google si la hay; si no, iniciales sobre la tinta de marca.
const Avatar = ({ user, size = 'sm' }) => {
  const dim = size === 'lg' ? 'w-11 h-11 text-base rounded-xl' : 'w-8 h-8 text-xs rounded-lg';
  return user.photoURL
    ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className={`${dim} object-cover flex-shrink-0`} />
    : <span aria-hidden="true" className={`${dim} flex items-center justify-center bg-brand-orange text-brand-cocoa font-bold flex-shrink-0`}>{iniciales(user)}</span>;
};

const RolBadge = ({ role }) => {
  const r = ROL[role] ?? ROL.Lector;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${r.cls}`}>
      <r.icon size={12} aria-hidden="true" /> {role}
    </span>
  );
};

const MenuUsuario = ({ user, onUsers, onLogout, onGuardarNombre }) => {
  const { open, setOpen, ref, shown } = usePopover();
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const item = 'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left text-brand-ink hover:bg-brand-bg rounded-lg transition-colors';
  const esAdmin = user.role === 'Administrador';
  const sinNombre = !(user.nombre || '').trim();

  const guardar = async (e) => {
    e.preventDefault();
    if (nombre.trim().length < 3) { setError('Escribe tu nombre y apellido.'); return; }
    setGuardando(true); setError('');
    try { await onGuardarNombre(nombre.trim()); setEditando(false); }
    catch { setError('No se pudo guardar. Revisa tu conexión.'); }
    finally { setGuardando(false); }
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        aria-label={`Cuenta de ${nombreVisible(user)} (${user.role})`}
        className={`flex items-center gap-2.5 h-11 pl-1.5 pr-2.5 rounded-xl transition ${VIDRIO}`}>
        <Avatar user={user} />
        <span className="hidden lg:block text-left min-w-0 max-w-[160px]">
          <span className="block text-sm font-semibold text-white leading-tight truncate">{nombreVisible(user)}</span>
          <span className="block text-[11px] text-brand-amber font-medium leading-tight">{user.role}</span>
        </span>
        <ChevronDown size={14} className={`text-white/60 hidden sm:block transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {shown && (
        <div role="menu" className={`absolute right-0 top-12 z-50 w-72 bg-white border border-brand-border rounded-2xl shadow-xl shadow-brand-ink/10 overflow-hidden ${open ? 'animate-pop-in' : 'animate-pop-out'}`}>
          <div className="flex items-center gap-3 px-4 py-4 border-b border-brand-border bg-brand-bg/50">
            <Avatar user={user} size="lg" />
            <div className="min-w-0">
              <p className="text-base font-semibold text-brand-ink leading-tight truncate">{nombreVisible(user)}</p>
              <p className="text-xs text-brand-gray truncate mb-1">{user.email}</p>
              <RolBadge role={user.role} />
            </div>
          </div>
          {editando ? (
            <form onSubmit={guardar} className="p-3 space-y-2 border-b border-brand-border">
              <label className="block text-xs font-semibold text-brand-slate" htmlFor="mi-nombre">Tu nombre</label>
              <input id="mi-nombre" value={nombre} onChange={e => { setNombre(e.target.value); setError(''); }} autoFocus
                placeholder="Ej: Juan Felipe Cortés" maxLength={120}
                className="w-full bg-brand-bg border border-brand-border text-brand-ink text-sm px-3 py-2 rounded-lg focus:outline-none focus:bg-white focus:border-transparent focus:ring-2 focus:ring-[#B86E00]" />
              {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditando(false)} className="text-sm text-brand-slate hover:text-brand-ink px-3 h-8 rounded-lg vidrio">Cancelar</button>
                <button type="submit" disabled={guardando} className="text-sm font-semibold vidrio-naranja px-3 h-8 rounded-lg disabled:opacity-60">
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          ) : null}
          <div className="p-1.5">
            {esAdmin && onGuardarNombre && !editando && (
              <button role="menuitem" type="button" className={item} onClick={() => { setNombre(user.nombre || ''); setEditando(true); }}>
                <PencilLine size={15} className="text-brand-slate" aria-hidden="true" /> {sinNombre ? 'Agregar mi nombre' : 'Cambiar mi nombre'}
              </button>
            )}
            {esAdmin && (
              <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); onUsers(); }}>
                <Users size={15} className="text-brand-slate" aria-hidden="true" /> Usuarios
              </button>
            )}
            <button role="menuitem" type="button" className={`${item} text-rose-700`} onClick={() => { setOpen(false); onLogout(); }}>
              <LogOut size={15} aria-hidden="true" /> Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const AppShell = ({ user, screen, onNavigate, onLogout, onGuardarNombre, resumen, children }) => {
  const actual = PESTANAS.some(p => p.key === screen) ? screen : null;
  const conteo = (p) => (p.conteo ? resumen.conteos[p.conteo] ?? 0 : 0);
  const irAlAviso = (alerta) => {
    if (alerta.id !== 'solicitudes-pendientes') resumen.dismissAlert(alerta.id);
    if (alerta.navigateTo) onNavigate(alerta.navigateTo);
    else onNavigate('dashboard', { filtro: { categoria: alerta.filterCategory ?? 'Todos', estado: alerta.filterStatus ?? 'Todos' } });
  };

  return (
    <div className="min-h-screen bg-brand-bg pb-20 sm:pb-0">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:bg-white focus:px-3 focus:py-2 focus:rounded-lg focus:shadow-card">
        Saltar al contenido
      </a>
      <header className="relative z-30 bg-nav-tech text-white shadow-[0_8px_24px_rgba(21,33,42,0.18)]">
        <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center gap-3 sm:gap-6">
          <button type="button" onClick={() => onNavigate('dashboard')} className="flex items-center gap-3 min-w-0 flex-shrink-0 rounded-lg" aria-label="BETR MEDIA TECH, ir a Inicio">
            <span className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.12] flex-shrink-0">
              <img src={LOGO_URL} alt="" className="h-6 w-auto object-contain" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-sm sm:text-[15px] font-bold tracking-[0.08em] leading-tight truncate">BETR MEDIA TECH</span>
              <span className="hidden sm:block text-[11px] text-white/60 leading-tight">Activos y soporte de T.I.</span>
            </span>
          </button>

          <nav aria-label="Secciones" className="hidden sm:flex items-center gap-1 flex-1 min-w-0">
            {PESTANAS.map(p => {
              const activa = actual === p.key;
              const n = conteo(p);
              return (
                <button key={p.key} type="button" onClick={() => onNavigate(p.key)} aria-current={activa ? 'page' : undefined}
                  aria-label={etiquetaPestana(p, n)}
                  className={`relative flex items-center gap-2 h-11 px-3.5 rounded-xl text-sm font-medium transition ${activa ? 'bg-white/[0.16] border border-white/30 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]' : VIDRIO}`}>
                  <p.icon size={16} aria-hidden="true" className={activa ? 'text-brand-amber' : ''} />
                  <span className="hidden md:inline">{p.label}</span>
                  <Insignia n={n} accion={p.accion} />
                  {activa && <span aria-hidden="true" className="absolute left-3 right-3 -bottom-[14px] h-[3px] rounded-full bg-brand-orange" />}
                </button>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <AlertsBell alerts={resumen.alerts} onGoTo={irAlAviso} onDismiss={resumen.dismissAlert} botonClassName={`h-11 w-11 ${VIDRIO}`} />
            <MenuUsuario user={user} onUsers={() => onNavigate('users')} onLogout={onLogout} onGuardarNombre={onGuardarNombre} />
          </div>
        </div>

        {/* Bienvenida: solo en Inicio */}
        {actual === 'dashboard' && (
          <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-8 sm:pt-5 sm:pb-10 border-t border-white/[0.08]">
            <h1 className="text-2xl sm:text-[2rem] font-bold leading-tight text-balance">
              Bienvenido a <span className="tracking-wide whitespace-nowrap">BETR MEDIA TECH</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm sm:text-base text-white/70 leading-relaxed text-pretty">
              Gestiona, consulta y realiza seguimiento a los activos tecnológicos y solicitudes de soporte de nuestra compañía desde un solo lugar.
            </p>
          </div>
        )}
      </header>

      <div id="contenido">{children}</div>

      {/* Celular: pestañas abajo, al alcance del pulgar */}
      <nav aria-label="Secciones" className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-[#15212A]/90 backdrop-blur-md border-t border-white/10 shadow-[0_-8px_24px_rgba(21,33,42,0.18)] pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4">
          {PESTANAS.map(p => {
            const activa = actual === p.key;
            const n = conteo(p);
            return (
              <button key={p.key} type="button" onClick={() => onNavigate(p.key)} aria-current={activa ? 'page' : undefined}
                aria-label={etiquetaPestana(p, n)}
                className={`relative flex flex-col items-center justify-center gap-0.5 h-16 text-[11px] font-medium transition-colors ${activa ? 'text-white' : 'text-white/60'}`}>
                <span className={`relative flex items-center justify-center w-11 h-7 rounded-full ${activa ? 'bg-brand-orange/20 text-brand-amber ring-1 ring-brand-orange/30' : ''}`}>
                  <p.icon size={18} aria-hidden="true" />
                  <Insignia n={n} accion={p.accion} className="absolute -top-1 -right-1.5" />
                </span>
                {p.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppShell;
