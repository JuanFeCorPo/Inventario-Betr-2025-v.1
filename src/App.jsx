import React, { useState, useEffect, useMemo } from 'react';
import { app, firebaseConfig } from './firebase';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  Timestamp
} from 'firebase/firestore';
import { CheckCircle, PlusCircle, AlertTriangle, Edit, Trash2, Box, Users, Archive, UserPlus } from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
import { app, firebaseConfig } from './firebase';

const auth = getAuth(app);
const db = getFirestore(app);

// --- COMPONENTES DE LA UI ---

const StatCard = ({ title, value, icon, color }) => (
    <div className="bg-gray-800 p-6 rounded-2xl shadow-lg flex items-center space-x-4 transition-transform duration-300 hover:scale-105">
        <div className={`p-3 rounded-full ${color}`}>
            {icon}
        </div>
        <div>
            <p className="text-gray-400 text-sm font-medium">{title}</p>
            <p className="text-white text-3xl font-bold">{value}</p>
        </div>
    </div>
);

const ItemModal = ({ isOpen, onClose, onSave, currentItem }) => {
    const [item, setItem] = useState({});
    const categorias = ["Periféricos", "Monitores", "Laptops", "CPU", "Cámaras", "Luces", "Audio", "Otros"];

    useEffect(() => {
        if (currentItem) {
            const formattedItem = { ...currentItem };
            if (currentItem.fechaIngreso && currentItem.fechaIngreso.toDate) {
                formattedItem.fechaIngreso = currentItem.fechaIngreso.toDate().toISOString().split('T')[0];
            }
            setItem(formattedItem);
        } else {
            setItem({
                nombre: '', categoria: categorias[0], numeroSerial: '', numeroInventario: '',
                observaciones: '', fechaIngreso: new Date().toISOString().split('T')[0], estado: 'Disponible',
            });
        }
    }, [currentItem, isOpen]);

    if (!isOpen) return null;
    const handleChange = (e) => setItem(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleSave = (e) => {
        e.preventDefault();
        const dataToSave = { ...item };
        if (dataToSave.fechaIngreso) dataToSave.fechaIngreso = Timestamp.fromDate(new Date(dataToSave.fechaIngreso));
        onSave(dataToSave);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 animate-modal-in">
            <div className="bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-2xl text-white">
                <h2 className="text-2xl font-bold mb-6">{currentItem ? 'Modificar Equipo' : 'Añadir Nuevo Equipo'}</h2>
                <form onSubmit={handleSave}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <input name="nombre" value={item.nombre || ''} onChange={handleChange} placeholder="Nombre del Equipo" className="bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" required />
                        <select name="categoria" value={item.categoria || ''} onChange={handleChange} className="bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">{categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
                        <input name="numeroSerial" value={item.numeroSerial || ''} onChange={handleChange} placeholder="Número de Serial" className="bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" />
                        <input name="numeroInventario" value={item.numeroInventario || ''} onChange={handleChange} placeholder="Número de Inventario" className="bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" required />
                        <input type="date" name="fechaIngreso" value={item.fechaIngreso || ''} onChange={handleChange} className="bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" required />
                        <select name="estado" value={item.estado || 'Disponible'} onChange={handleChange} className="bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"><option value="Disponible">Disponible</option><option value="En Uso">En Uso</option><option value="En Mantenimiento">En Mantenimiento</option></select>
                        <textarea name="observaciones" value={item.observaciones || ''} onChange={handleChange} placeholder="Observaciones" className="bg-gray-700 p-3 rounded-lg md:col-span-2 h-24 focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                    <div className="flex justify-end space-x-4 mt-8">
                        <button type="button" onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 transition-colors">Cancelar</button>
                        <button type="submit" className="px-6 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 font-semibold transition-colors">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 animate-modal-in">
            <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-white shadow-2xl">
                <div className="flex items-center space-x-3 mb-4"><AlertTriangle className="text-yellow-400" size={24} /><h3 className="text-xl font-bold">{title}</h3></div>
                <p className="text-gray-300 mb-6">{message}</p>
                <div className="flex justify-end space-x-4">
                    <button onClick={onClose} className="px-5 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 transition-colors">Cancelar</button>
                    <button onClick={onConfirm} className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 font-semibold transition-colors">Confirmar</button>
                </div>
            </div>
        </div>
    );
}

// --- Componente para la gestión de usuarios (Simulado) ---
const UserManagement = ({ onBack }) => {
    // ESTO ES DATA SIMULADA. En una app real, vendría de Firestore.
    const [users, setUsers] = useState([
        { id: 1, nombre: 'Admin Principal', email: 'admin@empresa.com', rol: 'Administrador' },
        { id: 2, nombre: 'Gestor de Contenido', email: 'gestor@empresa.com', rol: 'Gestor' },
        { id: 3, nombre: 'Usuario de Consulta', email: 'lector@empresa.com', rol: 'Lector' },
    ]);

    const getRoleBadge = (role) => {
        const roles = {
            'Administrador': 'bg-red-500 text-red-100',
            'Gestor': 'bg-orange-500 text-orange-100',
            'Lector': 'bg-gray-500 text-gray-100'
        }
        return <span className={`px-3 py-1 text-xs font-semibold rounded-full ${roles[role] || 'bg-gray-400'}`}>{role}</span>
    }

    return (
        <div className="animate-modal-in">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">Administración de Usuarios</h1>
                    <p className="text-gray-400">Crea y gestiona los roles de acceso al sistema.</p>
                </div>
                <button onClick={() => alert("Función para crear usuario no implementada en este entorno.")} className="flex items-center space-x-2 bg-orange-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-orange-500 transition-all duration-300 shadow-lg hover:shadow-orange-500/50">
                    <UserPlus size={20} />
                    <span>Crear Usuario</span>
                </button>
            </header>
             <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-700/50">
                        <tr>
                            <th className="p-4 text-sm font-semibold text-gray-300">Nombre</th>
                            <th className="p-4 text-sm font-semibold text-gray-300">Email</th>
                            <th className="p-4 text-sm font-semibold text-gray-300">Rol</th>
                            <th className="p-4 text-sm font-semibold text-gray-300 text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                                <td className="p-4 text-white font-medium">{user.nombre}</td>
                                <td className="p-4">{user.email}</td>
                                <td className="p-4">{getRoleBadge(user.rol)}</td>
                                <td className="p-4">
                                    <div className="flex justify-center items-center space-x-3">
                                        <button className="text-orange-400 hover:text-orange-300 transition-colors"><Edit size={18}/></button>
                                        <button className="text-red-400 hover:text-red-300 transition-colors"><Trash2 size={18}/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button onClick={onBack} className="mt-8 px-6 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 transition-colors">Volver al Inventario</button>
        </div>
    );
}


// --- COMPONENTE PRINCIPAL DE LA APLICACIÓN ---
export default function App() {
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState([]);
    const [view, setView] = useState('inventory'); // 'inventory' o 'users'
    const [showModal, setShowModal] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirmAction, setConfirmAction] = useState({ action: null, item: null });
    const [filterCategory, setFilterCategory] = useState('Todos');
    const [filterStatus, setFilterStatus] = useState('Activos');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        try {
            
            const authInstance = getAuth(app);
            const dbInstance = getFirestore(app);
            setDb(dbInstance);

            const unsubscribe = onAuthStateChanged(authInstance, async (currentUser) => {
                if (currentUser) {
                    setUserId(currentUser.uid);
                } else {
                    const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                    if (token) {
                        await signInWithCustomToken(authInstance, token);
                    } else {
                        await signInAnonymously(authInstance);
                    }
                }
                setLoading(false);
            });
            return () => unsubscribe();
        } catch (error) { 
            console.error("Error inicializando Firebase:", error); 
            setLoading(false); 
        }
    }, []);
    
    useEffect(() => {
        if (!db || !userId) return;
        const itemsCollectionPath = `artifacts/${firebaseConfig.appId}/users/${userId}/equipos`;
        const q = query(collection(db, itemsCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const itemsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            itemsData.sort((a, b) => (b.fechaIngreso?.toDate() || 0) - (a.fechaIngreso?.toDate() || 0));
            setItems(itemsData);
        }, (error) => console.error("Error al obtener datos de Firestore:", error));
        return () => unsubscribe();
    }, [db, userId, appId]);

    const handleSaveItem = async (itemData) => {
        if (!db || !userId) return;
        const itemsCollectionPath = `artifacts/${firebaseConfig.appId}/users/${userId}/equipos`;
        try {
            if (itemData.id) {
                const itemRef = doc(db, itemsCollectionPath, itemData.id);
                const { id, ...dataToUpdate } = itemData;
                await updateDoc(itemRef, dataToUpdate);
            } else {
                await addDoc(collection(db, itemsCollectionPath), { ...itemData, fecha_salida: null, fecha_baja: null });
            }
            setShowModal(false); setCurrentItem(null);
        } catch (error) { console.error("Error guardando el equipo:", error); }
    };
    
    const openAddItemModal = () => { setCurrentItem(null); setShowModal(true); };
    const openEditItemModal = (item) => { setCurrentItem(item); setShowModal(true); };
    const openConfirmDialog = (action, item) => { setConfirmAction({ action, item }); setShowConfirm(true); };
    
    const executeConfirmAction = async () => {
        const { action, item } = confirmAction;
        if (!item || !db) return;
        const itemRef = doc(db, `artifacts/${appId}/users/${userId}/equipos`, item.id);
        try {
            if (action === 'soft-delete') await updateDoc(itemRef, { estado: 'De Baja', fecha_baja: Timestamp.now() });
            else if (action === 'hard-delete') await deleteDoc(itemRef);
        } catch (error) { console.error(`Error en la acción ${action}:`, error); } 
        finally { setShowConfirm(false); setConfirmAction({ action: null, item: null }); }
    };
    
    const filteredItems = useMemo(() => items.filter(item => {
        const catMatch = filterCategory === 'Todos' || item.categoria === filterCategory;
        const statusMatch = (filterStatus === 'Activos' && item.estado !== 'De Baja') || (filterStatus === 'De Baja' && item.estado === 'De Baja') || filterStatus === 'Todos';
        const searchMatch = searchTerm === '' || item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (item.numeroSerial && item.numeroSerial.toLowerCase().includes(searchTerm.toLowerCase())) || item.numeroInventario.toLowerCase().includes(searchTerm.toLowerCase());
        return catMatch && statusMatch && searchMatch;
    }), [items, filterCategory, filterStatus, searchTerm]);
    
    const stats = useMemo(() => {
        const activos = items.filter(item => item.estado !== 'De Baja');
        return { total: activos.length, disponibles: activos.filter(item => item.estado === 'Disponible').length, enUso: activos.filter(item => item.estado === 'En Uso').length, deBaja: items.filter(item => item.estado === 'De Baja').length };
    }, [items]);

    const categorias = useMemo(() => ['Todos', ...new Set(items.map(item => item.categoria))], [items]);
    
    const getStatusBadge = (status) => {
        const statuses = {
            'Disponible': "bg-green-600 text-green-100", 'En Uso': "bg-yellow-600 text-yellow-100",
            'En Mantenimiento': "bg-purple-600 text-purple-100", 'De Baja': "bg-gray-500 text-gray-100"
        };
        return <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statuses[status] || 'bg-gray-400'}`}>{status}</span>;
    };
    
    if (loading) return <div className="bg-gray-900 h-screen flex justify-center items-center text-white text-xl">Cargando Sistema de Inventario...</div>;

    return (
        <div className="bg-gray-900 min-h-screen text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                {view === 'inventory' ? (
                    <div className="animate-modal-in">
                        <header className="flex flex-wrap gap-4 justify-between items-center mb-8">
                            <div>
                                <h1 className="text-3xl font-bold text-white">Sistema de Inventario</h1>
                                <p className="text-gray-400">Panel de gestión para equipos de marketing.</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <button onClick={() => setView('users')} className="flex items-center space-x-2 bg-gray-700 text-white px-5 py-3 rounded-xl font-semibold hover:bg-gray-600 transition-colors">
                                    <Users size={20} /><span>Usuarios</span>
                                </button>
                                <button onClick={openAddItemModal} className="flex items-center space-x-2 bg-orange-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-orange-500 transition-all duration-300 shadow-lg hover:shadow-orange-500/50">
                                    <PlusCircle size={20} /><span>Añadir Equipo</span>
                                </button>
                            </div>
                        </header>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <StatCard title="Equipos Activos" value={stats.total} icon={<Box size={24} className="text-white"/>} color="bg-orange-500" />
                            <StatCard title="Disponibles" value={stats.disponibles} icon={<CheckCircle size={24} className="text-white"/>} color="bg-green-500" />
                            <StatCard title="En Uso" value={stats.enUso} icon={<Users size={24} className="text-white"/>} color="bg-yellow-500" />
                            <StatCard title="Dados de Baja" value={stats.deBaja} icon={<Archive size={24} className="text-white"/>} color="bg-gray-600" />
                        </div>
                        <div className="bg-gray-800 p-4 rounded-xl mb-6 flex flex-col md:flex-row items-center gap-4">
                            <input type="text" placeholder="Buscar por nombre, serial o inventario..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full md:w-1/3 bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"/>
                            <div className="flex-grow"></div>
                            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full md:w-auto bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white">{categorias.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select>
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full md:w-auto bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-white"><option value="Activos">Activos</option><option value="De Baja">De Baja</option><option value="Todos">Todos</option></select>
                        </div>
                        <div className="bg-gray-800 rounded-xl shadow-lg overflow-hidden">
                            <div className="overflow-x-auto">
                               <table className="w-full text-left">
                                    <thead className="bg-gray-700/50"><tr><th className="p-4 text-sm font-semibold text-gray-300">Nombre</th><th className="p-4 text-sm font-semibold text-gray-300">Nº Inventario</th><th className="p-4 text-sm font-semibold text-gray-300">Nº Serial</th><th className="p-4 text-sm font-semibold text-gray-300">Categoría</th><th className="p-4 text-sm font-semibold text-gray-300">Fecha Ingreso</th><th className="p-4 text-sm font-semibold text-gray-300">Estado</th><th className="p-4 text-sm font-semibold text-gray-300 text-center">Acciones</th></tr></thead>
                                    <tbody>
                                        {filteredItems.length > 0 ? filteredItems.map((item) => (
                                            <tr key={item.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                                                <td className="p-4 text-white font-medium">{item.nombre}</td><td className="p-4">{item.numeroInventario}</td><td className="p-4">{item.numeroSerial}</td><td className="p-4">{item.categoria}</td><td className="p-4">{item.fechaIngreso?.toDate().toLocaleDateString()}</td><td className="p-4">{getStatusBadge(item.estado)}</td>
                                                <td className="p-4"><div className="flex justify-center items-center space-x-3"><button onClick={() => openEditItemModal(item)} className="text-orange-400 hover:text-orange-300"><Edit size={18}/></button>{item.estado !== 'De Baja' && (<button onClick={() => openConfirmDialog('soft-delete', item)} className="text-yellow-400 hover:text-yellow-300"><Archive size={18}/></button>)}<button onClick={() => openConfirmDialog('hard-delete', item)} className="text-red-400 hover:text-red-300"><Trash2 size={18}/></button></div></td>
                                            </tr>
                                        )) : (<tr><td colSpan="7" className="text-center p-8 text-gray-400">No se encontraron equipos.</td></tr>)}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <UserManagement onBack={() => setView('inventory')} />
                )}
            </div>
            <ItemModal isOpen={showModal} onClose={() => setShowModal(false)} onSave={handleSaveItem} currentItem={currentItem} />
            <ConfirmDialog isOpen={showConfirm} onClose={() => setShowConfirm(false)} onConfirm={executeConfirmAction} title={confirmAction.action === 'soft-delete' ? 'Dar de Baja Equipo' : 'Eliminar Equipo'} message={confirmAction.action === 'soft-delete' ? `El equipo será marcado como 'De Baja' y se ocultará, pero no se eliminará.` : `¡ADVERTENCIA! Esta acción es irreversible y eliminará permanentemente el equipo.`}/>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
                body { font-family: 'Inter', sans-serif; }
                .animate-modal-in { animation: fadeInScale 0.3s ease-out forwards; }
                @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                ::-webkit-scrollbar { width: 8px; height: 8px; } ::-webkit-scrollbar-track { background: #1f2937; } ::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 10px; } ::-webkit-scrollbar-thumb:hover { background: #6b7280; }
            `}</style>
        </div>
    );
}