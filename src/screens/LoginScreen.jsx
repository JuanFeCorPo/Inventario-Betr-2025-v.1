import { useState, useRef, useEffect } from 'react';
import { ShieldX, Eye, EyeOff, Clock, ChevronDown } from 'lucide-react';
import { LOGO_URL, SUPPORT_EMAIL } from '../config/constants';
import { COMPANY_DOMAIN } from '../utils/roles';
import { Field, FormError, Spinner } from '../components/ui';
import { fieldClass } from '../components/ui/fieldClasses';

// Login de la app. Lo usan dos públicos muy distintos:
//  - ~60 colaboradores, que solo entran con Google: es el camino principal.
//  - El equipo de T.I., con correo y contraseña: queda plegado y se recuerda
//    abierto en el equipo de quien lo usó.

const ESPERA_RECUPERAR_MS = 30_000;
const RECORDAR_TI = 'login:acceso-ti';
const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('No puedo entrar a BETR MEDIA TECH')}`;

// Marca "G" de Google (colores oficiales).
const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

// Errores de Google que el usuario puede entender y resolver ('' = no mostrar nada).
const googleErrorMessage = (code) => {
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '';
  if (code === 'auth/account-exists-with-different-credential') return 'Esta cuenta entra con correo y contraseña: usa el acceso de T.I. de abajo.';
  if (code === 'auth/network-request-failed') return 'Sin conexión a internet. Revisa la red e intenta de nuevo.';
  return 'No se pudo entrar con Google. Intenta de nuevo.';
};

const SoporteLink = ({ children = SUPPORT_EMAIL, oscuro = false }) => (
  <a href={mailto} className={`font-medium underline underline-offset-2 ${oscuro ? 'text-brand-amber decoration-brand-amber/40 hover:decoration-brand-amber' : 'text-brand-ember decoration-brand-ember/40 hover:decoration-brand-ember'}`}>
    {children}
  </a>
);

const LoginScreen = ({ onLogin, onGoogleLogin, onResetPassword, accessError, notice }) => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');      // formulario de T.I.
  const [googleError, setGoogleError] = useState('');
  const [info,     setInfo]     = useState('');
  const [loading,  setLoading]  = useState(false);
  // null | 'abriendo' (ventana de Google) | 'verificando' (Google respondió; se revisa el acceso)
  const [googleFase, setGoogleFase] = useState(null);
  const [tiOpen, setTiOpen] = useState(() => localStorage.getItem(RECORDAR_TI) === '1');
  const [resetLocked, setResetLocked] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const emailRef = useRef(null);
  const resetTimer = useRef(null);
  const googleBusy = googleFase !== null;

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  // Si App rechaza la cuenta después de Google (otro dominio, sin acceso), el botón vuelve a estar disponible.
  useEffect(() => { if (accessError) setGoogleFase(null); }, [accessError]);

  const abrirTi = (abrir) => {
    setTiOpen(abrir);
    localStorage.setItem(RECORDAR_TI, abrir ? '1' : '0');
    if (abrir) requestAnimationFrame(() => emailRef.current?.focus());
  };

  const handleGoogle = async () => {
    if (googleBusy || loading) return;
    setGoogleError('');
    setError('');
    setInfo('');
    setGoogleFase('abriendo');
    try {
      await onGoogleLogin();
      // Google respondió: App revisa el acceso y cambia de pantalla
      setGoogleFase('verificando');
    } catch (err) {
      const msg = googleErrorMessage(err?.code);
      setGoogleError(msg);
      if (err?.code === 'auth/account-exists-with-different-credential') abrirTi(true);
      setGoogleFase(null);
    }
  };

  // Bloq Mayús activo: la causa más común de "contraseña incorrecta" y no se ve en un campo de puntos
  const detectCaps = (e) => setCapsOn(!!e.getModifierState?.('CapsLock'));

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setGoogleError('');
    setInfo('');
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      // Mensaje igual para correo inexistente o contraseña incorrecta (no revela qué correos existen).
      // El bloqueo aplica a cualquier correo tras varios intentos, así que decirlo no revela nada.
      setError(err?.code === 'login/locked'
        ? 'Demasiados intentos fallidos con este correo. Espera una hora o escribe a T.I.'
        : 'Correo o contraseña incorrectos.');
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
    <main className="min-h-screen bg-nav-tech flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Luz naranja de marca detrás de la tarjeta: profundidad sin recargar */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(520px_420px_at_50%_58%,rgba(230,142,0,0.16),transparent_70%)]" aria-hidden="true" />

      {/* Entrada escalonada: es lo primero que se ve de la sesión, y ocurre una sola vez */}
      <div className="w-full max-w-sm relative z-10 stagger-in">
        <header className="text-center mb-7">
          <span className="mx-auto mb-5 w-16 h-16 flex items-center justify-center rounded-2xl vidrio-oscuro shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
            <img src={LOGO_URL} alt="Betrmedia" width="40" height="40" className="h-10 w-10 object-contain" />
          </span>
          <h1 className="text-[1.75rem] leading-tight font-bold text-white text-balance">
            Bienvenido a <span className="whitespace-nowrap tracking-wide">BETR MEDIA TECH</span>
          </h1>
          <p className="text-white/70 text-[0.9375rem] mt-2 leading-relaxed text-pretty">
            Gestiona, consulta y realiza seguimiento a los activos tecnológicos y solicitudes de soporte de nuestra compañía desde un solo lugar.
          </p>
        </header>

        {/* Cuenta sin acceso, de otro dominio o desactivada (viene de App.jsx) */}
        {accessError && (
          <div role="alert" className="bg-white/[0.95] backdrop-blur-xl border border-rose-200 rounded-2xl p-4 mb-4 shadow-[0_12px_32px_rgba(0,0,0,0.25)]">
            <div className="flex items-start gap-3">
              <ShieldX size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm min-w-0">
                <p className="text-rose-700 font-medium break-words">{accessError.mensaje}</p>
                {accessError.tipo === 'dominio' ? (
                  <button type="button" onClick={handleGoogle} disabled={googleBusy}
                    className="mt-2 font-semibold text-brand-ink underline underline-offset-2 decoration-brand-ink/30 hover:decoration-brand-ink min-h-6">
                    Usar otra cuenta de Google
                  </button>
                ) : accessError.tipo !== 'google' && (
                  <p className="text-brand-slate mt-1">Escríbele a T.I. a <SoporteLink /> y te habilitamos.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Aviso neutro: por ejemplo, la sesión se cerró por inactividad */}
        {notice && !accessError && (
          <div role="status" className="bg-white/[0.95] backdrop-blur-xl border border-white/50 rounded-2xl p-4 mb-4 flex items-start gap-3 shadow-[0_12px_32px_rgba(0,0,0,0.25)]">
            <Clock size={18} className="text-brand-slate flex-shrink-0 mt-0.5" />
            <p className="text-brand-slate text-sm">{notice}</p>
          </div>
        )}

        <section aria-labelledby="login-google" className="bg-white/[0.95] backdrop-blur-xl border border-white/50 rounded-2xl p-6 sm:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_24px_60px_rgba(0,0,0,0.35)]">
          <h2 id="login-google" className="text-base font-semibold text-brand-ink">Colaboradores</h2>
          <p className="text-sm text-brand-slate mt-1 mb-5">Usa tu cuenta de Google <span className="whitespace-nowrap">@{COMPANY_DOMAIN}</span>.</p>

          <button type="button" onClick={handleGoogle} disabled={googleBusy || loading} aria-busy={googleBusy}
            className="w-full flex items-center justify-center gap-3 vidrio-tinta font-semibold h-12 rounded-xl transition disabled:cursor-wait">
            <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center flex-shrink-0">
              {googleBusy ? <Spinner size="sm" /> : <GoogleMark />}
            </span>
            {googleFase === 'verificando' ? 'Verificando tu cuenta…'
              : googleFase === 'abriendo' ? 'Abriendo Google…'
              : 'Continuar con Google'}
          </button>
          <FormError key={googleError} className="mt-3">{googleError}</FormError>

          {/* Acceso de T.I. (correo y contraseña): plegado para no competir con Google */}
          <div className="mt-6 pt-2 border-t border-brand-border">
            <button type="button" onClick={() => abrirTi(!tiOpen)} aria-expanded={tiOpen} aria-controls="acceso-ti"
              className="w-full flex items-center justify-between gap-2 py-2.5 text-left text-sm text-brand-slate hover:text-brand-ink transition-colors rounded-lg">
              <span>¿Eres de T.I.? <span className="font-medium text-brand-ink">Entrar con correo y contraseña</span></span>
              <ChevronDown size={16} aria-hidden="true" className={`flex-shrink-0 transition-transform duration-200 ${tiOpen ? 'rotate-180' : ''}`} />
            </button>

            {tiOpen && (
              <form id="acceso-ti" onSubmit={handleLogin} noValidate aria-label="Acceso del equipo de T.I." className="space-y-4 pt-3 animate-reveal">
                <Field label="Correo electrónico">
                  <input ref={emailRef} type="email" value={email} onChange={e => setEmail(e.target.value)}
                    autoComplete="username" placeholder={`nombre@${COMPANY_DOMAIN}`} required className={fieldClass} />
                </Field>

                <div>
                  {/* Sin <Field>: el botón del ojo no puede ir dentro de la etiqueta */}
                  <label htmlFor="login-password" className="text-xs font-semibold text-brand-slate mb-1.5 block">Contraseña</label>
                  <div className="relative">
                    <input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      onKeyDown={detectCaps} onKeyUp={detectCaps} onBlur={() => setCapsOn(false)}
                      autoComplete="current-password" required aria-describedby={capsOn ? 'login-caps' : undefined}
                      className={`${fieldClass} pr-12`} />
                    <button type="button" onClick={() => setShowPassword(p => !p)}
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-lg text-brand-gray hover:text-brand-ink transition-colors">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {capsOn && <p id="login-caps" role="status" className="text-xs text-amber-800 font-medium mt-1.5">Bloq Mayús está activado.</p>}
                  <div className="flex justify-end mt-1">
                    <button type="button" onClick={handleReset} disabled={resetLocked}
                      className="text-xs font-medium text-brand-ember hover:underline underline-offset-2 py-1.5 disabled:text-brand-gray disabled:no-underline disabled:cursor-not-allowed">
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                </div>

                <FormError key={error}>{error}</FormError>
                {info && (
                  <p role="status" className="text-emerald-700 text-xs bg-emerald-50 border border-emerald-200 rounded-lg py-2 px-3 animate-reveal">{info}</p>
                )}

                <button type="submit" disabled={loading || googleBusy}
                  className="w-full flex items-center justify-center gap-2 vidrio-naranja font-semibold h-11 rounded-xl transition">
                  {loading && <Spinner size="sm" tone="dark" />}
                  {loading ? 'Ingresando…' : 'Ingresar'}
                </button>
              </form>
            )}
          </div>
        </section>

        <footer className="text-center mt-6 space-y-1.5 text-xs text-white/60">
          <p>¿Problemas para entrar? Escribe a <SoporteLink oscuro /></p>
          <p>© {new Date().getFullYear()} Betrmedia SAS</p>
        </footer>
      </div>
    </main>
  );
};

export default LoginScreen;
