// ─────────────────────────────────────────────
//  Descargas de una hoja de vida (ver utils/hojaDeVida.js).
//  Excel: se llena la plantilla real (public/plantillas/F-MAN-0X.xlsx, creada
//  con scripts/hojas-de-vida/crear-plantillas.mjs), así sale con el mismo logo,
//  colores, bordes y celdas combinadas que las hojas de Google Sheets.
//  PDF: página HTML con la misma cuadrícula y el diálogo de impresión.
// ─────────────────────────────────────────────

import { CASILLAS } from './puestos';
import { htmlHojaPuesto, htmlHojaEquipo, nombreArchivo } from './hojaDeVida';

const LOGO_HOJA = '/plantillas/logo-hoja.jpg';
const FUENTE = { name: 'Calibri', size: 11 };
const TACHADO = { ...FUENTE, italic: true, strike: true, color: { argb: 'FFFF0000' } };
const NORMAL = { ...FUENTE, color: { argb: 'FF000000' } };
const clon = (v) => (v ? JSON.parse(JSON.stringify(v)) : {});
const letras = (a, b) => Array.from({ length: b.charCodeAt(0) - a.charCodeAt(0) + 1 }, (_, i) => String.fromCharCode(a.charCodeAt(0) + i));
// Fecha en la celda sin correrse de día por la zona horaria
const fechaExcel = (d) => (d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) : null);

async function cargarPlantilla(codigo) {
  const ExcelJS = (await import('exceljs')).default; // pesa: solo se carga al descargar
  const res = await fetch(`/plantillas/${codigo}.xlsx`);
  if (!res.ok) throw new Error(`No se encontró la plantilla ${codigo}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  return wb;
}

async function guardar(wb, d) {
  const ws = wb.worksheets[0];
  ws.name = d.nombre.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Hoja de vida';
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${nombreArchivo(d)}.xlsx` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Historial y novedades tienen largo variable: se reescriben desde la primera fila
// de datos copiando el estilo de las filas de la plantilla.
function reescribirTablas(ws, d, l) {
  const cols = letras(l.desde, l.hasta);
  const estiloFila = (r) => Object.fromEntries(cols.map(c => [c, clon(ws.getCell(`${c}${r}`).style)]));
  const valores = (r) => Object.fromEntries(cols.map(c => [c, ws.getCell(`${c}${r}`).value]));
  const sHist = estiloFila(l.filaHist);
  const sNovT = estiloFila(l.filaNovTitulo); const vNovT = valores(l.filaNovTitulo);
  const sNovE = estiloFila(l.filaNovTitulo + 1); const vNovE = valores(l.filaNovTitulo + 1);
  const sNov = estiloFila(l.filaNovTitulo + 2);
  const alturaNovT = ws.getRow(l.filaNovTitulo).height;

  for (const m of Object.values(ws._merges)) {
    const { top, left, bottom, right } = m.model;
    if (top >= l.filaHist) ws.unMergeCells(top, left, bottom, right);
  }
  for (let r = l.filaHist; r <= Math.max(ws.rowCount, l.filaNovTitulo + 12); r++) {
    for (const c of cols) { const cell = ws.getCell(`${c}${r}`); cell.value = null; cell.style = {}; }
    ws.getRow(r).height = undefined;
  }

  const poner = (r, estilos, vals = {}) => cols.forEach(c => {
    const cell = ws.getCell(`${c}${r}`);
    cell.style = clon(estilos[c]);
    if (vals[c] !== undefined) cell.value = vals[c];
  });
  // Alto según el largo del texto (las celdas combinadas no se ajustan solas)
  const alto = (txt, anchoChars) => Math.max(15, Math.ceil(String(txt ?? '').length / anchoChars) * 15);

  let r = l.filaHist;
  const historial = [...d.historial, ...Array(3).fill(null)]; // tres filas libres para escribir a mano
  for (const h of historial) {
    poner(r, sHist, h ? {
      [l.fecha]: fechaExcel(h.fecha), [l.prev]: h.tipo === 'preventivo' ? 'x' : null, [l.corr]: h.tipo === 'correctivo' ? 'x' : null,
      [l.desc[0]]: h.descripcion, [l.resp]: h.responsable,
    } : {});
    ws.mergeCells(`${l.desc[0]}${r}:${l.desc[1]}${r}`);
    ws.getCell(`${l.desc[0]}${r}`).alignment = { ...ws.getCell(`${l.desc[0]}${r}`).alignment, wrapText: true, vertical: 'middle' };
    if (h) ws.getRow(r).height = alto(h.descripcion, l.anchoDesc);
    r++;
  }
  poner(r, sNovT, vNovT); ws.mergeCells(`${l.desde}${r}:${l.hasta}${r}`); ws.getRow(r).height = alturaNovT; r++;
  poner(r, sNovE, vNovE); ws.mergeCells(`${l.nov[0]}${r}:${l.nov[1]}${r}`); r++;
  for (const n of [...d.novedades, ...Array(2).fill(null)]) {
    poner(r, sNov, n ? { [l.fecha]: fechaExcel(n.fecha), [l.nov[0]]: n.descripcion, [l.reporta]: n.reporta } : {});
    ws.mergeCells(`${l.nov[0]}${r}:${l.nov[1]}${r}`);
    ws.getCell(`${l.nov[0]}${r}`).alignment = { ...ws.getCell(`${l.nov[0]}${r}`).alignment, wrapText: true, vertical: 'middle' };
    if (n) ws.getRow(r).height = alto(n.descripcion, l.anchoNov);
    r++;
  }
}

// ── F-MAN-02 (puesto) ──
export async function descargarExcelPuesto(d) {
  const wb = await cargarPlantilla('F-MAN-02');
  const ws = wb.worksheets[0];
  const id = d.identificacion;
  ['equipo', 'tipo', 'inventario', 'marca', 'modelo', 'serial'].forEach((k, i) => { ws.getCell(`C${4 + i}`).value = id[k]; });

  // Personas a cargo (recuadro de la derecha): si son más que las filas del recuadro, se copia su estilo
  const sPersona = clon(ws.getCell('K4').style);
  d.personas.forEach((p, i) => { const c = ws.getCell(`K${3 + i}`); if (i > 6) c.style = clon(sPersona); c.value = p; });

  // COMPONENTES: una columna por casilla (B=CPU … I=ACCESORIOS), filas 12 a 20; lo que salió va tachado.
  const COL = Object.fromEntries(CASILLAS.map((c, i) => [c.key, String.fromCharCode(66 + i)]));
  for (const { key } of CASILLAS) {
    const lista = d.componentes[key];
    const col = COL[key];
    if (key === 'accesorios' || lista.length > 9) {
      // ACCESORIOS es una sola celda combinada (I12:I20): todo junto, una línea por elemento
      const ultimos = key === 'accesorios' ? lista : lista.slice(8);
      lista.slice(0, key === 'accesorios' ? 0 : 8).forEach((c, i) => {
        const cell = ws.getCell(`${col}${12 + i}`); cell.value = c.texto; cell.font = c.retirado ? TACHADO : NORMAL;
      });
      const fila = key === 'accesorios' ? 12 : 20;
      if (ultimos.length) {
        ws.getCell(`${col}${fila}`).value = { richText: ultimos.map((c, i) => ({ text: (i ? '\n' : '') + c.texto, font: c.retirado ? TACHADO : NORMAL })) };
      }
    } else {
      lista.forEach((c, i) => { const cell = ws.getCell(`${col}${12 + i}`); cell.value = c.texto; cell.font = c.retirado ? TACHADO : NORMAL; });
    }
  }

  const hw = d.hardware;
  ['ram', 'procesador', 'tarjetaGrafica', 'refrigeracion', 'almacenamiento', 'board', 'fuente']
    .forEach((k, i) => { ws.getCell(`${String.fromCharCode(66 + i)}23`).value = hw[k] || null; });

  reescribirTablas(ws, d, {
    desde: 'B', hasta: 'I', filaHist: 30, filaNovTitulo: 61,
    fecha: 'B', prev: 'C', corr: 'D', desc: ['E', 'H'], resp: 'I', anchoDesc: 92,
    nov: ['C', 'H'], reporta: 'I', anchoNov: 128,
  });
  await guardar(wb, d);
}

// ── F-MAN-03 (equipo individual) ──
export async function descargarExcelEquipo(d) {
  const wb = await cargarPlantilla('F-MAN-03');
  const ws = wb.worksheets[0];
  const id = d.identificacion;
  ['responsable', 'nombre', 'marca', 'inventario', 'modelo', 'serial', 'accesorios'].forEach((k, i) => { ws.getCell(`C${5 + i}`).value = id[k] || null; });
  reescribirTablas(ws, d, {
    desde: 'B', hasta: 'G', filaHist: 15, filaNovTitulo: 20,
    fecha: 'B', prev: 'C', corr: 'D', desc: ['E', 'F'], resp: 'G', anchoDesc: 26,
    nov: ['C', 'F'], reporta: 'G', anchoNov: 44,
  });
  await guardar(wb, d);
}

// Abre la hoja en una pestaña nueva con el diálogo de impresión ("Guardar como PDF").
// Devuelve false si el navegador bloqueó la ventana.
export function imprimirHoja(d) {
  const win = window.open('', '_blank');
  if (!win) return false;
  const logoUrl = new URL(LOGO_HOJA, window.location.origin).href;
  const html = d.codigo === 'F-MAN-02' ? htmlHojaPuesto(d, { logoUrl }) : htmlHojaEquipo(d, { logoUrl });
  win.document.open();
  win.document.write(html);
  win.document.close();
  const imprimir = () => { win.focus(); win.print(); };
  const logo = win.document.querySelector('img');
  if (logo && !logo.complete) { logo.onload = imprimir; logo.onerror = imprimir; } else imprimir();
  return true;
}

export const descargarExcel = (d) => (d.codigo === 'F-MAN-02' ? descargarExcelPuesto(d) : descargarExcelEquipo(d));
