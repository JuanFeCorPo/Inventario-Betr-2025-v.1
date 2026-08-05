// ─────────────────────────────────────────────
//  src/hooks/useDismissedAlerts.js
//  Alertas descartadas, compartidas entre todos los usuarios vía Firestore
//  (ver src/utils/dismissedAlerts.js para cuándo vuelven a aparecer).
// ─────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore';
import { DISMISSED_ALERTS_PATH } from '../config/firebase';

const useDismissedAlerts = (db, user) => {
  const [dismissedMap, setDismissedMap] = useState({});

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      collection(db, DISMISSED_ALERTS_PATH),
      snap => {
        const next = {};
        snap.docs.forEach(d => { next[d.id] = d.data().dismissedAt?.toMillis?.() ?? 0; });
        setDismissedMap(next);
      },
      () => {},
    );
    return unsub;
  }, [db]);

  const dismissAlert = async (alertId) => {
    await setDoc(doc(db, DISMISSED_ALERTS_PATH, alertId), {
      dismissedAt: Timestamp.now(),
      dismissedBy: user?.email ?? '',
    });
  };

  return { dismissedMap, dismissAlert };
};

export default useDismissedAlerts;
