// ─────────────────────────────────────────────
//  Puestos de trabajo + hoja de vida.
//  Una sola acción en la app actualiza a la vez el puesto, el equipo
//  y el historial de ambos (antes había que llenarlo en varios sitios).
// ─────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import {
  collection, doc, onSnapshot, query, Timestamp, writeBatch, deleteField,
} from 'firebase/firestore';
import { PUESTOS_PATH, EQUIPOS_PATH } from '../config/firebase';
import { etiquetaEquipo, limpiarPersonas, casillaDe } from '../utils/puestos';

const HISTORIAL = 'historial';
// Encargado que queda en el inventario cuando un equipo sale de un puesto
// (es el valor que ya se usa para los equipos de stock).
export const ENCARGADO_SIN_PUESTO = 'Betrmedia';

// Fecha 'YYYY-MM-DD' del formulario → Timestamp a mediodía local (evita saltos de día por zona horaria).
const fechaATimestamp = (fecha) => {
  const [y, m, d] = fecha.split('-').map(Number);
  return Timestamp.fromDate(new Date(y, m - 1, d, 12));
};

const usePuestos = (db, user) => {
  // Todos los documentos (incluidos los eliminados, que quedan ocultos para poder deshacer)
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(query(collection(db, PUESTOS_PATH)),
      snap => { setTodos(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      () => setLoading(false));
    return unsub;
  }, [db]);

  const puestos = useMemo(() => todos.filter(p => !p.eliminado), [todos]);
  // Para no volver a ofrecer la importación si ya se hizo (aunque luego se eliminen puestos)
  const hayImportados = useMemo(() => todos.some(p => p.origen === 'hoja-de-vida'), [todos]);

  const now = () => Timestamp.now();
  // Devuelve la referencia del registro (Deshacer lo borra).
  const puestoLog = (batch, puestoId, entry) => {
    const ref = doc(collection(db, PUESTOS_PATH, puestoId, HISTORIAL));
    batch.set(ref, { fecha: now(), responsable: user.nombre || user.email, ...entry, timestamp: now(), user: user.email });
    return ref;
  };
  const equipoLog = (batch, equipoId, action, extra = {}) =>
    batch.set(doc(collection(db, EQUIPOS_PATH, equipoId, HISTORIAL)), { timestamp: now(), user: user.email, action, ...extra });

  // Lo que sale de una casilla queda anotado con su casilla: así la hoja de vida
  // lo muestra tachado en la columna correcta (como en el Excel).
  const retiradoDe = (e) => ({ retirado: { equipoId: e.id, codigo: e.numeroInventario ?? '', nombre: e.nombre ?? '', casilla: casillaDe(e) } });

  // ── Deshacer ─────────────────────────────────
  // Cada acción devuelve una función que deja los equipos como estaban y borra
  // los registros que creó en la hoja del puesto (el historial del equipo no se
  // borra: queda la nota "Se deshizo…").
  const CAMPOS_REVERSIBLES = ['puestoId', 'personaEncargada', 'estado', 'estadoDesde', 'condicion', 'casilla'];
  const foto = (e) => ({ id: e.id, ...Object.fromEntries(CAMPOS_REVERSIBLES.map(k => [k, e[k]])) });
  const conDeshacer = (fotos, refs, que) => async () => {
    const batch = writeBatch(db);
    for (const { id, ...antes } of fotos) {
      batch.update(doc(db, EQUIPOS_PATH, id), Object.fromEntries(Object.entries(antes).map(([k, v]) => [k, v === undefined ? deleteField() : v])));
      equipoLog(batch, id, `Se deshizo: ${que}`);
    }
    refs.forEach(r => batch.delete(r));
    await batch.commit();
  };

  // ── Crear / editar puesto ────────────────────
  // Si cambia el nombre, el "Encargado" de sus equipos en el inventario se actualiza también.
  // Devuelve el id del puesto (al crear, la pantalla abre su hoja para armarlo).
  const savePuesto = async ({ id, nombre, area, grupo, grupoOrden, personas, observaciones }, equiposDelPuesto = []) => {
    const data = {
      nombre: nombre.trim(), area,
      grupo: (grupo ?? '').trim(), grupoOrden: grupoOrden ?? 500,
      personas: limpiarPersonas(personas),
      correos: limpiarPersonas(personas).map(p => p.correo).filter(Boolean),
      observaciones: (observaciones ?? '').trim(),
    };
    const batch = writeBatch(db);
    let puestoId = id;
    if (id) {
      batch.update(doc(db, PUESTOS_PATH, id), data);
      equiposDelPuesto
        .filter(e => e.personaEncargada !== data.nombre)
        .forEach(e => batch.update(doc(db, EQUIPOS_PATH, e.id), { personaEncargada: data.nombre }));
    } else {
      const ref = doc(collection(db, PUESTOS_PATH));
      puestoId = ref.id;
      batch.set(ref, { ...data, createdAt: now(), addedByEmail: user.email });
      puestoLog(batch, ref.id, { tipo: 'nota', descripcion: 'Puesto creado.' });
    }
    await batch.commit();
    return puestoId;
  };

  // Datos que recibe un equipo al entrar a un puesto (en la casilla elegida).
  const entrarAlPuesto = (equipo, puesto, casilla) => {
    const changes = { puestoId: puesto.id, personaEncargada: puesto.nombre };
    if (casilla && casillaDe({ ...equipo, casilla: undefined }) !== casilla) changes.casilla = casilla;
    else if (equipo.casilla) changes.casilla = deleteField();
    if (equipo.estado === 'Disponible') {
      changes.estado = 'En Uso';
      changes.estadoDesde = now();
      if (equipo.condicion === 'Nuevo') changes.condicion = 'Usado';
    }
    return changes;
  };

  // Datos que recibe un equipo al salir de un puesto.
  const salirDelPuesto = (equipo, estado) => {
    const changes = { puestoId: deleteField(), personaEncargada: ENCARGADO_SIN_PUESTO };
    if (estado && estado !== equipo.estado) { changes.estado = estado; changes.estadoDesde = now(); }
    return changes;
  };

  // ── Agregar un equipo a una casilla del puesto ──
  // `origen` = puesto donde estaba antes (si estaba en otro).
  const asignarEquipo = async (puesto, equipo, origen = null, casilla = null) => {
    const batch = writeBatch(db);
    batch.update(doc(db, EQUIPOS_PATH, equipo.id), entrarAlPuesto(equipo, puesto, casilla));
    equipoLog(batch, equipo.id, `Asignado al puesto "${puesto.nombre}".${origen ? `\nVenía de "${origen.nombre}".` : ''}`);
    const refs = [puestoLog(batch, puesto.id, { tipo: 'cambio', equipoId: equipo.id, descripcion: `Se agrega ${etiquetaEquipo(equipo)}.` })];
    if (origen) refs.push(puestoLog(batch, origen.id, { tipo: 'cambio', equipoId: equipo.id, ...retiradoDe(equipo), descripcion: `Sale ${etiquetaEquipo(equipo)}: pasa a "${puesto.nombre}".` }));
    await batch.commit();
    return conDeshacer([foto(equipo)], refs, `agregar ${etiquetaEquipo(equipo)} a "${puesto.nombre}".`);
  };

  // ── Quitar un equipo del puesto ──────────────
  const retirarEquipo = async (puesto, equipo, { estado, motivo }) => {
    const batch = writeBatch(db);
    batch.update(doc(db, EQUIPOS_PATH, equipo.id), salirDelPuesto(equipo, estado));
    const motivoTxt = motivo?.trim() ? `\nMotivo: ${motivo.trim()}` : '';
    equipoLog(batch, equipo.id, `Retirado del puesto "${puesto.nombre}". Queda ${estado}.${motivoTxt}`);
    const ref = puestoLog(batch, puesto.id, { tipo: 'cambio', equipoId: equipo.id, ...retiradoDe(equipo), descripcion: `Se retira ${etiquetaEquipo(equipo)} (queda ${estado}).${motivoTxt}` });
    await batch.commit();
    return conDeshacer([foto(equipo)], [ref], `retirar ${etiquetaEquipo(equipo)} de "${puesto.nombre}".`);
  };

  // ── Reemplazar un equipo por otro ────────────
  // Equivale a "tachar" el componente viejo en la hoja de Excel y escribir el nuevo en su casilla.
  const reemplazarEquipo = async (puesto, viejo, nuevo, { estado, motivo }, origenNuevo = null) => {
    const batch = writeBatch(db);
    const motivoTxt = motivo?.trim() ? `\nMotivo: ${motivo.trim()}` : '';
    batch.update(doc(db, EQUIPOS_PATH, viejo.id), salirDelPuesto(viejo, estado));
    batch.update(doc(db, EQUIPOS_PATH, nuevo.id), entrarAlPuesto(nuevo, puesto, casillaDe(viejo)));
    equipoLog(batch, viejo.id, `Reemplazado en el puesto "${puesto.nombre}" por ${etiquetaEquipo(nuevo)}. Queda ${estado}.${motivoTxt}`);
    equipoLog(batch, nuevo.id, `Asignado al puesto "${puesto.nombre}" en reemplazo de ${etiquetaEquipo(viejo)}.${origenNuevo ? `\nVenía de "${origenNuevo.nombre}".` : ''}`);
    const refs = [puestoLog(batch, puesto.id, {
      tipo: 'cambio', equipoId: nuevo.id, reemplazaA: viejo.id, ...retiradoDe(viejo),
      descripcion: `${etiquetaEquipo(viejo)} se reemplaza por ${etiquetaEquipo(nuevo)}. El anterior queda ${estado}.${motivoTxt}`,
    })];
    if (origenNuevo) refs.push(puestoLog(batch, origenNuevo.id, { tipo: 'cambio', equipoId: nuevo.id, ...retiradoDe(nuevo), descripcion: `Sale ${etiquetaEquipo(nuevo)}: pasa a "${puesto.nombre}".` }));
    await batch.commit();
    return conDeshacer([foto(viejo), foto(nuevo)], refs, `reemplazar ${etiquetaEquipo(viejo)} por ${etiquetaEquipo(nuevo)}.`);
  };

  // ── Trasladar un equipo de un puesto a otro ──
  // Se hace desde el puesto de origen: el equipo sale tachado de su casilla allá
  // y entra en la misma casilla del destino. Una sola confirmación.
  const trasladarEquipo = async (origen, destino, equipo, motivo = '') => {
    const batch = writeBatch(db);
    const motivoTxt = motivo?.trim() ? `\nMotivo: ${motivo.trim()}` : '';
    batch.update(doc(db, EQUIPOS_PATH, equipo.id), entrarAlPuesto(equipo, destino, casillaDe(equipo)));
    equipoLog(batch, equipo.id, `Trasladado de "${origen.nombre}" a "${destino.nombre}".${motivoTxt}`);
    const refs = [
      puestoLog(batch, origen.id, { tipo: 'cambio', equipoId: equipo.id, ...retiradoDe(equipo), descripcion: `Sale ${etiquetaEquipo(equipo)}: pasa a "${destino.nombre}".${motivoTxt}` }),
      puestoLog(batch, destino.id, { tipo: 'cambio', equipoId: equipo.id, descripcion: `Llega ${etiquetaEquipo(equipo)} desde "${origen.nombre}".${motivoTxt}` }),
    ];
    await batch.commit();
    return conDeshacer([foto(equipo)], refs, `trasladar ${etiquetaEquipo(equipo)} a "${destino.nombre}".`);
  };

  // ── Mantenimiento, novedad o nota ────────────
  // Un preventivo también actualiza `ultimoMantenimiento` del equipo principal,
  // así la pantalla de Mantenimientos queda al día sin registrarlo dos veces.
  const registrarEvento = async (puesto, { tipo, fecha, descripcion, reporta }, principal = null) => {
    const batch = writeBatch(db);
    const fechaTs = fechaATimestamp(fecha);
    puestoLog(batch, puesto.id, {
      tipo, fecha: fechaTs, descripcion: descripcion.trim(),
      ...(reporta?.trim() ? { reporta: reporta.trim() } : {}),
      ...(principal && (tipo === 'preventivo' || tipo === 'correctivo') ? { equipoId: principal.id } : {}),
    });
    // En el equipo también queda con campos, para su hoja de vida (F-MAN-03)
    const estructurado = { tipo, fecha: fechaTs, descripcion: descripcion.trim(), responsable: user.nombre || user.email };
    if (principal && tipo === 'preventivo') {
      const previo = principal.ultimoMantenimiento?.toMillis?.() ?? 0;
      if (fechaTs.toMillis() > previo) batch.update(doc(db, EQUIPOS_PATH, principal.id), { ultimoMantenimiento: fechaTs });
      equipoLog(batch, principal.id, `Mantenimiento preventivo realizado (puesto "${puesto.nombre}").\n${descripcion.trim()}`, estructurado);
    } else if (principal && tipo === 'correctivo') {
      equipoLog(batch, principal.id, `Mantenimiento correctivo (puesto "${puesto.nombre}").\n${descripcion.trim()}`, estructurado);
    }
    await batch.commit();
  };

  // ── Importar las hojas de vida de Excel (una sola vez) ──
  // Recibe el resultado de prepararImportacion (utils/importarHojas.js) y lo
  // escribe en lotes. Los puestos van primero: si algo falla a mitad, la
  // pantalla ya los ve como importados y no deja repetir la importación.
  const importarHojas = async (resultado, onProgreso = () => {}) => {
    const ts = (iso) => (iso ? fechaATimestamp(iso) : null);
    const ops = [];
    const nuevos = new Map(resultado.crear.map(c => [c.codigo, doc(collection(db, EQUIPOS_PATH)).id]));
    const idDe = (ref) => (ref?.startsWith('nuevo:') ? nuevos.get(ref.slice(6)) : ref);
    const nombrePuesto = new Map(resultado.puestos.map(p => [p.id, p.data.nombre]));
    const conFechas = (cambios) => (cambios.ultimoMantenimiento
      ? { ...cambios, ultimoMantenimiento: ts(cambios.ultimoMantenimiento) } : cambios);

    for (const p of resultado.puestos) {
      ops.push(b => b.set(doc(db, PUESTOS_PATH, p.id), { ...p.data, createdAt: now(), addedByEmail: user.email }));
    }
    for (const c of resultado.crear) {
      ops.push(b => b.set(doc(db, EQUIPOS_PATH, nuevos.get(c.codigo)), {
        ...conFechas(c.data),
        ...(c.puestoId ? { puestoId: c.puestoId } : {}),
        fechaIngreso: now(), addedBy: user.uid, addedByEmail: user.email, createdAt: now(), estadoDesde: now(),
      }));
    }
    for (const [id, cambios] of resultado.actualizar) {
      ops.push(b => b.update(doc(db, EQUIPOS_PATH, id), conFechas(cambios)));
      if (cambios.puestoId) {
        ops.push(b => b.set(doc(collection(db, EQUIPOS_PATH, id, HISTORIAL)), {
          timestamp: now(), user: user.email, importado: true,
          action: `Asignado al puesto "${nombrePuesto.get(cambios.puestoId)}" al importar las hojas de vida.`,
        }));
      }
    }
    for (const p of resultado.puestos) {
      for (const { equipoRef, fecha, ...h } of p.historial) {
        ops.push(b => b.set(doc(collection(db, PUESTOS_PATH, p.id, HISTORIAL)), {
          ...h, fecha: ts(fecha), ...(equipoRef ? { equipoId: idDe(equipoRef) } : {}),
          timestamp: now(), user: user.email, importado: true,
        }));
      }
    }
    for (const h of resultado.historialEquipos) {
      const id = idDe(h.ref);
      for (const e of h.entradas) {
        ops.push(b => b.set(doc(collection(db, EQUIPOS_PATH, id, HISTORIAL)), {
          timestamp: ts(e.fecha) ?? now(), user: user.email, action: e.action, importado: true,
          tipo: e.tipo, fecha: ts(e.fecha), descripcion: e.descripcion, responsable: e.responsable,
          ...(e.reporta ? { reporta: e.reporta } : {}),
        }));
      }
    }

    const LOTE = 450; // Firestore admite 500 escrituras por lote
    const total = Math.ceil(ops.length / LOTE);
    for (let i = 0; i < total; i++) {
      const batch = writeBatch(db);
      ops.slice(i * LOTE, (i + 1) * LOTE).forEach(op => op(batch));
      await batch.commit();
      onProgreso(i + 1, total);
    }
  };

  // ── Eliminar un puesto ───────────────────────
  // No se borra: queda oculto (con su historial) para poder deshacer. Sus equipos
  // salen del puesto; los que estaban "En Uso" quedan Disponibles en stock.
  const eliminarPuesto = async (puesto, equiposDelPuesto = []) => {
    const batch = writeBatch(db);
    batch.update(doc(db, PUESTOS_PATH, puesto.id), { eliminado: true, eliminadoAt: now(), eliminadoPor: user.email });
    for (const e of equiposDelPuesto) {
      batch.update(doc(db, EQUIPOS_PATH, e.id), salirDelPuesto(e, e.estado === 'En Uso' ? 'Disponible' : e.estado));
      equipoLog(batch, e.id, `Sale del puesto "${puesto.nombre}": el puesto se eliminó.`);
    }
    const ref = puestoLog(batch, puesto.id, { tipo: 'nota', descripcion: 'Puesto eliminado.' });
    await batch.commit();
    return async () => {
      const b = writeBatch(db);
      b.update(doc(db, PUESTOS_PATH, puesto.id), { eliminado: deleteField(), eliminadoAt: deleteField(), eliminadoPor: deleteField() });
      for (const e of equiposDelPuesto) {
        const { id, ...antes } = foto(e);
        b.update(doc(db, EQUIPOS_PATH, id), Object.fromEntries(Object.entries(antes).map(([k, v]) => [k, v === undefined ? deleteField() : v])));
        equipoLog(b, id, `Vuelve al puesto "${puesto.nombre}": se deshizo la eliminación.`);
      }
      b.delete(ref);
      await b.commit();
    };
  };

  return { puestos, hayImportados, loading, eliminarPuesto, savePuesto, asignarEquipo, retirarEquipo, reemplazarEquipo, trasladarEquipo, registrarEvento, importarHojas };
};

// Historial en vivo de un puesto, más reciente primero.
export const usePuestoHistorial = (db, puestoId) => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!db || !puestoId) { setHistorial([]); setLoading(false); return; }
    setLoading(true);
    const unsub = onSnapshot(collection(db, PUESTOS_PATH, puestoId, HISTORIAL),
      snap => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => (b.fecha?.toMillis?.() ?? 0) - (a.fecha?.toMillis?.() ?? 0)
          || (b.timestamp?.toMillis?.() ?? 0) - (a.timestamp?.toMillis?.() ?? 0));
        setHistorial(rows);
        setLoading(false);
      },
      () => { setHistorial([]); setLoading(false); });
    return unsub;
  }, [db, puestoId]);
  return { historial, loading };
};

export default usePuestos;
