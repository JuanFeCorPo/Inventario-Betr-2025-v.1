// Importaciones de React y librerías necesarias
import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    createUserWithEmailAndPassword // Importado para la función de crear usuarios
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc,
    addDoc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    query,
    Timestamp // Importado para las fechas
} from 'firebase/firestore';
import { CheckCircle, PlusCircle, AlertTriangle, Edit, Trash2, Box, Users, Archive, UserPlus, LogOut, Frown, History, X } from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = typeof __firebase_config !== 'undefined' 
    ? JSON.parse(__firebase_config) 
    : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- COMPONENTES DE UI REUTILIZABLES ---
const Modal = ({ isOpen, onClose, title, children }) => { if (!isOpen) return null; return ( <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 animate-modal-in"><div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-2xl text-white relative"><button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={24} /></button><h2 className="text-2xl font-bold mb-6">{title}</h2>{children}</div></div> ); };

// --- PANTALLA DE LOGIN ---
const LoginScreen = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        console.log("LOGIN: Intentando iniciar sesión con el email:", email);
        try {
            await onLogin(email, password);
            // El listener onAuthStateChanged se encargará de la redirección.
        } catch (err) {
            console.error("LOGIN_ERROR:", { code: err.code, message: err.message });
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
                setError("Credenciales incorrectas. Verifica tu email y contraseña.");
            } else {
                setError("Ocurrió un error inesperado al iniciar sesión.");
            }
            setLoading(false);
        }
    };

    return (
         <div className="bg-gray-900 min-h-screen flex items-center justify-center text-white p-4">
            <div className="w-full max-w-md bg-gray-800 p-8 rounded-2xl shadow-2xl animate-modal-in">
                <h1 className="text-3xl font-bold text-center text-orange-500 mb-2">Sistema de Inventario</h1>
                <p className="text-center text-gray-400 mb-8">Inicia sesión para continuar</p>
                <form onSubmit={handleLogin} className="space-y-6">
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo electrónico" className="w-full bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" required />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="w-full bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" required />
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                        {loading ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>
            </div>
        </div>
    );
};


// --- PANTALLA PRINCIPAL DEL INVENTARIO (DASHBOARD) ---
const InventoryDashboard = ({ user, onLogout, db, auth }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('inventory');
    const [modal, setModal] = useState({ type: null, data: null });

    useEffect(() => {
        if (!db) return;
        const itemsCollectionPath = `artifacts/${appId}/public/data/equipos`;
        const q = query(collection(db, itemsCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const itemsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setItems(itemsData);
            setLoading(false);
        }, (error) => {
            console.error("Error al obtener datos del inventario:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [db]);
    
    const handleSaveItem = async (itemData) => {
        const itemsCollectionPath = `artifacts/${appId}/public/data/equipos`;
        const { id, ...dataToSave } = itemData;
        try {
            if (id) {
                const itemRef = doc(db, itemsCollectionPath, id);
                await updateDoc(itemRef, dataToSave);
            } else {
                await addDoc(collection(db, itemsCollectionPath), { ...dataToSave, addedBy: user.uid, createdAt: Timestamp.now() });
            }
            setModal({ type: null, data: null });
        } catch (error) { console.error("Error guardando equipo:", error); }
    };

    const handleDeactivateItem = async (reason) => {
        if (!modal.data?.id) return;
        const itemRef = doc(db, `artifacts/${appId}/public/data/equipos`, modal.data.id);
        await updateDoc(itemRef, { 
            estado: 'De Baja', 
            fecha_baja: Timestamp.now(),
            motivo_baja: reason
        });
        setModal({ type: null, data: null });
    };

    const handleDeleteItem = async (itemId) => {
        if (!itemId) return;
        // Reemplazar window.confirm por un modal de confirmación en el futuro
        const isConfirmed = window.confirm("¿Estás seguro de que quieres eliminar este equipo permanentemente? Esta acción es irreversible.");
        if (isConfirmed) {
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/equipos`, itemId));
        }
    };

    const filteredItems = useMemo(() => items.filter(item => { const catMatch = filterCategory === 'Todos' || item.categoria === filterCategory; const statusMatch = (filterStatus === 'Activos' && item.estado !== 'De Baja') || (filterStatus === 'De Baja' && item.estado === 'De Baja') || filterStatus === 'Todos'; const searchMatch = searchTerm === '' || (item.nombre && item.nombre.toLowerCase().includes(searchTerm.toLowerCase())) || (item.numeroSerial && item.numeroSerial.toLowerCase().includes(searchTerm.toLowerCase())) || (item.numeroInventario && item.numeroInventario.toLowerCase().includes(searchTerm.toLowerCase())); return catMatch && statusMatch && searchMatch; }), [items, filterCategory, filterStatus, searchTerm]);
    const stats = useMemo(() => { const activos = items.filter(item => item.estado !== 'De Baja'); return { total: activos.length, disponibles: activos.filter(item => item.estado === 'Disponible').length, enUso: activos.filter(item => item.estado === 'En Uso').length, deBaja: items.filter(item => item.estado === 'De Baja').length }; }, [items]);
    const categorias = useMemo(() => ['Todos', ...new Set(items.map(item => item.categoria))], [items]);
    const getStatusBadge = (status) => { const statuses = { 'Disponible': "bg-green-600 text-green-100", 'En Uso': "bg-yellow-600 text-yellow-100", 'En Mantenimiento': "bg-purple-600 text-purple-100", 'De Baja': "bg-gray-500 text-gray-100" }; return <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statuses[status] || 'bg-gray-400'}`}>{status}</span>; };
    const StatCard = ({ title, value, icon, color }) => ( <div className="bg-gray-800 p-6 rounded-2xl shadow-lg flex items-center space-x-4 transition-transform duration-300 hover:scale-105"><div className={`p-3 rounded-full ${color}`}>{icon}</div><div><p className="text-gray-400 text-sm font-medium">{title}</p><p className="text-white text-3xl font-bold">{value}</p></div></div> );
    
    return (
        <div className="bg-gray-900 min-h-screen text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                 <header className="flex flex-wrap gap-4 justify-between items-center mb-8">
                    <div><h1 className="text-3xl font-bold text-white">Sistema de Inventario</h1><p className="text-gray-400">Bienvenido, <span className="font-semibold text-orange-400">{user.email}</span> ({user.role})</p></div>
                    <div className="flex items-center gap-4">{user.role === 'Administrador' && ( <button onClick={() => setView('users')} className="flex items-center space-x-2 bg-gray-700 text-white px-5 py-3 rounded-xl font-semibold hover:bg-gray-600 transition-colors"><Users size={20} /><span>Usuarios</span></button> )}<button onClick={() => setModal({ type: 'add', data: null })} className="flex items-center space-x-2 bg-orange-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-orange-500 transition-all duration-300 shadow-lg hover:shadow-orange-500/50"><PlusCircle size={20} /><span>Añadir Equipo</span></button><button onClick={onLogout} className="p-3 bg-gray-700 rounded-xl hover:bg-red-500 transition-colors"><LogOut size={20}/></button></div>
                 </header>

                {view === 'inventory' ? (
                    <div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"><StatCard title="Equipos Activos" value={stats.total} icon={<Box size={24} className="text-white"/>} color="bg-orange-500" /><StatCard title="Disponibles" value={stats.disponibles} icon={<CheckCircle size={24} className="text-white"/>} color="bg-green-500" /><StatCard title="En Uso" value={stats.enUso} icon={<Users size={24} className="text-white"/>} color="bg-yellow-500" /><StatCard title="Dados de Baja" value={stats.deBaja} icon={<Archive size={24} className="text-white"/>} color="bg-gray-600" /></div>
                        <div className="bg-gray-800 p-4 rounded-xl mb-6 flex flex-col md:flex-row items-center gap-4"><input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-1/3 bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"/><div className="flex-grow"></div><select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full md:w-auto bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white">{categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full md:w-auto bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"><option value="Activos">Activos</option><option value="De Baja">De Baja</option><option value="Todos">Todos</option></select></div>
                        <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-gray-700/50"><tr><th className="p-4">Nombre</th><th className="p-4">Nº Inventario</th><th className="p-4">Categoría</th><th className="p-4">Estado</th><th className="p-4 text-center">Acciones</th></tr></thead>
                                <tbody>{loading ? <tr><td colSpan="5" className="text-center p-8">Cargando equipos...</td></tr> : filteredItems.map((item) => ( <tr key={item.id} className="border-b border-gray-700 hover:bg-gray-700/50"><td className="p-4 font-medium text-white">{item.nombre}</td><td className="p-4">{item.numeroInventario}</td><td className="p-4">{item.categoria}</td><td className="p-4">{getStatusBadge(item.estado)}</td><td className="p-4"><div className="flex justify-center items-center space-x-3"><button onClick={() => setModal({ type: 'history', data: item })} className="text-blue-400 hover:text-blue-300"><History size={18}/></button><button onClick={() => setModal({ type: 'edit', data: item })} className="text-orange-400 hover:text-orange-300"><Edit size={18}/></button>{item.estado !== 'De Baja' && (<button onClick={() => setModal({ type: 'deactivate', data: item })} className="text-yellow-400 hover:text-yellow-300"><Archive size={18}/></button>)}<button onClick={() => handleDeleteItem(item.id)} className="text-red-400 hover:text-red-300"><Trash2 size={18}/></button></div></td></tr> ))}</tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <UserManagement db={db} auth={auth} onBack={() => setView('inventory')} />
                )}
            </div>
            
            <ItemFormModal isOpen={modal.type === 'add' || modal.type === 'edit'} onClose={() => setModal({ type: null, data: null })} onSave={handleSaveItem} currentItem={modal.data} />
            <HistoryModal isOpen={modal.type === 'history'} onClose={() => setModal({ type: null, data: null })} item={modal.data} />
            <DeactivateModal isOpen={modal.type === 'deactivate'} onClose={() => setModal({ type: null, data: null })} onDeactivate={handleDeactivateItem} />
            
            <style>{`.animate-modal-in { animation: fadeInScale 0.3s ease-out forwards; } @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
        </div>
    );
};


// --- COMPONENTE PRINCIPAL QUE GESTIONA LA APP ---
export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    const [configError, setConfigError] = useState(false);

    useEffect(() => {
        if (!firebaseConfig) {
            console.error("Configuración de Firebase no encontrada.");
            setConfigError(true);
            setLoading(false);
            return;
        }
        try {
            const app = initializeApp(firebaseConfig);
            setAuth(getAuth(app));
            setDb(getFirestore(app));
        } catch(e) {
            console.error("Error inicializando Firebase:", e);
            setConfigError(true);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!auth || !db) {
            if (!auth) setLoading(false);
            return;
        };

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            console.log("AUTH_STATE_CHANGED: Usuario detectado ->", firebaseUser?.uid);
            if (firebaseUser) {
                const userDocRef = doc(db, "users", firebaseUser.uid);
                try {
                    console.log(`Buscando rol para UID: ${firebaseUser.uid}`);
                    const userDoc = await getDoc(userDocRef);
                    const role = userDoc.exists() ? userDoc.data().role : 'Lector';
                    console.log(`Rol encontrado: ${role}. Estableciendo estado del usuario.`);
                    setUser({ ...firebaseUser, role });
                } catch (e) {
                    console.error("Error al obtener el rol del usuario:", e);
                    setUser({ ...firebaseUser, role: 'Lector' }); // Fallback
                }
            } else {
                console.log("No hay usuario, estableciendo a null.");
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [auth, db]);

    const handleLogin = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };
    const handleLogout = () => signOut(auth);

    if (loading) {
        return <div className="bg-gray-900 h-screen flex justify-center items-center text-white text-xl">Cargando...</div>;
    }

    if (configError) {
        return <ConfigErrorScreen />;
    }

    return (
        <>
            {user ? (
                <InventoryDashboard user={user} onLogout={handleLogout} db={db} auth={auth} />
            ) : (
                <LoginScreen onLogin={handleLogin} />
            )}
        </>
    );
}


// --- MODALES ESPECÍFICOS ---
const ItemFormModal = ({ isOpen, onClose, onSave, currentItem }) => { const [item, setItem] = useState({}); const categorias = ["Periféricos", "Monitores", "Laptops", "CPU", "Cámaras", "Luces", "Audio", "Otros"]; useEffect(() => { if (isOpen) { const initialData = currentItem ? { ...currentItem, fechaIngreso: currentItem.fechaIngreso?.toDate().toISOString().split('T')[0] || '' } : { nombre: '', categoria: categorias[0], estado: 'Disponible', fechaIngreso: new Date().toISOString().split('T')[0], numeroSerial: '', numeroInventario: '', observaciones: '' }; setItem(initialData); } }, [isOpen, currentItem]); const handleChange = (e) => setItem(prev => ({ ...prev, [e.target.name]: e.target.value })); const handleSave = (e) => { e.preventDefault(); const { id, ...dataToSave } = item; const finalData = { ...dataToSave, fechaIngreso: Timestamp.fromDate(new Date(item.fechaIngreso)) }; onSave({ ...finalData, id }); }; return ( <Modal isOpen={isOpen} onClose={onClose} title={currentItem ? 'Modificar Equipo' : 'Añadir Nuevo Equipo'}><form onSubmit={handleSave} className="space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><input name="nombre" value={item.nombre || ''} onChange={handleChange} placeholder="Nombre del Equipo" className="bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" required /><select name="categoria" value={item.categoria || ''} onChange={handleChange} className="bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">{categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select><input name="numeroSerial" value={item.numeroSerial || ''} onChange={handleChange} placeholder="Número de Serial" className="bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" /><input name="numeroInventario" value={item.numeroInventario || ''} onChange={handleChange} placeholder="Número de Inventario" className="bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" required /><input type="date" name="fechaIngreso" value={item.fechaIngreso || ''} onChange={handleChange} className="bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" required /><select name="estado" value={item.estado || 'Disponible'} onChange={handleChange} className="bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"><option value="Disponible">Disponible</option><option value="En Uso">En Uso</option><option value="En Mantenimiento">En Mantenimiento</option></select><textarea name="observaciones" value={item.observaciones || ''} onChange={handleChange} placeholder="Observaciones" className="bg-gray-700 p-3 rounded-lg md:col-span-2 h-24 focus:outline-none focus:ring-2 focus:ring-orange-500" /></div><div className="flex justify-end space-x-4 pt-4"><button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 transition-colors">Cancelar</button><button type="submit" className="px-6 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 font-semibold transition-colors">Guardar</button></div></form></Modal> ); };
const HistoryModal = ({ isOpen, onClose, item }) => { return ( <Modal isOpen={isOpen} onClose={onClose} title={`Historial de ${item?.nombre}`}><div className="space-y-4 text-gray-300"><p><span className="font-semibold text-gray-100">Observaciones Generales:</span> {item?.observaciones || 'Ninguna.'}</p>{item?.estado === 'De Baja' && ( <div className="bg-yellow-900/50 p-4 rounded-lg border border-yellow-700"><h4 className="font-bold text-yellow-300">Información de Baja</h4><p><span className="font-semibold">Fecha:</span> {item.fecha_baja?.toDate().toLocaleString()}</p><p><span className="font-semibold">Motivo:</span> {item.motivo_baja || 'No especificado.'}</p></div> )}<p className="italic text-sm text-center pt-4">La función de historial de asignaciones se implementará en una futura versión.</p></div></Modal> ); };
const DeactivateModal = ({ isOpen, onClose, onDeactivate }) => { const [reason, setReason] = useState(''); const handleConfirm = () => { if (!reason) { alert("Por favor, especifica un motivo para la baja."); return; } onDeactivate(reason); }; return ( <Modal isOpen={isOpen} onClose={onClose} title="Dar de Baja Equipo"><div className="space-y-4"><p>Por favor, especifica el motivo para dar de baja este equipo.</p><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: Pantalla rota, equipo obsoleto..." className="w-full bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 h-28" required/><div className="flex justify-end space-x-4 pt-2"><button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 transition-colors">Cancelar</button><button onClick={handleConfirm} className="px-6 py-2 rounded-lg bg-yellow-600 hover:bg-yellow-500 font-semibold transition-colors">Confirmar Baja</button></div></div></Modal> ); };
const UserManagement = ({ db, auth, onBack }) => { return ( <div className="animate-modal-in"> <header className="flex justify-between items-center mb-8"><div><h1 className="text-3xl font-bold text-white">Administración de Usuarios</h1><p className="text-gray-400">Esta sección es una simulación visual.</p></div></header> <div className="bg-gray-800 p-6 rounded-xl text-center text-gray-300"> <p>La gestión de usuarios real se implementará con Cloud Functions por seguridad.</p> <button onClick={onBack} className="mt-8 px-6 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 transition-colors">Volver al Inventario</button> </div> </div> ); }
