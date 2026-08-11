import { useState, useEffect } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  signOut, setPersistence, browserSessionPersistence,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { firebaseConfig, configError, initFirebase } from './config/firebase';
import { isLoginLocked, recordFailedLogin, clearLoginAttempts } from './utils/loginLockout';
import { IDLE_TIME_MS, IDLE_WARNING_MS } from './config/constants';
import useIdleTimeout     from './hooks/useIdleTimeout';
import IdleModal          from './components/modals/IdleModal';
import LoginScreen        from './screens/LoginScreen';
import InventoryDashboard from './screens/InventoryDashboard';
import UsersScreen        from './screens/UsersScreen';
import MaintenanceScreen  from './screens/MaintenanceScreen';
import ConfigErrorScreen  from './screens/ConfigErrorScreen';

export default function App() {
  const [user,     setUser]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [auth,     setAuth]     = useState(null);
  const [db,       setDb]       = useState(null);
  const [hasError, setHasError] = useState(!!configError);
  const [screen,   setScreen]   = useState('dashboard');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!firebaseConfig) { setHasError(true); setLoading(false); return; }
    try {
      const { auth: a, db: d } = initFirebase();
      setAuth(a);
      setDb(d);
    } catch (e) {
      console.error('Error inicializando Firebase:', e);
      setHasError(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!auth) { if (loading) setLoading(false); return; }

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const userRef = doc(db, 'users', fbUser.uid);
        const snap    = await getDoc(userRef);

        if (!snap.exists()) {
          // No está registrado en el sistema → denegar acceso
          await signOut(auth);
          setAuthError('Tu cuenta no está autorizada para acceder al sistema. Contacta al administrador.');
          setUser(null);
        } else {
          const data = snap.data();
          if (!(data.active ?? true)) {
            // Cuenta desactivada → denegar acceso
            await signOut(auth);
            setAuthError('Tu cuenta ha sido desactivada. Contacta al administrador.');
            setUser(null);
          } else {
            setAuthError('');
            setUser({ ...fbUser, role: data.role ?? 'Lector' });
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsub;
    // `loading` se lee solo para evitar un setState redundante; no debe re-disparar el efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth, db]);

  const handleLogin = async (email, password) => {
    if (!auth) throw new Error('Firebase auth no está listo.');
    setAuthError('');

    // El bloqueo se revisa en Firestore (no solo en este navegador) antes
    // de intentar el login, para que no se pueda evadir borrando el caché.
    if (await isLoginLocked(db, email)) {
      throw new Error('Cuenta bloqueada temporalmente por demasiados intentos fallidos.');
    }

    await setPersistence(auth, browserSessionPersistence);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await clearLoginAttempts(db, email);
      return result;
    } catch (err) {
      await recordFailedLogin(db, email);
      throw err;
    }
  };

  const handleLogout = () => { setScreen('dashboard'); signOut(auth); };

  // El control de inactividad vive aquí y no en el dashboard: antes, al entrar
  // a Usuarios o Mantenimientos el temporizador se desmontaba con la pantalla
  // y el aviso no salía. Aquí aplica a todas por igual.
  const { expired: sessionExpired, countdown: idleCountdown } =
    useIdleTimeout(handleLogout, user, IDLE_TIME_MS, IDLE_WARNING_MS);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex justify-center items-center">
        <div className="w-8 h-8 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (hasError) return <ConfigErrorScreen />;
  if (!user)    return <LoginScreen onLogin={handleLogin} accessError={authError} />;

  const screenEl = (screen === 'users' && user.role === 'Administrador')
    ? <UsersScreen db={db} currentUser={user} onBack={() => setScreen('dashboard')} />
    : screen === 'maintenance'
      ? <MaintenanceScreen db={db} user={user} onBack={() => setScreen('dashboard')} />
      : <InventoryDashboard user={user} onLogout={handleLogout} db={db} onNavigate={setScreen} />;

  return (
    <>
      {sessionExpired && <IdleModal countdown={idleCountdown} />}
      {screenEl}
    </>
  );
}
