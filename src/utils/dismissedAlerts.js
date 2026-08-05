// ─────────────────────────────────────────────
//  src/utils/dismissedAlerts.js
//  Una alerta descartada ("Ver" o la X) se oculta por 15 días; si el
//  problema sigue sin resolverse, vuelve a aparecer como recordatorio.
// ─────────────────────────────────────────────

export const ALERT_REAPPEAR_AFTER_MS = 15 * 24 * 60 * 60 * 1000;

// `dismissedMap`: { [alertId]: dismissedAtMillis }, ver useDismissedAlerts.
export function isAlertDismissed(dismissedMap, alertId, now = Date.now()) {
  const dismissedAt = dismissedMap[alertId];
  return dismissedAt !== undefined && (now - dismissedAt) < ALERT_REAPPEAR_AFTER_MS;
}
