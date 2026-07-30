import { Component } from 'react';
import { AlertOctagon } from 'lucide-react';

class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Error no controlado:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-[#080c12] flex flex-col justify-center items-center text-white p-8">
        <AlertOctagon className="text-rose-500 mb-6" size={52} strokeWidth={1.5} />
        <h1 className="text-3xl font-bold mb-2 tracking-tight">Algo salió mal</h1>
        <p className="text-zinc-400 text-center max-w-md mb-8 text-sm">
          Ocurrió un error inesperado en la aplicación. Intenta recargar la página; si el problema persiste, contacta al administrador.
        </p>
        <button onClick={() => window.location.reload()}
          className="bg-brand-orange hover:bg-brand-amber text-white font-semibold px-6 py-3 rounded-xl transition-all">
          Recargar página
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
