import { describe, it, expect } from 'vitest';
import { getIdleState } from './idle';

const IDLE = 900_000;   // 15 min
const WARN = 20_000;    // 20 s

describe('getIdleState', () => {
  it('está activo mientras no se acerca el cierre', () => {
    expect(getIdleState(0, IDLE, WARN)).toEqual({ status: 'active', secondsLeft: 20 });
    expect(getIdleState(600_000, IDLE, WARN).status).toBe('active');
  });

  it('devuelve el mismo valor durante toda la fase activa (no re-renderiza cada segundo)', () => {
    expect(getIdleState(1_000, IDLE, WARN)).toEqual(getIdleState(500_000, IDLE, WARN));
  });

  it('avisa exactamente 20 segundos antes del cierre', () => {
    expect(getIdleState(IDLE - WARN - 1, IDLE, WARN).status).toBe('active');
    expect(getIdleState(IDLE - WARN, IDLE, WARN)).toEqual({ status: 'warning', secondsLeft: 20 });
  });

  it('descuenta los segundos durante el aviso', () => {
    expect(getIdleState(IDLE - 10_000, IDLE, WARN)).toEqual({ status: 'warning', secondsLeft: 10 });
    expect(getIdleState(IDLE - 1_000, IDLE, WARN)).toEqual({ status: 'warning', secondsLeft: 1 });
  });

  it('expira justo al cumplir el tiempo de inactividad', () => {
    expect(getIdleState(IDLE, IDLE, WARN)).toEqual({ status: 'expired', secondsLeft: 0 });
  });

  it('sigue expirado aunque la pestaña estuviera congelada mucho tiempo', () => {
    // Caso real: el navegador congela los timers en segundo plano y al volver
    // han pasado 40 minutos de golpe.
    expect(getIdleState(2_400_000, IDLE, WARN)).toEqual({ status: 'expired', secondsLeft: 0 });
  });

  it('no rompe si el aviso es más largo que el tiempo de inactividad', () => {
    expect(getIdleState(0, 10_000, 30_000).status).toBe('warning');
  });
});
