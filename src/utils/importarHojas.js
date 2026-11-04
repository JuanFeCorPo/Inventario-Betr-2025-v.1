// ─────────────────────────────────────────────
//  Importación de las hojas de vida de Excel (una sola vez).
//  Lógica pura: cruza el plan que genera
//  scripts/hojas-de-vida/preparar-importacion.mjs con el inventario en vivo
//  y devuelve qué escribir. Las fechas van como 'YYYY-MM-DD'; el hook las
//  convierte a Timestamp.
// ─────────────────────────────────────────────

import { CATEGORIAS_CON_MANTENIMIENTO } from '../config/constants';
import { equipoPrincipal, grupoDe, SIN_GRUPO } from './puestos';

export const ORIGEN_IMPORTACION = 'hoja-de-vida';
const ENCARGADO_SIN_PUESTO = 'Betrmedia';
const HARDWARE = ['procesador', 'ram', 'almacenamiento', 'tarjetaGrafica'];
const TIPO_TEXTO = { preventivo: 'Mantenimiento preventivo', correctivo: 'Mantenimiento correctivo', novedad: 'Novedad', nota: 'Registro' };

export const codigoInventario = (s) => {
  const m = String(s ?? '').toUpperCase().match(/BM\s?-?\s?INV\s?-?\s?(\d{3,4})/);
  return m ? `BM-INV-${m[1].padStart(4, '0')}` : null;
};

// "Model: A1466 / Cargador Portatil: BM-INV-0226" → "BM-INV-0226"
export const cargadorEnTexto = (texto) => {
  const m = String(texto ?? '').match(/cargador[^\n]{0,40}?(BM\s?-?\s?INV\s?-?\s?\d{3,4})/i);
  return m ? codigoInventario(m[1]) : null;
};

export const yaImportado = (puestos) => puestos.some(p => p.origen === ORIGEN_IMPORTACION);

// Revisa que el archivo sea un plan de importación de esta app.
export const validarPlan = (plan) =>
  plan && plan.version === 1 && Array.isArray(plan.puestos) && Array.isArray(plan.historialEquipos) && Array.isArray(plan.crear);

const etiqueta = (e, codigo) => (e ? `${e.nombre} (${codigo})` : codigo);
const ultimaFecha = (entradas, tipo) =>
  entradas.filter(h => h.tipo === tipo && h.fecha).map(h => h.fecha).sort().at(-1) ?? null;

// Fecha del último registro del historial que menciona el código (para fechar un componente retirado).
const fechaDeMencion = (historial, codigo) => {
  const num = codigo.slice(-4).replace(/^0+/, '');
  const re = new RegExp(`BM\\s?-?\\s?INV\\s?-?\\s?0*${num}(?!\\d)`, 'i');
  return historial.filter(h => h.fecha && re.test(h.descripcion)).map(h => h.fecha).sort().at(-1) ?? null;
};

/**
 * @returns {{
 *   puestos: { id, data, historial }[],
 *   crear: { codigo, data, puestoId }[],
 *   actualizar: Map<equipoId, cambios>,
 *   historialEquipos: { ref, entradas: { fecha, action }[] }[],
 *   avisos: string[], resumen: object
 * }}
 * `ref` de un equipo es su id o `nuevo:<código>` si lo crea esta importación.
 */
export function prepararImportacion(plan, items, hoy = null) {
  const avisos = [...(plan.avisos ?? [])];

  // Equipos del inventario por código. Un código repetido no se toca.
  const porCodigo = new Map();
  const repetidos = new Set();
  for (const it of items) {
    const c = codigoInventario(it.numeroInventario);
    if (!c) continue;
    if (porCodigo.has(c)) repetidos.add(c); else porCodigo.set(c, it);
  }
  repetidos.forEach(c => { porCodigo.delete(c); avisos.push(`${c} está repetido en el inventario: no se toca. Corrígelo y vuelve a importar ese equipo a mano.`); });

  const planCrear = new Map(plan.crear.map(c => [c.codigo, c]));
  const crear = new Map();       // código → { codigo, data, puestoId }
  const actualizar = new Map();  // equipoId → cambios
  const cambiar = (id, cambios) => actualizar.set(id, { ...(actualizar.get(id) ?? {}), ...cambios });

  // Equipo listo para usar: existente activo, uno por crear, o null.
  const resolver = (codigo) => {
    const it = porCodigo.get(codigo);
    if (it) return it.estado === 'De Baja' ? { deBaja: it } : { equipo: it, ref: it.id };
    const pc = planCrear.get(codigo);
    if (pc) {
      return {
        nuevo: true, ref: `nuevo:${codigo}`,
        equipo: { nombre: pc.nombre || pc.categoria, categoria: pc.categoria, numeroInventario: codigo },
      };
    }
    return {};
  };
  const registrarCreacion = (codigo, puesto) => {
    const pc = planCrear.get(codigo);
    if (crear.has(codigo)) {
      if (puesto) Object.assign(crear.get(codigo).data, { estado: 'En Uso', personaEncargada: puesto.nombre });
      if (puesto) crear.get(codigo).puestoId = puesto.id;
      return;
    }
    crear.set(codigo, {
      codigo,
      puestoId: puesto?.id ?? null,
      data: {
        nombre: pc.nombre || pc.categoria, categoria: pc.categoria,
        estado: puesto ? 'En Uso' : 'Disponible', condicion: 'Usado',
        numeroInventario: codigo, numeroSerial: pc.numeroSerial ?? '',
        marca: pc.marca ?? '', modelo: pc.modelo ?? '',
        personaEncargada: puesto?.nombre ?? ENCARGADO_SIN_PUESTO,
        observaciones: 'Creado al importar las hojas de vida.',
      },
    });
  };
  // Mantenimiento y hardware del equipo principal (solo CPU y portátiles).
  const alDia = (ref, equipo, entradas, hardware = {}) => {
    if (!CATEGORIAS_CON_MANTENIMIENTO.includes(equipo.categoria)) return;
    const ultimo = ultimaFecha(entradas, 'preventivo');
    const cambios = {};
    const actual = equipo.ultimoMantenimiento?.toDate?.();
    const actualIso = actual ? `${actual.getFullYear()}-${String(actual.getMonth() + 1).padStart(2, '0')}-${String(actual.getDate()).padStart(2, '0')}` : '';
    if (ultimo && ultimo > actualIso) cambios.ultimoMantenimiento = ultimo;
    for (const k of HARDWARE) if (hardware[k] && !String(equipo[k] ?? '').trim()) cambios[k] = hardware[k];
    if (!Object.keys(cambios).length) return;
    if (ref.startsWith('nuevo:')) Object.assign(crear.get(ref.slice(6)).data, cambios);
    else cambiar(ref, cambios);
  };

  // ── Puestos ──
  const puestos = [];
  let asignados = 0;
  for (const p of plan.puestos) {
    const puesto = { id: p.clave, nombre: p.nombre };
    const historial = p.historial.map(h => ({
      fecha: h.fecha ?? null, tipo: h.tipo,
      descripcion: h.descripcion || (h.fechaTexto ? `(fecha en la hoja: ${h.fechaTexto})` : ''),
      responsable: h.responsable || '',
      ...(h.reporta ? { reporta: h.reporta } : {}),
    }));

    const presentes = [];
    for (const codigo of p.equipos) {
      const r = resolver(codigo);
      if (r.deBaja) {
        historial.push({ fecha: fechaDeMencion(p.historial, codigo), tipo: 'cambio', responsable: '', descripcion: `${etiqueta(r.deBaja, codigo)} sigue en la hoja de vida, pero en el inventario está De Baja: no se agrega.` });
        continue;
      }
      if (!r.equipo) { if (!repetidos.has(codigo)) avisos.push(`${codigo} (${p.nombre}) no está en el inventario: no se agrega.`); continue; }
      if (r.nuevo) registrarCreacion(codigo, puesto);
      else {
        const cambios = { puestoId: puesto.id };
        if (r.equipo.personaEncargada !== p.nombre) cambios.personaEncargada = p.nombre;
        cambiar(r.ref, cambios);
      }
      presentes.push(r);
      asignados++;
    }

    for (const codigo of p.retirados) {
      const e = porCodigo.get(codigo);
      historial.push({ fecha: fechaDeMencion(p.historial, codigo), tipo: 'cambio', responsable: '', descripcion: `Sale ${etiqueta(e, codigo)} (tachado en la hoja de vida).` });
    }

    const principal = equipoPrincipal(presentes.map(r => r.equipo));
    if (principal) {
      const ref = presentes.find(r => r.equipo === principal).ref;
      alDia(ref, principal, p.historial, p.hardware);
      historial.forEach(h => { if (h.tipo === 'preventivo' || h.tipo === 'correctivo') h.equipoRef = ref; });
    }

    puestos.push({
      id: p.clave,
      data: {
        nombre: p.nombre, area: p.area,
        personas: p.personas, correos: p.personas.map(x => x.correo).filter(Boolean),
        observaciones: p.observaciones ?? '',
        origen: ORIGEN_IMPORTACION, hojaOriginal: p.hoja ?? '',
        ...(() => { const g = grupoDe({ hojaOriginal: p.hoja, nombre: p.nombre }); return g.nombre === SIN_GRUPO ? {} : { grupo: g.nombre, grupoOrden: g.orden }; })(),
      },
      historial: [...historial, { fecha: hoy, tipo: 'nota', responsable: '', descripcion: 'Puesto importado de la hoja de vida en Excel.' }],
    });
  }

  // ── Historial de equipos sin puesto (backups y hojas F-MAN-03) ──
  const historialEquipos = [];
  for (const h of plan.historialEquipos) {
    const candidatos = h.codigos.map(c => ({ codigo: c, ...resolver(c) })).filter(r => r.equipo || r.deBaja);
    const activos = candidatos.filter(r => r.equipo);
    const principal = equipoPrincipal(activos.map(r => r.equipo));
    const elegido = principal ? activos.find(r => r.equipo === principal)
      : activos[0] ?? (candidatos[0]?.deBaja ? { equipo: candidatos[0].deBaja, ref: candidatos[0].deBaja.id } : null);
    if (!elegido) {
      const motivo = h.codigos.some(c => repetidos.has(c)) ? 'tiene el código repetido en el inventario' : 'no está en el inventario';
      avisos.push(`El historial de "${h.hoja}" no se importa: ${h.codigos.join(', ')} ${motivo}.`);
      continue;
    }
    if (elegido.nuevo) registrarCreacion(elegido.equipo.numeroInventario, null);
    const entradas = h.historial.map(x => ({
      fecha: x.fecha ?? null,
      tipo: x.tipo, descripcion: x.descripcion || (x.fechaTexto ? `(fecha en la hoja: ${x.fechaTexto})` : ''),
      responsable: x.responsable || '', reporta: x.reporta || '',
      action: `${TIPO_TEXTO[x.tipo] ?? 'Registro'} (hoja de vida).\n${x.descripcion}`
        + (x.responsable ? `\nResponsable: ${x.responsable}` : '')
        + (x.reporta ? `\nReporta: ${x.reporta}` : '')
        + (x.fechaTexto ? `\nFecha en la hoja: ${x.fechaTexto}` : ''),
    }));
    historialEquipos.push({ ref: elegido.ref, entradas });
    alDia(elegido.ref, elegido.equipo, h.historial);
  }

  // Equipos por crear que no quedaron en ningún puesto ni con historial
  for (const codigo of planCrear.keys()) {
    if (!crear.has(codigo) && !porCodigo.has(codigo) && !repetidos.has(codigo)) registrarCreacion(codigo, null);
  }

  // "Adicionales o accesorios" de las hojas F-MAN-03 (solo si el equipo no tiene ya)
  for (const { codigo, accesorios } of plan.fichas ?? []) {
    if (!accesorios) continue;
    if (crear.has(codigo)) { crear.get(codigo).data.accesorios ??= accesorios; continue; }
    const it = porCodigo.get(codigo);
    if (it && !String(it.accesorios ?? '').trim()) cambiar(it.id, { accesorios });
  }

  // Casilla "Cargador" de los portátiles: sale de lo que ya dicen sus Observaciones
  let cargadores = 0;
  for (const it of items) {
    if (it.categoria !== 'Laptops' || it.estado === 'De Baja' || String(it.cargador ?? '').trim()) continue;
    const c = cargadorEnTexto(it.observaciones);
    if (c) { cambiar(it.id, { cargador: c }); cargadores++; }
  }

  const n = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  return {
    puestos,
    crear: [...crear.values()],
    actualizar,
    historialEquipos,
    avisos,
    resumen: {
      puestos: puestos.length,
      equiposEnPuestos: asignados,
      equiposCreados: crear.size,
      equiposActualizados: actualizar.size,
      registrosPuestos: n(puestos, p => p.historial.length),
      registrosEquipos: n(historialEquipos, h => h.entradas.length),
      cargadores,
    },
  };
}
