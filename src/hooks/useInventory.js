// ─────────────────────────────────────────────
//  src/hooks/useInventory.js
//  Toda la lógica de Firestore en un solo hook:
//  lectura en tiempo real + CRUD de equipos
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, Timestamp, writeBatch,
} from 'firebase/firestore';
import { EQUIPOS_PATH, EQUIPOS_ELIMINADOS_PATH } from '../config/firebase';

const HISTORIAL = 'historial';

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
  // La primera entrada ("Equipo creado…") no se escribe en el historial:
  // se sintetiza en la UI a partir de createdAt/addedByEmail. Esto deja
  // que Lector cree equipos sin necesitar permiso de escritura en historial
  // (reservado a Administrador para ediciones, bajas y notas reales).
  const saveItem = async (itemData, motivoEstado) => {
    const { id, ...data } = itemData;

    // Un equipo deja de considerarse "Nuevo" en cuanto se asigna a alguien,
    // aunque luego vuelva a quedar "Disponible" (ej. renuncia de un colaborador).
    if (data.estado === 'En Uso' && data.condicion === 'Nuevo') {
      data.condicion = 'Usado';
    }

    if (id) {
      // El historial legado (si el equipo aún lo tiene embebido) llega en `data`
      // porque el formulario parte de una copia de currentItem — nunca debe
      // volver a escribirse ni entrar en el diff, solo vive de forma pasiva.
      delete data.history;

      const ref      = doc(db, EQUIPOS_PATH, id);
      const snap     = await getDoc(ref);
      const oldData  = snap.data();
      const changes  = [];

      for (const key in data) {
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
      await updateDoc(ref, data);
      if (changes.length > 0) {
        const entry = { timestamp: Timestamp.now(), user: user.email, action, changes };
        await addDoc(collection(db, EQUIPOS_PATH, id, HISTORIAL), entry);
      }
    } else {
      await addDoc(collection(db, EQUIPOS_PATH), {
        ...data,
        addedBy: user.uid,
        addedByEmail: user.email,
        createdAt: Timestamp.now(),
      });
    }
  };

  // ── Dar de baja ──────────────────────────────
  const deactivateItem = async (id, reason, fecha) => {
    const ref            = doc(db, EQUIPOS_PATH, id);
    const fechaTimestamp = Timestamp.fromDate(new Date(fecha));
    await updateDoc(ref, {
      estado: 'De Baja',
      fecha_baja: fechaTimestamp,
      motivo_baja: reason,
    });
    const entry = {
      timestamp: Timestamp.now(),
      user: user.email,
      action: `Equipo dado de baja.\nMotivo: ${reason}`,
      fechaBaja: fechaTimestamp,
    };
    await addDoc(collection(db, EQUIPOS_PATH, id, HISTORIAL), entry);
  };

  // ── Agregar nota (no toca observaciones) ─────
  const addNote = async (id, note) => {
    const entry = { timestamp: Timestamp.now(), user: user.email, action: `Nota: ${note}` };
    await addDoc(collection(db, EQUIPOS_PATH, id, HISTORIAL), entry);
  };

  // ── Importar en lote desde Excel ─────────────
  const importItems = async (rows) => {
    const BATCH_SIZE = 200; // cada fila implica 2 escrituras (equipo + historial); margen bajo el límite de 500/lote
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      rows.slice(i, i + BATCH_SIZE).forEach(row => {
        const ref = doc(collection(db, EQUIPOS_PATH));
        batch.set(ref, {
          ...row,
          fechaIngreso: Timestamp.fromDate(new Date(row.fechaIngreso)),
          addedBy: user.uid,
          addedByEmail: user.email,
          createdAt: Timestamp.now(),
        });
        const historialRef = doc(collection(db, EQUIPOS_PATH, ref.id, HISTORIAL));
        batch.set(historialRef, { timestamp: Timestamp.now(), user: user.email, action: 'Equipo importado desde Excel.' });
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
    const historialSnap = await getDocs(collection(db, EQUIPOS_PATH, id, HISTORIAL));
    if (!historialSnap.empty) {
      const cleanupBatch = writeBatch(db);
      historialSnap.docs.forEach(d => cleanupBatch.delete(d.ref));
      await cleanupBatch.commit();
    }
    await deleteDoc(ref);
  };

  return { items, loading, saveItem, deactivateItem, deleteItem, importItems, addNote };
};

export default useInventory;
