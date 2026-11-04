// ─────────────────────────────────────────────
//  Prepara la importación de las hojas de vida (Excel) a la app.
//
//  Uso:  node scripts/hojas-de-vida/preparar-importacion.mjs ["C:/Users/LIDER I.T/hojas-de-vida"]
//
//  Lee las hojas de vida exportadas de Drive y las decisiones del líder de
//  T.I. (decisiones-importacion.xlsx) y escribe plan-importacion.json en la
//  misma carpeta. Ese plan se carga en la app (Puestos → Importar hojas de
//  vida), que lo cruza con el inventario en vivo y lo escribe en Firestore.
//
//  Las hojas tienen datos personales: la carpeta y el plan se quedan fuera
//  del repositorio.
//
//  Qué es cada hoja:
//   - F-MAN-02 (equipo de cómputo) de un puesto → un puesto con sus equipos,
//     personas a cargo e historial.
//   - F-MAN-02 de backup (carpeta o nombre con "Backup", "dado de baja") →
//     sin puesto: su historial pasa al equipo principal (CPU o portátil).
//   - F-MAN-03 (equipo o infraestructura) → su historial pasa a ese equipo.
// ─────────────────────────────────────────────

import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import { leerLibro } from './leer-hoja.mjs';

XLSX.set_fs(fs);

const RAIZ = process.argv[2] ?? 'C:/Users/LIDER I.T/hojas-de-vida';
const SALIDA = path.join(RAIZ, 'plan-importacion.json');

// ── Reglas del negocio (dichas por el líder de T.I.) ──
const IGNORAR_CARPETA = /antiguas|AIRES ACONDICIONADOS/i;
const NO_SON_HOJAS = /inventario_betrmedia|conciliacion|decisiones|plan-importacion/i;
const ES_BACKUP = /backup|dado de baja/i;
// Componentes que aparecen vigentes en dos hojas: hoja donde de verdad están
// (pestaña B de las decisiones, resuelta el 2026-11-03).
const UBICACION_ELEGIDA = {
  'BM-INV-0190': /EQUIPO #1 +- Realizadores/i,
  'BM-INV-0593': /EQUIPO #5 Lideres Optimizaci/i,
  'BM-INV-0594': /EQUIPO #5 Lideres Optimizaci/i,
  'BM-INV-0214': /HP Sanner/i,
  'BM-INV-0651': /EQUIPO #1 - RECLAMACI/i,
};
// Nombres de puesto que no salen bien de forma automática.
// Por defecto se usa el "Encargado" que ya tiene el inventario para esos equipos
// (ej. "Reali. Audiovisual #2"), así nada cambia de nombre.
const NOMBRE_PUESTO = {
  'EQUIPO #1 Servidor - CPU': 'Servidor',
  'EQUIPO #1 Traffickers de operaciones': 'Trafficker de Operaciones #1',
  'EQUIPO #2 Coor. Plataformas digitales': 'Coor. Plataformas Digitales #2',
  'EQUIPO #5 Lideres Optimización Portatil': 'Lideres Optimización Portátil',
};
// Nombres para equipos por crear cuya hoja no trae uno claro.
const NOMBRE_CREAR = {
  'BM-INV-0010': 'UPS', 'BM-INV-0142': 'UPS', 'BM-INV-0145': 'UPS', 'BM-INV-0148': 'UPS',
  'BM-INV-0149': 'UPS', 'BM-INV-0449': 'UPS', 'BM-INV-0627': 'UPS Servidor',
  'BM-INV-0281': 'Combo teclado y mouse', 'BM-INV-0306': 'Servidor - CPU',
  'BM-INV-0073': 'Base de televisor', 'BM-INV-0075': 'Base de televisor',
  'BM-INV-0250': 'Cargador de baterías Canon',
};
const NOMBRE_DUDOSO = /^(|cpu|c[oó]digo|base|s\/?n\b.*|n\/?a)$/i;
// Un "Encargado" del inventario es nombre de puesto (y no de persona) si lleva
// número o una palabra de cargo/área.
const PARECE_PUESTO = /#|coor|analista|l[ií]der|jefe|director|recepci|optimizaci|contab|auditor|dise[ñn]o|reali|gestor|reclamaci|periodista|plataformas|talento|comercial|servidor/i;

// ── Utilidades ──
const codigosEn = (s) => [...String(s).toUpperCase().matchAll(/BM\s?-?\s?INV\s?-?\s?(\d{3,4})/g)]
  .map(m => `BM-INV-${m[1].padStart(4, '0')}`);
const limpio = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const sinAcentos = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const pad = (n) => String(n).padStart(2, '0');

// Celda de fecha → 'YYYY-MM-DD' (número de serie de Excel o texto dd/mm/aaaa).
function fechaDe(celda) {
  if (!celda) return null;
  const t = limpio(celda.text);
  // Año al que le falta un dígito ("204", "0206") → 2024, 2026
  const iso = (anio, mes, dia) => `${anio < 2000 ? 2020 + (anio % 10) : anio}-${pad(mes)}-${pad(dia)}`;
  if (celda.numero && /^-?\d+(\.\d+)?$/.test(t)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(+t) * 864e5);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  // Tolera espacios y separadores de más o de menos: "27 /01/2025", "25//08/2023", "09/082024".
  const m = t.replace(/\s+/g, '').match(/^(\d{1,2})[/.-]+(\d{1,2})[/.-]*(\d{2,4})$/);
  if (!m) return null;
  if (+m[2] < 1 || +m[2] > 12 || +m[1] < 1 || +m[1] > 31) return null;
  return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
}

// ── Decisiones del líder de T.I. ──
function leerDecisiones() {
  const wb = XLSX.readFile(path.join(RAIZ, 'decisiones-importacion.xlsx'));
  const hoja = (prefijo) => XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames.find(n => n.startsWith(prefijo))], { defval: '' });
  const crear = new Map();
  const ignorar = new Set();
  for (const r of hoja('A')) {
    const codigo = codigosEn(r['N° Inventario'])[0];
    const d = limpio(r['Tu decisión']).toUpperCase();
    if (!codigo) continue;
    if (d === 'CREAR') crear.set(codigo, limpio(r['Categoría al crear']) || 'Otros');
    else if (d === 'IGNORAR') ignorar.add(codigo);
  }
  const compartidos = new Set(hoja('B')
    .filter(r => limpio(r['Tu decisión']).toUpperCase() === 'COMPARTIDO')
    .flatMap(r => codigosEn(r['N° Inventario'])));
  return { crear, ignorar, compartidos };
}

// ── Lectura de una hoja ──
const SECCION = /^(IDENTIFICACI|COMPONENTES|HARDWARE|HISTORIAL|NOVEDADES|ADICIONALES|ACCESORIOS)/i;

function analizarHoja(cells) {
  // Los títulos de sección van en la primera columna (B); "ACCESORIOS" en la
  // columna I es el encabezado de una columna de componentes, no una sección.
  const marcas = cells
    .filter(c => c.col <= 2 && SECCION.test(limpio(c.text)) && limpio(c.text).length < 40 && !/:$/.test(limpio(c.text)))
    .map(c => ({ row: c.row, sec: sinAcentos(limpio(c.text)).toUpperCase().slice(0, 5) }));
  const seccionDe = (row) => marcas.reduce((s, m) => (m.row <= row ? m.sec : s), 'CABEZ');
  const filaDe = (sec) => marcas.find(m => m.sec === sec)?.row;
  const finDe = (sec) => { const ini = filaDe(sec); return Math.min(...marcas.filter(m => m.row > ini).map(m => m.row), Infinity); };
  const valorJunto = (re) => {
    const et = cells.find(c => re.test(limpio(c.text)));
    const v = et && cells.find(c => c.row === et.row && c.col > et.col);
    if (!v) return '';
    // Seriales que Excel guardó como número: "1.419036519E9" → "1419036519"
    if (v.numero && Number.isFinite(+v.text)) return Number.isInteger(+v.text) ? (+v.text).toFixed(0) : String(+v.text);
    const t = limpio(v.text);
    return /^(N\/?A|NO APLICA|-)$/i.test(t) ? '' : t;
  };

  // Composición: códigos en identificación, componentes, adicionales y hardware.
  // Un código tachado en todas sus apariciones es un componente que ya salió.
  const tachado = new Map();
  const contexto = new Map();
  for (const c of cells) {
    if (!/^(IDENT|COMPO|ADICI|ACCES|CABEZ|HARDW)/.test(seccionDe(c.row))) continue;
    for (const r of c.runs) for (const codigo of codigosEn(r.text)) {
      tachado.set(codigo, (tachado.get(codigo) ?? true) && r.struck);
      if (!contexto.has(codigo)) contexto.set(codigo, limpio(c.text));
    }
  }
  const actuales = [...tachado].filter(([, t]) => !t).map(([c]) => c);
  const retirados = [...tachado].filter(([, t]) => t).map(([c]) => c);

  // Tabla de una sección: encabezados (col → nombre) y filas de datos.
  const tabla = (sec, columnas) => {
    const ini = filaDe(sec);
    if (ini == null) return [];
    const fin = finDe(sec);
    const zona = cells.filter(c => c.row > ini && c.row < fin);
    const col = {};
    for (const [clave, re] of Object.entries(columnas)) col[clave] = zona.find(c => re.test(limpio(c.text)))?.col;
    const filaEncabezado = Math.max(...zona.filter(c => Object.values(columnas).some(re => re.test(limpio(c.text)))).map(c => c.row), ini);
    const filas = new Map();
    for (const c of zona) if (c.row > filaEncabezado) (filas.get(c.row) ?? filas.set(c.row, []).get(c.row)).push(c);
    return [...filas.values()].map(fila => {
      const en = (clave) => fila.find(c => c.col === col[clave]);
      // La descripción puede estar en varias celdas combinadas a la derecha
      return { en, fila, col };
    });
  };

  const historial = tabla('HISTO', {
    fecha: /^Fecha/i, preventivo: /^Preventivo$/i, correctivo: /^Correctivo$/i,
    descripcion: /Descripci[oó]n/i, responsable: /^Responsable$/i,
  }).map(({ en, fila, col }) => {
    const desc = limpio(fila.filter(c => c.col >= (col.descripcion ?? 99) && c.col !== col.responsable).map(c => c.text).join(' '));
    const marca = (k) => /\S/.test(en(k)?.text ?? '');
    const tipo = marca('preventivo') ? 'preventivo' : marca('correctivo') ? 'correctivo' : 'nota';
    return { fecha: fechaDe(en('fecha')), tipo, descripcion: desc, responsable: limpio(en('responsable')?.text), fechaTexto: en('fecha') && !fechaDe(en('fecha')) ? limpio(en('fecha').text) : '' };
  }).filter(h => h.descripcion || h.fecha);

  const novedades = tabla('NOVED', { fecha: /^Fecha/i, novedad: /^Novedad/i, reporta: /^Reporta$/i })
    .map(({ en, fila, col }) => ({
      fecha: fechaDe(en('fecha')), tipo: 'novedad',
      descripcion: limpio(fila.filter(c => c.col >= (col.novedad ?? 99) && c.col !== col.reporta).map(c => c.text).join(' ')),
      reporta: limpio(en('reporta')?.text),
      fechaTexto: en('fecha') && !fechaDe(en('fecha')) ? limpio(en('fecha').text) : '',
    }))
    .filter(n => n.descripcion);

  return { marcas, seccionDe, filaDe, finDe, valorJunto, actuales, retirados, contexto, historial, novedades };
}

// Personas a cargo (columna con el título "Personas a cargo", hasta la primera fila vacía).
function personasDe(cells) {
  const titulo = cells.find(c => /^Personas a cargo/i.test(limpio(c.text)));
  if (!titulo) return [];
  const nombres = [];
  for (let row = titulo.row + 1; ; row++) {
    const c = cells.find(x => x.row === row && x.col === titulo.col);
    if (!c) break;
    const n = limpio(c.text);
    if (n && !/^(N\/?A|NO APLICA)$/i.test(n)) nombres.push(n);
  }
  return [...new Set(nombres)].map(nombre => ({ nombre, correo: '' }));
}

// Lo que hay en el puesto sin código de inventario (audífonos por serial, pad mouse…).
function otrosElementos(cells, a) {
  const ini = a.filaDe('COMPO');
  if (ini == null) return [];
  const fin = a.finDe('COMPO');
  const enc = cells.filter(c => c.row === ini + 1);
  const etiqueta = (col) => limpio(enc.find(c => c.col === col)?.text);
  return cells
    .filter(c => c.row > ini + 1 && c.row < fin)
    .filter(c => !codigosEn(c.text).length && !c.runs.every(r => r.struck))
    .map(c => ({ et: etiqueta(c.col), txt: limpio(c.runs.filter(r => !r.struck).map(r => r.text).join('')) }))
    .map(x => ({ ...x, txt: x.txt.replace(/^[-–\s]+/, '') }))             // "- Dayanna Guerrero"
    .filter(x => x.txt && !/^(NO APLICA|N\/?A)$/i.test(x.txt))
    .map(x => (x.et ? `${x.et.charAt(0)}${x.et.slice(1).toLowerCase()}: ${x.txt}` : x.txt));
}

const HARDWARE = { ram: /^RAM$/i, procesador: /^PROCESADOR$/i, tarjetaGrafica: /^TARJETA G/i, almacenamiento: /^ALMACENAMIENTO$/i };
function hardwareDe(cells, a) {
  const ini = a.filaDe('HARDW');
  if (ini == null) return {};
  const zona = cells.filter(c => c.row > ini && c.row < a.finDe('HARDW'));
  const out = {};
  for (const [k, re] of Object.entries(HARDWARE)) {
    const et = zona.find(c => re.test(limpio(c.text)));
    const v = et && limpio(zona.find(c => c.col === et.col && c.row > et.row)?.text);
    if (v && !/^(N\/?A|NO APLICA|-)$/i.test(v)) out[k] = v;
  }
  return out;
}

// "EQUIPO #2 - OPTIMIZACIÓN" → "Optimización #2"; "EQUIPO #10 Administración - Jefe Creativo" → "Jefe Creativo".
function nombrePuesto(archivo) {
  const base = limpio(path.basename(archivo, '.xlsx').replace(/_+$/, '').replace(/_/g, ' '));
  if (NOMBRE_PUESTO[base]) return NOMBRE_PUESTO[base];
  const num = base.match(/#\s*(\d+)/)?.[1];
  let resto = limpio(base.replace(/^EQUIPO\s*#\s*\d+\s*/i, '').replace(/^[-–\s]+/, ''));
  if (/Administraci[oó]n/i.test(resto)) return limpio(resto.replace(/^-?\s*Administraci[oó]n\s*-?\s*/i, ''));
  resto = resto.replace(/\s+-\s+.*$/, '');                       // "Streaming - Auditoria" → "Streaming"
  const titulo = resto === resto.toUpperCase()
    ? resto.charAt(0) + resto.slice(1).toLowerCase()               // "OPTIMIZACIÓN" → "Optimización"
    : resto;
  return num ? `${titulo} #${num}` : titulo;
}

// ── Recorrido ──
const archivos = [];
(function recorrer(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (!IGNORAR_CARPETA.test(f)) recorrer(p); }
    else if (p.endsWith('.xlsx') && !f.startsWith('~$') && !NO_SON_HOJAS.test(f) && !IGNORAR_CARPETA.test(p)) archivos.push(p);
  }
})(RAIZ);

const { crear, ignorar, compartidos } = leerDecisiones();

// Último inventario exportado de la app (solo para tomar los nombres de puesto).
const exportes = fs.readdirSync(RAIZ).filter(f => /^inventario_betrmedia_.*.xlsx$/i.test(f)).sort();
const encargadoDe = new Map();
if (exportes.length) {
  const inv = XLSX.utils.sheet_to_json(XLSX.readFile(path.join(RAIZ, exportes.at(-1))).Sheets.Inventario, { defval: '' });
  for (const r of inv) for (const c of codigosEn(r['N° Inventario'])) encargadoDe.set(c, limpio(r['Persona Encargada']));
}
const avisos = [];
const puestos = [];
const historialEquipos = [];
const datosCrear = new Map(); // código → { nombre, marca, modelo, numeroSerial }
const fichas = new Map();     // código → { accesorios } (casilla "Adicionales o accesorios" del F-MAN-03)

for (const ruta of archivos.sort()) {
  const rel = path.relative(RAIZ, ruta).split(path.sep).slice(1).join('/'); // sin la carpeta del zip
  const area = /ADMINISTRATIVOS/i.test(rel) ? 'Administrativos' : 'Operaciones';
  for (const { name, cells } of leerLibro(ruta)) {
    const todo = cells.map(c => c.text).join(' ');
    const formato = /F-?MAN-?02/i.test(todo) ? 'F-MAN-02' : /F-?MAN-?03/i.test(todo) ? 'F-MAN-03' : null;
    if (!formato) { avisos.push(`Sin formato reconocido: ${rel} (${name})`); continue; }
    const a = analizarHoja(cells);
    const historial = [...a.historial, ...a.novedades];
    const hoja = rel.split('/').slice(-2).join('/');

    // Datos de identificación para equipos que hay que crear
    const idCodigo = codigosEn(a.valorJunto(/^No\.? ?INVENTARIO/i))[0];
    if (idCodigo && formato === 'F-MAN-03') {
      const re = UBICACION_ELEGIDA[idCodigo];
      const accesorios = a.valorJunto(/^ADICIONALES O ACCESORIOS/i);
      if (accesorios && (!re || re.test(rel))) fichas.set(idCodigo, { accesorios });
      datosCrear.set(idCodigo, {
        nombre: a.valorJunto(/^NOMBRE DEL EQUIPO/i), marca: a.valorJunto(/^MARCA$/i),
        modelo: a.valorJunto(/^MODELO$/i), numeroSerial: a.valorJunto(/^SERIAL$/i).replace(/^S\/?N\s*[-:]?\s*/i, ''),
      });
    }
    for (const [codigo, ctx] of a.contexto) if (!datosCrear.has(codigo)) {
      const nombre = limpio(ctx.replace(/BM\s?-?\s?INV\s?-?\s?\d{3,4}/gi, '').replace(/^[-/:\s]+|[-/:\s]+$/g, ''));
      datosCrear.set(codigo, { nombre: nombre.slice(0, 60) });
    }

    const esPuesto = formato === 'F-MAN-02' && !ES_BACKUP.test(rel);
    if (esPuesto) {
      puestos.push({
        clave: `hv-${sinAcentos(hoja).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        nombre: nombrePuesto(rel), area, hoja,
        personas: personasDe(cells),
        observaciones: otrosElementos(cells, a).join('\n'),
        equipos: a.actuales,
        retirados: a.retirados,
        hardware: hardwareDe(cells, a),
        historial,
      });
    } else {
      const codigos = formato === 'F-MAN-03' ? (idCodigo ? [idCodigo] : a.actuales.slice(0, 1)) : a.actuales;
      if (!codigos.length) { if (historial.length) avisos.push(`Hoja sin Nº de inventario, su historial no se importa: ${hoja}`); continue; }
      if (historial.length) historialEquipos.push({ hoja, formato, codigos, historial });
    }
  }
}

// ── Nombres: el Encargado del inventario si es nombre de puesto ──
{
  const candidatos = puestos.flatMap(p => {
    const cuenta = {};
    p.equipos.forEach(c => { const e = encargadoDe.get(c); if (e && PARECE_PUESTO.test(e)) cuenta[e] = (cuenta[e] ?? 0) + 1; });
    return Object.entries(cuenta).filter(([, n]) => n >= 2).map(([nombre, n]) => ({ p, nombre, n }));
  }).sort((a, b) => b.n - a.n);
  const usados = new Set();
  for (const { p, nombre } of candidatos) {
    if (p.nombreInventario || usados.has(nombre.toLowerCase())) continue;
    p.nombreInventario = nombre; usados.add(nombre.toLowerCase());
  }
  for (const p of puestos) {
    const base = limpio(path.basename(p.hoja, '.xlsx').replace(/_+$/, '').replace(/_/g, ' '));
    if (!NOMBRE_PUESTO[base] && p.nombreInventario) p.nombre = p.nombreInventario;
    delete p.nombreInventario;
  }
  const repetidos = puestos.filter((p, i) => puestos.findIndex(q => q.nombre.toLowerCase() === p.nombre.toLowerCase()) !== i);
  repetidos.forEach(p => avisos.push(`Nombre de puesto repetido: ${p.nombre} (${p.hoja})`));
}

// ── Un componente vigente en un solo puesto ──
const dondeEsta = new Map();
for (const p of puestos) for (const c of p.equipos) (dondeEsta.get(c) ?? dondeEsta.set(c, []).get(c)).push(p);
const compartidosPorArea = { Operaciones: [], Administrativos: [] };
for (const [codigo, lista] of dondeEsta) {
  if (compartidos.has(codigo)) {
    lista.forEach(p => { p.equipos = p.equipos.filter(c => c !== codigo); });
    const area = lista[0]?.area ?? 'Operaciones';
    compartidosPorArea[area].push(codigo);
    continue;
  }
  if (lista.length < 2) continue;
  const elegido = UBICACION_ELEGIDA[codigo]
    ? lista.find(p => UBICACION_ELEGIDA[codigo].test(p.hoja))
    : lista[0];
  if (!UBICACION_ELEGIDA[codigo]) avisos.push(`${codigo} vigente en varias hojas (${lista.map(p => p.nombre).join(', ')}): queda en ${elegido.nombre}`);
  lista.filter(p => p !== elegido).forEach(p => { p.equipos = p.equipos.filter(c => c !== codigo); });
}
// Hojas de equipo sueltas con la ubicación resuelta (la impresora 0214)
for (const h of historialEquipos) {
  const re = UBICACION_ELEGIDA[h.codigos[0]];
  if (h.formato === 'F-MAN-03' && re && !re.test(h.hoja)) h.descartada = true;
}
for (const [area, codigos] of Object.entries(compartidosPorArea)) {
  if (!codigos.length) continue;
  puestos.push({
    clave: `hv-compartidos-${area.toLowerCase()}`, nombre: `${area} - Compartidos`, area, hoja: null,
    personas: [], observaciones: 'Equipos que usa todo el departamento.',
    equipos: codigos, retirados: [], hardware: {}, historial: [],
  });
}

// Cargadores y demás ignorados: fuera de la composición.
for (const p of puestos) {
  p.equipos = p.equipos.filter(c => !ignorar.has(c));
  p.retirados = p.retirados.filter(c => !ignorar.has(c));
}

// Fechas imposibles (en el futuro): se importan igual, pero se avisa para corregirlas en la app.
const hoy = new Date().toISOString().slice(0, 10);
for (const x of [...puestos, ...historialEquipos.filter(h => !h.descartada)]) {
  for (const h of x.historial) if (h.fecha && h.fecha > hoy) avisos.push(`Fecha en el futuro (${h.fecha}) en ${x.hoja}: "${h.descripcion.slice(0, 50)}"`);
}

const plan = {
  version: 1,
  generado: new Date().toISOString(),
  puestos,
  historialEquipos: historialEquipos.filter(h => !h.descartada),
  crear: [...crear].map(([codigo, categoria]) => {
    const d = datosCrear.get(codigo) ?? {};
    const dudoso = NOMBRE_DUDOSO.test(limpio(d.nombre));
    const nombre = NOMBRE_CREAR[codigo] ?? (dudoso ? categoria : d.nombre);
    if (dudoso && !NOMBRE_CREAR[codigo]) avisos.push(`${codigo} se crea con el nombre "${nombre}": cámbialo en la app si hace falta`);
    return {
      codigo, categoria, nombre,
      marca: d.marca ?? '', modelo: d.modelo ?? '',
      numeroSerial: d.numeroSerial || (d.nombre?.match(/^S\/?N\s*[-:]?\s*(\S+)/i)?.[1] ?? ''),
    };
  }),
  fichas: [...fichas].map(([codigo, f]) => ({ codigo, ...f })),
  avisos,
};
fs.writeFileSync(SALIDA, JSON.stringify(plan, null, 1));

// ── Resumen ──
const n = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
console.log(`Hojas leídas: ${archivos.length}`);
console.log(`Puestos: ${puestos.length} (${n(puestos, p => p.equipos.length)} equipos, ${n(puestos, p => p.historial.length)} registros de historial, ${n(puestos, p => p.retirados.length)} componentes retirados)`);
console.log(`Historial de equipos sueltos: ${plan.historialEquipos.length} hojas, ${n(plan.historialEquipos, h => h.historial.length)} registros`);
console.log(`Equipos por crear: ${plan.crear.length}`);
console.log(`Sin fecha: ${n([...puestos, ...plan.historialEquipos], x => x.historial.filter(h => !h.fecha).length)}`);
console.log(`Avisos: ${avisos.length}`);
avisos.forEach(x => console.log(`  - ${x}`));
console.log(`→ ${SALIDA}`);
