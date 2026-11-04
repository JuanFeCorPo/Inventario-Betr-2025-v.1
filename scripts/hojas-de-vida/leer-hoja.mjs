// ─────────────────────────────────────────────
//  Lector de las hojas de vida en Excel (formatos F-MAN-02 y F-MAN-03).
//
//  SheetJS no informa bien el tachado, y en las hojas un componente tachado
//  es un componente que ya salió del puesto. Por eso se lee el XML del .xlsx
//  directamente: tachado de celda completa (estilo) y tachado parcial
//  (texto enriquecido, <rPr><strike/>).
// ─────────────────────────────────────────────

import XLSX from 'xlsx';

const { CFB } = XLSX;

const decode = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const archivo = (cfb, nombre) => {
  const i = cfb.FullPaths.indexOf(`Root Entry/${nombre}`);
  const e = i < 0 ? null : cfb.FileIndex[i];
  return e ? Buffer.from(e.content).toString('utf8') : null;
};

const STRIKE = /<strike(?![^>]*val="(0|false)")/;
const textos = (xml) => [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => decode(m[1])).join('');

// Cadena compartida → tramos [{ text, struck }] (struck null = lo decide el estilo de la celda)
const tramos = (si) => {
  const runs = [...si.matchAll(/<r>([\s\S]*?)<\/r>/g)];
  if (!runs.length) return [{ text: textos(si), struck: null }];
  return runs.map(m => ({
    text: textos(m[1]),
    struck: STRIKE.test(m[1].match(/<rPr>([\s\S]*?)<\/rPr>/)?.[1] ?? ''),
  }));
};

const numeroColumna = (letras) => [...letras].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);

// Devuelve [{ name, cells: [{ row, col, text, runs: [{ text, struck }] }] }] por cada hoja del libro.
export function leerLibro(ruta) {
  const cfb = CFB.read(ruta, { type: 'file' });
  const estilos = archivo(cfb, 'xl/styles.xml') ?? '';
  const fuentesTachadas = [...(estilos.match(/<fonts[^>]*>([\s\S]*?)<\/fonts>/)?.[1] ?? '')
    .matchAll(/<font>([\s\S]*?)<\/font>|<font\/>/g)].map(m => STRIKE.test(m[1] ?? ''));
  const fuenteDeEstilo = [...(estilos.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '')
    .matchAll(/<xf ([^>]*?)\/?>/g)].map(m => +(m[1].match(/fontId="(\d+)"/)?.[1] ?? 0));
  const compartidas = [...(archivo(cfb, 'xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map(m => tramos(m[1]));
  const libro = archivo(cfb, 'xl/workbook.xml');
  const rels = archivo(cfb, 'xl/_rels/workbook.xml.rels');

  return [...libro.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map(([, name, rid]) => {
    const t = rels.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"|Target="([^"]+)"[^>]*Id="${rid}"`));
    const xml = archivo(cfb, `xl/${(t[1] || t[2]).replace(/^\/?xl\//, '')}`) ?? '';
    const cells = [];
    for (const [, col, row, attrs, inner = ''] of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const estilo = +(attrs.match(/ s="(\d+)"/)?.[1] ?? 0);
      const celdaTachada = !!fuentesTachadas[fuenteDeEstilo[estilo]];
      const tipo = attrs.match(/ t="(\w+)"/)?.[1];
      let runs;
      if (tipo === 's') runs = compartidas[+inner.match(/<v>(\d+)<\/v>/)?.[1]] ?? [];
      else if (tipo === 'inlineStr') runs = tramos(inner);
      else {
        const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
        runs = v == null ? [] : [{ text: decode(v), struck: null, numero: tipo !== 'str' }];
      }
      runs = runs.map(r => ({ ...r, struck: r.struck ?? celdaTachada }));
      const text = runs.map(r => r.text).join('');
      if (text.trim()) cells.push({ row: +row, col: numeroColumna(col), text, runs, numero: runs[0]?.numero === true });
    }
    cells.sort((a, b) => a.row - b.row || a.col - b.col);
    return { name: decode(name), cells };
  });
}
