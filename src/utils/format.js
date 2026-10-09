// Formato de fechas único para toda la app: no depender del idioma del navegador.
const LOCALE = 'es-CO';

export const formatFecha = (date) => (date ? date.toLocaleDateString(LOCALE) : '—');

export const formatFechaHora = (date) => (date ? date.toLocaleString(LOCALE) : '');
