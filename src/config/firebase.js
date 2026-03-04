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
export const EQUIPOS_PATH = `artifacts/${APP_ID}/public/data/equipos`;
export { firebaseConfig, configError };

export function initFirebase() {
  if (!firebaseConfig) throw new Error('Firebase config no encontrada.');
  const app = initializeApp(firebaseConfig);
  return { auth: getAuth(app), db: getFirestore(app) };
}