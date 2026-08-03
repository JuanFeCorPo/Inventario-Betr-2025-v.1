// ─────────────────────────────────────────────
//  Historial en tiempo real de un equipo, leído desde su
//  subcolección `historial` (ver useInventory.js para el porqué).
// ─────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { EQUIPOS_PATH } from '../config/firebase';

const useEquipoHistorial = (db, equipoId) => {
  const [historial, setHistorial] = useState([]);

  useEffect(() => {
    if (!db || !equipoId) { setHistorial([]); return; }
    const unsub = onSnapshot(
      collection(db, EQUIPOS_PATH, equipoId, 'historial'),
      snap => setHistorial(snap.docs.map(d => d.data())),
      () => setHistorial([]),
    );
    return unsub;
  }, [db, equipoId]);

  return historial;
};

export default useEquipoHistorial;
