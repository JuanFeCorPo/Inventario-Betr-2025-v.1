// ─────────────────────────────────────────────
//  Hojas de vida como documento, con el diseño exacto de los formatos de
//  Betrmedia (para descargar en Excel o PDF):
//  - F-MAN-02: puesto de trabajo (equipo de cómputo), con las columnas de
//    COMPONENTES (CPU, MONITOR, UPS…) y lo que salió, tachado.
//  - F-MAN-03: equipo individual (cámaras, micrófonos, trípodes, luces…).
//
//  datosHojaPuesto / datosHojaEquipo arman los datos (lógica pura).
//  htmlHojaPuesto / htmlHojaEquipo los dibujan para imprimir o guardar en PDF.
//  El Excel se llena sobre la plantilla real (utils/hojaDeVidaExport.js).
// ─────────────────────────────────────────────

import { CASILLAS, casillaDe, casillaPorTexto, serialLimpio, recientesPrimero } from './puestos';
import { formatFecha } from './format';

export const VERSION_FORMATO = '03';
const NO_APLICA = 'NO APLICA';

const fechaDe = (v) => (v?.toDate ? v.toDate() : v instanceof Date ? v : null);
const texto = (v) => String(v ?? '').trim();
const codigoEn = (s) => {
  const m = String(s ?? '').toUpperCase().match(/BM\s?-?\s?INV\s?-?\s?(\d{3,4})/);
  return m ? `BM-INV-${m[1].padStart(4, '0')}` : null;
};

// ── Historial de un equipo → entradas de hoja de vida ──
// Los registros nuevos traen `tipo`; los anteriores se reconocen por el texto.
const LEGADO = [
  [/^Mantenimiento preventivo/i, 'preventivo'],
  [/^Mantenimiento correctivo/i, 'correctivo'],
  [/^Nota:\s*/i, 'nota'],
  [/^(Asignado|Retirado|Reemplazado|Trasladado|Equipo dado de baja|Equipo reactivado)/i, 'cambio'],
];

export function entradasDeEquipo(historial = []) {
  return historial.flatMap((h) => {
    if (h.tipo) {
      return [{
        fecha: fechaDe(h.fecha) ?? fechaDe(h.timestamp), timestamp: h.timestamp, tipo: h.tipo,
        descripcion: texto(h.descripcion), responsable: texto(h.responsable ?? h.user), reporta: texto(h.reporta),
      }];
    }
    const action = texto(h.action);
    const regla = LEGADO.find(([re]) => re.test(action));
    if (!regla) return [];
    const [re, tipo] = regla;
    // "Mantenimiento preventivo realizado.\nCambio de pasta" → "Cambio de pasta"
    let descripcion = tipo === 'nota' ? action.replace(re, '') : action;
    if (tipo === 'preventivo' || tipo === 'correctivo') {
      const resto = action.split('\n').slice(1).join(' ').trim();
      descripcion = resto || (tipo === 'preventivo' ? 'Mantenimiento preventivo realizado.' : 'Mantenimiento correctivo.');
    }
    return [{ fecha: fechaDe(h.timestamp), timestamp: h.timestamp, tipo, descripcion: descripcion.replace(/\s*\n\s*/g, ' '), responsable: texto(h.user), reporta: '' }];
  }).sort((a, b) => recientesPrimero(b, a)); // de la más antigua a la más reciente
}

// ── Componentes que salieron del puesto (van tachados en su columna) ──
// Los registros nuevos traen `retirado: { codigo, nombre, casilla }`; los
// importados y los anteriores se reconocen por el texto ("Sale …", "Se retira …",
// "… se reemplaza por …").
const SALIDA = /^(Sale |Se retira |.+ se reemplaza por )/;

// Casilla según lo que dice el historial justo antes del código ("cambio de teclado BM-INV-0392").
const casillaPorMencion = (historial, codigo) => {
  const num = codigo.slice(-4).replace(/^0+/, '');
  const re = new RegExp(`BM\\s?-?\\s?INV\\s?-?\\s?0*${num}(?!\\d)`, 'gi');
  for (const h of historial) {
    const t = String(h.descripcion ?? '');
    for (const m of t.matchAll(re)) {
      const c = casillaPorTexto(t.slice(Math.max(0, m.index - 30), m.index));
      if (c !== 'accesorios') return c;
    }
  }
  return null;
};
export function retiradosDelPuesto(historial = [], items = [], equiposActuales = []) {
  const porCodigo = new Map(items.map(i => [codigoEn(i.numeroInventario), i]));
  const actuales = new Set(equiposActuales.map(e => codigoEn(e.numeroInventario)).filter(Boolean));
  const vistos = new Set();
  const out = [];
  for (const h of [...historial].sort((a, b) => (fechaDe(a.fecha)?.getTime() ?? 0) - (fechaDe(b.fecha)?.getTime() ?? 0))) {
    if (h.tipo !== 'cambio') continue;
    let codigo, nombre, casilla;
    if (h.retirado) ({ codigo, nombre, casilla } = h.retirado);
    else if (SALIDA.test(h.descripcion ?? '')) {
      codigo = codigoEn(h.descripcion);
      const item = porCodigo.get(codigo);
      nombre = item?.nombre ?? '';
      casilla = item ? casillaDe(item) : casillaPorTexto(h.descripcion);
    } else continue;
    codigo = codigoEn(codigo) ?? texto(codigo);
    if (!codigo || actuales.has(codigo) || vistos.has(codigo)) continue;
    vistos.add(codigo);
    const item = porCodigo.get(codigo);
    // Si el código ya no está en el inventario, el historial suele decir qué era: "El mouse BM-INV-0236…"
    if ((!casilla || casilla === 'accesorios') && !item) casilla = casillaPorMencion(historial, codigo) ?? casilla;
    out.push({ codigo, nombre: nombre || item?.nombre || '', serial: item?.numeroSerial ?? '', casilla: casilla || 'accesorios', fecha: fechaDe(h.fecha) });
  }
  return out;
}

// Texto de un componente en su celda: "BM-INV-0115 - Monitor Samsung / SN - 0ACH…"
const textoComponente = (codigo, nombre, serial, cargador = '') =>
  [codigo, nombre].filter(Boolean).join(' - ') + (serialLimpio(serial) ? ` / SN - ${serialLimpio(serial)}` : '')
  + (cargador ? ` / Cargador - ${cargador}` : '');

// Registros del sistema que no van en la hoja (la importación y los tachados se ven en otro lado).
const ES_DEL_SISTEMA = /^(Puesto importado de la hoja de vida|Puesto creado\.)|\(tachado en la hoja de vida\)|en el inventario está De Baja: no se agrega/;

// ── F-MAN-02: puesto de trabajo ──
export function datosHojaPuesto({ puesto, equipos = [], principal = null, historial = [], items = [] }) {
  const componentes = Object.fromEntries(CASILLAS.map(c => [c.key, []]));
  for (const e of equipos) {
    const cas = casillaDe(e);
    // El cargador del computador va en su propia casilla de la hoja (Fuente); el de un celular, junto a él
    componentes[cas].push({ texto: textoComponente(e.numeroInventario, e.nombre, e.numeroSerial, cas === 'principal' ? '' : texto(e.cargador)), retirado: false });
  }
  // Lo que el puesto tiene sin código de inventario (audífonos por serial, pad mouse) vive en Observaciones
  for (const linea of texto(puesto.observaciones).split('\n')) {
    const m = linea.match(/^(Aud[ií]fonos|Accesorios|Celular|Mouse|Teclado|Monitor|Ups)\s*:\s*(.+)$/i);
    if (m) componentes[casillaPorTexto(m[1].toLowerCase() === 'accesorios' ? '' : m[1])].push({ texto: m[2].trim(), retirado: false });
  }
  for (const r of retiradosDelPuesto(historial, items, equipos)) {
    componentes[r.casilla]?.push({ texto: textoComponente(r.codigo, r.nombre, r.serial), retirado: true });
  }

  const entradas = historial
    .map(h => ({ fecha: fechaDe(h.fecha), timestamp: h.timestamp, tipo: h.tipo, descripcion: texto(h.descripcion), responsable: texto(h.responsable), reporta: texto(h.reporta) }))
    .filter(h => h.descripcion && !ES_DEL_SISTEMA.test(h.descripcion))
    .sort((a, b) => recientesPrimero(b, a)); // la hoja va de la más antigua a la más reciente

  const o = (v) => texto(v) || NO_APLICA;
  return {
    codigo: 'F-MAN-02', version: VERSION_FORMATO, titulo: 'HOJA DE VIDA DE EQUIPOS DE COMPUTO', nombre: puesto.nombre,
    identificacion: {
      equipo: puesto.nombre,
      tipo: principal ? (principal.categoria === 'CPU' ? 'COMPUTADOR DE ESCRITORIO' : 'COMPUTADOR PORTATIL') : NO_APLICA,
      inventario: o(principal?.numeroInventario), marca: o(principal?.marca), modelo: o(principal?.modelo), serial: o(principal?.numeroSerial),
    },
    personas: (puesto.personas ?? []).map(p => p.nombre || p.correo).filter(Boolean),
    componentes,
    hardware: {
      ram: texto(principal?.ram), procesador: texto(principal?.procesador), tarjetaGrafica: texto(principal?.tarjetaGrafica),
      refrigeracion: '', almacenamiento: texto(principal?.almacenamiento), board: '', fuente: principal?.cargador ? `Cargador ${principal.cargador}` : '',
    },
    historial: entradas.filter(e => e.tipo !== 'novedad'),
    novedades: entradas.filter(e => e.tipo === 'novedad'),
  };
}

// ── F-MAN-03: equipo individual ──
export function datosHojaEquipo(equipo, historial = []) {
  const entradas = entradasDeEquipo(historial);
  return {
    codigo: 'F-MAN-03', version: VERSION_FORMATO, titulo: 'HOJA DE VIDA DE EQUIPOS E INFRAESTRUCTURA',
    nombre: `${equipo.nombre ?? 'Equipo'} ${equipo.numeroInventario ?? ''}`.trim(),
    identificacion: {
      responsable: texto(equipo.personaEncargada), nombre: texto(equipo.nombre), marca: texto(equipo.marca),
      inventario: texto(equipo.numeroInventario), modelo: texto(equipo.modelo),
      serial: serialLimpio(equipo.numeroSerial) ? `SN - ${serialLimpio(equipo.numeroSerial)}` : '',
      accesorios: [texto(equipo.accesorios), equipo.cargador ? `Cargador ${equipo.cargador}` : ''].filter(Boolean).join(', '),
    },
    historial: entradas.filter(e => e.tipo !== 'novedad'),
    novedades: entradas.filter(e => e.tipo === 'novedad'),
  };
}

// ── PDF: página HTML con la cuadrícula del formato ("Guardar como PDF") ──
const esc = (s) => texto(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fechaCorta = (d) => (d ? formatFecha(d) : '');
// Colores de las plantillas (tema de Google Sheets de las hojas originales)
const ROJO = '#EA4335', GRIS = '#666666', ENCABEZADO = '#E0E0E0';

const estiloBase = (orientacion) => `
  @page { size: A4 ${orientacion}; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #000; margin: 0; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td, th { border: 1px solid #000; padding: 2px 4px; vertical-align: middle; text-align: center; word-wrap: break-word; }
  .izq { text-align: left; }
  .b { font-weight: 700; }
  .barra td { color: #fff; font-weight: 700; }
  .enc td { background: ${ENCABEZADO}; font-weight: 700; }
  .tit { font-size: 17px; font-weight: 700; }
  .logo img { max-width: 120px; max-height: 44px; }
  s { color: #FF0000; font-style: italic; }
  tr { break-inside: avoid; }
  .vacio td { height: 14px; }
`;

const filas = (n, celdas) => Array.from({ length: n }, () => `<tr class="vacio">${celdas}</tr>`).join('');

export function htmlHojaPuesto(d, { logoUrl = '' } = {}) {
  const cols = CASILLAS.map(c => c.key);
  const maxComp = Math.max(9, ...cols.map(k => d.componentes[k].length));
  const comp = Array.from({ length: maxComp }, (_, i) => `<tr>${cols.map(k => {
    const c = d.componentes[k][i];
    return `<td>${c ? (c.retirado ? `<s>${esc(c.texto)}</s>` : esc(c.texto)) : ''}</td>`;
  }).join('')}</tr>`).join('');
  const hist = d.historial.map(h => `<tr><td>${esc(fechaCorta(h.fecha))}</td><td>${h.tipo === 'preventivo' ? 'x' : ''}</td><td>${h.tipo === 'correctivo' ? 'x' : ''}</td><td colspan="4" class="izq">${esc(h.descripcion)}</td><td>${esc(h.responsable)}</td></tr>`).join('');
  const nov = d.novedades.map(n => `<tr><td>${esc(fechaCorta(n.fecha))}</td><td colspan="6" class="izq">${esc(n.descripcion)}</td><td>${esc(n.reporta)}</td></tr>`).join('');
  const hw = d.hardware;
  const dato = (et, v) => `<tr><td class="izq b">${et}</td><td colspan="7">${esc(v)}</td></tr>`;

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(d.codigo)} · ${esc(d.nombre)}</title>
<style>${estiloBase('landscape')}
  .hoja { display: grid; grid-template-columns: 1fr 150px; gap: 14px; align-items: start; }
</style></head><body>
<div class="hoja"><div>
<table>
  <colgroup><col style="width:12%"><col style="width:12%"><col style="width:9%"><col style="width:11%"><col style="width:12%"><col style="width:12%"><col style="width:20%"><col style="width:12%"></colgroup>
  <tr><td class="logo" rowspan="2">${logoUrl ? `<img src="${esc(logoUrl)}" alt="Betrmedia">` : 'betrmedia'}</td><td colspan="6" rowspan="2" class="tit">${esc(d.titulo)}</td><td class="b">CÓDIGO: ${esc(d.codigo)}</td></tr>
  <tr><td class="b">VERSIÓN: ${esc(d.version)}</td></tr>
  <tr class="barra"><td colspan="8" style="background:${ROJO}">IDENTIFICACIÓN DEL EQUIPO</td></tr>
  ${dato('EQUIPO:', d.identificacion.equipo)}${dato('TIPO DE EQUIPO:', d.identificacion.tipo)}${dato('No. INVENTARIO', d.identificacion.inventario)}
  ${dato('MARCA', d.identificacion.marca)}${dato('MODELO', d.identificacion.modelo)}${dato('SERIAL', d.identificacion.serial)}
  <tr class="barra"><td colspan="8" style="background:${ROJO}">COMPONENTES</td></tr>
  <tr class="enc">${CASILLAS.map(c => `<td>${c.hoja}</td>`).join('')}</tr>
  ${comp}
  <tr class="barra"><td colspan="8" style="background:${ROJO}">HARDWARE DEL EQUIPO</td></tr>
  <tr class="enc"><td>RAM</td><td>PROCESADOR</td><td>TARJETA GÁFICA</td><td>REFRIGERACIÓN</td><td>ALMACENAMIENTO</td><td>BOARD</td><td>FUENTE DE PDR</td><td></td></tr>
  <tr><td>${esc(hw.ram)}</td><td>${esc(hw.procesador)}</td><td>${esc(hw.tarjetaGrafica)}</td><td>${esc(hw.refrigeracion)}</td><td>${esc(hw.almacenamiento)}</td><td>${esc(hw.board)}</td><td>${esc(hw.fuente)}</td><td></td></tr>
  <tr class="barra"><td colspan="8" style="background:${GRIS}">HISTORIAL</td></tr>
  <tr><td rowspan="2" class="b">Fecha (dia/mes/año)</td><td colspan="2" class="b">Tipo de mantenimiento</td><td colspan="4" rowspan="2" class="b">Descripcion del mantenimiento / observaciones</td><td rowspan="2" class="b">Responsable</td></tr>
  <tr><td class="b">Preventivo</td><td class="b">Correctivo</td></tr>
  ${hist || filas(3, '<td></td><td></td><td></td><td colspan="4"></td><td></td>')}
  <tr class="barra"><td colspan="8" style="background:#D41500">NOVEDADES</td></tr>
  <tr><td class="b">Fecha</td><td colspan="6" class="b">Novedad</td><td class="b">Reporta</td></tr>
  ${nov || filas(2, '<td></td><td colspan="6"></td><td></td>')}
</table></div>
<table>
  <tr class="barra"><td style="background:${ROJO}">Personas a cargo</td></tr>
  ${d.personas.map(p => `<tr><td class="izq">${esc(p)}</td></tr>`).join('')}<tr class="vacio"><td></td></tr>
</table></div>
</body></html>`;
}

export function htmlHojaEquipo(d, { logoUrl = '' } = {}) {
  const i = d.identificacion;
  const dato = (et, v) => `<tr><td class="izq b">${et}</td><td colspan="5">${esc(v)}</td></tr>`;
  const hist = d.historial.map(h => `<tr><td>${esc(fechaCorta(h.fecha))}</td><td>${h.tipo === 'preventivo' ? 'x' : ''}</td><td>${h.tipo === 'correctivo' ? 'x' : ''}</td><td colspan="2" class="izq">${esc(h.descripcion)}</td><td>${esc(h.responsable)}</td></tr>`).join('');
  const nov = d.novedades.map(n => `<tr><td>${esc(fechaCorta(n.fecha))}</td><td colspan="4" class="izq">${esc(n.descripcion)}</td><td>${esc(n.reporta)}</td></tr>`).join('');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(d.codigo)} · ${esc(d.nombre)}</title>
<style>${estiloBase('portrait')}</style></head><body>
<table>
  <colgroup><col style="width:30%"><col style="width:10%"><col style="width:10%"><col style="width:11%"><col style="width:17%"><col style="width:22%"></colgroup>
  <tr><td class="logo" rowspan="2">${logoUrl ? `<img src="${esc(logoUrl)}" alt="Betrmedia">` : 'betrmedia'}</td><td colspan="4" rowspan="2" class="tit">${esc(d.titulo)}</td><td class="b">CÓDIGO: ${esc(d.codigo)}</td></tr>
  <tr><td class="b">VERSIÓN: ${esc(d.version)}</td></tr>
  <tr class="barra"><td colspan="6" style="background:#ED7D31">IDENTIFICACIÓN DEL EQUIPO</td></tr>
  ${dato('NOMBRE DEL RESPONSABLE', i.responsable)}${dato('NOMBRE DEL EQUIPO', i.nombre)}${dato('MARCA', i.marca)}
  ${dato('No. INVENTARIO', i.inventario)}${dato('MODELO', i.modelo)}${dato('SERIAL', i.serial)}${dato('ADICIONALES O ACCESORIOS', i.accesorios)}
  <tr class="barra"><td colspan="6" style="background:${GRIS}">HISTORIAL</td></tr>
  <tr><td rowspan="2" class="b">Fecha</td><td colspan="2" class="b">Tipo de mantenimiento</td><td colspan="2" rowspan="2" class="b">Descripcion del mantenimiento / observaciones</td><td rowspan="2" class="b">Responsable</td></tr>
  <tr><td class="b">Preventivo</td><td class="b">Correctivo</td></tr>
  ${hist || filas(5, '<td></td><td></td><td></td><td colspan="2"></td><td></td>')}
  <tr class="barra"><td colspan="6" style="background:#CC0000">NOVEDADES</td></tr>
  <tr><td class="b">Fecha</td><td colspan="4" class="b">Novedad</td><td class="b">Reporta</td></tr>
  ${nov || filas(3, '<td></td><td colspan="4"></td><td></td>')}
</table>
</body></html>`;
}

// Nombre de archivo: "F-MAN-03 Cámara Fotográfica BM-INV-0197"
export const nombreArchivo = (d) => `${d.codigo} ${d.nombre}`.replace(/[\\/:*?"<>|]+/g, '-').trim();
