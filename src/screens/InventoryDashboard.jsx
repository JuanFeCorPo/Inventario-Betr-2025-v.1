import { useState, useMemo, useRef, useEffect } from 'react';
import { StatCard, StatusDot, Initials, NewBadge, Dropdown, Spinner, EmptyState, Button, ToastHost } from '../components/ui';
import { usePopover } from '../hooks/usePopover';
import useToast from '../hooks/useToast';
import {
  CheckCircle, PlusCircle, AlertTriangle,
  Box, Users, UserCheck, Archive, LogOut, ChevronRight, X, Wrench, Search,
  Menu, Download, Upload, MoreVertical, FileSpreadsheet,
  Package, ArrowLeft,
  ArrowUp, ArrowDown, ChevronsUpDown,
  Coffee, Cable, HardDrive, Mic, MemoryStick, Keyboard,
} from 'lucide-react';
import ItemFormModal from '../components/modals/ItemFormModal';
import ImportModal   from '../components/modals/ImportModal';
import PreviewModal  from '../components/modals/PreviewModal';
import ReportModal   from '../components/modals/ReportModal';
import { DeactivateModal, DeleteConfirmModal } from '../components/modals/OtherModals';
import useInventory   from '../hooks/useInventory';
import useEncargados  from '../hooks/useEncargados';
import useDismissedAlerts from '../hooks/useDismissedAlerts';
import { LOGO_URL } from '../config/constants';
import { exportInventory, normalize } from '../utils/excel';
import { computeAlerts } from '../utils/alerts';
import { isAlertDismissed } from '../utils/dismissedAlerts';
import { countOverdueMaintenance } from '../utils/maintenance';
import AlertsBell     from '../components/AlertsBell';
import EquipmentAgeChart from '../components/EquipmentAgeChart';
import UpcomingMaintenanceCard from '../components/UpcomingMaintenanceCard';
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

// Entrada escalonada de las tarjetas: solo la primera vez por sesión (volver desde otra pantalla es frecuente)
let tarjetasYaAnimadas = false;

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

// ── Menú de más opciones (móvil) ──────────────
const MobileMenu = ({ isAdmin, userEmail, role, exportLabel, onUsers, onExport, onImport, onReport, onMaintenance }) => {
  const { open, setOpen, ref, shown } = usePopover();

  const item = (icon, label, onClick, colorClass) => (
    <button type="button" onClick={() => { setOpen(false); onClick(); }}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-brand-ink hover:bg-brand-bg rounded-xl transition-colors text-left">
      <span className={`w-8 h-8 flex items-center justify-center rounded-full flex-shrink-0 ${colorClass}`}>{icon}</span>
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative sm:hidden">
      <button type="button" onClick={() => setOpen(p => !p)} aria-label="Más opciones"
        className="w-10 h-10 flex items-center justify-center bg-white hover:bg-brand-bg border border-brand-border text-brand-slate rounded-xl transition shadow-sm hover:shadow-md">
        <MoreVertical size={16} />
      </button>
      {shown && (
        <div className={`absolute right-0 z-50 mt-2 w-64 bg-white border border-brand-border rounded-2xl shadow-xl shadow-brand-ink/10 overflow-hidden ${open ? 'animate-pop-in' : 'animate-pop-out'}`}>
          <div className="px-4 py-2.5 border-b border-brand-border bg-brand-bg/50">
            <p className="text-sm font-semibold text-brand-ink truncate" title={userEmail}>{userEmail}</p>
            <p className="text-xs text-brand-ember font-medium">{role}</p>
          </div>
          <div className="p-2 space-y-0.5">
            {isAdmin  && item(<Users size={15} />, 'Usuarios', onUsers, 'bg-slate-100 text-slate-600')}
            {item(<Wrench size={15} />, 'Mantenimientos', onMaintenance, 'bg-violet-100 text-violet-600')}
            {item(<Download size={15} />, exportLabel, onExport, 'bg-blue-100 text-blue-600')}
            {isAdmin  && item(<Upload size={15} />, 'Importar', onImport, 'bg-emerald-100 text-emerald-600')}
            {isAdmin  && item(<FileSpreadsheet size={15} />, 'Generar reporte', onReport, 'bg-brand-orange/10 text-brand-ember')}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Dashboard principal ──────────────────────
const InventoryDashboard = ({ user, onLogout, db, onNavigate }) => {
  const isAdmin = user.role === 'Administrador';
  const { items, loading, saveItem, deactivateItem, deleteItem, restoreItem, importItems, addNote } = useInventory(db, user);
  const { toast, show: showToast, dismiss: dismissToast } = useToast();
  const searchRef = useRef(null);
  const animarTarjetas = useRef(!tarjetasYaAnimadas).current;
  useEffect(() => { tarjetasYaAnimadas = true; }, []);
  const { encargados, addEncargado } = useEncargados(db);
  const { dismissedMap, dismissAlert } = useDismissedAlerts(db, user);
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

  const alerts = useMemo(
    () => computeAlerts(items).filter(a => !isAlertDismissed(dismissedMap, a.id)),
    [items, dismissedMap],
  );
  const maintenanceOverdue = useMemo(() => countOverdueMaintenance(items), [items]);

  // "Ver" también descarta la alerta (por 15 días — vuelve a aparecer si
  // el problema sigue sin resolverse).
  const goToAlert = (alert) => {
    dismissAlert(alert.id);
    if (alert.navigateTo) { onNavigate(alert.navigateTo); return; }
    setFilterCategory(alert.filterCategory ?? 'Todos');
    setFilterStatus(alert.filterStatus ?? 'Todos');
  };

  const categorias = useMemo(() => ['Todos', ...new Set(items.map(i => i.categoria))], [items]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return items.filter(item => {
      const catOk    = filterCategory === 'Todos' || item.categoria === filterCategory;
      const statusOk = filterStatus === 'Todos' ? true : filterStatus === 'Activos' ? item.estado !== 'De Baja' : item.estado === filterStatus;
      const searchOk = !term || [item.nombre, item.numeroSerial, item.numeroInventario, item.personaEncargada].some(f => f?.toLowerCase().includes(term));
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
    <div className="min-h-screen bg-brand-bg text-brand-ink font-sans">
      <div className="fixed inset-0 bg-glow pointer-events-none" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">

        {/* ── Header ─────────────────────────── */}
        <header className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <img src={LOGO_URL} alt="Betrmedia"
              className="h-8 sm:h-10 w-auto object-contain flex-shrink-0"
            />
            <div className="border-l border-brand-border pl-3 min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-brand-ink leading-tight truncate">
                Inventario Betr Media
              </h1>
              <p className="text-xs text-brand-gray truncate hidden sm:block">
                {user.email} · <span className="text-brand-ember font-medium">{user.role}</span>
              </p>
            </div> 
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <AlertsBell alerts={alerts} onGoTo={goToAlert} onDismiss={dismissAlert} />
            <MobileMenu isAdmin={isAdmin} userEmail={user.email} role={user.role} exportLabel={exportLabel}
              onUsers={() => onNavigate('users')} onMaintenance={() => onNavigate('maintenance')}
              onExport={() => exportInventory(exportItems)} onImport={() => setShowImport(true)} onReport={() => setShowReport(true)} />
            <button onClick={() => onNavigate('maintenance')} aria-label="Ver mantenimientos preventivos" title="Mantenimientos preventivos"
              className="hidden sm:flex items-center gap-2 bg-white hover:bg-brand-bg border border-brand-border text-brand-slate text-sm px-3 lg:px-4 h-10 rounded-xl transition shadow-sm relative">
              <Wrench size={15} /> <span className="hidden lg:inline">Mantenimientos</span>
              {maintenanceOverdue > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-rose-600 text-white text-[10px] font-bold rounded-full">
                  {maintenanceOverdue}
                </span>
              )}
            </button>
            {isAdmin && (
              <button onClick={() => onNavigate('users')} aria-label="Gestionar usuarios" title="Usuarios"
                className="hidden sm:flex items-center gap-2 bg-white hover:bg-brand-bg border border-brand-border text-brand-slate text-sm px-3 lg:px-4 h-10 rounded-xl transition shadow-sm">
                <Users size={15} /> <span className="hidden lg:inline">Usuarios</span>
              </button>
            )}
            <button onClick={() => openModal('add')} aria-label="Añadir equipo" title="Añadir equipo (N)"
              className="flex items-center gap-2 bg-brand-orange hover:bg-brand-amber text-brand-cocoa text-sm font-semibold px-3 sm:px-4 h-10 min-w-10 justify-center rounded-xl transition shadow-md hover:shadow-brand-orange/30">
              <PlusCircle size={15} />
              <span className="hidden sm:inline">Añadir equipo</span>
            </button>
            <button onClick={onLogout} aria-label="Cerrar sesión"
              className="w-10 h-10 flex items-center justify-center bg-white hover:bg-rose-50 border border-brand-border hover:border-rose-200 text-brand-gray hover:text-rose-500 rounded-xl transition shadow-sm"
              title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* ── Stat Cards ─────────────────────── */}
        <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-5 ${animarTarjetas ? 'stagger-in' : ''}`}>
          <StatCard title="Activos"      value={stats.total}           icon={<Box size={16} className="text-brand-ember"/>}          accent="bg-brand-orange/10"  onClick={() => toggleStatus('Activos')} active={filterStatus === 'Activos'} loading={loading} />
          <StatCard title="Disponibles"  value={stats.disponibles}     icon={<CheckCircle size={16} className="text-emerald-600"/>} accent="bg-emerald-50"    onClick={() => toggleStatus('Disponible')} active={filterStatus === 'Disponible'} loading={loading} />
          <StatCard title="En Uso"       value={stats.enUso}           icon={<UserCheck size={16} className="text-blue-600"/>}          accent="bg-blue-50"      onClick={() => toggleStatus('En Uso')} active={filterStatus === 'En Uso'} loading={loading} />
          <StatCard title="En mantenimiento" value={stats.enMantenimiento} icon={<Wrench size={16} className="text-violet-600"/>}       accent="bg-violet-50"     onClick={() => toggleStatus('En Mantenimiento')} active={filterStatus === 'En Mantenimiento'} loading={loading} />
          <StatCard title="Fuera de servicio" value={stats.fueraServicio}   icon={<AlertTriangle size={16} className="text-rose-500"/>}  accent="bg-rose-50"       onClick={() => toggleStatus('Fuera de Servicio')} active={filterStatus === 'Fuera de Servicio'} loading={loading} />
          <StatCard title="De Baja"      value={stats.deBaja}          icon={<Archive size={16} className="text-brand-gray"/>}       accent="bg-brand-gray/10"  onClick={() => toggleStatus('De Baja')} active={filterStatus === 'De Baja'} loading={loading} />
        </div>

        {/* ── Contenido + barra lateral del gráfico ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 items-start">

        <div className="xl:col-start-1 xl:row-start-1 min-w-0">

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
              className="sm:hidden flex items-center gap-1.5 bg-brand-bg border border-brand-border text-brand-slate text-sm px-3 py-2.5 rounded-xl transition flex-shrink-0">
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
            : <CategoryMosaic items={filteredItems} onSelect={setFilterCategory} onShowAll={() => setShowAllList(true)} actions={dataActions} />)}

        {/* ── Fila de la lista: dónde estás + acciones de datos ── */}
        {!showMosaic && (
          <div className="flex items-center gap-2 mb-3 px-1 animate-reveal">
            {!searchTerm ? (<>
              <button type="button" onClick={backToMosaic}
                className="flex items-center gap-1.5 text-sm text-brand-slate hover:text-brand-ink px-2 py-1.5 -ml-2 rounded-lg hover:bg-white transition-colors flex-shrink-0">
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
            <div className="ml-auto flex-shrink-0">{dataActions}</div>
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

        {/* Resúmenes: franja bajo la lista; barra lateral derecha desde 1280 px (así los vencidos se ven sin hacer scroll en portátiles) */}
        <div className="xl:col-start-2 xl:row-start-1 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 gap-4 items-start">
          <UpcomingMaintenanceCard items={items} onNavigate={onNavigate} loading={loading} />
          <EquipmentAgeChart items={items} loading={loading} />
        </div>
        </div>
      </div>

      <ToastHost toast={toast} onDismiss={dismissToast} />

      <ItemFormModal isOpen={modal.type === 'add' || modal.type === 'edit'} onClose={closeModal} onSave={handleSave} currentItem={modal.data} items={items}
        encargados={encargados} onAddEncargado={addEncargado} />
      <PreviewModal isOpen={modal.type === 'preview'} onClose={closeModal} item={liveModalData} isAdmin={isAdmin} db={db}
        onEdit={() => openModal('edit', modal.data)}
        onDeactivate={() => openModal('deactivate', modal.data)}
        onDelete={() => openModal('delete', modal.data)}
        onAddNote={addNote}
      />
      <DeactivateModal isOpen={modal.type === 'deactivate'} onClose={closeModal} onDeactivate={handleDeactivate} />
      <DeleteConfirmModal isOpen={modal.type === 'delete'} onClose={closeModal} onConfirm={handleDelete} itemName={modal.data?.nombre} />
      {isAdmin && (<>
        <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} items={items} onImport={importItems} />
        <ReportModal isOpen={showReport} onClose={() => setShowReport(false)} db={db} items={items} />
      </>)}
    </div>
  );
};

export default InventoryDashboard;