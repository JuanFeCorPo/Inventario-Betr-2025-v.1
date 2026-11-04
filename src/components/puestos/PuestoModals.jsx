import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, Search, ArrowRight, AlertTriangle, MoveRight, Users as UsersIcon } from 'lucide-react';
import { Modal, Button, Field, FormActions, Spinner, StatusDot } from '../ui';
import { fieldClass } from '../ui/fieldClasses';
import useAsyncAction from '../../hooks/useAsyncAction';
import { hoyLocal } from '../../utils/format';
import { CATEGORY_ICONS } from '../../config/categoryIcons';
import {
  AREAS, TIPOS_EVENTO, correoValido, etiquetaEquipo, etiquetaCasilla, casillaDe,
  candidatosParaCasilla, gruposDelArea, grupoDe, agruparPuestos, equiposDelPuesto, SIN_GRUPO,
} from '../../utils/puestos';

// Estados en los que puede quedar un equipo al salir de un puesto.
const ESTADOS_SALIDA = ['Disponible', 'En Mantenimiento', 'Fuera de Servicio'];
const OTRO_GRUPO = '__otro__';

const SaveButton = ({ busy, children, busyText = 'Guardando…', variant = 'primary', disabled = false }) => (
  <Button variant={variant} type="submit" disabled={busy || disabled} className="flex items-center gap-2">
    {busy && <Spinner size="sm" tone="dark" />}
    {busy ? busyText : children}
  </Button>
);

// Botones segmentados con flechas (radiogroup accesible): Área, tipo de registro, pestañas.
const Segmentado = ({ label, opciones, valor, onChange, className = '' }) => {
  const refs = useRef([]);
  const mover = (e, i) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + opciones.length) % opciones.length;
    onChange(opciones[j].value);
    refs.current[j]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={`grid gap-1 p-1 vidrio rounded-xl ${className}`} style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}>
      {opciones.map((o, i) => (
        <button key={o.value} ref={el => { refs.current[i] = el; }} type="button" role="radio" aria-checked={valor === o.value}
          tabIndex={valor === o.value ? 0 : -1} onClick={() => onChange(o.value)} onKeyDown={e => mover(e, i)}
          className={`h-9 rounded-lg text-sm font-medium transition truncate px-2 ${valor === o.value ? 'bg-white text-brand-ink shadow-card' : 'text-brand-slate hover:text-brand-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
};

// ── Crear / editar puesto ──────────────────────
// Nombre, área, equipo de trabajo (la carpeta de Drive) y personas. Al crear, la
// pantalla abre la hoja del puesto para llenar sus casillas.
export const PuestoFormModal = ({ isOpen, onClose, onSave, puesto, puestos = [], onEliminar }) => {
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const { busy, error, run, reset } = useAsyncAction();

  useEffect(() => {
    if (!isOpen) return;
    const g = puesto ? grupoDe(puesto) : null;
    setForm({
      nombre: puesto?.nombre ?? '',
      area: puesto?.area ?? AREAS[0],
      grupo: g && g.nombre !== SIN_GRUPO ? g.nombre : '',
      grupoNuevo: '',
      personas: puesto?.personas?.length ? puesto.personas : [{ nombre: '', correo: '' }],
      observaciones: puesto?.observaciones ?? '',
    });
    setErrors({});
    reset();
  }, [isOpen, puesto, reset]);

  const grupos = useMemo(() => (form ? gruposDelArea(puestos, form.area) : []), [puestos, form]);

  if (!form) return null;
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };
  const setPersona = (i, k, v) => set('personas', form.personas.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const escribiendoGrupo = form.grupo === OTRO_GRUPO;

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.nombre.trim()) next.nombre = 'Escribe el nombre del puesto.';
    if (escribiendoGrupo && !form.grupoNuevo.trim()) next.grupoNuevo = 'Escribe el nombre del equipo de trabajo.';
    if (form.personas.some(p => !correoValido(p.correo.trim()))) next.personas = 'Revisa los correos: falta el @ o el dominio.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const nombreGrupo = escribiendoGrupo ? form.grupoNuevo.trim() : form.grupo;
    const existente = grupos.find(g => g.nombre === nombreGrupo);
    const grupoOrden = existente?.orden ?? Math.max(0, ...grupos.map(g => (g.orden < 900 ? g.orden : 0))) + 1;
    run(() => onSave({
      id: puesto?.id, nombre: form.nombre, area: form.area, grupo: nombreGrupo, grupoOrden,
      personas: form.personas, observaciones: form.observaciones,
    }), 'No se pudo guardar el puesto. Revisa tu conexión e inténtalo de nuevo.');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={puesto ? 'Editar puesto' : 'Nuevo puesto'}>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Field label="Nombre del puesto" required error={errors.nombre} hint='Ej: "Optimización #7" o "Coor. Contable"'>
          <input value={form.nombre} onChange={e => set('nombre', e.target.value)} autoFocus
            aria-required="true" aria-invalid={!!errors.nombre} className={fieldClass} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="text-xs font-semibold text-brand-slate mb-1.5 block" id="area-label">Área</span>
            <Segmentado label="Área" valor={form.area} onChange={v => { set('area', v); set('grupo', ''); }}
              opciones={AREAS.map(a => ({ value: a, label: a }))} />
          </div>
          <Field label="Equipo de trabajo" error={errors.grupoNuevo} hint={escribiendoGrupo ? undefined : 'Como las carpetas de Drive: Optimización, Diseño…'}>
            {escribiendoGrupo ? (
              <div className="flex gap-2">
                <input value={form.grupoNuevo} onChange={e => set('grupoNuevo', e.target.value)} autoFocus placeholder="Nombre del equipo de trabajo"
                  aria-invalid={!!errors.grupoNuevo} className={fieldClass} />
                <Button type="button" variant="ghost" size="sm" onClick={() => set('grupo', '')}>Elegir</Button>
              </div>
            ) : (
              <select value={form.grupo} onChange={e => set('grupo', e.target.value)} className={fieldClass}>
                <option value="">Sin equipo de trabajo</option>
                {grupos.map(g => <option key={g.nombre} value={g.nombre}>{g.nombre}</option>)}
                <option value={OTRO_GRUPO}>+ Otro equipo de trabajo…</option>
              </select>
            )}
          </Field>
        </div>

        <fieldset>
          <legend className="text-xs font-semibold text-brand-slate mb-1.5">Personas a cargo</legend>
          <div className="space-y-2">
            {form.personas.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_auto] gap-2">
                <input value={p.nombre} onChange={e => setPersona(i, 'nombre', e.target.value)} placeholder="Nombre"
                  aria-label={`Nombre de la persona ${i + 1}`} className={fieldClass} />
                <input type="email" value={p.correo} onChange={e => setPersona(i, 'correo', e.target.value)} placeholder="Correo (opcional)"
                  aria-label={`Correo de la persona ${i + 1}`} className={`${fieldClass} col-span-1 row-start-2 sm:row-start-auto`} />
                <button type="button" onClick={() => set('personas', form.personas.filter((_, j) => j !== i))}
                  disabled={form.personas.length === 1} aria-label={`Quitar persona ${i + 1}`}
                  className="w-10 h-10 self-center flex items-center justify-center rounded-xl text-brand-gray hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-30">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          {errors.personas && <span role="alert" className="text-xs text-rose-700 mt-1.5 block">{errors.personas}</span>}
          <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
            <Button type="button" variant="ghost" size="sm" className="flex items-center gap-1.5"
              onClick={() => set('personas', [...form.personas, { nombre: '', correo: '' }])}>
              <Plus size={13} /> Agregar persona
            </Button>
            <p className="text-xs text-brand-gray">Con el correo, la persona verá su puesto al entrar con Google.</p>
          </div>
        </fieldset>

        <Field label="Observaciones" hint="Lo que el puesto tiene sin Nº de inventario. Ej: Audífonos: SN 2448… - Smith">
          <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)}
            className={`${fieldClass} h-16 resize-none`} />
        </Field>

        <FormActions error={error}>
          {puesto && onEliminar && (
            <Button variant="dangerGhost" type="button" onClick={onEliminar} disabled={busy} className="mr-auto flex items-center gap-1.5">
              <Trash2 size={14} aria-hidden="true" /> Eliminar puesto
            </Button>
          )}
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</Button>
          <SaveButton busy={busy}>{puesto ? 'Guardar cambios' : 'Crear y armar el puesto'}</SaveButton>
        </FormActions>
      </form>
    </Modal>
  );
};

// Fila de un equipo candidato (selector de casilla).
const Candidato = ({ e, donde, onPick }) => {
  const Icon = CATEGORY_ICONS[e.categoria] ?? CATEGORY_ICONS.Otros;
  return (
    <li>
      <button type="button" onClick={() => onPick(e)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-brand-bg focus-visible:bg-brand-bg transition-colors">
        <Icon size={15} className="text-brand-gray flex-shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-brand-ink truncate">{e.nombre}</span>
          <span className="block text-xs text-brand-gray truncate">
            <span className="font-mono text-brand-slate">{e.numeroInventario || 'Sin Nº'}</span>{donde ? ` · ${donde}` : ''}
          </span>
        </span>
        <StatusDot status={e.estado} />
      </button>
    </li>
  );
};

// ── Agregar o reemplazar el equipo de una casilla ──
// Muestra primero los equipos disponibles de ese tipo (sin escribir nada).
// Traer uno que está en otro puesto avisa qué casilla queda vacía allá.
export const CasillaPickerModal = ({ isOpen, onClose, items, puestos, puesto, casilla, viejo, onConfirm }) => {
  const reemplazo = !!viejo;
  const [term, setTerm] = useState('');
  const [pestana, setPestana] = useState('disponibles');
  const [todos, setTodos] = useState(false);
  const [elegido, setElegido] = useState(null);
  const [estado, setEstado] = useState('Disponible');
  const [motivo, setMotivo] = useState('');
  const { busy, error, run, reset } = useAsyncAction();
  const ultimo = useRef({ casilla, viejo });
  if (isOpen) ultimo.current = { casilla, viejo };
  const cas = ultimo.current.casilla;

  useEffect(() => {
    if (isOpen) { setTerm(''); setPestana('disponibles'); setTodos(false); setElegido(null); setEstado('Disponible'); setMotivo(''); reset(); }
  }, [isOpen, reset]);

  const { disponibles, enUso } = useMemo(
    () => candidatosParaCasilla(items, { casilla: cas, puestoId: puesto?.id, term, todos }),
    [items, cas, puesto, term, todos],
  );
  const puestoDe = (e) => puestos.find(p => p.id === e?.puestoId) ?? null;
  const origen = puestoDe(elegido);
  // ¿La casilla del puesto de origen queda vacía?
  const dejaVacio = origen && equiposDelPuesto(items, origen.id).filter(x => casillaDe(x) === casillaDe(elegido)).length === 1;
  const lista = pestana === 'disponibles' ? disponibles : enUso;
  const nombreCasilla = etiquetaCasilla(cas).toLowerCase();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!elegido) return;
    run(() => onConfirm(elegido, { estado, motivo }, origen),
      'No se pudo guardar el cambio. Revisa tu conexión e inténtalo de nuevo.');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title={reemplazo ? `Reemplazar ${nombreCasilla}` : `Agregar ${nombreCasilla} a ${puesto?.nombre ?? 'el puesto'}`}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {reemplazo && (
          <p className="text-sm text-brand-slate">
            Sale: <span className="font-semibold text-brand-ink">{etiquetaEquipo(ultimo.current.viejo)}</span>
          </p>
        )}

        {!elegido ? (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray pointer-events-none" aria-hidden="true" />
              <input value={term} onChange={e => setTerm(e.target.value)} autoFocus placeholder="Filtrar por Nº, serial o nombre"
                aria-label="Filtrar equipos" className={`${fieldClass} pl-9`} />
            </div>
            <Segmentado label="Origen del equipo" valor={pestana} onChange={setPestana}
              opciones={[
                { value: 'disponibles', label: `Disponibles (${disponibles.length})` },
                { value: 'enUso', label: `En uso (${enUso.length})` },
              ]} />
            <p className="sr-only" aria-live="polite">{lista.length} equipos</p>
            <ul className="border border-brand-border rounded-xl divide-y divide-brand-border max-h-72 overflow-y-auto">
              {lista.length === 0 && (
                <li className="text-sm text-brand-gray text-center py-6 px-4">
                  {pestana === 'disponibles'
                    ? <>No hay {nombreCasilla === 'cpu / portátil' ? 'CPU ni portátiles' : `${nombreCasilla}s`} disponibles{term ? ' con ese dato' : ''}. Mira en “En uso”.</>
                    : 'Ningún equipo en uso coincide.'}
                </li>
              )}
              {lista.map(e => {
                const en = puestoDe(e);
                return <Candidato key={e.id} e={e} onPick={setElegido} donde={en ? `en ${en.nombre}` : e.estado === 'Disponible' ? '' : e.personaEncargada} />;
              })}
            </ul>
            <label className="flex items-center gap-2 text-xs text-brand-slate cursor-pointer w-fit">
              <input type="checkbox" checked={todos} onChange={e => setTodos(e.target.checked)} className="w-4 h-4 rounded border-brand-border" />
              Mostrar equipos de otros tipos (si alguno está mal clasificado)
            </label>
          </>
        ) : (
          <div className="space-y-4 animate-reveal">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-bg">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-brand-ink truncate">{elegido.nombre}</p>
                <p className="text-xs text-brand-gray"><span className="font-mono text-brand-slate">{elegido.numeroInventario}</span> · {elegido.estado}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setElegido(null)}>Cambiar</Button>
            </div>
            {origen && (
              <p className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Sale de “{origen.nombre}”{dejaVacio ? <>: su casilla <b>{etiquetaCasilla(casillaDe(elegido))}</b> queda vacía</> : ''}. Queda registrado en las dos hojas.
                </span>
              </p>
            )}
            {reemplazo && (
              <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4">
                <Field label="El que sale queda">
                  <select value={estado} onChange={e => setEstado(e.target.value)} className={fieldClass}>
                    {ESTADOS_SALIDA.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Motivo">
                  <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: teclas pegadas" className={fieldClass} />
                </Field>
              </div>
            )}
          </div>
        )}

        <FormActions error={error}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={busy || !elegido} className="flex items-center gap-2">
            {busy ? <Spinner size="sm" tone="dark" /> : reemplazo && <ArrowRight size={14} aria-hidden="true" />}
            {busy ? 'Guardando…' : reemplazo ? 'Reemplazar' : 'Agregar al puesto'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
};

// ── Trasladar un equipo a otro puesto (se inicia desde el origen) ──
export const TrasladarModal = ({ isOpen, onClose, equipo, origen, puestos, items, onConfirm }) => {
  const [term, setTerm] = useState('');
  const [destino, setDestino] = useState(null);
  const [motivo, setMotivo] = useState('');
  const { busy, error, run, reset } = useAsyncAction();
  const ultimo = useRef({ equipo, origen });
  if (isOpen && equipo) ultimo.current = { equipo, origen };
  const eq = ultimo.current.equipo;
  const or = ultimo.current.origen;

  useEffect(() => { if (isOpen) { setTerm(''); setDestino(null); setMotivo(''); reset(); } }, [isOpen, reset]);

  const plano = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const grupos = useMemo(() => {
    const q = plano(term).trim();
    const candidatos = puestos.filter(p => p.id !== or?.id)
      .filter(p => !q || plano(p.nombre).includes(q) || (p.personas ?? []).some(x => plano(x.nombre).includes(q)) || plano(grupoDe(p).nombre).includes(q));
    return agruparPuestos(candidatos).flatMap(a => a.grupos.map(g => ({ ...g, area: a.area })));
  }, [puestos, or, term]);

  if (!eq) return null;
  const cas = casillaDe(eq);
  const yaHay = destino ? equiposDelPuesto(items, destino.id).filter(x => casillaDe(x) === cas) : [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!destino) return;
    run(() => onConfirm(destino, motivo), 'No se pudo trasladar el equipo. Revisa tu conexión e inténtalo de nuevo.');
  };

  const Tarjeta = ({ titulo, puesto: p, tono }) => (
    <div className={`min-w-0 flex-1 rounded-xl border p-3 ${tono}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-gray">{titulo}</p>
      <p className="text-sm font-semibold text-brand-ink truncate mt-0.5">{p?.nombre ?? 'Elige un puesto'}</p>
      {p && <p className="text-xs text-brand-gray truncate">{grupoDe(p).nombre}</p>}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Trasladar equipo">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-brand-bg">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-ink truncate">{eq.nombre}</p>
            <p className="text-xs text-brand-gray"><span className="font-mono text-brand-slate">{eq.numeroInventario}</span> · {etiquetaCasilla(cas)}</p>
          </div>
        </div>

        <div className="flex items-stretch gap-2">
          <Tarjeta titulo="Sale de" puesto={or} tono="border-brand-border bg-white" />
          <MoveRight size={18} className="self-center text-brand-gray flex-shrink-0" aria-hidden="true" />
          <Tarjeta titulo="Llega a" puesto={destino} tono={destino ? 'border-brand-orange/50 bg-brand-orange/5' : 'border-dashed border-brand-border bg-white'} />
        </div>

        {!destino ? (
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray pointer-events-none" aria-hidden="true" />
              <input value={term} onChange={e => setTerm(e.target.value)} autoFocus placeholder="Buscar puesto, persona o equipo de trabajo"
                aria-label="Buscar puesto de destino" className={`${fieldClass} pl-9`} />
            </div>
            <div className="border border-brand-border rounded-xl max-h-72 overflow-y-auto">
              {grupos.length === 0 && <p className="text-sm text-brand-gray text-center py-6">Ningún puesto coincide.</p>}
              {grupos.map(g => (
                <div key={`${g.area}-${g.nombre}`}>
                  <p className="sticky top-0 bg-brand-bg/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-slate">{g.nombre} <span className="font-normal normal-case tracking-normal text-brand-gray">· {g.area}</span></p>
                  <ul>
                    {g.puestos.map(p => (
                      <li key={p.id}>
                        <button type="button" onClick={() => setDestino(p)}
                          className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-brand-bg focus-visible:bg-brand-bg transition-colors">
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-brand-ink truncate">{p.nombre}</span>
                            <span className="block text-xs text-brand-gray truncate flex items-center gap-1">
                              <UsersIcon size={11} aria-hidden="true" />{(p.personas ?? []).map(x => x.nombre).join(', ') || 'Sin persona asignada'}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-4 animate-reveal">
            {yaHay.length > 0 && (
              <p className="text-xs text-brand-slate bg-brand-bg rounded-lg px-3 py-2">
                En “{destino.nombre}” ya hay {yaHay.length === 1 ? 'un' : yaHay.length} {etiquetaCasilla(cas).toLowerCase()}: {yaHay.map(x => x.numeroInventario || x.nombre).join(', ')}. Quedan los dos.
              </p>
            )}
            <div className="flex items-end gap-3 flex-wrap">
              <Field label="Motivo (opcional)" className="flex-1 min-w-[200px]">
                <input value={motivo} onChange={e => setMotivo(e.target.value)} autoFocus placeholder="Ej: cambio de turno, ingreso de personal" className={fieldClass} />
              </Field>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDestino(null)} className="mb-1">Cambiar destino</Button>
            </div>
          </div>
        )}

        <FormActions error={error}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="primary" type="submit" disabled={busy || !destino} className="flex items-center gap-2">
            {busy ? <Spinner size="sm" tone="dark" /> : <MoveRight size={14} aria-hidden="true" />}
            {busy ? 'Trasladando…' : 'Trasladar'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
};

// ── Eliminar un puesto ─────────────────────────
// Dice qué pasa con sus equipos antes de confirmar. Se puede deshacer justo después.
export const EliminarPuestoModal = ({ isOpen, onClose, puesto, equipos = [], onConfirm }) => {
  const { busy, error, run, reset } = useAsyncAction();
  const ultimo = useRef({ puesto, equipos });
  if (isOpen && puesto) ultimo.current = { puesto, equipos };
  const { puesto: p, equipos: eqs } = ultimo.current;
  useEffect(() => { if (isOpen) reset(); }, [isOpen, reset]);
  if (!p) return null;
  const enUso = eqs.filter(e => e.estado === 'En Uso').length;
  const handleSubmit = (e) => {
    e.preventDefault();
    run(() => onConfirm(), 'No se pudo eliminar el puesto. Revisa tu conexión e inténtalo de nuevo.');
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Eliminar puesto" size="sm">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <p className="text-sm text-brand-ink">Se elimina <span className="font-semibold">“{p.nombre}”</span>.</p>
        <ul className="text-sm text-brand-slate space-y-1.5 list-disc pl-5">
          {eqs.length > 0 ? (
            <li>
              Sus {eqs.length} equipo{eqs.length === 1 ? '' : 's'} quedan sin puesto, con Encargado “Betrmedia”
              {enUso > 0 ? <>; {enUso === eqs.length ? 'todos pasan' : `${enUso} pasan`} de En Uso a <b>Disponible</b></> : ''}.
            </li>
          ) : <li>El puesto no tiene equipos.</li>}
          <li>Su hoja de vida deja de verse en la lista.</li>
        </ul>
        <p className="text-xs text-brand-gray">Justo después podrás deshacerlo desde el aviso.</p>
        <FormActions error={error}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="danger" type="submit" disabled={busy} className="flex items-center gap-2">
            {busy ? <Spinner size="sm" tone="light" /> : <Trash2 size={14} aria-hidden="true" />}
            {busy ? 'Eliminando…' : 'Eliminar puesto'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
};

// ── Retirar un componente sin reemplazo ─────────
export const RetirarModal = ({ isOpen, onClose, equipo, onConfirm }) => {
  const [estado, setEstado] = useState('Disponible');
  const [motivo, setMotivo] = useState('');
  const { busy, error, run, reset } = useAsyncAction();
  const [ultimo, setUltimo] = useState(equipo);
  useEffect(() => { if (equipo) setUltimo(equipo); }, [equipo]);
  useEffect(() => { if (isOpen) { setEstado('Disponible'); setMotivo(''); reset(); } }, [isOpen, reset]);

  const handleSubmit = (e) => {
    e.preventDefault();
    run(() => onConfirm({ estado, motivo }), 'No se pudo retirar el equipo. Revisa tu conexión e inténtalo de nuevo.');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Retirar del puesto" size="sm">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <p className="text-sm text-brand-slate">Sale: <span className="font-semibold text-brand-ink">{etiquetaEquipo(ultimo)}</span></p>
        <Field label="Queda en el inventario como">
          <select value={estado} onChange={e => setEstado(e.target.value)} autoFocus className={fieldClass}>
            {ESTADOS_SALIDA.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Motivo">
          <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej: ya no se usa en el puesto" className={fieldClass} />
        </Field>
        <FormActions error={error}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</Button>
          <SaveButton busy={busy} variant="warning">Retirar</SaveButton>
        </FormActions>
      </form>
    </Modal>
  );
};

// ── Mantenimiento o novedad (lo mismo que el formato F-MAN) ──
// `aviso` reemplaza el texto que explica a dónde va el registro (lo usa la hoja de un equipo suelto).
const TIPOS_REGISTRO = ['preventivo', 'correctivo', 'novedad'];
export const EventoModal = ({ isOpen, onClose, onConfirm, tipoInicial = 'preventivo', principal, aviso }) => {
  const [tipo, setTipo] = useState(tipoInicial);
  const [fecha, setFecha] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [reporta, setReporta] = useState('');
  const [errors, setErrors] = useState({});
  const { busy, error, run, reset } = useAsyncAction();

  useEffect(() => {
    if (isOpen) { setTipo(tipoInicial); setFecha(hoyLocal()); setDescripcion(''); setReporta(''); setErrors({}); reset(); }
  }, [isOpen, tipoInicial, reset]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!fecha) next.fecha = 'Elige la fecha.';
    else if (fecha > hoyLocal()) next.fecha = 'La fecha no puede ser futura.';
    if (!descripcion.trim()) next.descripcion = 'Describe qué se hizo o qué pasó.';
    setErrors(next);
    if (Object.keys(next).length) return;
    run(() => onConfirm({ tipo, fecha, descripcion, reporta }), 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.');
  };

  const placeholder = {
    preventivo: 'Ej: mantenimiento general, limpieza interna y cambio de pasta térmica',
    correctivo: 'Ej: cambio de disco duro por fallas constantes',
    novedad: 'Ej: solicita cambio de celular',
  }[tipo];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar mantenimiento o novedad" size="sm">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Segmentado label="Tipo de registro" valor={tipo} onChange={setTipo}
          opciones={TIPOS_REGISTRO.map(k => ({ value: k, label: TIPOS_EVENTO[k].label }))} />
        {aviso !== undefined ? (
          aviso && (tipo === 'preventivo' || tipo === 'correctivo') && <p className="text-xs text-brand-gray -mt-1">{aviso}</p>
        ) : (tipo === 'preventivo' || tipo === 'correctivo') && (
          <p className="text-xs text-brand-gray -mt-1">
            {principal
              ? <>Queda también en el historial de <span className="font-medium text-brand-slate">{etiquetaEquipo(principal)}</span>{tipo === 'preventivo' ? ' y actualiza su próximo mantenimiento.' : '.'}</>
              : 'El puesto no tiene CPU ni portátil: queda solo en la hoja de vida.'}
          </p>
        )}
        <Field label="Fecha" required error={errors.fecha}>
          <input type="date" value={fecha} max={hoyLocal()} onChange={e => { setFecha(e.target.value); setErrors(p => ({ ...p, fecha: '' })); }}
            aria-required="true" aria-invalid={!!errors.fecha} className={fieldClass} />
        </Field>
        <Field label={tipo === 'novedad' ? 'Novedad' : 'Descripción del mantenimiento'} required error={errors.descripcion}>
          <textarea value={descripcion} onChange={e => { setDescripcion(e.target.value); setErrors(p => ({ ...p, descripcion: '' })); }}
            placeholder={placeholder} autoFocus aria-required="true" aria-invalid={!!errors.descripcion}
            className={`${fieldClass} h-24 resize-none`} />
        </Field>
        {tipo === 'novedad' && (
          <Field label="Reporta">
            <input value={reporta} onChange={e => setReporta(e.target.value)} placeholder="Quién lo reportó" className={fieldClass} />
          </Field>
        )}
        <FormActions error={error}>
          <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>Cancelar</Button>
          <SaveButton busy={busy}>Guardar en la hoja de vida</SaveButton>
        </FormActions>
      </form>
    </Modal>
  );
};
