import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatFecha, formatFechaHora, hoyLocal, haceUnMesLocal } from './format';

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

describe('hoyLocal / haceUnMesLocal', () => {
  afterEach(() => vi.useRealTimers());

  it('da el día local aunque ya sea de noche (UTC ya cambió de día)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 9, 23, 30)); // 9 oct, 11:30 p. m. hora local
    expect(hoyLocal()).toBe('2026-10-09');
  });

  it('rellena con ceros mes y día', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 8, 0));
    expect(hoyLocal()).toBe('2026-01-05');
  });

  it('haceUnMesLocal resta un mes calendario', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 9, 12, 0));
    expect(haceUnMesLocal()).toBe('2026-09-09');
  });
});
