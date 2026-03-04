// ─────────────────────────────────────────────
//  src/screens/ConfigErrorScreen.jsx
// ─────────────────────────────────────────────

import React from 'react';
import { ServerCrash } from 'lucide-react';

const ConfigErrorScreen = () => (
  <div className="min-h-screen bg-[#080c12] flex flex-col justify-center items-center text-white p-8">
    <ServerCrash className="text-rose-500 mb-6" size={52} strokeWidth={1.5} />
    <h1 className="text-3xl font-bold mb-2 tracking-tight">Error de Configuración</h1>
    <p className="text-zinc-400 text-center max-w-md mb-10 text-sm">
      La API Key de Firebase es inválida o no se encontró. La aplicación no puede iniciarse.
    </p>
    <div className="bg-[#111827] border border-white/10 p-6 rounded-2xl w-full max-w-lg shadow-xl">
      <h2 className="text-base font-semibold mb-4 text-zinc-100">¿Cómo solucionarlo?</h2>
      <ol className="list-decimal list-inside text-zinc-400 space-y-2 text-sm">
        <li>Corrige el valor de <code className="text-orange-400 bg-white/5 px-1 rounded">VITE_FIREBASE_CONFIG</code> en tu archivo <code className="text-orange-400 bg-white/5 px-1 rounded">.env.local</code>.</li>
        <li>Asegúrate de copiar el objeto JSON completo y sin comillas faltantes.</li>
        <li>Si usas Vercel, haz <strong className="text-white">Redeploy</strong> después de guardar la variable.</li>
      </ol>
    </div>
  </div>
);

export default ConfigErrorScreen;
