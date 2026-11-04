import { useState, useMemo, useRef, useEffect } from 'react';
import { StatusDot, Initials, NewBadge, Dropdown, Spinner, EmptyState, Button, ToastHost, Skeleton } from '../components/ui';
import useToast from '../hooks/useToast';
import {
  PlusCircle, ChevronRight, ChevronDown, X, Wrench, Search, Menu,
  Package, ArrowLeft, ArrowUp, ArrowDown, ChevronsUpDown,
  Coffee, Cable, HardDrive, Mic, MemoryStick, Keyboard,
} from 'lucide-react';
import ItemFormModal from '../components/modals/ItemFormModal';
import ImportModal   from '../components/modals/ImportModal';
import PreviewModal  from '../components/modals/PreviewModal';
import ReportModal   from '../components/modals/ReportModal';
import { DeactivateModal, DeleteConfirmModal } from '../components/modals/OtherModals';
import useInventory   from '../hooks/useInventory';
import useEncargados  from '../hooks/useEncargados';
import { STATUS_DOT } from '../config/constants';
import { exportInventory, normalize } from '../utils/excel';
import EquipmentAgeChart from '../components/EquipmentAgeChart';
import HoyBand from '../components/inicio/HoyBand';
import CategoryMosaic from '../components/CategoryMosaic';
import DataActions from '../components/DataActions';
import { CATEGORY_ICONS } from '../config/categoryIcons';

// La categoría es muy genérica ("Otros", "Electrodomésticos") para elegir un
// ícono representativo — antes de caer en el de categoría, se intenta
// reconocer el equipo puntual por palabras clave en su nombre.
const ITEM_ICON_RULES = [
  { test: /destornillador|desarmador|kit de herramientas|\bherramienta/, icon: Wrench },
  { test: /cafetera/,                                                    icon: Coffee },
  { test: /extension|regleta|multitoma/,                                 icon: Cable },
  { test: /disco duro|disco externo|\bhdd\b|\bssd\b/,                    icon: HardDrive },
  { test: /micro ?sd|tarjeta de memoria|memoria.*sd/,                    icon: MemoryStick },
  { test: /microfono/,                                                   icon: Mic },
  { test: /teclado/,                                                     icon: Keyboard },
];

const CategoryIcon = ({ categoria, nombre, ...props }) => {
  const normNombre = normalize(nombre);
  const rule = ITEM_ICON_RULES.find(({ test }) => test.test(normNombre));
  const Icon = rule?.icon ?? CATEGORY_ICONS[categoria] ?? Package;
  return <Icon {...props} />;
};

// ── Columnas ordenables de la tabla ──────────
const TABLE_COLUMNS = [
  { key: 'nombre',           label: 'Nombre' },
  { key: 'estado',           label: 'Estado', center: true },
  { key: 'numeroInventario', label: 'Nº Inv' },
  { key: 'categoria',        label: 'Categoría' },
  { key: 'personaEncargada', label: 'Encargado', responsive: 'hidden lg:table-cell' },
];


const STATUS_FILTERS = ['Activos', 'Disponible', 'En Uso', 'En Mantenimiento', 'Fuera de Servicio', 'De Baja', 'Todos'];

// ── Fila de tabla (desktop) ──────────────────
const EquipoRow = ({ item, onAction }) => (
  <tr className="border-b border-brand-border hover:bg-brand-bg/60 active:bg-brand-bg transition-colors cursor-pointer"
    tabIndex={0}
    onClick={() => onAction('preview', item)}
    onKeyDown={(e) => { if (e.key === 'Enter') onAction('preview', item); }}>
    <td className="px-4 py-3 font-semibold text-brand-ink text-sm min-w-[160px]">
      <div className="flex items-center gap-2">
        <CategoryIcon categoria={item.categoria} nombre={item.nombre} size={15} className="text-brand-gray flex-shrink-0" />
        <span className="truncate">{item.nombre}</span>
      </div>
    </td>
    <td className="px-4 py-3 text-center">
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <StatusDot status={item.estado} />
        {item.condicion === 'Nuevo' && <NewBadge />}
      </div>
    </td>
    <td className="px-4 py-3 text-brand-slate text-sm font-mono whitespace-nowrap">{item.numeroInventario}</td>
    <td className="px-4 py-3 text-brand-slate text-sm whitespace-nowrap">{item.categoria}</td>
    <td className="hidden lg:table-cell px-4 py-3 max-w-[220px]">
      <Initials name={item.personaEncargada} />
    </td>
  </tr>
);

// ── Tarjeta móvil ─────────────────────────────
const EquipoCard = ({ item, onAction }) => (
  <button onClick={() => onAction('preview', item)}
    className="w-full flex items-center justify-between px-4 py-3.5 text-left bg-white border border-brand-border rounded-xl shadow-sm hover:bg-brand-bg/50 transition-colors">
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex flex-col items-start gap-1 flex-shrink-0">
        <StatusDot status={item.estado} />
        {item.condicion === 'Nuevo' && <NewBadge />}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <CategoryIcon categoria={item.categoria} nombre={item.nombre} size={13} className="text-brand-gray flex-shrink-0" />
          <p className="font-semibold text-brand-ink text-sm truncate">{item.nombre}</p>
        </div>
        <p className="inline-block text-xs font-mono font-semibold text-brand-slate bg-brand-bg px-1.5 py-0.5 rounded mt-1">
          {item.numeroInventario}
        </p>
      </div>
    </div>
    <ChevronRight size={16} className="text-brand-gray flex-shrink-0" />
  </button>
);

// ── Línea de estado del inventario ───────────
// Una sola línea en vez de 6 tarjetas: cada cifra filtra (tocar la activa vuelve a "Activos").
// Sus puntos de color son la leyenda del mosaico. "De Baja" queda en el filtro Estado.
const ESTADOS_LINEA = [
  { key: 'Activos',           label: 'activos',           stat: 'total' },
  { key: 'Disponible',        label: 'disponibles',       stat: 'disponibles' },
  { key: 'En Uso',            label: 'en uso',            stat: 'enUso' },
  { key: 'En Mantenimiento',  label: 'en mantenimiento',  stat: 'enMantenimiento' },
  { key: 'Fuera de Servicio', label: 'fuera de servicio', stat: 'fueraServicio' },
];
const LineaEstado = ({ stats, activo, onToggle, loading }) => (
  <div role="radiogroup" aria-label="Filtrar por estado" className="flex flex-wrap items-center gap-1">
    {ESTADOS_LINEA.map(({ key, label, stat }) => {
      const sel = activo === key;
      const alerta = key === 'Fuera de Servicio' && stats[stat] > 0;
      return (
        <button key={key} type="button" role="radio" aria-checked={sel} onClick={() => onToggle(key)}
          className={`flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-sm transition-colors ${sel ? 'bg-brand-ink text-white' : 'vidrio text-brand-slate hover:text-brand-ink'}`}>
          {key !== 'Activos' && <span className={`w-2 h-2 rounded-full ${STATUS_DOT[key]}`} aria-hidden="true" />}
          {loading ? <Skeleton className="w-6 h-4 rounded" /> : (
            <span className={`font-semibold tabular-nums ${sel ? '' : alerta ? 'text-rose-700' : 'text-brand-ink'}`}>{stats[stat]}</span>
          )}
          <span className={sel ? 'text-white/85' : ''}>{label}</span>
        </button>
      );
    })}
  </div>
);

// ── Dashboard principal ──────────────────────
const InventoryDashboard = ({ user, db, onNavigate, filtro, filtroNonce }) => {
  const isAdmin = user.role === 'Administrador';
  const { items, loading, saveItem, deactivateItem, deleteItem, restoreItem, importItems, addNote, registrarEvento } = useInventory(db, user);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();
  const searchRef = useRef(null);
  const inventarioRef = useRef(null);
  const { encargados, addEncargado } = useEncargados(db);
  const [modal,          setModal]          = useState({ type: null, data: null });
  const [showImport,     setShowImport]     = useState(false);
  const [showReport,     setShowReport]     = useState(false);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [filterCategory, setFilterCategory] = useState('Todos');
  const [filterStatus,   setFilterStatus]   = useState('Activos');
  const [mobileFilters,  setMobileFilters]  = useState(false);
  const [showAllList,    setShowAllList]    = useState(false);
  const [sortConfig,     setSortConfig]     = useState({ key: 'nombre', direction: 'asc' });

  const toggleSort = (key) => setSortConfig(prev =>
    prev.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' }
  );

  // Tocar otra vez la tarjeta activa quita el filtro y vuelve a "Activos"
  const toggleStatus = (estado) => setFilterStatus(prev => (prev === estado && estado !== 'Activos' ? 'Activos' : estado));

  const openModal  = (type, data = null) => setModal({ type, data });
  const closeModal = () => setModal({ type: null, data: null });
  // Si venías de editar desde el detalle, vuelve ahí en vez de mandarte a la
  // lista completa — con muchos equipos, tener que rebuscarlo era tedioso.
  const handleSave = async (data, motivoEstado) => {
    const wasEdit = modal.type === 'edit';
    await saveItem(data, motivoEstado);
    wasEdit ? openModal('preview', data) : closeModal();
    showToast(wasEdit ? 'Cambios guardados' : 'Equipo añadido');
  };
  const handleDeactivate = async (reason, fecha) => {
    await deactivateItem(modal.data.id, reason, fecha);
    closeModal();
    showToast('Equipo dado de baja');
  };
  const handleDelete = async () => {
    const nombre = modal.data.nombre;
    const backup = await deleteItem(modal.data.id);
    closeModal();
    // Sin respaldo = el equipo ya no existía (otro usuario lo eliminó antes): no hay nada que deshacer
    if (!backup) { showToast(`${nombre} ya no estaba en el inventario`); return; }
    showToast(`${nombre} eliminado`, {
      ms: 8000,
      action: {
        label: 'Deshacer',
        onClick: async () => {
          try { await restoreItem(backup); showToast(`${nombre} restaurado`); }
          catch { showToast('No se pudo restaurar. Revisa tu conexión e inténtalo de nuevo.'); }
        },
      },
    });
  };

  // El modal guarda una foto del equipo al abrirse; esto la refresca con
  // los datos en vivo de Firestore para que, ej., una nota nueva se vea
  // de inmediato en la trazabilidad sin tener que cerrar y reabrir.
  const liveModalData = useMemo(
    () => (modal.data ? items.find(i => i.id === modal.data.id) ?? modal.data : null),
    [items, modal.data],
  );

  const stats = useMemo(() => {
    const activos = items.filter(i => i.estado !== 'De Baja');
    return {
      total: activos.length,
      disponibles: activos.filter(i => i.estado === 'Disponible').length,
      enUso: activos.filter(i => i.estado === 'En Uso').length,
      enMantenimiento: activos.filter(i => i.estado === 'En Mantenimiento').length,
      fueraServicio: activos.filter(i => i.estado === 'Fuera de Servicio').length,
      deBaja: items.filter(i => i.estado === 'De Baja').length,
    };
  }, [items]);

  // Un aviso de la campana ("3 portátiles fuera de servicio") llega con un filtro: se aplica y se baja al inventario
  useEffect(() => {
    if (!filtro) return;
    setFilterCategory(filtro.categoria ?? 'Todos');
    setFilterStatus(filtro.estado ?? 'Activos');
    setSearchTerm('');
    setShowAllList(filtro.categoria === 'Todos');
    requestAnimationFrame(() => inventarioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [filtro, filtroNonce]);

  const categorias = useMemo(() => ['Todos', ...new Set(items.map(i => i.categoria))], [items]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return items.filter(item => {
      const catOk    = filterCategory === 'Todos' || item.categoria === filterCategory;
      const statusOk = filterStatus === 'Todos' ? true : filterStatus === 'Activos' ? item.estado !== 'De Baja' : item.estado === filterStatus;
      const searchOk = !term || [item.nombre, item.numeroSerial, item.numeroInventario, item.personaEncargada, item.cargador].some(f => f?.toLowerCase().includes(term));
      return catOk && statusOk && searchOk;
    }).sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      const va  = (a[sortConfig.key] ?? '').toString();
      const vb  = (b[sortConfig.key] ?? '').toString();
      return va.localeCompare(vb) * dir;
    });
  }, [items, filterCategory, filterStatus, searchTerm, sortConfig]);

  const categoryCount = useMemo(
    () => filterCategory === 'Todos' ? null : items.filter(i => i.categoria === filterCategory).length,
    [items, filterCategory],
  );

  // Mosaico cuando no hay categoría ni búsqueda; la lista completa es opt-in.
  const showMosaic = filterCategory === 'Todos' && !searchTerm && !showAllList;
  const backToMosaic = () => { setFilterCategory('Todos'); setShowAllList(false); };

  const hasFilters = searchTerm !== '' || filterCategory !== 'Todos' || filterStatus !== 'Activos';
  const clearFilters = () => { setSearchTerm(''); setFilterCategory('Todos'); setFilterStatus('Activos'); setShowAllList(false); };
  // Exportar baja la vista filtrada si hay filtros; sin filtros, todo el inventario (sirve de plantilla de importación)
  const exportItems = hasFilters ? filteredItems : items;
  const exportLabel = hasFilters ? `Exportar vista (${filteredItems.length})` : `Exportar todo (${items.length})`;
  const exportTitle = hasFilters ? 'Descarga en Excel lo que estás viendo' : 'Descarga todo el inventario en Excel, incluidos los equipos dados de baja';
  const dataActions = (
    <DataActions isAdmin={isAdmin} exportLabel={exportLabel} exportTitle={exportTitle}
      onExport={() => exportInventory(exportItems)} onImport={() => setShowImport(true)} onReport={() => setShowReport(true)} />
  );

  // Atajos: "/" busca, "N" añade. Se ignoran al escribir en un campo y con un modal abierto.
  const modalOpen = modal.type !== null || showImport || showReport;
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || modalOpen) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openModal('add'); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const emptyResults = (
    <EmptyState icon={<Search size={28} />} title="No hay equipos con estos filtros."
      action={hasFilters && <Button variant="secondary" size="sm" onClick={clearFilters}>Limpiar filtros</Button>} />
  );

  return (
    <main className="relative text-brand-ink font-sans">
      <div className="fixed inset-0 bg-glow pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">

        {/* ── Hoy: lo que pide acción ─────────── */}
        <HoyBand db={db} user={user} items={items} loading={loading} onNavigate={onNavigate} />

        {/* ── Inventario ─────────────────────── */}
        <section ref={inventarioRef} aria-labelledby="inventario-titulo" className="scroll-mt-4">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 mb-3">
          <div className="min-w-0">
            <h2 id="inventario-titulo" className="text-lg font-bold text-brand-ink">Inventario</h2>
            <LineaEstado stats={stats} activo={filterStatus} onToggle={toggleStatus} loading={loading} />
          </div>
          <div className="flex items-center gap-2">
            {dataActions}
            <button onClick={() => openModal('add')} aria-label="Añadir equipo" title="Añadir equipo (N)"
              className="flex items-center gap-2 vidrio-naranja text-sm font-semibold px-3 sm:px-4 h-10 rounded-xl transition">
              <PlusCircle size={15} aria-hidden="true" /> <span className="hidden sm:inline">Añadir equipo</span>
            </button>
          </div>
        </div>

        <div className="min-w-0">

        {/* ── Filtros ────────────────────────── */}
        <div className="bg-white border border-brand-border rounded-2xl p-3 sm:p-4 mb-4 shadow-card sticky top-2 z-20">
          {/* Barra superior siempre visible */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray pointer-events-none" />
              <input ref={searchRef} type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar equipo…"
                className="w-full bg-brand-bg border border-brand-border text-brand-ink placeholder-brand-gray text-sm pl-9 pr-8 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/40 transition" />
              {!searchTerm && (
                <kbd className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 items-center justify-center w-5 h-5 text-xs font-mono text-brand-gray border border-brand-border rounded bg-white pointer-events-none" aria-hidden="true">/</kbd>
              )}
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda" className="animate-fade-in absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray hover:text-brand-ink">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Toggle filtros en móvil */}
            <button onClick={() => setMobileFilters(p => !p)} aria-label="Mostrar filtros"
              className="sm:hidden flex items-center gap-1.5 vidrio text-brand-slate text-sm px-3 py-2.5 rounded-xl transition flex-shrink-0">
              <Menu size={15} />
              {(filterCategory !== 'Todos' || filterStatus !== 'Activos') && (
                <span className="w-1.5 h-1.5 bg-brand-orange rounded-full" />
              )}
            </button>

            {/* Dropdowns en desktop */}
            <div className="hidden sm:flex items-center gap-2">
              <Dropdown label="Categoría" value={filterCategory} onChange={setFilterCategory} options={categorias} />
              <Dropdown label="Estado" value={filterStatus} onChange={setFilterStatus} options={STATUS_FILTERS} />
              {filterCategory !== 'Todos' && (
                <span className="text-xs text-brand-slate bg-brand-bg border border-brand-border px-3 py-2.5 rounded-xl whitespace-nowrap">
                  <span className="font-bold text-brand-ember">{categoryCount}</span>
                </span>
              )}
            </div>

          </div>

          {/* Filtros expandibles en móvil */}
          {mobileFilters && (
            <div className="sm:hidden mt-3 pt-3 border-t border-brand-border flex flex-col gap-2 animate-reveal">
              <Dropdown label="Categoría" value={filterCategory} onChange={setFilterCategory} options={categorias} />
              <Dropdown label="Estado" value={filterStatus} onChange={setFilterStatus} options={STATUS_FILTERS} />
              <p className="text-xs text-brand-gray text-right">
                {filteredItems.length} equipo{filteredItems.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        {/* ── Mosaico de categorías (primer nivel) ── */}
        {showMosaic && (loading
          ? <CategoryMosaic loading />
          : filteredItems.length === 0
            ? <div className="bg-white border border-brand-border rounded-2xl shadow-card">{emptyResults}</div>
            : <CategoryMosaic items={filteredItems} onSelect={setFilterCategory} onShowAll={() => setShowAllList(true)} />)}

        {/* ── Fila de la lista: dónde estás + acciones de datos ── */}
        {!showMosaic && (
          <div className="flex items-center gap-2 mb-3 px-1 animate-reveal">
            {!searchTerm ? (<>
              <button type="button" onClick={backToMosaic}
                className="flex items-center gap-1.5 text-sm text-brand-slate hover:text-brand-ink px-3 h-9 rounded-lg vidrio transition flex-shrink-0">
                <ArrowLeft size={15} /> Categorías
              </button>
              <span className="text-brand-gray">/</span>
              <span className="text-sm font-semibold text-brand-ink truncate min-w-0">
                {filterCategory === 'Todos' ? 'Todos los equipos' : filterCategory}
              </span>
              <span className="text-xs text-brand-gray tabular-nums flex-shrink-0">· {filteredItems.length} equipo{filteredItems.length !== 1 ? 's' : ''}</span>
            </>) : (
              <p className="text-xs text-brand-gray tabular-nums min-w-0 truncate">
                {filteredItems.length} resultado{filteredItems.length !== 1 ? 's' : ''} para «{searchTerm}»
              </p>
            )}
          </div>
        )}

        {!showMosaic && (<>
        {/* ── Vista móvil: tarjetas ───────────── */}
        <div className="sm:hidden space-y-2">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-brand-gray">
              <Spinner />
              <span className="text-sm">Cargando equipos…</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white border border-brand-border rounded-xl">{emptyResults}</div>
          ) : filteredItems.map(item => (
            <EquipoCard key={item.id} item={item} onAction={openModal} />
          ))}
        </div>

        {/* ── Vista desktop: tabla ────────────── */}
        <div className="hidden sm:block bg-white border border-brand-border rounded-2xl overflow-clip shadow-card">
          <div className="overflow-x-auto lg:overflow-visible">
            <table className="w-full text-left">
              <thead className="sticky top-[92px] z-10 bg-[#F7F8F9] shadow-[0_1px_0_#E8EAED]">
                <tr>
                  {TABLE_COLUMNS.map(({ key, label, center, responsive }) => {
                    const active   = sortConfig.key === key;
                    const SortIcon = active ? (sortConfig.direction === 'asc' ? ArrowUp : ArrowDown) : ChevronsUpDown;
                    return (
                      <th key={key} className={`px-4 py-3.5 text-xs font-semibold text-brand-gray uppercase tracking-wider whitespace-nowrap ${center ? 'text-center' : ''} ${responsive ?? ''}`}>
                        <button type="button" onClick={() => toggleSort(key)}
                          className={`flex items-center gap-1 hover:text-brand-ink transition-colors ${center ? 'mx-auto' : ''} ${active ? 'text-brand-ink' : ''}`}>
                          {label}
                          <SortIcon size={12} className={active ? 'text-brand-ember' : 'text-brand-gray/50'} />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="text-center py-16 text-brand-gray">
                    <div className="flex flex-col items-center gap-3">
                      <Spinner />
                      <span className="text-sm">Cargando equipos…</span>
                    </div>
                  </td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan="5">{emptyResults}</td></tr>
                ) : filteredItems.map(item => (
                  <EquipoRow key={item.id} item={item} onAction={openModal} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>)}

        </div>

        {/* Planeación (cambia poco): plegada al final */}
        <details className="mt-6 group bg-white border border-brand-border rounded-2xl shadow-card">
          <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer text-sm font-semibold text-brand-ink list-none rounded-2xl hover:bg-brand-bg/50">
            Antigüedad del parque
            <ChevronDown size={16} className="text-brand-gray transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="px-1 pb-1"><EquipmentAgeChart items={items} loading={loading} /></div>
        </details>
        </section>
      </div>

      <ToastHost toast={toast} onDismiss={dismissToast} />

      <ItemFormModal isOpen={modal.type === 'add' || modal.type === 'edit'} onClose={closeModal} onSave={handleSave} currentItem={modal.data} items={items}
        encargados={encargados} onAddEncargado={addEncargado} />
      <PreviewModal isOpen={modal.type === 'preview'} onClose={closeModal} item={liveModalData} isAdmin={isAdmin} db={db}
        onEdit={() => openModal('edit', modal.data)}
        onDeactivate={() => openModal('deactivate', modal.data)}
        onDelete={() => openModal('delete', modal.data)}
        onAddNote={addNote}
        onRegistrarEvento={registrarEvento}
      />
      <DeactivateModal isOpen={modal.type === 'deactivate'} onClose={closeModal} onDeactivate={handleDeactivate} />
      <DeleteConfirmModal isOpen={modal.type === 'delete'} onClose={closeModal} onConfirm={handleDelete} itemName={modal.data?.nombre} />
      {isAdmin && (<>
        <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} items={items} onImport={importItems} />
        <ReportModal isOpen={showReport} onClose={() => setShowReport(false)} db={db} items={items} />
      </>)}
    </main>
  );
};

export default InventoryDashboard;