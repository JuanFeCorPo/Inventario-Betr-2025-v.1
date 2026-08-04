import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {"apiKey":"AIzaSyBeQPON-fKYd01sBXj04okO7LxAdcscC1o","authDomain":"inventario-betrmedia-sas.firebaseapp.com","projectId":"inventario-betrmedia-sas","storageBucket":"inventario-betrmedia-sas.firebasestorage.app","messagingSenderId":"901628639089","appId":"1:901628639089:web:e3bb3b9e244f7c754ae8d0","measurementId":"G-10VL9FSB90"};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const email = process.argv[2];
if (!email) { console.error('Uso: node check-lockout.mjs <email>'); process.exit(1); }

const id = email.trim().toLowerCase();
const snap = await getDoc(doc(db, 'loginAttempts', id));
if (!snap.exists()) {
  console.log(`No hay documento de intentos para "${id}". Nunca falló un login o nunca se creó el registro.`);
} else {
  const data = snap.data();
  console.log('Documento loginAttempts/' + id + ':', JSON.stringify(data, null, 2));
  if (data.lockedUntil) {
    const until = data.lockedUntil.toDate ? data.lockedUntil.toDate() : new Date(data.lockedUntil);
    console.log('lockedUntil ->', until.toString(), until.getTime() > Date.now() ? '(BLOQUEADO ahora)' : '(ya expiró)');
  }
}
process.exit(0);
