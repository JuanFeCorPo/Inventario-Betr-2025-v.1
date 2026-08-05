import { describe, it, expect } from 'vitest';
import { isAlertDismissed, ALERT_REAPPEAR_AFTER_MS } from './dismissedAlerts';

const NOW = Date.now();

describe('isAlertDismissed', () => {
  it('no está descartada si nunca se descartó', () => {
    expect(isAlertDismissed({}, 'stale-items', NOW)).toBe(false);
  });

  it('sigue oculta justo después de descartarla', () => {
    const map = { 'stale-items': NOW };
    expect(isAlertDismissed(map, 'stale-items', NOW)).toBe(true);
  });

  it('sigue oculta a los 14 días', () => {
    const map = { 'stale-items': NOW - 14 * 24 * 60 * 60 * 1000 };
    expect(isAlertDismissed(map, 'stale-items', NOW)).toBe(true);
  });

  it('vuelve a aparecer a los 15 días', () => {
    const map = { 'stale-items': NOW - ALERT_REAPPEAR_AFTER_MS };
    expect(isAlertDismissed(map, 'stale-items', NOW)).toBe(false);
  });

  it('no afecta a otras alertas con id distinto', () => {
    const map = { 'stale-items': NOW };
    expect(isAlertDismissed(map, 'oos-UPS', NOW)).toBe(false);
  });
});
