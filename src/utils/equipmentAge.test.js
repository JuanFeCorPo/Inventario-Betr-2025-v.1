import { describe, it, expect } from 'vitest';
import { getAgeBuckets } from './equipmentAge';

const ts = (date) => ({ toDate: () => date });
const yearsAgo = (n) => ts(new Date(Date.now() - n * 365.25 * 86_400_000));
const NOW = new Date();

function makeItem(overrides = {}) {
  return {
    id: Math.random().toString(36).slice(2),
    nombre: 'Equipo de prueba',
    categoria: 'Laptops',
    estado: 'En Uso',
    fechaIngreso: yearsAgo(0),
    ...overrides,
  };
}

describe('getAgeBuckets', () => {
  it('devuelve total 0 y sin buckets para un inventario vacío', () => {
    expect(getAgeBuckets([], NOW)).toEqual({ buckets: [], total: 0 });
  });

  it('excluye equipos De Baja del total y de los buckets', () => {
    const items = [makeItem({ estado: 'De Baja', fechaIngreso: yearsAgo(0.2) })];
    expect(getAgeBuckets(items, NOW)).toEqual({ buckets: [], total: 0 });
  });

  it('clasifica correctamente los rangos de antigüedad', () => {
    const items = [
      makeItem({ fechaIngreso: yearsAgo(0.5) }),
      makeItem({ fechaIngreso: yearsAgo(1.5) }),
      makeItem({ fechaIngreso: yearsAgo(2.5) }),
      makeItem({ fechaIngreso: yearsAgo(4) }),
      makeItem({ fechaIngreso: yearsAgo(6) }),
    ];
    const { buckets, total } = getAgeBuckets(items, NOW);
    expect(total).toBe(5);
    expect(buckets.map(b => b.key)).toEqual(['menos-1', '1-2', '2-3', '3-5', 'mas-5']);
    buckets.forEach(b => expect(b.count).toBe(1));
  });

  it('agrupa equipos sin fechaIngreso en un bucket aparte, sin romper el conteo', () => {
    const items = [makeItem({ fechaIngreso: undefined }), makeItem({ fechaIngreso: yearsAgo(0.1) })];
    const { buckets, total } = getAgeBuckets(items, NOW);
    expect(total).toBe(2);
    expect(buckets.find(b => b.key === 'sin-fecha')?.count).toBe(1);
    expect(buckets.find(b => b.key === 'menos-1')?.count).toBe(1);
  });

  it('omite los buckets vacíos', () => {
    const items = [makeItem({ fechaIngreso: yearsAgo(6) })];
    const { buckets } = getAgeBuckets(items, NOW);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].key).toBe('mas-5');
  });
});
