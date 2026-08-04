// ─────────────────────────────────────────────
//  src/utils/loginLockout.js
//  Bloqueo de intentos de login por correo, aplicado en Firestore
//  (no solo en el navegador) para que no se pueda evadir borrando
//  el caché local. Ver firestore.rules para la validación del lado
//  del servidor de estos documentos.
// ─────────────────────────────────────────────

import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { LOGIN_ATTEMPTS_PATH } from '../config/firebase';

export const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_MS = 60 * 60 * 1000; // 1 hora

const normalizeEmail = (email) => (email ?? '').trim().toLowerCase();

// true si este correo tiene un bloqueo activo en este momento.
export async function isLoginLocked(db, email) {
  const id = normalizeEmail(email);
  if (!id) return false;
  const snap = await getDoc(doc(db, LOGIN_ATTEMPTS_PATH, id));
  if (!snap.exists()) return false;
  const lockedUntil = snap.data().lockedUntil;
  return !!lockedUntil && lockedUntil.toMillis() > Date.now();
}

// Registra un intento fallido; al llegar al umbral, bloquea el correo por 1 hora.
export async function recordFailedLogin(db, email) {
  const id = normalizeEmail(email);
  if (!id) return;
  const ref  = doc(db, LOGIN_ATTEMPTS_PATH, id);
  const snap = await getDoc(ref);
  const failedCount = (snap.exists() ? snap.data().failedCount ?? 0 : 0) + 1;
  const reachedLimit = failedCount >= MAX_LOGIN_ATTEMPTS;

  await setDoc(ref, {
    failedCount: reachedLimit ? 0 : failedCount,
    lockedUntil: reachedLimit ? Timestamp.fromMillis(Date.now() + LOCKOUT_MS) : null,
    lastAttempt: Timestamp.now(),
  });
}

// Limpia el contador tras un login exitoso.
export async function clearLoginAttempts(db, email) {
  const id = normalizeEmail(email);
  if (!id) return;
  await setDoc(doc(db, LOGIN_ATTEMPTS_PATH, id), {
    failedCount: 0,
    lockedUntil: null,
    lastAttempt: Timestamp.now(),
  }).catch(() => {});
}
