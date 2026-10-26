import { useState, useRef, useEffect } from 'react';
import { LogIn, ShieldX, Eye, EyeOff, Clock } from 'lucide-react';
import { LOGO_URL } from '../config/constants';
import { Field, FormError, Spinner } from '../components/ui';
import { fieldClass } from '../components/ui/fieldClasses';

const ESPERA_RECUPERAR_MS = 30_000;

const LoginScreen = ({ onLogin, onResetPassword, accessError, notice }) => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [info,     setInfo]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [resetLocked, setResetLocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const emailRef = useRef(null);
  const resetTimer = useRef(null);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  // Bloq Mayús activo: la causa más común de "contraseña incorrecta" y no se ve en un campo de puntos
  const detectCaps = (e) => setCapsOn(!!e.getModifierState?.('CapsLock'));

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch {
      // Mensaje siempre igual (correo inexistente, contraseña incorrecta,
      // cuenta bloqueada por intentos fallidos, etc.) para no revelar
      // por qué falló el intento.
      setError('Correo o contraseña incorrectos.');
      setLoading(false);
    }
  };

  // La respuesta es siempre la misma, exista o no la cuenta (no revela qué correos están registrados).
  const handleReset = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Escribe tu correo y vuelve a pulsar “¿Olvidaste tu contraseña?”.');
      emailRef.current?.focus();
      return;
    }
    setResetLocked(true);
    resetTimer.current = setTimeout(() => setResetLocked(false), ESPERA_RECUPERAR_MS);
    try { await onResetPassword?.(email.trim()); } catch { /* respuesta neutra */ }
    setInfo('Si el correo está registrado, te enviamos un enlace para crear una contraseña nueva.');
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-glow-login pointer-events-none" />

      {/* Entrada escalonada: es lo primero que se ve de la sesión, y ocurre una sola vez */}
      <div className="w-full max-w-sm relative z-10 stagger-in">
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="Betrmedia" width="64" height="64"
            className="mx-auto h-16 w-16 object-contain mb-5" />
          <h1 className="text-2xl font-bold text-brand-ink tracking-tight">Inventario Betr Media</h1>
          <p className="text-brand-gray text-sm mt-1">Inicia sesión para continuar</p>
        </div>

        {/* Cuenta sin acceso o desactivada (viene de App.jsx) */}
        {accessError && (
          <div role="alert" className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
            <ShieldX size={18} className="text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-rose-700 text-sm">{accessError}</p>
          </div>
        )}

        {/* Aviso neutro: por ejemplo, la sesión se cerró por inactividad */}
        {notice && !accessError && (
          <div role="status" className="bg-white border border-brand-border rounded-2xl p-4 flex items-start gap-3 shadow-card">
            <Clock size={18} className="text-brand-slate flex-shrink-0 mt-0.5" />
            <p className="text-brand-slate text-sm">{notice}</p>
          </div>
        )}

        <div className={`bg-white border border-brand-border rounded-2xl p-6 sm:p-8 shadow-card-hover ${accessError || notice ? 'mt-4' : ''}`}>
          <form onSubmit={handleLogin} noValidate className="space-y-4">
            <Field label="Correo electrónico">
              <input ref={emailRef} type="email" value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="username" autoFocus required className={fieldClass} />
            </Field>

            <div>
              <Field label="Contraseña"
                hint={capsOn ? <span role="status" className="text-amber-800 font-medium">Bloq Mayús está activado.</span> : undefined}>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    onKeyDown={detectCaps} onKeyUp={detectCaps} onBlur={() => setCapsOn(false)}
                    autoComplete="current-password" required className={`${fieldClass} pr-11`} />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray hover:text-brand-ink transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>
              <div className="flex justify-end mt-2">
                <button type="button" onClick={handleReset} disabled={resetLocked}
                  className="text-xs font-medium text-brand-ember hover:underline disabled:text-brand-gray disabled:no-underline disabled:cursor-not-allowed">
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </div>

            <FormError key={error}>{error}</FormError>
            {info && (
              <p role="status" className="text-emerald-700 text-xs bg-emerald-50 border border-emerald-200 rounded-lg py-2 px-3 animate-reveal">{info}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand-orange hover:bg-brand-amber disabled:bg-brand-gray text-brand-cocoa disabled:text-white font-semibold h-11 rounded-xl transition shadow-lg hover:shadow-brand-orange/30">
              {loading ? <Spinner size="sm" tone="light" /> : <LogIn size={16} />}
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6 space-y-1.5">
          <p className="text-xs text-brand-gray">Solo usuarios autorizados. Si no tienes acceso, pídelo al administrador.</p>
          <p className="text-xs text-brand-gray">© 2026 Betrmedia SAS</p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
