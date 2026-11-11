// ─────────────────────────────────────────────
//  Solicitudes de soporte (tickets).
//  - useTicketsTI: bandeja de T.I. (tomar, responder, resolver).
//  - useMisTickets / useMiPuesto: lo que ve el colaborador.
//  Al resolver, la solicitud queda en la hoja de vida del puesto
//  (Novedad con quién la reportó + Correctivo con la solución) en el mismo lote.
// ─────────────────────────────────────────────

import { useEffect, useState } from 'react';
import {
  collection, doc, getDoc, onSnapshot, query, where, Timestamp, writeBatch, arrayUnion, serverTimestamp,
} from 'firebase/firestore';
import { TICKETS_PATH, PUESTOS_PATH, EQUIPOS_PATH } from '../config/firebase';
import { codigoTicket, tituloTicket } from '../utils/tickets';
import { partirBase64, unirPartes, base64ABlob } from '../utils/adjuntos';

const HISTORIAL = 'historial';
const now = () => Timestamp.now();
const conId = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

// ── Archivos adjuntos ─────────────────────────
// Cada archivo (base64) va partido en documentos de tickets/{id}/partes, en el mismo lote
// que el mensaje. Devuelve las fichas que se guardan en el mensaje.
const escribirAdjuntos = (db, batch, ticketId, archivos = []) => archivos.map((a) => {
  const partes = partirBase64(a.base64);
  partes.forEach((datos, i) => batch.set(doc(db, TICKETS_PATH, ticketId, 'partes', `${a.id}_${i}`), { archivoId: a.id, orden: i, datos }));
  return { id: a.id, nombre: a.nombre, tipo: a.tipo, tamano: a.tamano, partes: partes.length };
});

// Lee un adjunto y lo devuelve como Blob (para mostrarlo o descargarlo).
export const leerAdjunto = async (db, ticketId, adj) => {
  const snaps = await Promise.all(Array.from({ length: adj.partes }, (_, i) => getDoc(doc(db, TICKETS_PATH, ticketId, 'partes', `${adj.id}_${i}`))));
  if (snaps.some(sn => !sn.exists())) throw new Error('El archivo ya no está disponible.');
  return base64ABlob(unirPartes(snaps.map(sn => sn.data().datos)), adj.tipo);
};

// ── Bandeja de T.I. ───────────────────────────
export const useTicketsTI = (db, user) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) return undefined;
    return onSnapshot(collection(db, TICKETS_PATH),
      snap => { setTickets(conId(snap)); setLoading(false); },
      () => setLoading(false));
  }, [db]);

  const yo = () => user.nombre || user.email;
  const mensaje = (texto, adjuntos = []) => ({ autor: 'ti', nombre: yo(), texto: texto.trim(), fecha: now(), ...(adjuntos.length ? { adjuntos } : {}) });
  const ref = (t) => doc(db, TICKETS_PATH, t.id);
  const equipoLog = (batch, equipoId, action, extra = {}) =>
    batch.set(doc(collection(db, EQUIPOS_PATH, equipoId, HISTORIAL)), { timestamp: now(), user: user.email, action, ...extra });

  const marcarVisto = async (t) => {
    if (t.vistoPorTI === false) {
      const b = writeBatch(db); b.update(ref(t), { vistoPorTI: true }); await b.commit();
    }
  };

  // Tomar: pasa a "En proceso". Si el problema es de un equipo, puede ir a mantenimiento.
  const tomar = async (t, { mantenimiento = false, texto = '' } = {}) => {
    const b = writeBatch(db);
    b.update(ref(t), {
      estado: 'en_proceso', tomadoPor: yo(), actualizado: now(), vistoPorTI: true, vistoPorColaborador: false,
      ...(mantenimiento && t.equipoId ? { equipoEnMantenimiento: true } : {}),
      ...(texto.trim() ? { mensajes: arrayUnion(mensaje(texto)) } : {}),
    });
    if (mantenimiento && t.equipoId) {
      b.update(doc(db, EQUIPOS_PATH, t.equipoId), { estado: 'En Mantenimiento', estadoDesde: now() });
      equipoLog(b, t.equipoId, `En mantenimiento por el ticket ${t.codigo} (${t.creadoPor?.nombre ?? ''}).`);
    }
    await b.commit();
  };

  const responder = async (t, texto, archivos = []) => {
    const b = writeBatch(db);
    const fichas = escribirAdjuntos(db, b, t.id, archivos);
    b.update(ref(t), { mensajes: arrayUnion(mensaje(texto, fichas)), actualizado: now(), vistoPorTI: true, vistoPorColaborador: false });
    await b.commit();
  };

  // Resolver: cierra la solicitud y (si se pide) la registra en la hoja de vida del puesto.
  const resolver = async (t, { solucion, registrarEnHoja = true, estadoEquipo = 'En Uso' }) => {
    const sol = solucion.trim();
    const b = writeBatch(db);
    b.update(ref(t), {
      estado: 'resuelto', solucion: sol, resueltoAt: now(), resueltoPor: yo(), actualizado: now(),
      vistoPorTI: true, vistoPorColaborador: false, equipoEnMantenimiento: false,
      mensajes: arrayUnion({ ...mensaje(sol), resolucion: true }),
    });
    if (registrarEnHoja && t.puestoId) {
      const log = (entry) => b.set(doc(collection(db, PUESTOS_PATH, t.puestoId, HISTORIAL)), {
        responsable: yo(), ...entry, ticketId: t.id, timestamp: now(), user: user.email,
      });
      log({ tipo: 'novedad', fecha: t.creadoAt ?? now(), descripcion: `${tituloTicket(t)}: ${t.descripcion} (ticket ${t.codigo})`, reporta: t.creadoPor?.nombre || t.creadoPor?.email || '' });
      log({ tipo: 'correctivo', fecha: now(), descripcion: sol, ...(t.equipoId ? { equipoId: t.equipoId } : {}) });
    }
    if (t.equipoId) {
      if (t.equipoEnMantenimiento) b.update(doc(db, EQUIPOS_PATH, t.equipoId), { estado: estadoEquipo, estadoDesde: now() });
      equipoLog(b, t.equipoId, `Mantenimiento correctivo (ticket ${t.codigo}).\n${sol}`,
        { tipo: 'correctivo', fecha: now(), descripcion: sol, responsable: yo() });
    }
    await b.commit();
  };

  const reabrir = async (t, texto = '') => {
    const b = writeBatch(db);
    b.update(ref(t), {
      estado: 'en_proceso', actualizado: now(), vistoPorColaborador: false,
      ...(texto.trim() ? { mensajes: arrayUnion(mensaje(texto)) } : {}),
    });
    await b.commit();
  };

  return { tickets, loading, marcarVisto, tomar, responder, resolver, reabrir };
};

// Los tickets abiertos, para los conteos y avisos del encabezado. `loading` evita tomar la
// cola que ya existía al abrir la app como si fueran tickets nuevos.
export const useTicketsPendientes = (db, activo = true) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!db || !activo) return undefined;
    return onSnapshot(query(collection(db, TICKETS_PATH), where('estado', 'in', ['recibido', 'en_proceso'])),
      snap => { setTickets(conId(snap)); setLoading(false); }, () => { setTickets([]); setLoading(false); });
  }, [db, activo]);
  return { tickets, loading };
};

// ── Lo que ve el colaborador ──────────────────
// Sus puestos (su correo está en "correos") y los equipos de cada uno.
export const useMiPuesto = (db, user) => {
  const [puestos, setPuestos] = useState([]);
  const [equipos, setEquipos] = useState({});
  const [loading, setLoading] = useState(true);
  const correo = (user?.email ?? '').toLowerCase();

  useEffect(() => {
    if (!db || !correo) return undefined;
    return onSnapshot(query(collection(db, PUESTOS_PATH), where('correos', 'array-contains', correo)),
      snap => { setPuestos(conId(snap).filter(p => !p.eliminado && !p.archivado)); setLoading(false); },
      () => { setPuestos([]); setLoading(false); });
  }, [db, correo]);

  const ids = puestos.map(p => p.id).join('|');
  useEffect(() => {
    if (!db || !ids) { setEquipos({}); return undefined; }
    // Una consulta por puesto: las reglas solo dejan leer equipos de un puesto propio
    const unsubs = ids.split('|').map(id => onSnapshot(
      query(collection(db, EQUIPOS_PATH), where('puestoId', '==', id)),
      snap => setEquipos(prev => ({ ...prev, [id]: conId(snap).filter(e => e.estado !== 'De Baja') })),
      () => setEquipos(prev => ({ ...prev, [id]: [] })),
    ));
    return () => unsubs.forEach(u => u());
  }, [db, ids]);

  return { puestos, equipos, loading };
};

export const useMisTickets = (db, user) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !user?.uid) return undefined;
    return onSnapshot(query(collection(db, TICKETS_PATH), where('creadoPor.uid', '==', user.uid)),
      snap => { setTickets(conId(snap)); setLoading(false); },
      () => setLoading(false));
  }, [db, user?.uid]);

  const crear = async ({ categoria, puesto, equipo, descripcion, urgencia, archivos = [] }) => {
    const codigo = codigoTicket();
    // Un solo lote: el ticket y los pedazos de sus archivos se guardan juntos o no se guarda nada
    const b = writeBatch(db);
    const ticketRef = doc(collection(db, TICKETS_PATH));
    const fichas = escribirAdjuntos(db, b, ticketRef.id, archivos);
    b.set(ticketRef, {
      codigo,
      creadoPor: { uid: user.uid, email: (user.email ?? '').toLowerCase(), nombre: user.nombre || user.displayName || '' },
      categoria, urgencia,
      puestoId: puesto?.id ?? null, puestoNombre: puesto?.nombre ?? '',
      equipoId: equipo?.id ?? null, equipoNombre: equipo?.nombre ?? '', equipoCodigo: equipo?.numeroInventario ?? '',
      descripcion: descripcion.trim(),
      // Hora del servidor: las reglas verifican que no se pueda inventar
      estado: 'recibido', creadoAt: serverTimestamp(), actualizado: serverTimestamp(),
      mensajes: [], vistoPorTI: false, vistoPorColaborador: true,
      ...(fichas.length ? { adjuntos: fichas } : {}),
    });
    await b.commit();
    return codigo;
  };

  const comentar = async (t, texto, archivos = []) => {
    const b = writeBatch(db);
    const fichas = escribirAdjuntos(db, b, t.id, archivos);
    b.update(doc(db, TICKETS_PATH, t.id), {
      mensajes: arrayUnion({ autor: 'colaborador', nombre: user.nombre || user.email, texto: texto.trim(), fecha: Timestamp.now(), ...(fichas.length ? { adjuntos: fichas } : {}) }),
      actualizado: Timestamp.now(), vistoPorTI: false, vistoPorColaborador: true,
    });
    await b.commit();
  };

  const marcarVisto = async (t) => {
    if (t.vistoPorColaborador === false) {
      const b = writeBatch(db); b.update(doc(db, TICKETS_PATH, t.id), { vistoPorColaborador: true }); await b.commit();
    }
  };

  return { tickets, loading, crear, comentar, marcarVisto };
};
