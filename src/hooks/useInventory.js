// ─────────────────────────────────────────────
//  src/hooks/useInventory.js
//  Toda la lógica de Firestore en un solo hook:
//  lectura en tiempo real + CRUD de equipos
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, deleteField, setDoc,
  onSnapshot, query, Timestamp, writeBatch,
} from 'firebase/firestore';
import { EQUIPOS_PATH, EQUIPOS_ELIMINADOS_PATH } from '../config/firebase';
import { formatFecha } from '../utils/format';

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
            changes.push({ field: key, from: formatFecha(oldVal.toDate()), to: formatFecha(newVal.toDate()) });
        } else if (newVal !== oldVal) {
          changes.push({ field: key, from: oldVal ?? '', to: newVal ?? '' });
        }
      }

      let action = 'Equipo modificado.';
      if (motivoEstado?.trim() && changes.some(c => c.field === 'estado')) {
        action += `\nMotivo del cambio de estado: ${motivoEstado.trim()}`;
      }
      // Fecha desde la que el equipo está en su estado actual (alimenta la alerta de estancados)
      if (changes.some(c => c.field === 'estado')) data.estadoDesde = Timestamp.now();
      // Reactivar un equipo dado de baja: la fecha y el motivo de la baja ya no aplican
      if (oldData.estado === 'De Baja' && data.estado && data.estado !== 'De Baja') {
        data.fecha_baja = deleteField();
        data.motivo_baja = deleteField();
        action = action.replace('Equipo modificado.', 'Equipo reactivado tras una baja.');
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
        estadoDesde: Timestamp.now(),
      });
    }
  };

  // ── Dar de baja ──────────────────────────────
  const deactivateItem = async (id, reason, fecha) => {
    const ref            = doc(db, EQUIPOS_PATH, id);
    const fechaTimestamp = Timestamp.fromDate(new Date(fecha));
    await updateDoc(ref, {
      estado: 'De Baja',
      estadoDesde: Timestamp.now(),
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

  // ── Registrar mantenimiento preventivo realizado ──
  const registerMaintenance = async (id, fecha, notas) => {
    const ref             = doc(db, EQUIPOS_PATH, id);
    const fechaTimestamp  = Timestamp.fromDate(new Date(fecha));
    await updateDoc(ref, { ultimoMantenimiento: fechaTimestamp });
    const entry = {
      timestamp: Timestamp.now(),
      user: user.email,
      action: `Mantenimiento preventivo realizado.${notas?.trim() ? `\n${notas.trim()}` : ''}`,
    };
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
          estadoDesde: Timestamp.now(),
        });
        const historialRef = doc(collection(db, EQUIPOS_PATH, ref.id, HISTORIAL));
        batch.set(historialRef, { timestamp: Timestamp.now(), user: user.email, action: 'Equipo importado desde Excel.' });
      });
      await batch.commit();
    }
  };

  // ── Eliminar (queda registro en equipos_eliminados) ──
  // Devuelve una copia (datos + historial) para poder deshacer con restoreItem.
  const deleteItem = async (id) => {
    const ref  = doc(db, EQUIPOS_PATH, id);
    const snap = await getDoc(ref);
    let backup = null;
    if (snap.exists()) {
      const data = snap.data();
      const tombstone = await addDoc(collection(db, EQUIPOS_ELIMINADOS_PATH), {
        ...data,
        originalId: id,
        deletedBy: user.email,
        deletedAt: Timestamp.now(),
      });
      backup = { id, data, history: [], tombstoneId: tombstone.id };
    }
    const historialSnap = await getDocs(collection(db, EQUIPOS_PATH, id, HISTORIAL));
    if (backup) backup.history = historialSnap.docs.map(d => d.data());
    if (!historialSnap.empty) {
      const cleanupBatch = writeBatch(db);
      historialSnap.docs.forEach(d => cleanupBatch.delete(d.ref));
      await cleanupBatch.commit();
    }
    await deleteDoc(ref);
    return backup;
  };

  // ── Deshacer eliminar: vuelve el equipo con su mismo id e historial ──
  const restoreItem = async (backup) => {
    if (!backup) return;
    await setDoc(doc(db, EQUIPOS_PATH, backup.id), backup.data);
    for (const entry of backup.history) {
      await addDoc(collection(db, EQUIPOS_PATH, backup.id, HISTORIAL), entry);
    }
    await addDoc(collection(db, EQUIPOS_PATH, backup.id, HISTORIAL), {
      timestamp: Timestamp.now(),
      user: user.email,
      action: 'Equipo restaurado tras eliminarse por error.',
    });
    await deleteDoc(doc(db, EQUIPOS_ELIMINADOS_PATH, backup.tombstoneId));
  };

  return { items, loading, saveItem, deactivateItem, deleteItem, restoreItem, importItems, addNote, registerMaintenance };
};

export default useInventory;
