import { describe, it, expect } from 'vitest';
import {
  errorDeArchivo, errorDeConjunto, formatoTamano, nombreSeguro, partirBase64, unirPartes, base64ABlob, ADJUNTOS_MAX_BYTES,
} from './adjuntos';

const file = (name, size, type = '') => ({ name, size, type });
const MB = 1024 * 1024;

describe('errorDeArchivo', () => {
  it('acepta PDF e imágenes comunes', () => {
    expect(errorDeArchivo(file('a.pdf', 2 * MB, 'application/pdf'))).toBe('');
    expect(errorDeArchivo(file('foto.jpg', 4 * MB, 'image/jpeg'))).toBe('');
    expect(errorDeArchivo(file('captura.png', 900_000))).toBe(''); // el tipo sale de la extensión
  });
  it('un PDF de más de 5 MB no pasa; una foto grande sí (se reduce sola)', () => {
    expect(errorDeArchivo(file('a.pdf', 6 * MB, 'application/pdf'))).toMatch(/máximo es 5 MB/);
    expect(errorDeArchivo(file('foto.jpg', 8 * MB, 'image/jpeg'))).toBe('');
    expect(errorDeArchivo(file('enorme.jpg', 40 * MB, 'image/jpeg'))).toMatch(/demasiado grande/);
  });
  it('rechaza otros tipos, vacíos y HEIC con un mensaje que dice qué hacer', () => {
    expect(errorDeArchivo(file('a.exe', 1000, 'application/x-msdownload'))).toMatch(/solo se aceptan/);
    expect(errorDeArchivo(file('a.pdf', 0, 'application/pdf'))).toMatch(/vacío/);
    expect(errorDeArchivo(file('IMG_1.HEIC', 1000, 'image/heic'))).toMatch(/JPG o PNG/);
  });
});

describe('errorDeConjunto', () => {
  const a = (tamano) => ({ tamano });
  it('máximo 3 archivos y 5 MB en total', () => {
    expect(errorDeConjunto([a(1000), a(2000)])).toBe('');
    expect(errorDeConjunto([a(1), a(1), a(1), a(1)])).toMatch(/Máximo 3/);
    expect(errorDeConjunto([a(3 * MB), a(2 * MB + 1)])).toMatch(/máximo por mensaje es 5 MB/);
    expect(errorDeConjunto([a(ADJUNTOS_MAX_BYTES)])).toBe('');
  });
});

describe('formatoTamano y nombreSeguro', () => {
  it('formatea el tamaño', () => {
    expect(formatoTamano(512)).toBe('512 B');
    expect(formatoTamano(320 * 1024)).toBe('320 KB');
    expect(formatoTamano(1.4 * MB)).toBe('1,4 MB');
  });
  it('limpia el nombre y lo acorta conservando la extensión', () => {
    expect(nombreSeguro('a/b\\c:d.pdf')).toBe('a_b_c_d.pdf');
    const largo = nombreSeguro(`${'x'.repeat(200)}.pdf`);
    expect(largo.length).toBe(80);
    expect(largo.endsWith('.pdf')).toBe(true);
    expect(nombreSeguro('')).toBe('archivo');
  });
});

describe('partes en base64', () => {
  it('parte y une sin perder nada, con pedazos del tamaño pedido', () => {
    const b64 = 'A'.repeat(2500);
    const partes = partirBase64(b64, 1000);
    expect(partes.map(p => p.length)).toEqual([1000, 1000, 500]);
    expect(unirPartes(partes)).toBe(b64);
    expect(partirBase64('')).toEqual(['']);
  });
  it('5 MB caben en 10 documentos de ≤700 KB', () => {
    const b64Largo = Math.ceil((5 * MB * 4) / 3);
    expect(partirBase64('A'.repeat(b64Largo)).length).toBeLessThanOrEqual(10);
  });
  it('base64 → Blob devuelve los mismos bytes', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 45, 0, 255, 1]);
    const blob = base64ABlob(btoa(String.fromCharCode(...bytes)), 'application/pdf');
    expect(blob.type).toBe('application/pdf');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
  });
});
