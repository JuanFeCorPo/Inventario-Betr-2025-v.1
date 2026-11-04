// ─────────────────────────────────────────────
//  App del personal de T.I. (Administrador / Lector): el marco con pestañas
//  y la pantalla de cada una. La navegación puede llevar datos: abrir una
//  solicitud, la hoja de vida de un puesto o un filtro del inventario.
// ─────────────────────────────────────────────

import { useState } from 'react';
import AppShell from '../components/shell/AppShell';
import useResumenTI from '../hooks/useResumenTI';
import InventoryDashboard from './InventoryDashboard';
import UsersScreen from './UsersScreen';
import MaintenanceScreen from './MaintenanceScreen';
import SolicitudesScreen from './SolicitudesScreen';
import PuestosScreen from './PuestosScreen';

const StaffApp = ({ db, user, onLogout, onGuardarNombre }) => {
  const [nav, setNav] = useState({ screen: 'dashboard', params: {} });
  const resumen = useResumenTI(db, user);

  const onNavigate = (screen, params = {}) => {
    setNav({ screen, params: { ...params, n: Date.now() } });
    window.scrollTo(0, 0);
  };

  const { screen, params } = nav;
  let contenido;
  if (screen === 'users' && user.role === 'Administrador') contenido = <UsersScreen db={db} currentUser={user} />;
  else if (screen === 'maintenance') contenido = <MaintenanceScreen db={db} user={user} />;
  else if (screen === 'solicitudes') contenido = <SolicitudesScreen key={params.n} db={db} user={user} onNavigate={onNavigate} ticketInicial={params.ticketId} />;
  else if (screen === 'puestos') contenido = <PuestosScreen key={params.n} db={db} user={user} puestoInicial={params.puestoId} />;
  else contenido = <InventoryDashboard db={db} user={user} onNavigate={onNavigate} filtro={params.filtro} filtroNonce={params.n} />;

  return (
    <AppShell user={user} screen={screen} onNavigate={onNavigate} onLogout={onLogout} onGuardarNombre={onGuardarNombre} resumen={resumen}>
      {contenido}
    </AppShell>
  );
};

export default StaffApp;
