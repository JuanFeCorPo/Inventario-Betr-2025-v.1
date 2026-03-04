// ─────────────────────────────────────────────
//  src/hooks/useInventory.js
//  Toda la lógica de Firestore en un solo hook:
//  lectura en tiempo real + CRUD de equipos
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import {
  collection, doc, getDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, Timestamp, arrayUnion,
} from 'firebase/firestore';
import { EQUIPOS_PATH } from '../config/firebase';

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
  const saveItem = async (itemData) => {
    const { id, ...data } = itemData;
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

      const entry = { timestamp: Timestamp.now(), user: user.email, action: 'Equipo modificado.', changes };
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

  // ── Eliminar ─────────────────────────────────
  const deleteItem = async (id) => {
    await deleteDoc(doc(db, EQUIPOS_PATH, id));
  };

  return { items, loading, saveItem, deactivateItem, deleteItem };
};

export default useInventory;
