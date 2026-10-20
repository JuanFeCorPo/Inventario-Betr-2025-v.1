// Formato de fechas único para toda la app: no depender del idioma del navegador.
const LOCALE = 'es-CO';

export const formatFecha = (date) => (date ? date.toLocaleDateString(LOCALE) : '—');

export const formatFechaHora = (date) => (date ? date.toLocaleString(LOCALE) : '');

// "Hoy" para campos <input type="date"> en la zona horaria del usuario.
// toISOString() usa UTC: en Colombia, después de las 7 p. m. daba el día siguiente.
const pad = (n) => String(n).padStart(2, '0');
const aISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const hoyLocal = () => aISO(new Date());

export const haceUnMesLocal = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return aISO(d);
};
