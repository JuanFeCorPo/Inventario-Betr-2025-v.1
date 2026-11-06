import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

let firebaseConfig = null;
let configError = null;

try {
  const configFromVite = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env.VITE_FIREBASE_CONFIG : null;
  if (configFromVite) {
    firebaseConfig = JSON.parse(configFromVite);
  } else if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    firebaseConfig = JSON.parse(__firebase_config);
  }
} catch (e) {
  console.error('Error al parsear Firebase config:', e);
  configError = e;
}

export const APP_ID = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
export const EQUIPOS_PATH            = `artifacts/${APP_ID}/public/data/equipos`;
export const EQUIPOS_ELIMINADOS_PATH = `artifacts/${APP_ID}/public/data/equipos_eliminados`;
export const ENCARGADOS_PATH         = `artifacts/${APP_ID}/public/data/encargados`;
// Puestos de trabajo (hoja de vida F-MAN-02). Cada uno tiene su subcolección `historial`.
export const PUESTOS_PATH            = `artifacts/${APP_ID}/public/data/puestos`;
// Solicitudes de soporte (tickets) de los colaboradores.
export const TICKETS_PATH            = `artifacts/${APP_ID}/public/data/tickets`;
// Colección de nivel raíz (no bajo artifacts/.../public/data): debe ser
// legible/escribible sin sesión iniciada, ya que el bloqueo se evalúa
// antes de intentar el login.
export const LOGIN_ATTEMPTS_PATH = 'loginAttempts';
// También raíz: se comparte entre todos los usuarios (si un administrador
// descarta una alerta, no debe volver a salirle a otro en otro equipo).
export const DISMISSED_ALERTS_PATH = 'dismissedAlerts';
export { firebaseConfig, configError };

// Inicio de sesión con Google en el MISMO dominio del inventario.
// Chrome, Safari y Firefox bloquean el almacenamiento entre dominios: si el ingreso
// pasa por *.firebaseapp.com, al volver de Google (signInWithRedirect, la entrada
// directa desde BETR People Center y la app instalada) la sesión se pierde y vuelve
// al login. vercel.json reenvía /__/auth/* a Firebase, así que en producción el
// authDomain es el propio inventario.betrmedia.com. En local se deja el de Firebase.
function configConDominioPropio(config) {
  if (typeof window === 'undefined') return config;
  const host = window.location.host;
  return /(^|\.)betrmedia\.com$/.test(window.location.hostname) ? { ...config, authDomain: host } : config;
}

export function initFirebase() {
  if (!firebaseConfig) throw new Error('Firebase config no encontrada.');
  const app = initializeApp(configConDominioPropio(firebaseConfig));
  return { auth: getAuth(app), db: getFirestore(app) };
}