import { useState, useMemo, useRef, useEffect } from 'react';
import { StatCard, StatusBadge, Dropdown } from '../components/ui';
import {
  CheckCircle, PlusCircle, AlertTriangle, Edit, Trash2,
  Box, Users, Archive, LogOut, History, X, Wrench, Search,
  ChevronDown, ChevronUp, Menu, Download, Upload, MoreVertical
} from 'lucide-react';
import IdleModal     from '../components/modals/IdleModal';
import ItemFormModal from '../components/modals/ItemFormModal';
import ImportModal   from '../components/modals/ImportModal';
import { DeactivateModal, HistoryModal, DeleteConfirmModal } from '../components/modals/OtherModals';
import useIdleTimeout from '../hooks/useIdleTimeout';
import useInventory   from '../hooks/useInventory';
import { LOGO_URL, LOGO_FALLBACK, IDLE_TIME_MS, IDLE_WARNING_MS } from '../config/constants';
import { exportInventory } from '../utils/excel';

// ── Fila de tabla (desktop) ──────────────────
const EquipoRow = ({ item, isAdmin, onAction }) => (
  <tr className="border-b border-brand-border hover:bg-brand-bg/60 transition-colors group">
    <td className="px-4 py-3.5 font-semibold text-brand-ink text-sm">{item.nombre}</td>
    <td className="px-4 py-3.5 text-brand-slate text-sm font-mono">{item.numeroInventario}</td>
    <td className="px-4 py-3.5 text-brand-gray text-xs font-mono">{item.numeroSerial || '—'}</td>
    <td className="px-4 py-3.5 text-brand-slate text-sm">{item.categoria}</td>
    <td className="px-4 py-3.5 text-brand-slate text-xs max-w-[180px] truncate" title={item.observaciones}>
      {item.observaciones || <span className="text-brand-gray italic">Sin observaciones</span>}
    </td>
    <td className="px-4 py-3.5 text-brand-slate text-sm">{item.personaEncargada || '—'}</td>
    <td className="px-4 py-3.5"><StatusBadge status={item.estado} /></td>
    <td className="px-4 py-3.5">
      <div className="flex items-center justify-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onAction('history', item)} aria-label={`Ver historial de ${item.nombre}`}
          className="text-brand-slate hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-all" title="Historial">
          <History size={15} />
        </button>
        {isAdmin && (<>
          <button onClick={() => onAction('edit', item)} aria-label={`Editar ${item.nombre}`}
            className="text-brand-slate hover:text-brand-orange p-1.5 rounded-lg hover:bg-brand-orange/10 transition-all" title="Editar">
            <Edit size={15} />
          </button>
          {item.estado !== 'De Baja' && (
            <button onClick={() => onAction('deactivate', item)} aria-label={`Dar de baja ${item.nombre}`}
              className="text-brand-slate hover:text-amber-600 p-1.5 rounded-lg hover:bg-amber-50 transition-all" title="Dar de baja">
              <Archive size={15} />
            </button>
          )}
          <button onClick={() => onAction('delete', item)} aria-label={`Eliminar ${item.nombre}`}
            className="text-brand-slate hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-all" title="Eliminar">
            <Trash2 size={15} />
          </button>
        </>)}
      </div>
    </td>
  </tr>
);

// ── Tarjeta móvil expandible ─────────────────
const EquipoCard = ({ item, isAdmin, onAction }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border border-brand-border rounded-xl overflow-hidden shadow-sm">
      {/* Cabecera siempre visible */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-brand-bg/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <StatusBadge status={item.estado} />
          <div className="min-w-0">
            <p className="font-semibold text-brand-ink text-sm truncate">{item.nombre}</p>
            <p className="text-xs text-brand-gray font-mono">{item.numeroInventario}</p>
          </div>
        </div>
        {expanded
          ? <ChevronUp size={16} className="text-brand-gray flex-shrink-0" />
          : <ChevronDown size={16} className="text-brand-gray flex-shrink-0" />
        }
      </button>

      {/* Detalles expandibles */}
      {expanded && (
        <div className="border-t border-brand-border px-4 py-4 space-y-3 bg-brand-bg/30">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-brand-gray mb-0.5">Categoría</p>
              <p className="text-brand-ink font-medium">{item.categoria || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-brand-gray mb-0.5">Serial</p>
              <p className="text-brand-slate font-mono text-xs">{item.numeroSerial || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-brand-gray mb-0.5">Encargado</p>
              <p className="text-brand-ink">{item.personaEncargada || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-brand-gray mb-0.5">Estado</p>
              <StatusBadge status={item.estado} />
            </div>
          </div>

          {item.observaciones && (
            <div>
              <p className="text-xs text-brand-gray mb-0.5">Observaciones</p>
              <p className="text-brand-slate text-sm">{item.observaciones}</p>
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-2 pt-1 border-t border-brand-border">
            <button onClick={() => onAction('history', item)}
              className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg font-medium transition-colors hover:bg-blue-100">
              <History size={13} /> Historial
            </button>
            {isAdmin && (<>
              <button onClick={() => onAction('edit', item)}
                className="flex items-center gap-1.5 text-xs text-brand-orange bg-brand-orange/10 px-3 py-2 rounded-lg font-medium transition-colors hover:bg-brand-orange/20">
                <Edit size={13} /> Editar
              </button>
              {item.estado !== 'De Baja' && (
                <button onClick={() => onAction('deactivate', item)}
                  className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg font-medium transition-colors hover:bg-amber-100">
                  <Archive size={13} /> Baja
                </button>
              )}
              <button onClick={() => onAction('delete', item)}
                className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg font-medium transition-colors hover:bg-rose-100 ml-auto">
                <Trash2 size={13} /> Eliminar
              </button>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Menú de más opciones (móvil) ──────────────
const MobileMenu = ({ isAdmin, onUsers, onExport, onImport }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const item = (icon, label, onClick) => (
    <button type="button" onClick={() => { setOpen(false); onClick(); }}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-brand-ink hover:bg-brand-bg transition-colors text-left">
      {icon} {label}
    </button>
  );

  return (
    <div ref={ref} className="relative sm:hidden">
      <button type="button" onClick={() => setOpen(p => !p)} aria-label="Más opciones"
        className="p-2.5 bg-white hover:bg-brand-bg border border-brand-border text-brand-slate rounded-xl transition-all shadow-sm">
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-52 bg-white border border-brand-border rounded-xl shadow-xl shadow-brand-ink/10 overflow-hidden animate-modal-in py-1">
          {isAdmin  && item(<Users size={15} />, 'Usuarios', onUsers)}
          {item(<Download size={15} />, 'Exportar', onExport)}
          {isAdmin  && item(<Upload size={15} />, 'Importar', onImport)}
        </div>
      )}
    </div>
  );
};

// ── Dashboard principal ──────────────────────
const InventoryDashboard = ({ user, onLogout, db, onNavigate }) => {
  const isAdmin = user.role === 'Administrador';
  const { items, loading, saveItem, deactivateItem, deleteItem, importItems } = useInventory(db, user);
  const [modal,          setModal]          = useState({ type: null, data: null });
  const [showImport,     setShowImport]     = useState(false);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [filterCategory, setFilterCategory] = useState('Todos');
  const [filterStatus,   setFilterStatus]   = useState('Activos');
  const [mobileFilters,  setMobileFilters]  = useState(false);
  const { expired: sessionExpired, countdown: idleCountdown } = useIdleTimeout(onLogout, user, IDLE_TIME_MS, IDLE_WARNING_MS);

  const openModal  = (type, data = null) => setModal({ type, data });
  const closeModal = () => setModal({ type: null, data: null });
  const handleSave = async (data) => { await saveItem(data); closeModal(); };
  const handleDeactivate = async (reason, fecha) => { await deactivateItem(modal.data.id, reason, fecha); closeModal(); };
  const handleDelete     = async ()              => { await deleteItem(modal.data.id); closeModal(); };

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

  const categorias = useMemo(() => ['Todos', ...new Set(items.map(i => i.categoria))], [items]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return items.filter(item => {
      const catOk    = filterCategory === 'Todos' || item.categoria === filterCategory;
      const statusOk = filterStatus === 'Todos' ? true : filterStatus === 'Activos' ? item.estado !== 'De Baja' : item.estado === filterStatus;
      const searchOk = !term || [item.nombre, item.numeroSerial, item.numeroInventario, item.personaEncargada].some(f => f?.toLowerCase().includes(term));
      return catOk && statusOk && searchOk;
    }).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [items, filterCategory, filterStatus, searchTerm]);

  const categoryCount = useMemo(
    () => filterCategory === 'Todos' ? null : items.filter(i => i.categoria === filterCategory).length,
    [items, filterCategory],
  );

  return (
    <div className="min-h-screen bg-brand-bg text-brand-ink font-sans">
      {sessionExpired && <IdleModal countdown={idleCountdown} />}
      <div className="fixed top-0 right-0 w-[600px] h-[400px] bg-brand-orange/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">

        {/* ── Header ─────────────────────────── */}
        <header className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <img src={LOGO_URL} alt="Betrmedia"
              className="h-8 sm:h-10 w-auto object-contain flex-shrink-0"
              onError={e => { e.target.onerror = null; e.target.src = LOGO_FALLBACK; }}
            />
            <div className="border-l border-brand-border pl-3 min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-brand-ink leading-tight truncate">
                Sistema de Inventario Betr Media
              </h1>
              <p className="text-xs text-brand-gray truncate hidden sm:block">
                {user.email} · <span className="text-brand-orange font-medium">{user.role}</span>
              </p>
            </div> 
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <MobileMenu isAdmin={isAdmin} onUsers={() => onNavigate('users')}
              onExport={() => exportInventory(items)} onImport={() => setShowImport(true)} />
            {isAdmin && (
              <button onClick={() => onNavigate('users')}
                className="hidden sm:flex items-center gap-2 bg-white hover:bg-brand-bg border border-brand-border text-brand-slate text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm">
                <Users size={15} /> Usuarios
              </button>
            )}
            <button onClick={() => exportInventory(items)} aria-label="Exportar inventario a Excel" title="Exportar a Excel"
              className="hidden sm:flex items-center gap-2 bg-white hover:bg-brand-bg border border-brand-border text-brand-slate text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm">
              <Download size={15} /> Exportar
            </button>
            {isAdmin && (
              <button onClick={() => setShowImport(true)} aria-label="Importar inventario desde Excel" title="Importar desde Excel"
                className="hidden sm:flex items-center gap-2 bg-white hover:bg-brand-bg border border-brand-border text-brand-slate text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm">
                <Upload size={15} /> Importar
              </button>
            )}
            <button onClick={() => openModal('add')} aria-label="Añadir equipo"
              className="flex items-center gap-2 bg-brand-orange hover:bg-brand-amber text-white text-sm font-semibold px-3 sm:px-4 py-2.5 rounded-xl transition-all shadow-md hover:shadow-brand-orange/30">
              <PlusCircle size={15} />
              <span className="hidden sm:inline">Añadir Equipo</span>
            </button>
            <button onClick={onLogout} aria-label="Cerrar sesión"
              className="p-2.5 bg-white hover:bg-rose-50 border border-brand-border hover:border-rose-200 text-brand-gray hover:text-rose-500 rounded-xl transition-all shadow-sm"
              title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* ── Stat Cards ─────────────────────── */}
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-5">
          <StatCard title="Activos"      value={stats.total}           icon={<Box size={16} className="text-brand-orange"/>}          accent="bg-brand-orange/10"  onClick={() => setFilterStatus('Activos')} />
          <StatCard title="Disponibles"  value={stats.disponibles}     icon={<CheckCircle size={16} className="text-emerald-600"/>} accent="bg-emerald-50"    onClick={() => setFilterStatus('Disponible')} />
          <StatCard title="En Uso"       value={stats.enUso}           icon={<Users size={16} className="text-amber-600"/>}         accent="bg-amber-50"      onClick={() => setFilterStatus('En Uso')} />
          <StatCard title="Mant."        value={stats.enMantenimiento} icon={<Wrench size={16} className="text-violet-600"/>}       accent="bg-violet-50"     onClick={() => setFilterStatus('En Mantenimiento')} />
          <StatCard title="F. Servicio"  value={stats.fueraServicio}   icon={<AlertTriangle size={16} className="text-rose-500"/>}  accent="bg-rose-50"       onClick={() => setFilterStatus('Fuera de Servicio')} />
          <StatCard title="De Baja"      value={stats.deBaja}          icon={<Archive size={16} className="text-brand-gray"/>}       accent="bg-brand-gray/10"  onClick={() => setFilterStatus('De Baja')} />
        </div>

        {/* ── Filtros ────────────────────────── */}
        <div className="bg-white border border-brand-border rounded-2xl p-3 sm:p-4 mb-4 shadow-sm">
          {/* Barra superior siempre visible */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-gray pointer-events-none" />
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar equipo…"
                className="w-full bg-brand-bg border border-brand-border text-brand-ink placeholder-brand-gray text-sm pl-9 pr-8 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/40 transition-all" />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda" className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray hover:text-brand-ink">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Toggle filtros en móvil */}
            <button onClick={() => setMobileFilters(p => !p)} aria-label="Mostrar filtros"
              className="sm:hidden flex items-center gap-1.5 bg-brand-bg border border-brand-border text-brand-slate text-sm px-3 py-2.5 rounded-xl transition-all flex-shrink-0">
              <Menu size={15} />
              {(filterCategory !== 'Todos' || filterStatus !== 'Activos') && (
                <span className="w-1.5 h-1.5 bg-brand-orange rounded-full" />
              )}
            </button>

            {/* Dropdowns en desktop */}
            <div className="hidden sm:flex items-center gap-2">
              <Dropdown value={filterCategory} onChange={setFilterCategory} options={categorias} />
              <Dropdown value={filterStatus} onChange={setFilterStatus}
                options={['Activos','Disponible','En Uso','En Mantenimiento','Fuera de Servicio','De Baja','Todos']} />
              {filterCategory !== 'Todos' && (
                <span className="text-xs text-brand-slate bg-brand-bg border border-brand-border px-3 py-2.5 rounded-xl whitespace-nowrap">
                  <span className="font-bold text-brand-orange">{categoryCount}</span>
                </span>
              )}
            </div>

          </div>

          {/* Filtros expandibles en móvil */}
          {mobileFilters && (
            <div className="sm:hidden mt-3 pt-3 border-t border-brand-border flex flex-col gap-2">
              <Dropdown value={filterCategory} onChange={setFilterCategory} options={categorias} />
              <Dropdown value={filterStatus} onChange={setFilterStatus}
                options={['Activos','Disponible','En Uso','En Mantenimiento','Fuera de Servicio','De Baja','Todos']} />
              <p className="text-xs text-brand-gray text-right">
                {filteredItems.length} equipo{filteredItems.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        {/* ── Vista móvil: tarjetas ───────────── */}
        <div className="sm:hidden space-y-2">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-brand-gray">
              <div className="w-6 h-6 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
              <span className="text-sm">Cargando equipos…</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="text-center py-16 text-brand-gray text-sm italic">
              No se encontraron equipos con los filtros actuales.
            </p>
          ) : filteredItems.map(item => (
            <EquipoCard key={item.id} item={item} isAdmin={isAdmin} onAction={openModal} />
          ))}
        </div>

        {/* ── Vista desktop: tabla ────────────── */}
        <div className="hidden sm:block bg-white border border-brand-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-brand-border bg-brand-bg/50">
                  {['Nombre','Nº Inv','Serial','Categoría','Observaciones','Encargado','Estado','Acciones'].map(h => (
                    <th key={h} className="px-4 py-3.5 text-xs font-semibold text-brand-gray uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="text-center py-16 text-brand-gray">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-brand-orange/30 border-t-brand-orange rounded-full animate-spin" />
                      <span className="text-sm">Cargando equipos…</span>
                    </div>
                  </td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-16 text-brand-gray text-sm italic">
                    No se encontraron equipos con los filtros actuales.
                  </td></tr>
                ) : filteredItems.map(item => (
                  <EquipoRow key={item.id} item={item} isAdmin={isAdmin} onAction={openModal} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ItemFormModal isOpen={modal.type === 'add' || modal.type === 'edit'} onClose={closeModal} onSave={handleSave} currentItem={modal.data} items={items} />
      <HistoryModal isOpen={modal.type === 'history'} onClose={closeModal} item={modal.data} />
      <DeactivateModal isOpen={modal.type === 'deactivate'} onClose={closeModal} onDeactivate={handleDeactivate} />
      <DeleteConfirmModal isOpen={modal.type === 'delete'} onClose={closeModal} onConfirm={handleDelete} itemName={modal.data?.nombre} />
      {isAdmin && (
        <ImportModal isOpen={showImport} onClose={() => setShowImport(false)} items={items} onImport={importItems} />
      )}
    </div>
  );
};

export default InventoryDashboard;