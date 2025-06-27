// firebase.js
import { initializeApp } from 'firebase/app';

let firebaseConfig = {};

try {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG;
  firebaseConfig = raw && raw !== "undefined" ? JSON.parse(raw) : {};
} catch (error) {
  console.error("Error al parsear VITE_FIREBASE_CONFIG:", error);
}

const app = initializeApp(firebaseConfig);

export default app;
