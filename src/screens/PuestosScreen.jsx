// ─────────────────────────────────────────────
//  Puestos de trabajo: área → equipo de trabajo (como las carpetas de Drive)
//  → puesto, en filas compactas con la tira de casillas del F-MAN-02 para ver
//  de un vistazo qué tiene y qué le falta a cada uno. Abre la hoja de vida.
// ─────────────────────────────────────────────

import { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowLeft, Plus, Search, Loader2, Monitor, AlertTriangle, FileUp, ChevronRight, X } from 'lucide-react';
import { EmptyState, Button, ToastHost } from '../components/ui';
import { formatFecha } from '../utils/format';
import {
  CASILLAS, agruparPuestos, equiposDelPuesto, equiposPorCasilla, etiquetaCasilla, grupoDe, resumenPuesto,
} from '../utils/puestos';
import useInventory from '../hooks/useInventory';
import usePuestos from '../hooks/usePuestos';
import useToast from '../hooks/useToast';
import HojaDeVida from '../components/puestos/HojaDeVida';
import { PuestoFormModal } from '../components/puestos/PuestoModals';
import ImportarHojasModal from '../components/puestos/ImportarHojasModal';
import { iconoCasilla } from '../components/puestos/casillaIcons';
import { yaImportado } from '../utils/importarHojas';

const plano = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Tira de casillas: un ícono por casilla, lleno si tiene equipo, punteado si está vacía.
const TiraCasillas = ({ equipos }) => {
  const por = equiposPorCasilla(equipos);
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {CASILLAS.map(c => {
        const Icon = iconoCasilla(c.key, por[c.key]);
        const lleno = por[c.key].length > 0;
        return (
          <span key={c.key} title={lleno ? `${c.label}: ${por[c.key].map(e => e.numeroInventario || e.nombre).join(', ')}` : `Sin ${c.label.toLowerCase()}`}
            className={`w-6 h-6 flex items-center justify-center rounded-md ${lleno ? 'bg-brand-bg text-brand-ink' : 'border border-dashed border-brand-border text-brand-gray/50'}`}>
            <Icon size={13} />
          </span>
        );
      })}
    </span>
  );
};

const FilaPuesto = ({ puesto, equipos, onOpen }) => {
  const r = resumenPuesto(puesto, equipos);
  const personas = (puesto.personas ?? []).map(p => p.nombre || p.correo).join(', ');
  const estado = r.conFalla > 0
    ? { txt: `${r.conFalla} con falla`, cls: 'text-rose-700 font-semibold', icon: true }
    // Mismo orden que resumenPuesto (y que Inicio): falla > falta algo > mantenimiento vencido
    : r.faltan.length ? { txt: `Falta ${r.faltan.map(k => etiquetaCasilla(k).toLowerCase().replace('cpu / portátil', 'CPU')).join(', ')}`, cls: 'text-amber-800' }
      : r.vencido ? { txt: 'Mant. vencido', cls: 'text-rose-700 font-medium' }
        : r.mant ? { txt: `Mant. ${formatFecha(r.mant.proximaFecha)}`, cls: 'text-brand-gray' }
          : { txt: equipos.length ? `${equipos.length} equipos` : 'Puesto vacío', cls: 'text-brand-gray' };

  return (
    <li>
      <button type="button" onClick={onOpen} aria-label={`${puesto.nombre}. ${estado.txt}`}
        className="w-full text-left grid grid-cols-[1fr_auto] md:grid-cols-[minmax(0,1.6fr)_110px_auto_150px_16px] items-center gap-x-4 gap-y-1.5 px-4 py-3 hover:bg-brand-bg/70 focus-visible:bg-brand-bg/70 transition-colors">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-brand-ink truncate" title={puesto.nombre}>{puesto.nombre}</span>
          <span className="block text-xs text-brand-gray truncate">{personas || 'Sin persona asignada'}</span>
        </span>
        <span className="hidden md:block font-mono text-xs text-brand-slate truncate">{r.principal?.numeroInventario ?? '—'}</span>
        <span className="col-span-2 md:col-span-1 row-start-2 md:row-start-auto"><TiraCasillas equipos={equipos} /></span>
        <span className={`row-start-1 col-start-2 md:row-start-auto md:col-start-auto text-xs text-right md:text-left flex items-center justify-end md:justify-start gap-1 ${estado.cls}`}>
          {estado.icon && <AlertTriangle size={12} aria-hidden="true" />}<span className="truncate">{estado.txt}</span>
        </span>
        <ChevronRight size={16} className="hidden md:block text-brand-gray" aria-hidden="true" />
      </button>
    </li>
  );
};

const PuestosScreen = ({ db, user, onBack, puestoInicial = null }) => {
  const isAdmin = user.role === 'Administrador';
  const { items, loading: loadingItems } = useInventory(db, user);
  const { puestos, hayImportados, loading: loadingPuestos, ...actions } = usePuestos(db, user);
  // Desde Inicio se puede llegar directo a la hoja de vida de un puesto
  const [selectedId, setSelectedId] = useState(puestoInicial);
  const [term, setTerm] = useState('');
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [importarOpen, setImportarOpen] = useState(false);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();
  const scrollLista = useRef(0);
  const loading = loadingItems || loadingPuestos;
  // Importar las hojas de Excel es de una sola vez: el botón desaparece después.
  const puedeImportar = isAdmin && !loading && !hayImportados && !yaImportado(puestos);

  const equiposPorPuesto = useMemo(() => {
    const map = new Map();
    for (const p of puestos) map.set(p.id, equiposDelPuesto(items, p.id));
    return map;
  }, [items, puestos]);

  const pendientes = useMemo(
    () => new Set(puestos.filter(p => resumenPuesto(p, equiposPorPuesto.get(p.id) ?? []).pendiente).map(p => p.id)),
    [puestos, equiposPorPuesto],
  );

  const areas = useMemo(() => {
    const q = plano(term).trim();
    const lista = puestos.filter(p => (!soloPendientes || pendientes.has(p.id)) && (!q
      || plano(p.nombre).includes(q)
      || plano(grupoDe(p).nombre).includes(q)
      || (p.personas ?? []).some(x => plano(x.nombre).includes(q) || plano(x.correo).includes(q))
      || (equiposPorPuesto.get(p.id) ?? []).some(e => plano(e.numeroInventario).includes(q) || plano(e.numeroSerial).includes(q))));
    return agruparPuestos(lista);
  }, [puestos, term, soloPendientes, pendientes, equiposPorPuesto]);
  const hayResultados = areas.length > 0;

  const selected = puestos.find(p => p.id === selectedId);

  const abrir = (id) => { scrollLista.current = window.scrollY; setSelectedId(id); };
  const volver = () => setSelectedId(null);
  // Al volver de una hoja, la lista queda donde estaba
  useEffect(() => { if (!selectedId) requestAnimationFrame(() => window.scrollTo(0, scrollLista.current)); }, [selectedId]);

  const handleCrear = async (data) => {
    const id = await actions.savePuesto(data);
    setNuevoOpen(false);
    showToast(`Puesto "${data.nombre.trim()}" creado: llena sus casillas`);
    abrir(id);
  };

  // Eliminar desde la hoja: vuelve a la lista con aviso y Deshacer
  const handleEliminado = (puesto, deshacer) => {
    setSelectedId(null);
    showToast(`Puesto "${puesto.nombre}" eliminado`, {
      ms: 10000,
      action: { label: 'Deshacer', onClick: async () => {
        try { await deshacer(); showToast(`"${puesto.nombre}" volvió con sus equipos`); }
        catch { showToast('No se pudo deshacer. Revisa tu conexión.'); }
      } },
    });
  };

  const handleImportado = (resumen) => {
    setImportarOpen(false);
    if (resumen) showToast(`Hojas de vida importadas: ${resumen.puestos} puestos`);
  };

  return (
    <div className="min-h-screen bg-brand-bg font-sans">
      <div className="fixed inset-0 bg-glow pointer-events-none" />
      {/* En pantallas grandes se usa el ancho: lista en dos columnas y hoja más amplia */}
      <main className="relative z-10 max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {selected ? (
          <HojaDeVida key={selected.id} db={db} puesto={selected} equipos={equiposPorPuesto.get(selected.id) ?? []}
            items={items} puestos={puestos} isAdmin={isAdmin} actions={actions} onBack={volver} onEliminado={handleEliminado} />
        ) : (
          <>
            <header className="flex items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                {onBack && <button onClick={onBack} aria-label="Volver al inventario" title="Volver al inventario"
                  className="w-10 h-10 flex items-center justify-center vidrio rounded-xl transition text-brand-slate hover:text-brand-ink flex-shrink-0">
                  <ArrowLeft size={18} />
                </button>}
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-brand-ink">Puestos de trabajo</h1>
                  <p className="text-xs text-brand-gray mt-0.5 truncate">
                    {loading ? 'Cargando…' : `${puestos.length} puestos · la hoja de vida de cada uno, al día con el inventario`}
                  </p>
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {puedeImportar && (
                    <button onClick={() => setImportarOpen(true)} aria-label="Importar hojas de vida" title="Importar hojas de vida"
                      className="flex items-center gap-2 vidrio text-brand-slate hover:text-brand-ink text-sm font-medium px-3 h-10 rounded-xl transition">
                      <FileUp size={15} /> <span className="hidden sm:inline">Importar hojas de vida</span>
                    </button>
                  )}
                  <button onClick={() => setNuevoOpen(true)} aria-label="Nuevo puesto"
                    className="flex items-center gap-2 vidrio-naranja text-sm font-semibold px-3 sm:px-4 h-10 rounded-xl transition">
                    <Plus size={15} /> <span className="hidden sm:inline">Nuevo puesto</span>
                  </button>
                </div>
              )}
            </header>

            {loading ? (
              <div className="flex flex-col items-center gap-3 py-16 text-brand-gray">
                <Loader2 size={24} className="animate-spin text-brand-ember" />
                <span className="text-sm">Cargando puestos…</span>
              </div>
            ) : puestos.length === 0 ? (
              <div className="bg-white border border-brand-border rounded-2xl shadow-card">
                <EmptyState icon={<Monitor size={30} />} title="Aún no hay puestos registrados."
                  action={isAdmin && (puedeImportar
                    ? <Button size="sm" onClick={() => setImportarOpen(true)}>Importar hojas de vida</Button>
                    : <Button size="sm" onClick={() => setNuevoOpen(true)}>Crear el primero</Button>)} />
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
                  <div className="relative flex-1 sm:max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray pointer-events-none" aria-hidden="true" />
                    <input value={term} onChange={e => setTerm(e.target.value)} placeholder="Buscar puesto, persona o Nº"
                      aria-label="Buscar puesto, persona, equipo de trabajo o Nº de inventario"
                      className="w-full bg-white border border-brand-border text-brand-ink placeholder-brand-gray pl-9 pr-9 h-10 rounded-xl text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#B86E00] transition shadow-sm" />
                    {term && (
                      <button type="button" onClick={() => setTerm('')} aria-label="Limpiar búsqueda"
                        className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-brand-gray hover:text-brand-ink">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div role="radiogroup" aria-label="Mostrar" className="flex gap-1 p-1 vidrio rounded-xl w-fit">
                    {[[false, `Todos · ${puestos.length}`], [true, `Con pendientes · ${pendientes.size}`]].map(([v, label]) => (
                      <button key={label} type="button" role="radio" aria-checked={soloPendientes === v} onClick={() => setSoloPendientes(v)}
                        className={`h-8 px-3 rounded-lg text-sm font-medium transition whitespace-nowrap ${soloPendientes === v ? 'bg-brand-ink text-white' : 'text-brand-slate hover:text-brand-ink'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {!hayResultados && (
                  <div className="bg-white border border-brand-border rounded-2xl">
                    <EmptyState icon={<Search size={26} />} title={soloPendientes && !term ? 'Ningún puesto tiene pendientes.' : 'Ningún puesto coincide.'}
                      action={<Button variant="secondary" size="sm" onClick={() => { setTerm(''); setSoloPendientes(false); }}>Ver todos</Button>} />
                  </div>
                )}

                {areas.map(({ area, grupos }) => (
                  <section key={area} className="mb-8" aria-labelledby={`area-${area}`}>
                    <h2 id={`area-${area}`} className="text-xs font-semibold text-brand-slate uppercase tracking-wider mb-3">
                      {area} <span className="text-brand-gray font-normal normal-case tracking-normal">· {grupos.reduce((s, g) => s + g.puestos.length, 0)} puestos</span>
                    </h2>
                    <div className="2xl:columns-2 2xl:gap-4">
                      {grupos.map(g => {
                        const pend = g.puestos.filter(p => pendientes.has(p.id)).length;
                        return (
                          <section key={g.nombre} aria-label={g.nombre} className="bg-white border border-brand-border rounded-2xl shadow-card overflow-clip mb-3 2xl:mb-4 break-inside-avoid">
                            <header className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-brand-border bg-brand-bg/50">
                              <h3 className="text-sm font-semibold text-brand-ink truncate">{g.nombre}</h3>
                              <span className="text-xs text-brand-gray whitespace-nowrap tabular-nums">
                                {g.puestos.length} puesto{g.puestos.length === 1 ? '' : 's'}
                                {pend > 0 && <span className="text-amber-800"> · {pend} con pendientes</span>}
                              </span>
                            </header>
                            <ul className="divide-y divide-brand-border">
                              {g.puestos.map(p => (
                                <FilaPuesto key={p.id} puesto={p} equipos={equiposPorPuesto.get(p.id) ?? []} onOpen={() => abrir(p.id)} />
                              ))}
                            </ul>
                          </section>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </>
            )}
          </>
        )}
      </main>

      <PuestoFormModal isOpen={nuevoOpen} onClose={() => setNuevoOpen(false)} onSave={handleCrear} puesto={null} puestos={puestos} />
      {isAdmin && (
        <ImportarHojasModal isOpen={importarOpen} onClose={handleImportado} items={items} onImportar={actions.importarHojas} />
      )}
      <ToastHost toast={toast} onDismiss={dismissToast} />
    </div>
  );
};

export default PuestosScreen;
