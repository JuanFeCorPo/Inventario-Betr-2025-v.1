import { useState } from 'react';
import { LogIn, ShieldX, Eye, EyeOff } from 'lucide-react';
import { LOGO_URL, LOGO_FALLBACK } from '../config/constants';

const LoginScreen = ({ onLogin, accessError }) => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch {
      // Mensaje siempre igual (correo inexistente, contraseña incorrecta,
      // cuenta bloqueada por intentos fallidos, etc.) para no revelar
      // por qué falló el intento.
      setError('Email o contraseña incorrectos.');
      setLoading(false);
    }
  };

  const inputClass = 'w-full bg-brand-bg border border-brand-border text-brand-ink placeholder-brand-gray px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/40 transition text-sm';

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-glow-login pointer-events-none" />

      <div className="w-full max-w-sm animate-modal-in relative z-10">
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="Betrmedia"
            className="mx-auto h-16 w-auto object-contain mb-5"
            onError={e => { e.target.onerror = null; e.target.src = LOGO_FALLBACK; }}
          />
          <h1 className="text-2xl font-bold text-brand-ink tracking-tight">Inventario Betr Media</h1>
          <p className="text-brand-gray text-sm mt-1">Inicia sesión para continuar</p>
        </div>

        {/* Error de acceso denegado (viene de App.jsx) */}
        {accessError && (
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 animate-reveal">
            <ShieldX size={18} className="text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-rose-700 text-sm">{accessError}</p>
          </div>
        )}

        <div className="bg-white border border-brand-border rounded-2xl p-8 shadow-xl shadow-brand-ink/5">
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Correo electrónico" className={inputClass} required />
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Contraseña" className={`${inputClass} pr-11`} required />
              <button type="button" onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray hover:text-brand-ink transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {error && (
              <p key={error} className="text-rose-600 text-xs text-center bg-rose-50 border border-rose-200 rounded-lg py-2 px-3 animate-reveal">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand-orange hover:bg-brand-amber disabled:bg-brand-gray text-white font-semibold py-3 rounded-xl transition shadow-lg hover:shadow-brand-orange/30 mt-2">
              <LogIn size={16} />
              {loading ? 'Verificando…' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-brand-gray mt-10">
          © 2026 Betrmedia SAS
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;