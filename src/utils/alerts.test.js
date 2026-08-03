import { describe, it, expect } from 'vitest';
import { computeAlerts } from './alerts';

const ts = (date) => ({ toDate: () => date, toMillis: () => date.getTime() });
const daysAgo = (n) => ts(new Date(Date.now() - n * 86_400_000));

function makeItem(overrides = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    nombre: 'Equipo de prueba',
    categoria: 'Periféricos',
    estado: 'Disponible',
    createdAt: daysAgo(1),
    history: [],
    ...overrides,
  };
}

describe('computeAlerts', () => {
  it('no genera alertas para un inventario vacío o sin problemas', () => {
    expect(computeAlerts([])).toEqual([]);
    expect(computeAlerts([makeItem()])).toEqual([]);
  });

  it('avisa cuando una categoría tiene 3 o más equipos fuera de servicio', () => {
    const items = [
      makeItem({ categoria: 'UPS', estado: 'Fuera de Servicio' }),
      makeItem({ categoria: 'UPS', estado: 'Fuera de Servicio' }),
      makeItem({ categoria: 'UPS', estado: 'Fuera de Servicio' }),
    ];
    const alerts = computeAlerts(items);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ severity: 'high', filterCategory: 'UPS', filterStatus: 'Fuera de Servicio' });
    expect(alerts[0].message).toContain('3 equipos fuera de servicio');
  });

  it('no avisa con solo 2 equipos fuera de servicio en la misma categoría (bajo el umbral)', () => {
    const items = [
      makeItem({ categoria: 'UPS', estado: 'Fuera de Servicio' }),
      makeItem({ categoria: 'UPS', estado: 'Fuera de Servicio' }),
    ];
    expect(computeAlerts(items)).toEqual([]);
  });

  it('avisa de equipos estancados más de 30 días en Mantenimiento/Fuera de Servicio', () => {
    const items = [
      makeItem({ estado: 'En Mantenimiento', createdAt: daysAgo(45), history: [] }),
    ];
    const alerts = computeAlerts(items);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ id: 'stale-items', severity: 'medium' });
    expect(alerts[0].message).toContain('1 equipo');
  });

  it('no avisa de estancados si el cambio de estado fue reciente', () => {
    const items = [
      makeItem({
        estado: 'En Mantenimiento',
        createdAt: daysAgo(90),
        history: [{ timestamp: daysAgo(2), changes: [{ field: 'estado', from: 'Disponible', to: 'En Mantenimiento' }] }],
      }),
    ];
    expect(computeAlerts(items)).toEqual([]);
  });

  it('puede emitir ambas alertas a la vez', () => {
    const items = [
      makeItem({ categoria: 'CPU', estado: 'Fuera de Servicio', createdAt: daysAgo(60) }),
      makeItem({ categoria: 'CPU', estado: 'Fuera de Servicio', createdAt: daysAgo(1) }),
      makeItem({ categoria: 'CPU', estado: 'Fuera de Servicio', createdAt: daysAgo(1) }),
    ];
    const alerts = computeAlerts(items);
    expect(alerts).toHaveLength(2);
    expect(alerts.map(a => a.id).sort()).toEqual(['oos-CPU', 'stale-items']);
  });
});
