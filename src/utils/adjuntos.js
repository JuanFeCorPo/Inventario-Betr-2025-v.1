// ─────────────────────────────────────────────
//  Archivos adjuntos de los tickets (PDF o imagen).
//  Sin Firebase Storage (pide plan Blaze): cada archivo se guarda en base64,
//  partido en pedazos de ≤700 KB (Firestore acepta 1 MB por documento) en
//  tickets/{id}/partes, y el mensaje solo lleva su ficha (nombre, tipo, tamaño).
//  Límite: 5 MB por mensaje en total y 3 archivos. Las fotos se reducen solas
//  antes de subirse, así que caben varias.
// ─────────────────────────────────────────────

export const ADJUNTOS_MAX_BYTES = 5 * 1024 * 1024; // por mensaje, ya reducidas las fotos
export const ADJUNTOS_MAX_ARCHIVOS = 3;
export const PARTE_MAX_CHARS = 700_000;
export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
export const TIPO_PDF = 'application/pdf';
export const ACEPTAR = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';
const IMAGEN_ENTRADA_MAX = 25 * 1024 * 1024; // para no cargar en memoria fotos enormes

export const esImagen = (tipo) => TIPOS_IMAGEN.includes(tipo);

// "320 KB", "1,4 MB"
export const formatoTamano = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
};

// Tipo real según la extensión cuando el navegador no lo informa
const tipoDe = (file) => {
  if (file.type) return file.type;
  const ext = String(file.name ?? '').toLowerCase().split('.').pop();
  return { pdf: TIPO_PDF, jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext] ?? '';
};

// Mensaje de error si el archivo no se puede adjuntar (o '' si sirve).
export const errorDeArchivo = (file) => {
  const nombre = file?.name || 'El archivo';
  const tipo = tipoDe(file);
  if (!file || file.size === 0) return `${nombre} está vacío.`;
  if (tipo === TIPO_PDF) {
    return file.size > ADJUNTOS_MAX_BYTES ? `${nombre} pesa ${formatoTamano(file.size)}: el máximo es 5 MB.` : '';
  }
  if (esImagen(tipo)) {
    return file.size > IMAGEN_ENTRADA_MAX ? `${nombre} es demasiado grande (${formatoTamano(file.size)}).` : '';
  }
  if (/heic|heif/i.test(tipo) || /\.(heic|heif)$/i.test(nombre)) return `${nombre} es HEIC: usa JPG o PNG.`;
  return `${nombre}: solo se aceptan PDF e imágenes (JPG, PNG o WEBP).`;
};

// Error del conjunto de archivos de un mensaje (o '').
export const errorDeConjunto = (archivos) => {
  if (archivos.length > ADJUNTOS_MAX_ARCHIVOS) return `Máximo ${ADJUNTOS_MAX_ARCHIVOS} archivos por mensaje.`;
  const total = archivos.reduce((s, a) => s + a.tamano, 0);
  return total > ADJUNTOS_MAX_BYTES
    ? `Los archivos pesan ${formatoTamano(total)} y el máximo por mensaje es 5 MB.`
    : '';
};

// Nombre corto y sin caracteres raros (se muestra a la otra persona).
export const nombreSeguro = (nombre, max = 80) => {
  // Sin caracteres de control (códigos < 32) ni los que Windows no admite en nombres
  const prohibidos = '\\/:*?"<>|';
  const limpio = Array.from(String(nombre ?? 'archivo'))
    .map(c => (c.charCodeAt(0) < 32 || prohibidos.includes(c) ? '_' : c)).join('').trim() || 'archivo';
  if (limpio.length <= max) return limpio;
  const punto = limpio.lastIndexOf('.');
  const ext = punto > 0 && limpio.length - punto <= 6 ? limpio.slice(punto) : '';
  return `${limpio.slice(0, max - ext.length)}${ext}`;
};

// base64 ↔ pedazos
export const partirBase64 = (b64, tam = PARTE_MAX_CHARS) => {
  const partes = [];
  for (let i = 0; i < b64.length; i += tam) partes.push(b64.slice(i, i + tam));
  return partes.length ? partes : [''];
};
export const unirPartes = (partes) => partes.join('');

export const base64ABlob = (b64, tipo) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
};

// ── Del lado del navegador (canvas / FileReader) ──
const aBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
  r.onerror = () => reject(new Error('No se pudo leer el archivo.'));
  r.readAsDataURL(blob);
});

const idCorto = () => (typeof crypto !== 'undefined' && crypto.randomUUID
  ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

const cargarImagen = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`No se pudo abrir ${file.name || 'la imagen'}.`)); };
  img.src = url;
});

const aJpeg = (img, lado, calidad) => new Promise((resolve) => {
  const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // las transparencias (PNG) quedan sobre blanco
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(resolve, 'image/jpeg', calidad);
});

// Fotos: máximo 1600 px y JPEG; si aun así pesa mucho, más pequeña. Una imagen
// pequeña y liviana se deja como está.
const reducirImagen = async (file) => {
  const img = await cargarImagen(file);
  const chica = Math.max(img.naturalWidth, img.naturalHeight) <= 1600 && file.size <= 400_000;
  if (chica) return { blob: file, nombre: file.name, tipo: tipoDe(file) };
  let blob = await aJpeg(img, 1600, 0.82);
  if (blob && blob.size > 1_200_000) blob = await aJpeg(img, 1280, 0.65);
  if (!blob || blob.size >= file.size) return { blob: file, nombre: file.name, tipo: tipoDe(file) };
  return { blob, nombre: `${String(file.name || 'imagen').replace(/\.[^.]+$/, '')}.jpg`, tipo: 'image/jpeg' };
};

// Un archivo listo para subir: { id, nombre, tipo, tamano, base64 }. Lanza Error con un mensaje claro.
export const prepararArchivo = async (file) => {
  const malo = errorDeArchivo(file);
  if (malo) throw new Error(malo);
  const tipo = tipoDe(file);
  let origen = { blob: file, nombre: file.name, tipo };
  if (tipo === TIPO_PDF) {
    const cabecera = await file.slice(0, 5).text();
    if (cabecera !== '%PDF-') throw new Error(`${file.name} no parece un PDF válido.`);
  } else {
    origen = await reducirImagen(file);
  }
  return {
    id: idCorto(), nombre: nombreSeguro(origen.nombre), tipo: origen.tipo, tamano: origen.blob.size,
    base64: await aBase64(origen.blob),
  };
};
