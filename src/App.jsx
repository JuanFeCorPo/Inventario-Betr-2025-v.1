import React, { useState, useEffect } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  signOut, setPersistence, browserSessionPersistence,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { firebaseConfig, configError, initFirebase } from './config/firebase';
import LoginScreen        from './screens/LoginScreen';
import InventoryDashboard from './screens/InventoryDashboard';
import UsersScreen        from './screens/UsersScreen';
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
  }, [auth, db]);

  const handleLogin = async (email, password) => {
    if (!auth) throw new Error('Firebase auth no está listo.');
    setAuthError('');
    await setPersistence(auth, browserSessionPersistence);
    return signInWithEmailAndPassword(auth, email, password);
  };

  const handleLogout = () => { setScreen('dashboard'); signOut(auth); };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F2F4] flex justify-center items-center">
        <div className="w-8 h-8 border-2 border-[#E68E00]/30 border-t-[#E68E00] rounded-full animate-spin" />
      </div>
    );
  }

  if (hasError) return <ConfigErrorScreen />;
  if (!user)    return <LoginScreen onLogin={handleLogin} accessError={authError} />;

  if (screen === 'users' && user.role === 'Administrador') {
    return <UsersScreen db={db} currentUser={user} onBack={() => setScreen('dashboard')} />;
  }

  return (
    <InventoryDashboard
      user={user}
      onLogout={handleLogout}
      db={db}
      onNavigate={setScreen}
    />
  );
}
