import { useState } from 'react';
import { LogIn, ShieldX } from 'lucide-react';
import { LOGO_URL, LOGO_FALLBACK } from '../config/constants';

const LoginScreen = ({ onLogin, accessError }) => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

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

  const inputClass = 'w-full bg-brand-bg border border-brand-border text-brand-ink placeholder-brand-gray px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/40 transition-all text-sm';

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-orange/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-brand-slate/8 rounded-full blur-[100px] pointer-events-none" />

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
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
            <ShieldX size={18} className="text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-rose-700 text-sm">{accessError}</p>
          </div>
        )}

        <div className="bg-white border border-brand-border rounded-2xl p-8 shadow-xl shadow-brand-ink/5">
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Correo electrónico" className={inputClass} required />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Contraseña" className={inputClass} required />

            {error && (
              <p className="text-rose-600 text-xs text-center bg-rose-50 border border-rose-200 rounded-lg py-2 px-3">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand-orange hover:bg-brand-amber disabled:bg-brand-gray text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-brand-orange/30 mt-2">
              <LogIn size={16} />
              {loading ? 'Verificando…' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-brand-gray mt-10">
          Betrmedia SAS · 2026 ©️
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;