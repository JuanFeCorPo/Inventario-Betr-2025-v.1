import React, { useState, useMemo } from 'react';
import { StatCard, StatusBadge, Dropdown } from '../components/ui';
import {
  CheckCircle, PlusCircle, AlertTriangle, Edit, Trash2,
  Box, Users, Archive, LogOut, History, X, Wrench, Search,
  ChevronDown, ChevronUp, Menu
} from 'lucide-react';
import IdleModal     from '../components/modals/IdleModal';
import ItemFormModal from '../components/modals/ItemFormModal';
import { DeactivateModal, HistoryModal, DeleteConfirmModal } from '../components/modals/OtherModals';
import useIdleTimeout from '../hooks/useIdleTimeout';
import useInventory   from '../hooks/useInventory';
import { LOGO_URL, LOGO_FALLBACK } from '../config/constants';

// ── Fila de tabla (desktop) ──────────────────
const EquipoRow = ({ item, isAdmin, onAction }) => (
  <tr className="border-b border-[#E8EAED] hover:bg-[#F0F2F4]/60 transition-colors group">
    <td className="px-4 py-3.5 font-semibold text-[#1C2B35] text-sm">{item.nombre}</td>
    <td className="px-4 py-3.5 text-[#5E6A74] text-sm font-mono">{item.numeroInventario}</td>
    <td className="px-4 py-3.5 text-[#8D8D8D] text-xs font-mono">{item.numeroSerial || '—'}</td>
    <td className="px-4 py-3.5 text-[#5E6A74] text-sm">{item.categoria}</td>
    <td className="px-4 py-3.5 text-[#5E6A74] text-xs max-w-[180px] truncate" title={item.observaciones}>
      {item.observaciones || <span className="text-[#8D8D8D] italic">Sin observaciones</span>}
    </td>
    <td className="px-4 py-3.5 text-[#5E6A74] text-sm">{item.personaEncargada || '—'}</td>
    <td className="px-4 py-3.5"><StatusBadge status={item.estado} /></td>
    <td className="px-4 py-3.5">
      <div className="flex items-center justify-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onAction('history', item)}
          className="text-[#5E6A74] hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-all" title="Historial">
          <History size={15} />
        </button>
        {isAdmin && (<>
          <button onClick={() => onAction('edit', item)}
            className="text-[#5E6A74] hover:text-[#E68E00] p-1.5 rounded-lg hover:bg-[#E68E00]/10 transition-all" title="Editar">
            <Edit size={15} />
          </button>
          {item.estado !== 'De Baja' && (
            <button onClick={() => onAction('deactivate', item)}
              className="text-[#5E6A74] hover:text-amber-600 p-1.5 rounded-lg hover:bg-amber-50 transition-all" title="Dar de baja">
              <Archive size={15} />
            </button>
          )}
          <button onClick={() => onAction('delete', item)}
            className="text-[#5E6A74] hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-all" title="Eliminar">
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
    <div className="bg-white border border-[#E8EAED] rounded-xl overflow-hidden shadow-sm">
      {/* Cabecera siempre visible */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-[#F0F2F4]/50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <StatusBadge status={item.estado} />
          <div className="min-w-0">
            <p className="font-semibold text-[#1C2B35] text-sm truncate">{item.nombre}</p>
            <p className="text-xs text-[#8D8D8D] font-mono">{item.numeroInventario}</p>
          </div>
        </div>
        {expanded
          ? <ChevronUp size={16} className="text-[#8D8D8D] flex-shrink-0" />
          : <ChevronDown size={16} className="text-[#8D8D8D] flex-shrink-0" />
        }
      </button>

      {/* Detalles expandibles */}
      {expanded && (
        <div className="border-t border-[#E8EAED] px-4 py-4 space-y-3 bg-[#F0F2F4]/30">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-[#8D8D8D] mb-0.5">Categoría</p>
              <p className="text-[#1C2B35] font-medium">{item.categoria || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[#8D8D8D] mb-0.5">Serial</p>
              <p className="text-[#5E6A74] font-mono text-xs">{item.numeroSerial || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[#8D8D8D] mb-0.5">Encargado</p>
              <p className="text-[#1C2B35]">{item.personaEncargada || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[#8D8D8D] mb-0.5">Estado</p>
              <StatusBadge status={item.estado} />
            </div>
          </div>

          {item.observaciones && (
            <div>
              <p className="text-xs text-[#8D8D8D] mb-0.5">Observaciones</p>
              <p className="text-[#5E6A74] text-sm">{item.observaciones}</p>
            </div>
          )}

          {/* Acciones */}
          <div className="flex items-center gap-2 pt-1 border-t border-[#E8EAED]">
            <button onClick={() => onAction('history', item)}
              className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg font-medium transition-colors hover:bg-blue-100">
              <History size={13} /> Historial
            </button>
            {isAdmin && (<>
              <button onClick={() => onAction('edit', item)}
                className="flex items-center gap-1.5 text-xs text-[#E68E00] bg-[#E68E00]/10 px-3 py-2 rounded-lg font-medium transition-colors hover:bg-[#E68E00]/20">
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

// ── Dashboard principal ──────────────────────
const InventoryDashboard = ({ user, onLogout, db, onNavigate }) => {
  const isAdmin = user.role === 'Administrador';
  const { items, loading, saveItem, deactivateItem, deleteItem } = useInventory(db, user);
  const [modal,          setModal]          = useState({ type: null, data: null });
  const [searchTerm,     setSearchTerm]     = useState('');
  const [filterCategory, setFilterCategory] = useState('Todos');
  const [filterStatus,   setFilterStatus]   = useState('Activos');
  const [mobileFilters,  setMobileFilters]  = useState(false);
  const sessionExpired = useIdleTimeout(onLogout, user);

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
    <div className="min-h-screen bg-[#F0F2F4] text-[#1C2B35] font-sans">
      {sessionExpired && <IdleModal />}
      <div className="fixed top-0 right-0 w-[600px] h-[400px] bg-[#E68E00]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">

        {/* ── Header ─────────────────────────── */}
        <header className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <img src={LOGO_URL} alt="Betrmedia"
              className="h-8 sm:h-10 w-auto object-contain flex-shrink-0"
              onError={e => { e.target.onerror = null; e.target.src = LOGO_FALLBACK; }}
            />
            <div className="border-l border-[#E8EAED] pl-3 min-w-0">
              <h1 className="text-sm sm:text-base font-bold text-[#1C2B35] leading-tight truncate">
                Sistema de Inventario
              </h1>
              <p className="text-xs text-[#8D8D8D] truncate hidden sm:block">
                {user.email} · <span className="text-[#E68E00] font-medium">{user.role}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && (
              <button onClick={() => onNavigate('users')}
                className="hidden sm:flex items-center gap-2 bg-white hover:bg-[#F0F2F4] border border-[#E8EAED] text-[#5E6A74] text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm">
                <Users size={15} /> Usuarios
              </button>
            )}
            <button onClick={() => openModal('add')}
              className="flex items-center gap-2 bg-[#E68E00] hover:bg-[#EDAA00] text-white text-sm font-semibold px-3 sm:px-4 py-2.5 rounded-xl transition-all shadow-md hover:shadow-[#E68E00]/30">
              <PlusCircle size={15} />
              <span className="hidden sm:inline">Añadir Equipo</span>
            </button>
            <button onClick={onLogout}
              className="p-2.5 bg-white hover:bg-rose-50 border border-[#E8EAED] hover:border-rose-200 text-[#8D8D8D] hover:text-rose-500 rounded-xl transition-all shadow-sm"
              title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* ── Stat Cards ─────────────────────── */}
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-5">
          <StatCard title="Activos"      value={stats.total}           icon={<Box size={16} className="text-[#E68E00]"/>}          accent="bg-[#E68E00]/10"  onClick={() => setFilterStatus('Activos')} />
          <StatCard title="Disponibles"  value={stats.disponibles}     icon={<CheckCircle size={16} className="text-emerald-600"/>} accent="bg-emerald-50"    onClick={() => setFilterStatus('Disponible')} />
          <StatCard title="En Uso"       value={stats.enUso}           icon={<Users size={16} className="text-amber-600"/>}         accent="bg-amber-50"      onClick={() => setFilterStatus('En Uso')} />
          <StatCard title="Mant."        value={stats.enMantenimiento} icon={<Wrench size={16} className="text-violet-600"/>}       accent="bg-violet-50"     onClick={() => setFilterStatus('En Mantenimiento')} />
          <StatCard title="F. Servicio"  value={stats.fueraServicio}   icon={<AlertTriangle size={16} className="text-rose-500"/>}  accent="bg-rose-50"       onClick={() => setFilterStatus('Fuera de Servicio')} />
          <StatCard title="De Baja"      value={stats.deBaja}          icon={<Archive size={16} className="text-[#8D8D8D]"/>}       accent="bg-[#8D8D8D]/10"  onClick={() => setFilterStatus('De Baja')} />
        </div>

        {/* ── Filtros ────────────────────────── */}
        <div className="bg-white border border-[#E8EAED] rounded-2xl p-3 sm:p-4 mb-4 shadow-sm">
          {/* Barra superior siempre visible */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8D8D8D] pointer-events-none" />
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar equipo…"
                className="w-full bg-[#F0F2F4] border border-[#E8EAED] text-[#1C2B35] placeholder-[#8D8D8D] text-sm pl-9 pr-8 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#E68E00]/40 transition-all" />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8D8D8D] hover:text-[#1C2B35]">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Toggle filtros en móvil */}
            <button onClick={() => setMobileFilters(p => !p)}
              className="sm:hidden flex items-center gap-1.5 bg-[#F0F2F4] border border-[#E8EAED] text-[#5E6A74] text-sm px-3 py-2.5 rounded-xl transition-all flex-shrink-0">
              <Menu size={15} />
              {(filterCategory !== 'Todos' || filterStatus !== 'Activos') && (
                <span className="w-1.5 h-1.5 bg-[#E68E00] rounded-full" />
              )}
            </button>

            {/* Dropdowns en desktop */}
            <div className="hidden sm:flex items-center gap-2">
              <Dropdown value={filterCategory} onChange={setFilterCategory} options={categorias} />
              <Dropdown value={filterStatus} onChange={setFilterStatus}
                options={['Activos','Disponible','En Uso','En Mantenimiento','Fuera de Servicio','De Baja','Todos']} />
              {filterCategory !== 'Todos' && (
                <span className="text-xs text-[#5E6A74] bg-[#F0F2F4] border border-[#E8EAED] px-3 py-2.5 rounded-xl whitespace-nowrap">
                  {filterCategory}: <span className="font-bold text-[#E68E00]">{categoryCount}</span>
                </span>
              )}
            </div>

            <span className="ml-auto text-xs text-[#8D8D8D] hidden sm:block whitespace-nowrap">
              {filteredItems.length} equipo{filteredItems.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Filtros expandibles en móvil */}
          {mobileFilters && (
            <div className="sm:hidden mt-3 pt-3 border-t border-[#E8EAED] flex flex-col gap-2">
              <Dropdown value={filterCategory} onChange={setFilterCategory} options={categorias} />
              <Dropdown value={filterStatus} onChange={setFilterStatus}
                options={['Activos','Disponible','En Uso','En Mantenimiento','Fuera de Servicio','De Baja','Todos']} />
              <p className="text-xs text-[#8D8D8D] text-right">
                {filteredItems.length} equipo{filteredItems.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        {/* ── Vista móvil: tarjetas ───────────── */}
        <div className="sm:hidden space-y-2">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-[#8D8D8D]">
              <div className="w-6 h-6 border-2 border-[#E68E00]/30 border-t-[#E68E00] rounded-full animate-spin" />
              <span className="text-sm">Cargando equipos…</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="text-center py-16 text-[#8D8D8D] text-sm italic">
              No se encontraron equipos con los filtros actuales.
            </p>
          ) : filteredItems.map(item => (
            <EquipoCard key={item.id} item={item} isAdmin={isAdmin} onAction={openModal} />
          ))}
        </div>

        {/* ── Vista desktop: tabla ────────────── */}
        <div className="hidden sm:block bg-white border border-[#E8EAED] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#E8EAED] bg-[#F0F2F4]/50">
                  {['Nombre','Nº Inv','Serial','Categoría','Observaciones','Encargado','Estado','Acciones'].map(h => (
                    <th key={h} className="px-4 py-3.5 text-xs font-semibold text-[#8D8D8D] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="text-center py-16 text-[#8D8D8D]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-6 h-6 border-2 border-[#E68E00]/30 border-t-[#E68E00] rounded-full animate-spin" />
                      <span className="text-sm">Cargando equipos…</span>
                    </div>
                  </td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan="8" className="text-center py-16 text-[#8D8D8D] text-sm italic">
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

      <ItemFormModal isOpen={modal.type === 'add' || modal.type === 'edit'} onClose={closeModal} onSave={handleSave} currentItem={modal.data} />
      <HistoryModal isOpen={modal.type === 'history'} onClose={closeModal} item={modal.data} />
      <DeactivateModal isOpen={modal.type === 'deactivate'} onClose={closeModal} onDeactivate={handleDeactivate} />
      <DeleteConfirmModal isOpen={modal.type === 'delete'} onClose={closeModal} onConfirm={handleDelete} itemName={modal.data?.nombre} />
    </div>
  );
};

export default InventoryDashboard;