// ─────────────────────────────────────────────
//  Lista de personas a cargo, como colección propia en vez de texto
//  libre repetido en cada equipo — evita que el mismo nombre quede
//  escrito de formas distintas con el tiempo.
// ─────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { collection, doc, setDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ENCARGADOS_PATH } from '../config/firebase';

const normalize = (s) => (s ?? '').toString().trim();
const slugify   = (s) => normalize(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');

const useEncargados = (db) => {
  const [encargados, setEncargados] = useState([]);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(
      query(collection(db, ENCARGADOS_PATH), orderBy('nombre')),
      snap => setEncargados(snap.docs.map(d => d.data().nombre)),
      () => {},
    );
    return unsub;
  }, [db]);

  // Idempotente: el id es un slug del nombre, así que agregar el mismo
  // nombre dos veces (o con espacios/mayúsculas distintas) no duplica.
  const addEncargado = async (nombre) => {
    const clean = normalize(nombre);
    if (!clean) return;
    const id = slugify(clean);
    if (!id || encargados.some(e => slugify(e) === id)) return;
    await setDoc(doc(db, ENCARGADOS_PATH, id), { nombre: clean });
  };

  return { encargados, addEncargado };
};

export default useEncargados;
