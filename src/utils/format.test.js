import { describe, it, expect } from 'vitest';
import { formatFecha, formatFechaHora } from './format';

describe('formatFecha', () => {
  it('usa día/mes/año (es-CO)', () => {
    expect(formatFecha(new Date(2026, 9, 9))).toBe('9/10/2026');
  });
  it('devuelve guion sin fecha', () => {
    expect(formatFecha(null)).toBe('—');
  });
});

describe('formatFechaHora', () => {
  it('incluye la fecha en es-CO', () => {
    expect(formatFechaHora(new Date(2026, 9, 9, 15, 4))).toMatch(/^9\/10\/2026/);
  });
  it('devuelve vacío sin fecha', () => {
    expect(formatFechaHora(undefined)).toBe('');
  });
});
