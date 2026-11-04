// ─────────────────────────────────────────────
//  Lo que pide atención en toda la app (para el encabezado y la campana):
//  solicitudes, puestos con pendientes, mantenimientos vencidos y alertas del
//  inventario. Firestore comparte las suscripciones iguales entre pantallas.
// ─────────────────────────────────────────────

import { useMemo } from 'react';
import useInventory from './useInventory';
import usePuestos from './usePuestos';
import useDismissedAlerts from './useDismissedAlerts';
import { useTicketsPendientes } from './useTickets';
import { computeAlerts } from '../utils/alerts';
import { isAlertDismissed } from '../utils/dismissedAlerts';
import { countOverdueMaintenance } from '../utils/maintenance';
import { pendientesTI } from '../utils/tickets';
import { equiposDelPuesto, resumenPuesto } from '../utils/puestos';

const useResumenTI = (db, user) => {
  const { items } = useInventory(db, user);
  const { puestos } = usePuestos(db, user);
  const tickets = useTicketsPendientes(db);
  const { dismissedMap, dismissAlert } = useDismissedAlerts(db, user);

  return useMemo(() => {
    const solicitudes = pendientesTI(tickets);
    const bloquean = solicitudes.filter(t => t.urgencia === 'bloquea').length;
    const puestosPendientes = puestos.filter(p => resumenPuesto(p, equiposDelPuesto(items, p.id)).pendiente).length;
    const avisoTickets = solicitudes.length ? [{
      id: 'solicitudes-pendientes', tipo: 'solicitudes', noDescartable: true, navigateTo: 'solicitudes',
      severity: bloquean ? 'high' : 'medium',
      message: bloquean
        ? `${bloquean} ${bloquean === 1 ? 'persona no puede' : 'personas no pueden'} trabajar · ${solicitudes.length} ticket${solicitudes.length === 1 ? '' : 's'} sin atender`
        : `${solicitudes.length} ticket${solicitudes.length === 1 ? '' : 's'} sin atender`,
    }] : [];
    const alerts = [...avisoTickets, ...computeAlerts(items).filter(a => !isAlertDismissed(dismissedMap, a.id))];
    return {
      alerts, dismissAlert,
      conteos: { solicitudes: solicitudes.length, puestos: puestosPendientes, mantenimientos: countOverdueMaintenance(items) },
    };
  }, [items, puestos, tickets, dismissedMap, dismissAlert]);
};

export default useResumenTI;
