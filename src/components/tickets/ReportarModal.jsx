// Reportar un problema (colaborador): ¿qué pasa? → ¿con qué equipo? → cuéntanos.
// `equipoInicial`: si se abre tocando un equipo de "Mi puesto", ya viene elegido.
import { useState, useEffect, useRef } from 'react';
import { Monitor, Wifi, AppWindow, KeyRound, Printer, HelpCircle } from 'lucide-react';
import { Modal, Button, Field, FormActions, Spinner } from '../ui';
import { fieldClass } from '../ui/fieldClasses';
import useAsyncAction from '../../hooks/useAsyncAction';
import useAdjuntos from '../../hooks/useAdjuntos';
import { SelectorAdjuntos } from './AdjuntosUI';
import { CATEGORIAS_TICKET, URGENCIAS, validarTicket } from '../../utils/tickets';
import { CASILLAS, casillaDe } from '../../utils/puestos';
import { iconoCasilla } from '../puestos/casillaIcons';

const ICONOS = { equipo: Monitor, internet: Wifi, software: AppWindow, cuentas: KeyRound, impresora: Printer, otro: HelpCircle };

const ReportarModal = ({ isOpen, onClose, puestos = [], equipos = {}, onEnviar, equipoInicial = null }) => {
  const [categoria, setCategoria] = useState('');
  const [equipoId, setEquipoId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [urgencia, setUrgencia] = useState('normal');
  const [errores, setErrores] = useState({});
  const { busy, error, run, reset } = useAsyncAction();
  const adj = useAdjuntos();
  const limpiarAdj = adj.limpiar;
  const listaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCategoria(equipoInicial ? 'equipo' : ''); setEquipoId(equipoInicial ?? '');
      setDescripcion(''); setUrgencia('normal'); setErrores({}); reset(); limpiarAdj();
    }
  }, [isOpen, equipoInicial, reset, limpiarAdj]);

  // Si vino con el equipo elegido, la lista baja hasta él (puede estar al final)
  useEffect(() => {
    if (!isOpen || !equipoInicial) return undefined;
    const id = setTimeout(() => listaRef.current?.querySelector('[aria-checked="true"]')?.scrollIntoView({ block: 'nearest' }), 60);
    return () => clearTimeout(id);
  }, [isOpen, equipoInicial]);

  const misEquipos = puestos.flatMap(p => (equipos[p.id] ?? []).map(e => ({ ...e, puesto: p })))
    .sort((a, b) => CASILLAS.findIndex(c => c.key === casillaDe(a)) - CASILLAS.findIndex(c => c.key === casillaDe(b)));
  const sinPuesto = puestos.length === 0;
  const elegido = misEquipos.find(e => e.id === equipoId);

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validarTicket({ categoria, equipoId, descripcion });
    setErrores(err);
    if (Object.keys(err).length) return;
    run(() => onEnviar({ categoria, puesto: elegido?.puesto ?? puestos[0] ?? null, equipo: elegido ?? null, descripcion, urgencia, archivos: adj.archivos }),
      'No se pudo enviar el ticket. Revisa tu conexión e inténtalo de nuevo.');
  };

  const placeholder = {
    equipo: 'Ej: el mouse se congela y a veces no responde.',
    internet: 'Ej: desde esta mañana no carga ninguna página.',
    software: 'Ej: Photoshop se cierra cuando abro archivos grandes.',
    cuentas: 'Ej: no puedo entrar a mi correo, dice contraseña incorrecta.',
    impresora: 'Ej: la impresora de la oficina no imprime.',
    otro: 'Cuéntanos qué pasa.',
  }[categoria] ?? 'Cuéntanos qué pasa.';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reportar un problema">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <fieldset>
          <legend className="text-xs font-semibold text-brand-slate mb-2">¿Con qué es el problema?</legend>
          <div role="radiogroup" aria-label="Tipo de problema" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(CATEGORIAS_TICKET).filter(([k]) => k !== 'equipo' || !sinPuesto).map(([k, c]) => {
              const Icon = ICONOS[k];
              const activo = categoria === k;
              return (
                <button key={k} type="button" role="radio" aria-checked={activo}
                  onClick={() => { setCategoria(k); setErrores(p => ({ ...p, categoria: '' })); if (k !== 'equipo') setEquipoId(''); }}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left text-sm font-medium transition ${activo ? 'border-brand-ink bg-brand-ink text-white' : 'vidrio text-brand-ink'}`}>
                  <Icon size={17} className={activo ? 'text-white' : 'text-brand-slate'} aria-hidden="true" />
                  <span className="leading-tight">{c.label}</span>
                </button>
              );
            })}
          </div>
          {errores.categoria && <p role="alert" className="text-xs text-rose-700 mt-1.5">{errores.categoria}</p>}
        </fieldset>

        {categoria === 'equipo' && (
          <fieldset className="animate-reveal">
            <legend className="text-xs font-semibold text-brand-slate mb-2">¿Cuál equipo?</legend>
            <ul ref={listaRef} role="radiogroup" aria-label="Equipo" className="border border-brand-border rounded-xl divide-y divide-brand-border max-h-60 overflow-y-auto">
              {misEquipos.map(e => {
                const Icon = iconoCasilla(casillaDe(e), [e]);
                const activo = equipoId === e.id;
                return (
                  <li key={e.id}>
                    <button type="button" role="radio" aria-checked={activo} onClick={() => { setEquipoId(e.id); setErrores(p => ({ ...p, equipoId: '' })); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${activo ? 'bg-brand-orange/10' : 'hover:bg-brand-bg'}`}>
                      <Icon size={16} className="text-brand-slate flex-shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-brand-ink truncate">{e.nombre}</span>
                        <span className="block text-xs text-brand-gray font-mono">{e.numeroInventario}</span>
                      </span>
                      <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${activo ? 'border-brand-ember bg-brand-orange' : 'border-brand-border'}`} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {errores.equipoId && <p role="alert" className="text-xs text-rose-700 mt-1.5">{errores.equipoId}</p>}
            <p className="text-xs text-brand-gray mt-1.5">El número de inventario está en el sticker del equipo.</p>
          </fieldset>
        )}

        {categoria && (
          <div className="space-y-4 animate-reveal">
            <Field label="Cuéntanos qué pasa" required error={errores.descripcion}>
              <textarea value={descripcion} onChange={e => { setDescripcion(e.target.value); setErrores(p => ({ ...p, descripcion: '' })); }}
                placeholder={placeholder} autoFocus maxLength={2000} aria-invalid={!!errores.descripcion}
                className={`${fieldClass} h-28 resize-none`} />
            </Field>
            <SelectorAdjuntos adj={adj} disabled={busy} />
            <fieldset>
              <legend className="text-xs font-semibold text-brand-slate mb-1.5">¿Puedes seguir trabajando?</legend>
              <div role="radiogroup" aria-label="Urgencia" className="grid grid-cols-2 gap-1 p-1 vidrio rounded-xl">
                {Object.entries(URGENCIAS).map(([k, u]) => (
                  <button key={k} type="button" role="radio" aria-checked={urgencia === k} onClick={() => setUrgencia(k)}
                    className={`h-9 rounded-lg text-sm font-medium transition ${urgencia === k ? (k === 'bloquea' ? 'bg-rose-600 text-white shadow-card' : 'bg-white text-brand-ink shadow-card') : 'text-brand-slate hover:text-brand-ink'}`}>
                    {k === 'normal' ? 'Sí, puedo' : u.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        <FormActions error={error}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="submit" disabled={busy || !categoria || adj.procesando} className="flex items-center gap-2">
            {busy && <Spinner size="sm" tone="dark" />}
            {busy ? 'Enviando…' : 'Enviar a T.I.'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
};

export default ReportarModal;
