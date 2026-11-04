// ─────────────────────────────────────────────
//  Crea las plantillas en blanco de las hojas de vida a partir de dos hojas
//  reales (F-MAN-02 de un puesto y F-MAN-03 de un equipo), para que la
//  descarga de la app salga con el mismo diseño exacto: logo, colores del
//  tema, bordes, anchos y celdas combinadas.
//
//  Uso: node scripts/hojas-de-vida/crear-plantillas.mjs "<hoja F-MAN-02.xlsx>" "<hoja F-MAN-03.xlsx>"
//  Escribe public/plantillas/F-MAN-02.xlsx y F-MAN-03.xlsx, y el logo de las
//  hojas (public/plantillas/logo-hoja.jpg) para el PDF. Se borran todos los
//  datos: nombres, códigos e historial no quedan en el repositorio.
// ─────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';

const [, , fman02, fman03] = process.argv;
if (!fman02 || !fman03) {
  console.error('Uso: node scripts/hojas-de-vida/crear-plantillas.mjs "<F-MAN-02.xlsx>" "<F-MAN-03.xlsx>"');
  process.exit(1);
}
const SALIDA = path.resolve('public/plantillas');
fs.mkdirSync(SALIDA, { recursive: true });

const vaciar = (ws, desde, hasta, cols) => {
  for (let r = desde; r <= hasta; r++) {
    for (const c of cols) {
      const cell = ws.getCell(`${c}${r}`);
      if (cell.isMerged && cell.master.address !== cell.address) continue;
      cell.value = null;
      if (cell.font) cell.font = { ...cell.font, strike: false, italic: false, color: { argb: 'FF000000' } };
    }
  }
};
const COLS = (a, b) => Array.from({ length: b.charCodeAt(0) - a.charCodeAt(0) + 1 }, (_, i) => String.fromCharCode(a.charCodeAt(0) + i));

// ── F-MAN-02 (puesto) ──
{
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(fman02);
  const ws = wb.worksheets[0];
  ws.name = 'Hoja de vida';
  vaciar(ws, 4, 9, ['C']);                        // identificación
  vaciar(ws, 3, 40, ['K']);                       // personas a cargo
  vaciar(ws, 12, 20, COLS('B', 'I'));             // componentes
  vaciar(ws, 23, 26, COLS('B', 'I'));             // hardware
  vaciar(ws, 30, 60, COLS('B', 'I'));             // historial
  vaciar(ws, 63, ws.rowCount, COLS('B', 'I'));    // novedades
  await wb.xlsx.writeFile(path.join(SALIDA, 'F-MAN-02.xlsx'));
  const logo = wb.model.media.find(m => m.type === 'image');
  if (logo) fs.writeFileSync(path.join(SALIDA, `logo-hoja.${logo.extension}`), logo.buffer);
}

// ── F-MAN-03 (equipo individual) ──
{
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(fman03);
  const ws = wb.worksheets[0];
  ws.name = 'Hoja de vida';
  vaciar(ws, 5, 11, ['C']);
  vaciar(ws, 15, 19, COLS('B', 'G'));
  vaciar(ws, 22, Math.max(ws.rowCount, 24), COLS('B', 'G'));
  await wb.xlsx.writeFile(path.join(SALIDA, 'F-MAN-03.xlsx'));
}

console.log(`Plantillas en ${SALIDA}`);
