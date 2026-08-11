import { describe, it, expect } from 'vitest';
import { getMaintenanceInfo, groupMaintenanceByUrgency, countOverdueMaintenance } from './maintenance';

const ts = (date) => ({ toDate: () => date });
const daysAgo = (n) => ts(new Date(Date.now() - n * 86_400_000));
const NOW = new Date();

function makeItem(overrides = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    nombre: 'Laptop de prueba',
    categoria: 'Laptops',
    estado: 'En Uso',
    createdAt: daysAgo(400),
    ...overrides,
  };
}

describe('getMaintenanceInfo', () => {
  it('devuelve null para categorías sin mantenimiento programado', () => {
    expect(getMaintenanceInfo(makeItem({ categoria: 'Periféricos' }))).toBeNull();
  });

  it('devuelve null para equipos dados de baja', () => {
    expect(getMaintenanceInfo(makeItem({ estado: 'De Baja' }))).toBeNull();
  });

  it('devuelve null para equipos fuera de servicio (dañados, sin mantenimiento previsto)', () => {
    expect(getMaintenanceInfo(makeItem({ estado: 'Fuera de Servicio', ultimoMantenimiento: daysAgo(200) }))).toBeNull();
  });

  it('devuelve null para equipos excluidos manualmente (backup sin uso)', () => {
    const enBackup = makeItem({ estado: 'Disponible', sinMantenimiento: true, ultimoMantenimiento: daysAgo(200) });
    expect(getMaintenanceInfo(enBackup)).toBeNull();
  });

  it('sigue calculando si sinMantenimiento es false o no está definido', () => {
    expect(getMaintenanceInfo(makeItem({ sinMantenimiento: false, ultimoMantenimiento: daysAgo(200) }), NOW).urgencia).toBe('vencido');
    expect(getMaintenanceInfo(makeItem({ ultimoMantenimiento: daysAgo(200) }), NOW).urgencia).toBe('vencido');
  });

  it('devuelve null si no hay fecha base (ni ultimoMantenimiento, ni fechaIngreso, ni createdAt)', () => {
    expect(getMaintenanceInfo(makeItem({ createdAt: undefined }))).toBeNull();
  });

  it('usa fechaIngreso/createdAt como base cuando nunca se ha hecho mantenimiento', () => {
    const item = makeItem({ createdAt: daysAgo(200) });
    const info = getMaintenanceInfo(item, NOW);
    expect(info.urgencia).toBe('vencido');
    expect(info.diasRestantes).toBeLessThan(0);
  });

  it('usa ultimoMantenimiento como base cuando existe, ignorando fechaIngreso', () => {
    const item = makeItem({ createdAt: daysAgo(400), ultimoMantenimiento: daysAgo(10) });
    const info = getMaintenanceInfo(item, NOW);
    expect(info.urgencia).toBe('proximo');
    expect(info.diasRestantes).toBeGreaterThan(30);
  });

  it('respeta frecuenciaMantenimientoMeses editable por equipo', () => {
    const item = makeItem({ ultimoMantenimiento: daysAgo(95), frecuenciaMantenimientoMeses: 3 });
    const info = getMaintenanceInfo(item, NOW);
    expect(info.urgencia).toBe('vencido');
  });

  it('clasifica correctamente los umbrales de urgencia', () => {
    const vencido = getMaintenanceInfo(makeItem({ ultimoMantenimiento: daysAgo(200) }), NOW);
    const estaSemana = getMaintenanceInfo(makeItem({ ultimoMantenimiento: daysAgo(178) }), NOW); // vence en ~2 días
    const esteMes = getMaintenanceInfo(makeItem({ ultimoMantenimiento: daysAgo(165) }), NOW); // vence en ~15 días
    const proximo = getMaintenanceInfo(makeItem({ ultimoMantenimiento: daysAgo(30) }), NOW);

    expect(vencido.urgencia).toBe('vencido');
    expect(estaSemana.urgencia).toBe('esta-semana');
    expect(esteMes.urgencia).toBe('este-mes');
    expect(proximo.urgencia).toBe('proximo');
  });
});

describe('groupMaintenanceByUrgency', () => {
  it('agrupa solo los equipos aplicables y omite grupos vacíos', () => {
    const items = [
      makeItem({ categoria: 'Periféricos' }), // no aplica
      makeItem({ ultimoMantenimiento: daysAgo(200) }), // vencido
      makeItem({ categoria: 'CPU', ultimoMantenimiento: daysAgo(190) }), // vencido
      makeItem({ estado: 'Fuera de Servicio', ultimoMantenimiento: daysAgo(500) }), // dañado, no aplica
    ];
    const groups = groupMaintenanceByUrgency(items, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('vencido');
    expect(groups[0].rows).toHaveLength(2);
  });

  it('ordena por fecha de vencimiento más próxima primero', () => {
    const masVencido = makeItem({ nombre: 'A', ultimoMantenimiento: daysAgo(300) });
    const menosVencido = makeItem({ nombre: 'B', ultimoMantenimiento: daysAgo(190) });
    const groups = groupMaintenanceByUrgency([menosVencido, masVencido], NOW);
    expect(groups[0].rows.map(r => r.item.nombre)).toEqual(['A', 'B']);
  });
});

describe('countOverdueMaintenance', () => {
  it('cuenta solo los equipos vencidos', () => {
    const items = [
      makeItem({ ultimoMantenimiento: daysAgo(200) }),
      makeItem({ ultimoMantenimiento: daysAgo(10) }),
      makeItem({ categoria: 'Periféricos' }),
    ];
    expect(countOverdueMaintenance(items, NOW)).toBe(1);
  });
});
