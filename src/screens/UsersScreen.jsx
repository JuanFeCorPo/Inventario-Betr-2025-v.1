import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, doc, updateDoc, setDoc, query, Timestamp, arrayUnion
} from 'firebase/firestore';
import {
  Users, ArrowLeft, Shield, BookOpen,
  ToggleLeft, ToggleRight, Loader2, UserCheck,
  UserX, UserPlus, X, History, AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui';
import { HistoryModal } from '../components/modals/OtherModals';

const ROLES = ['Lector', 'Administrador'];

const RoleBadge = ({ role }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border
    ${role === 'Administrador'
      ? 'bg-brand-orange/10 text-brand-orange border-brand-orange/20'
      : 'bg-brand-slate/10 text-brand-slate border-brand-slate/20'}`}>
    {role === 'Administrador' ? <Shield size={10} /> : <BookOpen size={10} />}
    {role}
  </span>
);

// Modal para registrar un usuario ya existente en Firebase Auth
const AddUserModal = ({ isOpen, onClose, onAdd }) => {
  const [uid,    setUid]    = useState('');
  const [email,  setEmail]  = useState('');
  const [role,   setRole]   = useState('Lector');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // 'ok' | 'error'

  const reset = () => { setUid(''); setEmail(''); setRole('Lector'); setResult(null); };
  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!uid.trim() || !email.trim()) return;
    setSaving(true);
    setResult(null);
    try {
      await onAdd({ uid: uid.trim(), email: email.trim(), role });
      setResult('ok');
      setTimeout(() => handleClose(), 1800);
    } catch {
      setResult('error');
      setSaving(false);
    }
  };

  if (!isOpen) return null;
  const f = 'w-full bg-brand-bg border border-brand-border text-brand-ink placeholder-brand-gray px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all text-sm';

  return (
    <div className="fixed inset-0 bg-brand-ink/50 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-modal-in">
      <div className="bg-white border border-brand-border rounded-2xl shadow-2xl p-8 w-full max-w-md relative">
        <button onClick={handleClose} aria-label="Cerrar" className="absolute top-4 right-4 text-brand-gray hover:text-brand-ink p-1 rounded-lg hover:bg-brand-bg transition-colors">
          <X size={18} />
        </button>
        <h2 className="text-lg font-bold text-brand-ink mb-1">Registrar Usuario</h2>
        <p className="text-xs text-brand-gray mb-6">
          Ingresa el UID y email del usuario que creaste en Firebase Auth.
          Puedes encontrar el UID en <span className="font-medium text-brand-ink">Firebase Console → Authentication → Users</span>.
        </p>

        {/* Feedback */}
        {result === 'ok' && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <UserCheck size={16} className="text-emerald-600 flex-shrink-0" />
            <p className="text-emerald-700 text-sm font-medium">Usuario registrado correctamente.</p>
          </div>
        )}
        {result === 'error' && (
          <div className="mb-4 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <UserX size={16} className="text-rose-600 flex-shrink-0" />
            <p className="text-rose-700 text-sm">No se pudo registrar. Verifica que el UID sea correcto y que tengas permisos de Administrador.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-brand-slate mb-1.5 block">UID de Firebase</label>
            <input value={uid} onChange={e => setUid(e.target.value)}
              placeholder="Ej: abc123xyz..." className={f} required disabled={saving || result === 'ok'} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-slate mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="usuario@empresa.com" className={f} required disabled={saving || result === 'ok'} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brand-slate mb-1.5 block">Rol</label>
            <select value={role} onChange={e => setRole(e.target.value)} className={f} disabled={saving || result === 'ok'}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={handleClose} disabled={saving}>Cancelar</Button>
            <Button variant="primary" type="submit" disabled={saving || result === 'ok'}
              className="flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Registrando…' : 'Registrar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

const UsersScreen = ({ db, currentUser, onBack }) => {
  const [users,      setUsers]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(null);
  const [pageError,  setPageError]  = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [historyUser, setHistoryUser] = useState(null);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(query(collection(db, 'users')), snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [db]);

  const activeAdminCount = users.filter(u => (u.role ?? 'Lector') === 'Administrador' && (u.active ?? true)).length;

  const updateUser = async (userId, changes, actionLabel) => {
    setSaving(userId);
    setPageError('');
    try {
      const entry = { timestamp: Timestamp.now(), user: currentUser.email, action: actionLabel };
      await updateDoc(doc(db, 'users', userId), { ...changes, history: arrayUnion(entry) });
    } catch (e) {
      setPageError('No se pudo actualizar el usuario. Verifica tu conexión o permisos.');
    } finally {
      setSaving(null);
    }
  };

  const addUser = async ({ uid, email, role }) => {
    const entry = { timestamp: Timestamp.now(), user: currentUser.email, action: 'Usuario registrado en el sistema.' };
    await setDoc(doc(db, 'users', uid), { email, role, active: true, history: [entry] });
  };

  const isLastActiveAdmin = (user) =>
    user.role === 'Administrador' && (user.active ?? true) && activeAdminCount <= 1;

  const toggleRole = (user) => {
    if (isLastActiveAdmin(user)) {
      setPageError('No puedes quitarle el rol de Administrador: es el único administrador activo.');
      return;
    }
    const newRole = user.role === 'Administrador' ? 'Lector' : 'Administrador';
    updateUser(user.id, { role: newRole }, `Rol cambiado a "${newRole}".`);
  };

  const toggleActive = (user) => {
    if (isLastActiveAdmin(user)) {
      setPageError('No puedes desactivar al único administrador activo.');
      return;
    }
    const newActive = !(user.active ?? true);
    updateUser(user.id, { active: newActive }, newActive ? 'Acceso activado.' : 'Acceso desactivado.');
  };

  return (
    <div className="min-h-screen bg-brand-bg font-sans">
      <div className="fixed top-0 right-0 w-[600px] h-[400px] bg-brand-orange/5 rounded-full blur-[120px] pointer-events-none" />

      <AddUserModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onAdd={addUser} />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Header */}
        <header className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <button onClick={onBack}
              className="p-2.5 bg-white hover:bg-brand-bg border border-brand-border rounded-xl transition-all shadow-sm text-brand-slate hover:text-brand-ink">
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-brand-ink">Gestión de Usuarios</h1>
              <p className="text-xs text-brand-gray mt-0.5">Solo los usuarios registrados aquí pueden acceder al sistema</p>
            </div>
          </div>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-brand-orange hover:bg-brand-amber text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md hover:shadow-brand-orange/30 flex-shrink-0">
            <UserPlus size={15} />
            <span className="hidden sm:inline">Registrar Usuario</span>
          </button>
        </header>

        {/* Error de acción */}
        {pageError && (
          <div className="mb-6 bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-rose-500 flex-shrink-0 mt-0.5" />
            <p className="text-rose-700 text-sm flex-1">{pageError}</p>
            <button onClick={() => setPageError('')} className="text-rose-400 hover:text-rose-600 p-0.5">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Aviso de seguridad */}
        <div className="bg-brand-orange/8 border border-brand-orange/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <Shield size={18} className="text-brand-orange flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-brand-ink">Acceso controlado</p>
            <p className="text-brand-slate mt-0.5">
              Solo los usuarios registrados en esta lista pueden entrar al sistema.
              Primero crea el usuario en <span className="font-medium text-brand-ink">Firebase Console → Authentication</span>,
              luego regístralo aquí con el botón <span className="font-medium text-brand-ink">Registrar Usuario</span> usando su UID.
            </p>
          </div>
        </div>

        {/* Lista */}
        <div className="bg-white border border-brand-border rounded-2xl shadow-sm overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_160px_120px_100px] gap-4 px-6 py-3 border-b border-brand-border bg-brand-bg/50">
            <p className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Usuario</p>
            <p className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Rol</p>
            <p className="text-xs font-semibold text-brand-gray uppercase tracking-wider">Acceso</p>
            <p className="text-xs font-semibold text-brand-gray uppercase tracking-wider text-center">Acciones</p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-brand-gray">
              <Loader2 size={24} className="animate-spin text-brand-orange" />
              <span className="text-sm">Cargando usuarios…</span>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-brand-gray">
              <Users size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm italic">No hay usuarios registrados aún.</p>
            </div>
          ) : (
            <ul className="divide-y divide-brand-border">
              {users.map(user => {
                const isActive  = user.active ?? true;
                const isSelf    = user.id === currentUser.uid;
                const isSaving  = saving === user.id;
                const isLastAdmin = isLastActiveAdmin(user);

                return (
                  <li key={user.id}
                    className={`px-4 sm:px-6 py-4 transition-colors ${!isActive ? 'opacity-50 bg-brand-bg/30' : 'hover:bg-brand-bg/30'}`}>

                    {/* Mobile */}
                    <div className="sm:hidden space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-brand-ink text-sm truncate">{user.email}</p>
                          {isSelf && <span className="text-xs text-brand-orange">← Tú</span>}
                        </div>
                        <RoleBadge role={user.role ?? 'Lector'} />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => setHistoryUser(user)}
                          className="flex items-center gap-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-2 rounded-lg font-medium transition-all">
                          <History size={12} /> Historial
                        </button>
                        {!isSelf && (<>
                          <button onClick={() => toggleRole(user)} disabled={isSaving || isLastAdmin}
                            title={isLastAdmin ? 'Es el único administrador activo' : undefined}
                            className="flex items-center gap-1.5 text-xs bg-brand-bg hover:bg-brand-border border border-brand-border text-brand-slate px-3 py-2 rounded-lg font-medium transition-all disabled:opacity-40">
                            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
                            Cambiar rol
                          </button>
                          <button onClick={() => toggleActive(user)} disabled={isSaving || isLastAdmin}
                            title={isLastAdmin ? 'Es el único administrador activo' : undefined}
                            className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-all disabled:opacity-40 border
                              ${isActive ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                            {isActive ? <UserX size={12} /> : <UserCheck size={12} />}
                            {isActive ? 'Desactivar' : 'Activar'}
                          </button>
                        </>)}
                      </div>
                    </div>

                    {/* Desktop */}
                    <div className="hidden sm:grid grid-cols-[1fr_160px_120px_100px] gap-4 items-center">
                      <div className="min-w-0">
                        <p className="font-semibold text-brand-ink text-sm truncate">{user.email}</p>
                        {isSelf && <span className="text-xs text-brand-orange">← Tu cuenta</span>}
                      </div>
                      <RoleBadge role={user.role ?? 'Lector'} />
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isActive ? 'text-emerald-600' : 'text-brand-gray'}`}>
                        {isActive
                          ? <><ToggleRight size={16} className="text-emerald-500" /> Activo</>
                          : <><ToggleLeft size={16} /> Inactivo</>}
                      </span>
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setHistoryUser(user)}
                          title="Ver historial"
                          aria-label={`Ver historial de ${user.email}`}
                          className="p-2 rounded-lg text-brand-slate hover:text-blue-600 hover:bg-blue-50 transition-all">
                          <History size={15} />
                        </button>
                        {isSelf ? (
                          <span className="text-xs text-brand-gray italic">—</span>
                        ) : (<>
                          <button onClick={() => toggleRole(user)} disabled={isSaving || isLastAdmin}
                            title={isLastAdmin ? 'Es el único administrador activo' : `Cambiar a ${user.role === 'Administrador' ? 'Lector' : 'Administrador'}`}
                            aria-label={`Cambiar rol de ${user.email}`}
                            className="p-2 rounded-lg text-brand-slate hover:text-brand-orange hover:bg-brand-orange/10 transition-all disabled:opacity-40">
                            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Shield size={15} />}
                          </button>
                          <button onClick={() => toggleActive(user)} disabled={isSaving || isLastAdmin}
                            title={isLastAdmin ? 'Es el único administrador activo' : (isActive ? 'Desactivar acceso' : 'Activar acceso')}
                            aria-label={isActive ? `Desactivar acceso de ${user.email}` : `Activar acceso de ${user.email}`}
                            className={`p-2 rounded-lg transition-all disabled:opacity-40
                              ${isActive ? 'text-brand-slate hover:text-rose-600 hover:bg-rose-50' : 'text-brand-slate hover:text-emerald-600 hover:bg-emerald-50'}`}>
                            {isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                          </button>
                        </>)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <p className="text-xs text-brand-gray text-center mt-4">
          Los usuarios inactivos no pueden acceder al sistema aunque tengan credenciales válidas en Firebase.
        </p>
      </div>

      <HistoryModal isOpen={!!historyUser} onClose={() => setHistoryUser(null)}
        item={historyUser ? { nombre: historyUser.email, history: historyUser.history } : null} />
    </div>
  );
};

export default UsersScreen;