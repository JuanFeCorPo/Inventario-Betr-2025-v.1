// ─────────────────────────────────────────────
//  Cargadores que estaban anotados en Observaciones ("Cargador: BM-INV-0672") y
//  pasan a su casilla "Cargador" (portátiles y celulares). Lógica pura: la pantalla
//  muestra lo que se va a hacer y solo escribe lo que la persona confirme.
//  Las Observaciones no se tocan: el texto original se queda como está.
// ─────────────────────────────────────────────

import { CATEGORIAS_CON_CARGADOR } from '../config/constants';
import { cargadorEnTexto, codigoInventario } from './importarHojas';

const sinCargador = (i) => !String(i.cargador ?? '').trim();
const menciona = (texto) => /cargador/i.test(String(texto ?? ''));

// Devuelve:
//  - propuestas: equipo sin cargador cuya observación trae un Nº. Si ese Nº es un equipo del
//    inventario lo dice (`encontrado`); si no, está bien: el cargador no es un equipo aparte.
//    `avisos` solo marca lo raro: es el mismo Nº del equipo o ya es el cargador de otro.
//  - sinNumero: equipos que mencionan un cargador pero sin Nº ("Cargador con cable"): quedan igual.
export const proponerCargadores = (items = []) => {
  const porCodigo = new Map();
  for (const i of items) {
    const c = codigoInventario(i.numeroInventario);
    if (c && !porCodigo.has(c)) porCodigo.set(c, i);
  }
  const yaUsados = new Map(); // cargador → equipo que ya lo tiene anotado
  for (const i of items) {
    if (CATEGORIAS_CON_CARGADOR.includes(i.categoria) && !sinCargador(i)) yaUsados.set(codigoInventario(i.cargador) ?? String(i.cargador).trim().toUpperCase(), i);
  }

  const candidatos = items.filter(i => CATEGORIAS_CON_CARGADOR.includes(i.categoria) && i.estado !== 'De Baja' && sinCargador(i));
  const propuestas = [];
  const sinNumero = [];
  for (const item of candidatos) {
    const cargador = cargadorEnTexto(item.observaciones);
    if (!cargador) { if (menciona(item.observaciones)) sinNumero.push(item); continue; }
    const avisos = [];
    const encontrado = porCodigo.get(cargador) ?? null;
    if (cargador === codigoInventario(item.numeroInventario)) avisos.push('Es el mismo número del equipo.');
    const otro = yaUsados.get(cargador);
    if (otro && otro.id !== item.id) avisos.push(`Ya es el cargador de ${otro.nombre} (${otro.numeroInventario}).`);
    propuestas.push({ item, cargador, encontrado, avisos });
  }
  // Dos equipos de la lista con el mismo cargador
  const veces = new Map();
  for (const p of propuestas) veces.set(p.cargador, (veces.get(p.cargador) ?? 0) + 1);
  for (const p of propuestas) if (veces.get(p.cargador) > 1) p.avisos.push('Otro equipo de esta lista tiene el mismo cargador.');
  return { propuestas, sinNumero };
};
