// ─────────────────────────────────────────────
//  src/hooks/useInventory.js
//  Toda la lógica de Firestore en un solo hook:
//  lectura en tiempo real + CRUD de equipos
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import {
  collection, doc, getDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, Timestamp, arrayUnion, writeBatch,
} from 'firebase/firestore';
import { EQUIPOS_PATH, EQUIPOS_ELIMINADOS_PATH } from '../config/firebase';

const useInventory = (db, user) => {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Suscripción en tiempo real ───────────────
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, EQUIPOS_PATH));
    const unsub = onSnapshot(
      q,
      snapshot => {
        setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [db]);

  // ── Crear / Editar equipo ────────────────────
  const saveItem = async (itemData, motivoEstado) => {
    const { id, ...data } = itemData;

    // Un equipo deja de considerarse "Nuevo" en cuanto se asigna a alguien,
    // aunque luego vuelva a quedar "Disponible" (ej. renuncia de un colaborador).
    if (data.estado === 'En Uso' && data.condicion === 'Nuevo') {
      data.condicion = 'Usado';
    }

    if (id) {
      const ref      = doc(db, EQUIPOS_PATH, id);
      const snap     = await getDoc(ref);
      const oldData  = snap.data();
      const changes  = [];

      for (const key in data) {
        if (key === 'history') continue;
        const oldVal = oldData[key];
        const newVal = data[key];
        if (newVal instanceof Timestamp && oldVal instanceof Timestamp) {
          if (!newVal.isEqual(oldVal))
            changes.push({ field: key, from: oldVal.toDate().toLocaleDateString(), to: newVal.toDate().toLocaleDateString() });
        } else if (newVal !== oldVal) {
          changes.push({ field: key, from: oldVal ?? '', to: newVal ?? '' });
        }
      }

      let action = 'Equipo modificado.';
      if (motivoEstado?.trim() && changes.some(c => c.field === 'estado')) {
        action += `\nMotivo del cambio de estado: ${motivoEstado.trim()}`;
      }
      const entry = { timestamp: Timestamp.now(), user: user.email, action, changes };
      await updateDoc(ref, { ...data, history: arrayUnion(entry) });
    } else {
      const entry = { timestamp: Timestamp.now(), user: user.email, action: 'Equipo creado en el inventario.' };
      await addDoc(collection(db, EQUIPOS_PATH), {
        ...data,
        addedBy: user.uid,
        createdAt: Timestamp.now(),
        history: [entry],
      });
    }
  };

  // ── Dar de baja ──────────────────────────────
  const deactivateItem = async (id, reason, fecha) => {
    const ref            = doc(db, EQUIPOS_PATH, id);
    const fechaTimestamp = Timestamp.fromDate(new Date(fecha));
    const entry = {
      timestamp: Timestamp.now(),
      user: user.email,
      action: `Equipo dado de baja.\nMotivo: ${reason}`,
      fechaBaja: fechaTimestamp,
    };
    await updateDoc(ref, {
      estado: 'De Baja',
      fecha_baja: fechaTimestamp,
      motivo_baja: reason,
      history: arrayUnion(entry),
    });
  };

  // ── Agregar nota (no toca observaciones) ─────
  const addNote = async (id, note) => {
    const entry = { timestamp: Timestamp.now(), user: user.email, action: `Nota: ${note}` };
    await updateDoc(doc(db, EQUIPOS_PATH, id), { history: arrayUnion(entry) });
  };

  // ── Importar en lote desde Excel ─────────────
  const importItems = async (rows) => {
    const BATCH_SIZE = 450; // margen bajo el límite de 500 operaciones/lote de Firestore
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      rows.slice(i, i + BATCH_SIZE).forEach(row => {
        const entry = { timestamp: Timestamp.now(), user: user.email, action: 'Equipo importado desde Excel.' };
        const ref = doc(collection(db, EQUIPOS_PATH));
        batch.set(ref, {
          ...row,
          fechaIngreso: Timestamp.fromDate(new Date(row.fechaIngreso)),
          addedBy: user.uid,
          createdAt: Timestamp.now(),
          history: [entry],
        });
      });
      await batch.commit();
    }
  };

  // ── Eliminar (queda registro en equipos_eliminados) ──
  const deleteItem = async (id) => {
    const ref  = doc(db, EQUIPOS_PATH, id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await addDoc(collection(db, EQUIPOS_ELIMINADOS_PATH), {
        ...snap.data(),
        originalId: id,
        deletedBy: user.email,
        deletedAt: Timestamp.now(),
      });
    }
    await deleteDoc(ref);
  };

  return { items, loading, saveItem, deactivateItem, deleteItem, importItems, addNote };
};

export default useInventory;
