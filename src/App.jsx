import { useState, useEffect } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  signOut, setPersistence, browserSessionPersistence, sendPasswordResetEmail,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore';

import { firebaseConfig, configError, initFirebase } from './config/firebase';
import { isLoginLocked, recordFailedLogin, clearLoginAttempts } from './utils/loginLockout';
import { IDLE_TIME_MS, IDLE_WARNING_MS } from './config/constants';
import { COMPANY_DOMAIN, accessForUnregistered, isCompanyEmail, isGoogleUser } from './utils/roles';
import useIdleTimeout     from './hooks/useIdleTimeout';
import IdleModal          from './components/modals/IdleModal';
import LoginScreen        from './screens/LoginScreen';
import ColaboradorScreen  from './screens/ColaboradorScreen';
import StaffApp           from './screens/StaffApp';
import { Spinner } from './components/ui';
import ConfigErrorScreen  from './screens/ConfigErrorScreen';

// ── Entrada directa desde BETR People Center ──────────────────────────────────
// El menú de BETR PC abre /?entrar=google&correo=persona@betrmedia.com. Si aquí no hay
// sesión, se va directo a Google con esa cuenta ya escogida: como la persona acaba de
// entrar a BETR PC con ella, Google la devuelve sin pedir nada. Las reglas de acceso
// (accessForUnregistered y firestore.rules) no cambian: sigue siendo un ingreso con Google.
// Los parámetros se quitan de la dirección y un intento fallido no se repite en 2 minutos.
const CLAVE_ENTRADA = 'betr-entrada-directa';
function leerEntradaDirecta() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('entrar') !== 'google') return null;
    const correo = (url.searchParams.get('correo') || '').trim().toLowerCase();
    url.searchParams.delete('entrar');
    url.searchParams.delete('correo');
    window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    return isCompanyEmail(correo) ? correo : null;
  } catch { return null; }
}
const ENTRADA_DIRECTA = typeof window !== 'undefined' ? leerEntradaDirecta() : null;
const intentoReciente = () => {
  try { return Date.now() - Number(sessionStorage.getItem(CLAVE_ENTRADA) || 0) < 120000; } catch { return true; }
};
const marcarIntento = () => { try { sessionStorage.setItem(CLAVE_ENTRADA, String(Date.now())); } catch { /* sin almacenamiento */ } };

function proveedorGoogle(correo) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters(correo
    ? { hd: COMPANY_DOMAIN, login_hint: correo }
    : { hd: COMPANY_DOMAIN, prompt: 'select_account' });
  return provider;
}

export default function App() {
  const [user,     setUser]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [auth,     setAuth]     = useState(null);
  const [db,       setDb]       = useState(null);
  const [hasError, setHasError] = useState(!!configError);
  const [authError, setAuthError] = useState(null); // { tipo, mensaje } o null
  const [authNotice, setAuthNotice] = useState('');

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
        let   snap    = await getDoc(userRef);

        // Primera vez con la cuenta de Google de la empresa: se registra sola
        // como Colaborador (firestore.rules solo permite exactamente esto).
        if (!snap.exists() && accessForUnregistered(fbUser) === 'signup') {
          const email = fbUser.email.toLowerCase();
          try {
            await setDoc(userRef, {
              email,
              nombre: (fbUser.displayName || '').slice(0, 120),
              role: 'Colaborador',
              active: true,
              createdAt: serverTimestamp(),
              history: [{ timestamp: Timestamp.now(), user: email, action: 'Se registró con Google.' }],
            });
            snap = await getDoc(userRef);
          } catch (e) {
            console.error('No se pudo registrar al colaborador:', e);
          }
        }

        if (!snap.exists()) {
          // No está registrado en el sistema → denegar acceso
          await signOut(auth);
          setAuthError(isGoogleUser(fbUser) && !isCompanyEmail(fbUser.email)
            ? { tipo: 'dominio', mensaje: `${fbUser.email} no es una cuenta de Betrmedia. Entra con tu correo @${COMPANY_DOMAIN}.` }
            : { tipo: 'sin-acceso', mensaje: 'Tu cuenta todavía no tiene acceso a esta herramienta.' });
          setUser(null);
        } else {
          const data = snap.data();
          if (!(data.active ?? true)) {
            // Cuenta desactivada → denegar acceso
            await signOut(auth);
            setAuthError({ tipo: 'desactivada', mensaje: 'Tu acceso a esta herramienta está desactivado.' });
            setUser(null);
          } else {
            setAuthError(null);
            setUser({ ...fbUser, role: data.role ?? 'Lector', nombre: data.nombre || fbUser.displayName || '' });
          }
        }
      } else {
        // Viene de BETR PC y no hay sesión: directo a Google con su cuenta (sin pantalla de login).
        if (ENTRADA_DIRECTA && !intentoReciente()) {
          marcarIntento();
          try {
            await setPersistence(auth, browserSessionPersistence);
            await signInWithRedirect(auth, proveedorGoogle(ENTRADA_DIRECTA));
            return; // la página se va a Google; el cargador sigue visible
          } catch (e) {
            console.error('No se pudo iniciar la entrada directa:', e);
          }
        }
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
    setAuthError(null);
    setAuthNotice('');

    // El bloqueo se revisa en Firestore (no solo en este navegador) antes
    // de intentar el login, para que no se pueda evadir borrando el caché.
    if (await isLoginLocked(db, email)) {
      const err = new Error('Cuenta bloqueada temporalmente por demasiados intentos fallidos.');
      err.code = 'login/locked';
      throw err;
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

  // Google Workspace: lo usan los colaboradores (y quien quiera del equipo de T.I.).
  // `hd` solo sugiere el dominio en el selector de cuentas; el control real
  // está en accessForUnregistered (arriba) y en firestore.rules.
  //
  // La ventana emergente falla en la app instalada (PWA) y en los navegadores
  // internos de otras apps (enlace abierto desde Slack, Instagram…): ahí, o si el
  // navegador la bloquea, se entra redirigiendo la página a Google y de vuelta.
  const handleGoogleLogin = async () => {
    if (!auth) throw new Error('Firebase auth no está listo.');
    setAuthError(null);
    setAuthNotice('');
    await setPersistence(auth, browserSessionPersistence);
    // Si vino de BETR PC, el botón también sugiere esa cuenta
    const provider = proveedorGoogle(ENTRADA_DIRECTA);
    const sinVentanas = window.matchMedia?.('(display-mode: standalone)').matches
      || /FBAN|FBAV|Instagram|Line\/|Slack|; wv\)/i.test(navigator.userAgent);
    if (sinVentanas) return signInWithRedirect(auth, provider);
    try {
      return await signInWithPopup(auth, provider);
    } catch (err) {
      if (err?.code === 'auth/popup-blocked') return signInWithRedirect(auth, provider);
      throw err;
    }
  };

  // Al volver de la redirección a Google, un error se mostraría en ningún lado: se lleva al login.
  useEffect(() => {
    if (!auth) return;
    getRedirectResult(auth).catch((err) => {
      console.error('Error al volver de Google:', err);
      setAuthError({ tipo: 'google', mensaje: 'No se pudo terminar el ingreso con Google. Intenta de nuevo.' });
    });
  }, [auth]);

  // Envía el enlace para crear una contraseña nueva (lo gestiona Firebase Auth).
  const handleResetPassword = (email) => sendPasswordResetEmail(auth, email);

  const handleLogout = () => signOut(auth);

  // El Administrador puede ponerse su nombre (las cuentas de correo y contraseña no lo traen)
  const handleGuardarNombre = async (nombre) => {
    await updateDoc(doc(db, 'users', user.uid), {
      nombre,
      history: arrayUnion({ timestamp: Timestamp.now(), user: user.email, action: `Cambió su nombre a "${nombre}".` }),
    });
    setUser(prev => ({ ...prev, nombre }));
  };

  // Al cerrar por inactividad, el login explica por qué (antes la pantalla cambiaba sin decir nada)
  const handleIdleLogout = () => {
    setAuthNotice('Tu sesión se cerró por inactividad. Inicia sesión de nuevo para continuar.');
    handleLogout();
  };

  // El control de inactividad vive aquí y no en el dashboard: antes, al entrar
  // a Usuarios o Mantenimientos el temporizador se desmontaba con la pantalla
  // y el aviso no salía. Aquí aplica a todas por igual.
  const { expired: sessionExpired, countdown: idleCountdown } =
    useIdleTimeout(handleIdleLogout, user, IDLE_TIME_MS, IDLE_WARNING_MS);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex justify-center items-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (hasError) return <ConfigErrorScreen />;
  if (!user)    return <LoginScreen onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} onResetPassword={handleResetPassword} accessError={authError} notice={authNotice} />;

  // El colaborador solo ve su pantalla: nunca el inventario ni las demás.
  // El personal de T.I. entra al marco con pestañas (StaffApp); la navegación vive allí.
  const screenEl = user.role === 'Colaborador'
    ? <ColaboradorScreen db={db} user={user} onLogout={handleLogout} />
    : <StaffApp db={db} user={user} onLogout={handleLogout} onGuardarNombre={handleGuardarNombre} />;

  return (
    <>
      {sessionExpired && <IdleModal countdown={idleCountdown} />}
      {screenEl}
    </>
  );
}
