import { describe, it, expect } from 'vitest';
import { groupByCategory, statusCounts } from './inventoryGroups';

const eq = (categoria, estado) => ({ categoria, estado });

describe('groupByCategory', () => {
  it('ordena de la categoría más numerosa a la menos, y alfabético en empate', () => {
    const groups = groupByCategory([
      eq('Monitores', 'En Uso'), eq('Laptops', 'En Uso'), eq('Laptops', 'Disponible'), eq('Audio', 'En Uso'),
    ]);
    expect(groups.map(g => [g.categoria, g.rows.length])).toEqual([['Laptops', 2], ['Audio', 1], ['Monitores', 1]]);
  });

  it('devuelve vacío sin equipos', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});

describe('statusCounts', () => {
  it('cuenta por estado en orden fijo y omite los ausentes', () => {
    const rows = [eq('X', 'En Uso'), eq('X', 'Disponible'), eq('X', 'En Uso'), eq('X', 'Fuera de Servicio')];
    expect(statusCounts(rows)).toEqual([['Disponible', 1], ['En Uso', 2], ['Fuera de Servicio', 1]]);
  });
});
