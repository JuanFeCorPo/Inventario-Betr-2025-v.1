// ─────────────────────────────────────────────
//  Solicitudes de soporte (tickets). Lógica pura, sin React ni Firebase.
//  Un colaborador reporta un problema de un equipo de su puesto o uno general
//  (internet, programas, cuentas…). T.I. lo toma, responde y lo resuelve; al
//  resolverlo queda en la hoja de vida del puesto (Novedad + Correctivo).
// ─────────────────────────────────────────────

export const CATEGORIAS_TICKET = {
  equipo:    { label: 'Un equipo de mi puesto', corto: 'Equipo' },
  internet:  { label: 'Internet o red',          corto: 'Internet' },
  software:  { label: 'Programas o aplicaciones', corto: 'Programas' },
  cuentas:   { label: 'Cuentas y accesos',        corto: 'Cuentas' },
  impresora: { label: 'Impresora',                corto: 'Impresora' },
  otro:      { label: 'Otro',                     corto: 'Otro' },
};

export const ESTADOS_TICKET = {
  recibido:   { label: 'Recibido',   cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  en_proceso: { label: 'En proceso', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  resuelto:   { label: 'Resuelto',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};
export const ABIERTOS = ['recibido', 'en_proceso'];
export const estaAbierto = (t) => ABIERTOS.includes(t?.estado);

export const URGENCIAS = {
  normal:  { label: 'Puedo seguir trabajando' },
  bloquea: { label: 'No puedo trabajar' },
};

const ms = (v) => v?.toMillis?.() ?? (v instanceof Date ? v.getTime() : 0);

// Código corto para nombrar la solicitud por teléfono o chat: "T-0311-4F2"
export const codigoTicket = (fecha = new Date(), azar = Math.random) => {
  const pad = (n) => String(n).padStart(2, '0');
  const sufijo = Math.floor(azar() * 36 ** 3).toString(36).toUpperCase().padStart(3, '0');
  return `T-${pad(fecha.getDate())}${pad(fecha.getMonth() + 1)}-${sufijo}`;
};

// "Mouse Logitech · no responde" / "Internet o red"
export const tituloTicket = (t) => (t.categoria === 'equipo' && t.equipoNombre
  ? `${t.equipoNombre}${t.equipoCodigo ? ` (${t.equipoCodigo})` : ''}`
  : CATEGORIAS_TICKET[t.categoria]?.label ?? 'Ticket');

// Abiertos primero; entre abiertos, los que impiden trabajar y luego los más antiguos.
// Resueltos: los más recientes primero.
export const ordenarTickets = (tickets) => [...tickets].sort((a, b) => {
  const ab = estaAbierto(a), bb = estaAbierto(b);
  if (ab !== bb) return ab ? -1 : 1;
  if (ab) {
    const ua = a.urgencia === 'bloquea' ? 0 : 1, ub = b.urgencia === 'bloquea' ? 0 : 1;
    return ua - ub || ms(a.creadoAt) - ms(b.creadoAt);
  }
  return ms(b.resueltoAt ?? b.actualizado) - ms(a.resueltoAt ?? a.actualizado);
});

// Para T.I.: solicitudes que piden atención (nuevas o con un mensaje sin leer).
export const pendientesTI = (tickets) => tickets.filter(t => t.estado === 'recibido' || (estaAbierto(t) && t.vistoPorTI === false));

// "hace 5 min", "hace 3 h", "hace 2 días", o la fecha
export const haceCuanto = (v, ahora = Date.now()) => {
  const t = ms(v);
  if (!t) return '';
  const min = Math.floor((ahora - t) / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} día${d === 1 ? '' : 's'}`;
  return `el ${new Date(t).toLocaleDateString('es-CO')}`;
};

// Valida lo que el colaborador escribe antes de enviar.
export const validarTicket = ({ categoria, equipoId, descripcion }) => {
  const errores = {};
  if (!CATEGORIAS_TICKET[categoria]) errores.categoria = 'Elige qué tipo de problema es.';
  if (categoria === 'equipo' && !equipoId) errores.equipoId = 'Elige el equipo que falla.';
  const d = String(descripcion ?? '').trim();
  if (d.length < 5) errores.descripcion = 'Cuéntanos qué pasa (al menos unas palabras).';
  if (d.length > 2000) errores.descripcion = 'Máximo 2000 caracteres.';
  return errores;
};

// ── Vista del colaborador ──
// Quién atiende, en corto: "Juan Felipe Cortés" → "Juan"; un correo → lo de antes de la @.
// Si se tomó cuando T.I. aún no tenía nombre (quedó el correo) y luego respondió ya con
// su nombre, se usa ese nombre.
export const quienAtiende = (t) => {
  const s = String(t?.tomadoPor ?? '').trim();
  if (!s) return '';
  if (!s.includes('@')) return s.split(/\s+/)[0];
  const conNombre = [...(t.mensajes ?? [])].reverse().find(m => m.autor === 'ti' && m.nombre && !String(m.nombre).includes('@'));
  return conNombre ? String(conNombre.nombre).trim().split(/\s+/)[0] : s.split('@')[0];
};

// La línea que responde "¿qué pasa con mi problema?" (la etiqueta ya dice el estado).
export const lineaParaColaborador = (t, ahora = Date.now()) => {
  if (t.estado === 'resuelto') return `Resuelto ${haceCuanto(t.resueltoAt ?? t.actualizado, ahora)}`.trim();
  const cuando = haceCuanto(t.actualizado ?? t.creadoAt, ahora);
  const quien = quienAtiende(t);
  const que = t.estado === 'en_proceso'
    ? (quien ? `Lo atiende ${quien}` : 'T.I. lo está atendiendo')
    : 'T.I. lo revisará pronto';
  return cuando ? `${que} · ${cuando}` : que;
};

export const tieneRespuestaNueva = (t) => t?.vistoPorColaborador === false;

// Para el colaborador: primero lo que T.I. le respondió, luego lo abierto (lo más
// reciente arriba) y al final lo resuelto.
export const ordenarParaColaborador = (tickets) => [...tickets].sort((a, b) => {
  const na = tieneRespuestaNueva(a) ? 0 : 1, nb = tieneRespuestaNueva(b) ? 0 : 1;
  if (na !== nb) return na - nb;
  const ab = estaAbierto(a), bb = estaAbierto(b);
  if (ab !== bb) return ab ? -1 : 1;
  return ms(b.actualizado ?? b.creadoAt) - ms(a.actualizado ?? a.creadoAt);
});

// ── Avisos mientras la app está abierta ──
// Identifica "una respuesta nueva": cambia cuando T.I. escribe otra vez o cambia el estado.
export const firmaRespuesta = (t) => `${t.id}|${(t.mensajes ?? []).length}|${t.estado}`;

// "(2) T.I. te respondió · BETR MEDIA TECH" en la pestaña; sin respuestas, el título normal.
export const tituloPestana = (base, nuevas) => (nuevas > 0 ? `(${nuevas}) T.I. te respondió · ${base}` : base);
