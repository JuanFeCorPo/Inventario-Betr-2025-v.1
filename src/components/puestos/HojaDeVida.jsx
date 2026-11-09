// Hoja de vida de un puesto (formato F-MAN-02), armada en vivo con el puesto,
// sus equipos del inventario y su historial. Nada se escribe dos veces.
// Los componentes se muestran como las casillas de la hoja (CPU, MONITOR, UPS…),
// con lo que salió tachado debajo, igual que en el Excel.

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ArrowLeft, Pencil, ClipboardPlus, Plus, Repeat2, LogOut as SalirIcon, Loader2, History,
  MoreHorizontal, MoveRight, MoreVertical, FileSpreadsheet, FileText, Wrench, CheckCircle2,
  Archive, ArchiveRestore, ArrowRightLeft,
} from 'lucide-react';
import { EmptyState, StatusDot, ToastHost } from '../ui';
import { CAMPOS_ESPECIFICACIONES } from '../../config/constants';
import { formatFecha } from '../../utils/format';
import { getMaintenanceInfo, proximoTrasRegistrar } from '../../utils/maintenance';
import {
  CASILLAS, TIPOS_EVENTO, equipoPrincipal, etiquetaEquipo, equiposPorCasilla, grupoDe, SIN_GRUPO, serialLimpio,
} from '../../utils/puestos';
import { retiradosDelPuesto, datosHojaPuesto } from '../../utils/hojaDeVida';
import { usePuestoHistorial } from '../../hooks/usePuestos';
import { usePopover } from '../../hooks/usePopover';
import useToast from '../../hooks/useToast';
import { iconoCasilla } from './casillaIcons';
import {
  PuestoFormModal, CasillaPickerModal, TrasladarModal, RetirarModal, EventoModal, EliminarPuestoModal, MantenimientoModal,
  ArchivarPuestoModal, PasarPuestoModal,
} from './PuestoModals';
import DescargarHoja from './DescargarHoja';
import useDescargasHoja from '../../hooks/useDescargasHoja';

const Card = ({ title, action, children, className = '' }) => (
  <section className={`bg-white border border-brand-border rounded-2xl shadow-card ${className}`}>
    <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-brand-border">
      <h2 className="text-xs font-semibold text-brand-slate uppercase tracking-wider">{title}</h2>
      {action}
    </header>
    {children}
  </section>
);

const Dato = ({ label, children, mono = false }) => (
  <div className="min-w-0">
    <dt className="text-xs text-brand-gray">{label}</dt>
    <dd className={`text-sm text-brand-ink mt-0.5 break-words ${mono ? 'font-mono' : ''}`}>{children || '—'}</dd>
  </div>
);

const TipoBadge = ({ tipo }) => {
  const t = TIPOS_EVENTO[tipo] ?? TIPOS_EVENTO.nota;
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${t.cls}`}>{t.label}</span>;
};

// Menú ⋯ de un equipo: Trasladar, Reemplazar, Retirar.
const AccionesEquipo = ({ equipo, onTrasladar, onReemplazar, onRetirar }) => {
  const { open, setOpen, ref, shown } = usePopover();
  const item = 'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left text-brand-ink hover:bg-brand-bg transition-colors';
  const elegir = (fn) => () => { setOpen(false); fn(equipo); };
  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        aria-label={`Acciones de ${equipo.nombre}`} title="Trasladar, reemplazar o retirar"
        className="w-8 h-8 flex items-center justify-center rounded-lg vidrio text-brand-slate hover:text-brand-ink transition">
        <MoreHorizontal size={16} />
      </button>
      {shown && (
        <div role="menu" className={`absolute right-0 top-9 z-30 w-48 bg-white border border-brand-border rounded-xl shadow-xl shadow-brand-ink/10 py-1 ${open ? 'animate-pop-in' : 'animate-pop-out'}`}>
          <button role="menuitem" type="button" className={item} onClick={elegir(onTrasladar)}><MoveRight size={14} className="text-brand-slate" /> Trasladar a otro puesto</button>
          <button role="menuitem" type="button" className={item} onClick={elegir(onReemplazar)}><Repeat2 size={14} className="text-brand-slate" /> Reemplazar</button>
          <button role="menuitem" type="button" className={`${item} text-rose-700`} onClick={elegir(onRetirar)}><SalirIcon size={14} /> Retirar del puesto</button>
        </div>
      )}
    </div>
  );
};

// Una casilla del puesto (columna de COMPONENTES en la hoja).
const Casilla = ({ casilla, equipos, sinCodigo, retirados, isAdmin, onAgregar, onTrasladar, onReemplazar, onRetirar }) => {
  const Icon = iconoCasilla(casilla.key, equipos);
  const vacia = equipos.length === 0 && sinCodigo.length === 0;
  // La casilla principal dice lo que tiene: CPU, Portátil o los dos
  const titulo = casilla.key !== 'principal' ? casilla.label
    : equipos.length === 0 ? 'CPU / Portátil'
      : [...new Set(equipos.map(e => (e.categoria === 'Laptops' ? 'Portátil' : 'CPU')))].join(' / ');
  const etiqueta = casilla.label.toLowerCase();
  return (
    <div className={`rounded-xl border p-3 flex flex-col min-w-0 ${vacia ? 'border-dashed border-brand-border bg-brand-bg/40' : 'border-brand-border bg-white'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={15} className={vacia ? 'text-brand-gray' : 'text-brand-ink'} aria-hidden="true" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-brand-slate flex-1 min-w-0 truncate">{titulo}</h3>
        {isAdmin && !vacia && (
          <button type="button" onClick={onAgregar} aria-label={`Agregar otro ${etiqueta}`} title={`Agregar otro ${etiqueta}`}
            className="w-7 h-7 -my-1 -mr-1 flex items-center justify-center rounded-lg vidrio text-brand-gray hover:text-brand-ink transition">
            <Plus size={14} />
          </button>
        )}
      </div>

      {vacia ? (
        isAdmin ? (
          <button type="button" onClick={onAgregar}
            className="mt-1 flex-1 min-h-[52px] flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-brand-ember hover:bg-brand-orange/10 transition">
            <Plus size={14} /> Agregar {etiqueta === 'cpu / portátil' ? 'CPU o portátil' : etiqueta}
          </button>
        ) : <p className="text-sm text-brand-gray py-2">Vacío</p>
      ) : (
        <ul className="space-y-2">
          {equipos.map(e => (
            <li key={e.id} className="flex items-start gap-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-brand-ink leading-snug break-words">{e.nombre}</p>
                <p className="text-xs text-brand-gray">
                  <span className="font-mono text-brand-slate whitespace-nowrap">{e.numeroInventario || 'Sin Nº'}</span>
                  {serialLimpio(e.numeroSerial) ? <> · <span className="whitespace-nowrap">SN</span> <span className="font-mono [overflow-wrap:anywhere]">{serialLimpio(e.numeroSerial)}</span></> : null}
                </p>
                {e.cargador && casilla.key !== 'principal' && (
                  <p className="text-xs text-brand-gray">Cargador <span className="font-mono text-brand-slate whitespace-nowrap">{e.cargador}</span></p>
                )}
                {e.estado !== 'En Uso' && <span className="mt-0.5 inline-block"><StatusDot status={e.estado} /></span>}
              </div>
              {isAdmin && <AccionesEquipo equipo={e} onTrasladar={onTrasladar} onReemplazar={onReemplazar} onRetirar={onRetirar} />}
            </li>
          ))}
          {sinCodigo.map((t, i) => (
            <li key={`t${i}`} title="Sin Nº de inventario (viene de Observaciones)" className="text-xs text-brand-slate break-words leading-snug pl-2 border-l-2 border-brand-border">{t}</li>
          ))}
        </ul>
      )}

      {retirados.length > 0 && (
        <p className="mt-2 pt-2 border-t border-brand-border text-xs text-brand-gray break-words" title={retirados.map(r => `${r.codigo} ${r.nombre}`).join('\n')}>
          <span className="sr-only">Salieron: </span>
          {retirados.slice(0, 3).map((r, i) => (
            <span key={r.codigo}>{i > 0 && ', '}<s className="text-rose-700/80 decoration-rose-700/60">{r.codigo}</s></span>
          ))}
          {retirados.length > 3 && ` +${retirados.length - 3}`}
        </p>
      )}
    </div>
  );
};

// Menú ⋮ del encabezado en celular (Excel, PDF, Editar).
// Pasar a otro puesto y Archivar (en escritorio; en celular van dentro del menú ⋮)
const MenuMas = ({ onPasar, onArchivar }) => {
  const { open, setOpen, ref, shown } = usePopover();
  const item = 'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left text-brand-ink hover:bg-brand-bg transition-colors';
  return (
    <div ref={ref} className="relative hidden sm:block">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Más acciones del puesto" title="Más acciones"
        className="w-10 h-10 flex items-center justify-center vidrio rounded-xl text-brand-slate hover:text-brand-ink transition">
        <MoreHorizontal size={16} />
      </button>
      {shown && (
        <div role="menu" className={`absolute right-0 top-12 z-30 w-60 bg-white border border-brand-border rounded-xl shadow-xl shadow-brand-ink/10 py-1 ${open ? 'animate-pop-in' : 'animate-pop-out'}`}>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); onPasar(); }}><ArrowRightLeft size={15} className="text-brand-slate" /> Pasar a otro puesto</button>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); onArchivar(); }}><Archive size={15} className="text-brand-slate" /> Archivar puesto</button>
        </div>
      )}
    </div>
  );
};

const MenuHoja = ({ crearDatos, onEditar, isAdmin, onPasar, onArchivar }) => {
  const { open, setOpen, ref, shown } = usePopover();
  const { excel, pdf, aviso } = useDescargasHoja(crearDatos);
  const item = 'w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left text-brand-ink hover:bg-brand-bg transition-colors';
  return (
    <div ref={ref} className="relative sm:hidden">
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Más acciones"
        className="w-10 h-10 flex items-center justify-center vidrio rounded-xl text-brand-slate">
        <MoreVertical size={16} />
      </button>
      {shown && (
        <div role="menu" className={`absolute right-0 top-12 z-30 w-52 bg-white border border-brand-border rounded-xl shadow-xl shadow-brand-ink/10 py-1 ${open ? 'animate-pop-in' : 'animate-pop-out'}`}>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); excel(); }}><FileSpreadsheet size={15} className="text-brand-slate" /> Descargar Excel</button>
          <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); pdf(); }}><FileText size={15} className="text-brand-slate" /> Descargar PDF</button>
          {isAdmin && <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); onEditar(); }}><Pencil size={15} className="text-brand-slate" /> Editar puesto</button>}
          {isAdmin && <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); onPasar(); }}><ArrowRightLeft size={15} className="text-brand-slate" /> Pasar a otro puesto</button>}
          {isAdmin && <button role="menuitem" type="button" className={item} onClick={() => { setOpen(false); onArchivar(); }}><Archive size={15} className="text-brand-slate" /> Archivar puesto</button>}
        </div>
      )}
      {aviso && <p role="alert" className="absolute right-0 top-12 w-60 text-xs text-rose-700 bg-white border border-rose-200 rounded-lg p-2 shadow-card">{aviso}</p>}
    </div>
  );
};

// Las líneas "Audífonos: …" / "Accesorios: …" de Observaciones son componentes sin Nº de inventario.
const LINEA_COMPONENTE = /^(Aud[ií]fonos|Accesorios|Celular|Mouse|Teclado|Monitor|Ups)\s*:\s*(.+)$/i;
const CASILLA_DE_LINEA = { audifonos: 'audifonos', 'audífonos': 'audifonos', accesorios: 'accesorios', celular: 'celular', mouse: 'mouse', teclado: 'teclado', monitor: 'monitor', ups: 'ups' };

// Notas automáticas que no aportan en pantalla (siguen guardadas)
const ES_NOTA_DEL_SISTEMA = /^Puesto importado de la hoja de vida en Excel.$/;

// ── Franja de mantenimiento preventivo ──
// Arriba de Componentes: si un CPU o portátil del puesto está vencido (o vence
// esta semana) lo dice en grande con el botón para registrarlo; si todo está
// al día, una línea discreta. Revisa todos los equipos, no solo el primero.
const plural = (n, s) => `${n} ${s}${n === 1 ? '' : 's'}`;
const tituloMant = (d) => (d < 0 ? `Mantenimiento vencido hace ${plural(-d, 'día')}`
  : d === 0 ? 'El mantenimiento vence hoy' : `El mantenimiento vence en ${plural(d, 'día')}`);
const tipoCorto = (e) => (e.categoria === 'Laptops' ? 'Portátil' : 'CPU');

const FranjaMantenimiento = ({ equipos, isAdmin, onRegistrar }) => {
  const lista = equipos
    .map(e => ({ e, info: getMaintenanceInfo(e) }))
    .filter(x => x.info)
    .sort((a, b) => a.info.diasRestantes - b.info.diasRestantes);
  if (!lista.length) return null;
  const urgentes = lista.filter(x => x.info.diasRestantes <= 7);

  if (!urgentes.length) {
    const { e, info } = lista[0];
    return (
      <div className="flex items-center gap-3 bg-white border border-brand-border rounded-2xl shadow-card px-4 py-3">
        <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-sm text-brand-slate">
          <span className="font-semibold text-brand-ink">Mantenimiento al día</span>
          <span className="text-brand-gray"> · próximo {formatFecha(info.proximaFecha)} · {tipoCorto(e)} <span className="font-mono">{e.numeroInventario}</span></span>
        </p>
        {isAdmin && (
          <button type="button" onClick={() => onRegistrar(e, info)}
            className="hidden sm:flex items-center gap-1.5 vidrio text-brand-slate hover:text-brand-ink text-sm px-3 h-9 rounded-xl transition flex-shrink-0">
            <Wrench size={14} aria-hidden="true" /> Registrar
          </button>
        )}
      </div>
    );
  }

  const vencido = urgentes.some(x => x.info.diasRestantes < 0);
  const tono = vencido
    ? { caja: 'bg-rose-50 border-rose-200', icono: 'bg-rose-600 text-white', titulo: 'text-rose-800', linea: 'divide-rose-200' }
    : { caja: 'bg-amber-50 border-amber-200', icono: 'bg-amber-400 text-brand-ink', titulo: 'text-amber-900', linea: 'divide-amber-200' };
  return (
    <section aria-label="Mantenimiento preventivo" className={`border rounded-2xl ${tono.caja}`}>
      <ul className={`divide-y ${tono.linea}`}>
        {urgentes.map(({ e, info }) => (
          <li key={e.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3.5 gap-y-3 px-4 py-3.5">
            <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${tono.icono}`} aria-hidden="true">
              <Wrench size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${tono.titulo}`}>{tituloMant(info.diasRestantes)}</p>
              <p className="text-xs text-brand-slate mt-0.5">
                {tipoCorto(e)} <span className="font-mono">{e.numeroInventario}</span>
                {' · '}{e.ultimoMantenimiento ? `último ${formatFecha(info.ultimaFecha)}` : 'sin mantenimientos registrados'}
                {' · '}cada {info.frecuenciaMeses} {info.frecuenciaMeses === 1 ? 'mes' : 'meses'}
              </p>
            </div>
            {isAdmin && (
              <button type="button" onClick={() => onRegistrar(e, info)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 vidrio-naranja text-sm font-semibold px-4 h-10 rounded-xl transition flex-shrink-0">
                <Wrench size={15} aria-hidden="true" /> Registrar mantenimiento
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

// `onArchivado(puesto, mensaje, deshacer, mensajeAlDeshacer)`: la hoja se archivó y deja de ser
// un puesto de la lista; la pantalla vuelve a la lista con un aviso que permite Deshacer.
const HojaDeVida = ({ db, puesto, equipos, items, puestos, isAdmin, actions, onBack, onEliminado, onArchivado }) => {
  const { historial, loading: loadingHist } = usePuestoHistorial(db, puesto.id);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();
  const principal = equipoPrincipal(equipos);
  const mant = principal ? getMaintenanceInfo(principal) : null;
  const grupo = grupoDe(puesto);
  const tituloRef = useRef(null);
  // Un puesto archivado se ve y se descarga, pero no se edita: solo "Volver a usar"
  const archivado = !!puesto.archivado;
  const puedeEditar = isAdmin && !archivado;

  const [editOpen, setEditOpen] = useState(false);
  const [archivarOpen, setArchivarOpen] = useState(false);
  const [pasarOpen, setPasarOpen] = useState(false);
  const [reactivando, setReactivando] = useState(false);
  const [eventoOpen, setEventoOpen] = useState(false);
  const [mantenimiento, setMantenimiento] = useState(null); // { equipo, info }
  const [picker, setPicker] = useState({ open: false, casilla: null, viejo: null });
  const [traslado, setTraslado] = useState(null);
  const [retirar, setRetirar] = useState(null);
  const [eliminarOpen, setEliminarOpen] = useState(false);

  // Al abrir una hoja: arriba del todo y el foco en su título (lectores de pantalla)
  useEffect(() => { window.scrollTo(0, 0); tituloRef.current?.focus({ preventScroll: true }); }, [puesto.id]);

  const porCasilla = useMemo(() => equiposPorCasilla(equipos), [equipos]);
  const retirados = useMemo(() => retiradosDelPuesto(historial, items, equipos), [historial, items, equipos]);
  const { sinCodigo, notas } = useMemo(() => {
    const sc = Object.fromEntries(CASILLAS.map(c => [c.key, []]));
    const resto = [];
    for (const linea of String(puesto.observaciones ?? '').split('\n')) {
      const m = linea.trim().match(LINEA_COMPONENTE);
      if (m) sc[CASILLA_DE_LINEA[m[1].toLowerCase()] ?? 'accesorios'].push(m[2].trim());
      else if (linea.trim()) resto.push(linea.trim());
    }
    return { sinCodigo: sc, notas: resto.join('\n') };
  }, [puesto.observaciones]);

  // Historial agrupado por año (más reciente arriba)
  const porAnio = useMemo(() => {
    const m = new Map();
    for (const h of historial) {
      if (ES_NOTA_DEL_SISTEMA.test(h.descripcion ?? '')) continue;
      const y = h.fecha?.toDate?.().getFullYear() ?? 'Sin fecha';
      (m.get(y) ?? m.set(y, []).get(y)).push(h);
    }
    return [...m];
  }, [historial]);

  const specs = useMemo(
    () => (principal ? CAMPOS_ESPECIFICACIONES.filter(({ key }) => key !== 'marca' && key !== 'modelo' && principal[key]) : []),
    [principal],
  );

  const crearDatos = () => datosHojaPuesto({ puesto, equipos, principal, historial, items });
  // Aviso con Deshacer para cambios de componentes
  const conDeshacer = (msg, deshacer) => showToast(msg, {
    ms: 8000,
    action: deshacer && { label: 'Deshacer', onClick: async () => { try { await deshacer(); showToast('Cambio deshecho'); } catch { showToast('No se pudo deshacer. Revisa tu conexión.'); } } },
  });

  const handleSave = async (data) => { await actions.savePuesto(data, equipos); setEditOpen(false); showToast('Puesto guardado'); };
  const handleEvento = async (ev) => { await actions.registrarEvento(puesto, ev, principal); setEventoOpen(false); showToast('Guardado en la hoja de vida'); };
  const handleMantenimiento = async (ev) => {
    const { equipo } = mantenimiento;
    await actions.registrarEvento(puesto, ev, equipo);
    setMantenimiento(null);
    showToast(`Mantenimiento registrado · próximo ${formatFecha(proximoTrasRegistrar(equipo, ev.fecha))}`);
  };
  const handlePick = async (equipo, opts, origen) => {
    let deshacer;
    if (picker.viejo) {
      deshacer = await actions.reemplazarEquipo(puesto, picker.viejo, equipo, opts, origen);
      conDeshacer(`${equipo.nombre} reemplaza a ${picker.viejo.nombre}`, deshacer);
    } else {
      deshacer = await actions.asignarEquipo(puesto, equipo, origen, picker.casilla);
      conDeshacer(`${equipo.nombre} agregado al puesto`, deshacer);
    }
    setPicker(p => ({ ...p, open: false }));
  };
  const handleTrasladar = async (destino, motivo) => {
    const eq = traslado;
    const deshacer = await actions.trasladarEquipo(puesto, destino, eq, motivo);
    setTraslado(null);
    conDeshacer(`${eq.nombre} trasladado a ${destino.nombre}`, deshacer);
  };
  const handleRetirar = async (opts) => {
    const eq = retirar;
    const deshacer = await actions.retirarEquipo(puesto, eq, opts);
    setRetirar(null);
    conDeshacer(`${eq.nombre} retirado`, deshacer);
  };

  const handleEliminar = async () => {
    const deshacer = await actions.eliminarPuesto(puesto, equipos);
    setEliminarOpen(false);
    onEliminado?.(puesto, deshacer);
  };

  const handleArchivar = async (motivo) => {
    const deshacer = await actions.archivarPuesto(puesto, equipos, motivo);
    setArchivarOpen(false);
    onArchivado?.(puesto, `Puesto "${puesto.nombre}" archivado`, deshacer, `"${puesto.nombre}" volvió a la lista`);
  };
  const handleReactivar = async () => {
    setReactivando(true);
    try {
      const deshacer = await actions.reactivarPuesto(puesto, equipos);
      conDeshacer(`"${puesto.nombre}" vuelve a la lista de puestos`, deshacer);
    } catch { showToast('No se pudo volver a usar el puesto. Revisa tu conexión.'); } finally { setReactivando(false); }
  };
  const handlePasar = async (destino, opciones) => {
    const deshacer = await actions.pasarAOtroPuesto(puesto, destino, opciones);
    setPasarOpen(false);
    if (opciones.archivar) onArchivado?.(puesto, `Pasó a "${destino.nombre}". "${puesto.nombre}" quedó en Archivados`, deshacer, `Todo volvió a "${puesto.nombre}"`);
    else conDeshacer(`Pasó a "${destino.nombre}"`, deshacer);
  };

  const vacio = equipos.length === 0;

  return (
    <div className="animate-content-in">
      {/* Encabezado */}
      <header className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
          <button onClick={onBack} aria-label="Volver a puestos" title="Volver a puestos"
            className="w-10 h-10 flex items-center justify-center vidrio rounded-xl transition text-brand-slate hover:text-brand-ink flex-shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <p className="text-xs text-brand-gray truncate">
              Hoja de vida · {puesto.area}{grupo.nombre !== SIN_GRUPO ? ` · ${grupo.nombre}` : ''}
            </p>
            <h1 ref={tituloRef} tabIndex={-1} className="text-xl font-bold text-brand-ink leading-tight outline-none break-words">{puesto.nombre}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-2">
            <DescargarHoja disabled={loadingHist} crearDatos={crearDatos} />
            {puedeEditar && (
              <button onClick={() => setEditOpen(true)}
                className="flex items-center gap-2 vidrio text-brand-slate text-sm px-3 h-10 rounded-xl transition">
                <Pencil size={14} /> Editar
              </button>
            )}
          </div>
          {puedeEditar && (
            <button onClick={() => setEventoOpen(true)} title="Registrar mantenimiento o novedad"
              className="flex items-center gap-2 vidrio-naranja text-sm font-semibold px-3 sm:px-4 h-10 rounded-xl transition">
              <ClipboardPlus size={15} /> Registrar
            </button>
          )}
          {isAdmin && archivado && (
            <button onClick={handleReactivar} disabled={reactivando}
              className="flex items-center gap-2 vidrio-naranja text-sm font-semibold px-3 sm:px-4 h-10 rounded-xl transition disabled:opacity-60">
              <ArchiveRestore size={15} aria-hidden="true" /> {reactivando ? 'Reactivando…' : 'Volver a usar'}
            </button>
          )}
          {puedeEditar && <MenuMas onPasar={() => setPasarOpen(true)} onArchivar={() => setArchivarOpen(true)} />}
          <MenuHoja crearDatos={crearDatos} onEditar={() => setEditOpen(true)} isAdmin={puedeEditar}
            onPasar={() => setPasarOpen(true)} onArchivar={() => setArchivarOpen(true)} />
        </div>
      </header>

      {archivado && (
        <section aria-label="Puesto archivado" className="flex items-center gap-3.5 mb-4 px-4 py-3.5 rounded-2xl bg-white border border-brand-border shadow-card">
          <span className="w-10 h-10 rounded-xl bg-brand-bg text-brand-slate flex items-center justify-center flex-shrink-0" aria-hidden="true"><Archive size={18} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-ink">
              Puesto archivado{puesto.archivadoAt?.toDate ? ` el ${formatFecha(puesto.archivadoAt.toDate())}` : ''}
            </p>
            <p className="text-xs text-brand-slate mt-0.5 break-words">
              {[puesto.archivadoMotivo, puesto.archivadoPersonas && `Última persona: ${puesto.archivadoPersonas}`].filter(Boolean).join(' · ')
                || 'Su hoja de vida sigue completa: puedes descargarla en Excel o PDF.'}
            </p>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_380px] gap-4 2xl:gap-5 items-start">
        <div className="space-y-4 2xl:space-y-5 min-w-0">
          <FranjaMantenimiento equipos={equipos} isAdmin={puedeEditar} onRegistrar={(equipo, info) => setMantenimiento({ equipo, info })} />

          {/* Componentes: las casillas del F-MAN-02 */}
          <Card title={`Componentes · ${equipos.length} equipo${equipos.length === 1 ? '' : 's'}`}>
            {vacio && (
              <p className="px-5 pt-4 text-sm text-brand-slate">
                {puedeEditar ? 'Puesto vacío: llena sus casillas con equipos del inventario.' : 'Este puesto todavía no tiene equipos.'}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 p-4">
              {CASILLAS.map(c => (
                <Casilla key={c.key} casilla={c} equipos={porCasilla[c.key]} sinCodigo={sinCodigo[c.key]}
                  retirados={retirados.filter(r => r.casilla === c.key)} isAdmin={puedeEditar}
                  onAgregar={() => setPicker({ open: true, casilla: c.key, viejo: null })}
                  onTrasladar={setTraslado}
                  onReemplazar={(e) => setPicker({ open: true, casilla: c.key, viejo: e })}
                  onRetirar={setRetirar} />
              ))}
            </div>
          </Card>

          {/* Historial y novedades, por año */}
          <Card title="Historial y novedades">
            {loadingHist ? (
              <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-brand-ember" /></div>
            ) : historial.length === 0 ? (
              <EmptyState icon={<History size={26} />} title="Sin registros todavía." />
            ) : (
              porAnio.map(([anio, filas]) => (
                <section key={anio} aria-label={`Registros de ${anio}`}>
                  <h3 className="sticky top-0 z-[1] bg-brand-bg/95 px-5 py-1.5 text-xs font-semibold text-brand-slate tabular-nums border-b border-brand-border">
                    {anio} <span className="font-normal text-brand-gray">· {filas.length}</span>
                  </h3>
                  <ol className="divide-y divide-brand-border">
                    {filas.map(h => (
                      <li key={h.id} className="grid grid-cols-[76px_1fr] sm:grid-cols-[84px_96px_1fr] 2xl:grid-cols-[90px_104px_minmax(0,1fr)_200px] gap-x-3 2xl:gap-x-4 gap-y-1 px-5 py-3 text-sm">
                        <span className="text-xs text-brand-gray tabular-nums pt-0.5">{formatFecha(h.fecha?.toDate?.())}</span>
                        <span><TipoBadge tipo={h.tipo} /></span>
                        <div className="col-span-2 sm:col-span-1 min-w-0">
                          <p className="text-brand-ink whitespace-pre-line break-words">{h.descripcion}</p>
                          {(h.reporta || h.responsable) && (
                            <p className="2xl:hidden text-xs text-brand-gray mt-0.5 break-words">{h.reporta ? `Reporta: ${h.reporta}` : h.responsable}</p>
                          )}
                        </div>
                        {/* En pantallas anchas, responsable en su propia columna (como en la hoja) */}
                        <span className="hidden 2xl:block text-xs text-brand-gray pt-0.5 break-words">{h.reporta ? `Reporta: ${h.reporta}` : h.responsable}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ))
            )}
          </Card>
        </div>

        <div className="space-y-4 2xl:space-y-5 min-w-0">
          {/* Identificación (del equipo principal) */}
          <Card title="Identificación del equipo">
            {principal ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5">
                <Dato label="Tipo de equipo">{principal.categoria === 'CPU' ? 'Computador de escritorio' : 'Computador portátil'}</Dato>
                <Dato label="Nº inventario" mono>{principal.numeroInventario}</Dato>
                {serialLimpio(principal.numeroSerial) && <Dato label="Serial" mono>{serialLimpio(principal.numeroSerial)}</Dato>}
                {principal.marca && <Dato label="Marca">{principal.marca}</Dato>}
                {principal.modelo && <Dato label="Modelo">{principal.modelo}</Dato>}
                {principal.categoria === 'Laptops' && principal.cargador && <Dato label="Cargador" mono>{principal.cargador}</Dato>}
                <Dato label="Próximo mantenimiento">
                  {mant ? (
                    <span className={mant.diasRestantes < 0 ? 'text-rose-700 font-semibold' : ''}>
                      {formatFecha(mant.proximaFecha)}{mant.diasRestantes < 0 ? ' (vencido)' : ''}
                    </span>
                  ) : '—'}
                </Dato>
              </dl>
            ) : (
              <p className="px-5 py-4 text-sm text-brand-gray">Sin CPU ni portátil: agrégalo en la casilla “CPU / Portátil”.</p>
            )}
          </Card>

          {/* Personas a cargo */}
          <Card title="Personas a cargo">
            {puesto.personas?.length ? (
              <ul className="px-5 py-3 space-y-2">
                {puesto.personas.map((p, i) => (
                  <li key={i} className="min-w-0">
                    <p className="text-sm text-brand-ink break-words">{p.nombre || p.correo}</p>
                    {p.nombre && p.correo && <p className="text-xs text-brand-gray break-all">{p.correo}</p>}
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 py-4 text-sm text-brand-gray">Nadie asignado.</p>}
          </Card>

          {/* Hardware */}
          {principal && (
            <Card title="Hardware del equipo">
              {specs.length ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5">
                  {specs.map(({ key, label }) => <Dato key={key} label={label}>{principal[key]}</Dato>)}
                </dl>
              ) : (
                <p className="px-5 py-4 text-sm text-brand-gray">Sin datos. Se completan en la ficha de {etiquetaEquipo(principal)} (Especificaciones técnicas).</p>
              )}
            </Card>
          )}

          {notas && (
            <Card title="Observaciones">
              <p className="px-5 py-4 text-sm text-brand-slate whitespace-pre-line">{notas}</p>
            </Card>
          )}
        </div>
      </div>

      <PuestoFormModal isOpen={editOpen} onClose={() => setEditOpen(false)} onSave={handleSave} puesto={puesto} puestos={puestos}
        onEliminar={() => { setEditOpen(false); setEliminarOpen(true); }} />
      <EliminarPuestoModal isOpen={eliminarOpen} onClose={() => setEliminarOpen(false)} puesto={puesto} equipos={equipos} onConfirm={handleEliminar}
        onArchivar={() => { setEliminarOpen(false); setArchivarOpen(true); }} />
      <ArchivarPuestoModal isOpen={archivarOpen} onClose={() => setArchivarOpen(false)} puesto={puesto} equipos={equipos} onConfirm={handleArchivar} />
      <PasarPuestoModal isOpen={pasarOpen} onClose={() => setPasarOpen(false)} origen={puesto} equipos={equipos} puestos={puestos} onConfirm={handlePasar} />
      <EventoModal isOpen={eventoOpen} onClose={() => setEventoOpen(false)} onConfirm={handleEvento} principal={principal} />
      <MantenimientoModal isOpen={!!mantenimiento} onClose={() => setMantenimiento(null)} onConfirm={handleMantenimiento}
        equipo={mantenimiento?.equipo} ubicacion={puesto.nombre} proximaFecha={mantenimiento?.info.proximaFecha} conPuesto />
      <CasillaPickerModal isOpen={picker.open} onClose={() => setPicker(p => ({ ...p, open: false }))}
        items={items} puestos={puestos} puesto={puesto} casilla={picker.casilla} viejo={picker.viejo} onConfirm={handlePick} />
      <TrasladarModal isOpen={!!traslado} onClose={() => setTraslado(null)} equipo={traslado} origen={puesto}
        puestos={puestos} items={items} onConfirm={handleTrasladar} />
      <RetirarModal isOpen={!!retirar} onClose={() => setRetirar(null)} equipo={retirar} onConfirm={handleRetirar} />
      <ToastHost toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default HojaDeVida;
