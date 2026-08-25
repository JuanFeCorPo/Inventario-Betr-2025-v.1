// ─────────────────────────────────────────────
//  src/utils/idle.js
//  Lógica de inactividad, separada del hook para poder probarla.
//  El aviso aparece `warningTime` antes del cierre: con 30 min de
//  inactividad y 40 s de aviso, el modal sale al minuto 29:20 y la
//  sesión se cierra exactamente al minuto 30.
// ─────────────────────────────────────────────

export function getIdleState(msSinceActivity, idleTime, warningTime) {
  if (msSinceActivity >= idleTime) return { status: 'expired', secondsLeft: 0 };

  const warningStartsAt = Math.max(idleTime - warningTime, 0);
  if (msSinceActivity >= warningStartsAt) {
    return {
      status: 'warning',
      secondsLeft: Math.max(Math.ceil((idleTime - msSinceActivity) / 1000), 0),
    };
  }

  // Fuera del aviso se devuelve siempre el mismo valor para que el estado
  // no cambie de identidad en cada tick y no re-renderice la app cada segundo.
  return { status: 'active', secondsLeft: Math.ceil(warningTime / 1000) };
}
