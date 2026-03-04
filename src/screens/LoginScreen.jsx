import React, { useState } from 'react';
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
      setError('Credenciales incorrectas o error de conexión.');
      setLoading(false);
    }
  };

  const inputClass = 'w-full bg-[#F0F2F4] border border-[#E8EAED] text-[#1C2B35] placeholder-[#8D8D8D] px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E68E00]/50 focus:border-[#E68E00]/40 transition-all text-sm';

  return (
    <div className="min-h-screen bg-[#F0F2F4] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#E68E00]/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#5E6A74]/8 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm animate-modal-in relative z-10">
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="Betrmedia"
            className="mx-auto h-16 w-auto object-contain mb-5"
            onError={e => { e.target.onerror = null; e.target.src = LOGO_FALLBACK; }}
          />
          <h1 className="text-2xl font-bold text-[#1C2B35] tracking-tight">Inventario Betrmedia</h1>
          <p className="text-[#8D8D8D] text-sm mt-1">Inicia sesión para continuar</p>
        </div>

        {/* Error de acceso denegado (viene de App.jsx) */}
        {accessError && (
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
            <ShieldX size={18} className="text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-rose-700 text-sm">{accessError}</p>
          </div>
        )}

        <div className="bg-white border border-[#E8EAED] rounded-2xl p-8 shadow-xl shadow-[#1C2B35]/5">
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
              className="w-full flex items-center justify-center gap-2 bg-[#E68E00] hover:bg-[#EDAA00] disabled:bg-[#8D8D8D] text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-[#E68E00]/30 mt-2">
              <LogIn size={16} />
              {loading ? 'Verificando…' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#8D8D8D] mt-10">
          Betrmedia SAS · Sistema de Inventario
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;