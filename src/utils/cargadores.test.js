import { describe, it, expect } from 'vitest';
import { proponerCargadores } from './cargadores';

const eq = (id, categoria, numeroInventario, extra = {}) => ({ id, categoria, numeroInventario, nombre: `${categoria} ${id}`, estado: 'En Uso', ...extra });

describe('proponerCargadores', () => {
  const items = [
    eq('a', 'Smartphones', 'BM-INV-0158', { observaciones: 'Vidrio templado nuevo / Cargador: BM-INV-0672' }),
    eq('b', 'Smartphones', 'BM-INV-0715', { observaciones: 'Cargador 45W: BM-INV-0716 / Estuche' }),
    eq('c', 'Smartphones', 'BM-INV-0652', { observaciones: 'Cargador nuevo con AC y Cable Tipo C / BM-INV- 0658 ' }),
    eq('d', 'Smartphones', 'BM-INV-0320', { observaciones: 'Cargador con cable' }),
    eq('e', 'Smartphones', 'BM-INV-0329', { observaciones: 'Forro y vidrio nuevo' }),
    eq('f', 'Laptops', 'BM-INV-0001', { observaciones: 'Model: A1466 / Cargador Portatil: BM-INV-0226' }),
    eq('g', 'Smartphones', 'BM-INV-0900', { observaciones: 'Cargador: BM-INV-0901', cargador: 'BM-INV-0901' }),
    eq('h', 'Smartphones', 'BM-INV-0950', { observaciones: 'Cargador: BM-INV-0951', estado: 'De Baja' }),
    eq('c1', 'Adaptadores', 'BM-INV-0672'),
    eq('c2', 'Adaptadores', 'BM-INV-0716'),
  ];
  const { propuestas, sinNumero } = proponerCargadores(items);
  const por = (id) => propuestas.find(p => p.item.id === id);

  it('lee el Nº del cargador de las observaciones, con o sin espacios', () => {
    expect(por('a').cargador).toBe('BM-INV-0672');
    expect(por('b').cargador).toBe('BM-INV-0716');
    expect(por('c').cargador).toBe('BM-INV-0658');
    expect(por('f').cargador).toBe('BM-INV-0226'); // los portátiles también
  });
  it('dice qué equipo del inventario es ese Nº; si no está, no es un problema (el cargador no es un equipo aparte)', () => {
    expect(por('a').encontrado.id).toBe('c1');
    expect(por('a').avisos).toEqual([]);
    expect(por('c').encontrado).toBeNull();
    expect(por('c').avisos).toEqual([]);
  });
  it('no toca a quien ya tiene cargador, a los de baja ni a los que no dicen nada', () => {
    const ids = propuestas.map(p => p.item.id);
    expect(ids).not.toContain('g');
    expect(ids).not.toContain('h');
    expect(ids).not.toContain('e');
  });
  it('los que mencionan un cargador sin Nº quedan aparte, sin cambios', () => {
    expect(sinNumero.map(i => i.id)).toEqual(['d']);
  });
  it('avisa si el cargador ya es de otro equipo o se repite en la lista', () => {
    const r = proponerCargadores([
      eq('x', 'Smartphones', 'BM-INV-0001', { observaciones: 'Cargador: BM-INV-0500' }),
      eq('y', 'Smartphones', 'BM-INV-0002', { observaciones: 'Cargador: BM-INV-0500' }),
      eq('z', 'Smartphones', 'BM-INV-0003', { observaciones: 'Cargador: BM-INV-0600' }),
      eq('w', 'Smartphones', 'BM-INV-0004', { cargador: 'BM-INV-0600' }),
      eq('s', 'Smartphones', 'BM-INV-0005', { observaciones: 'Cargador: BM-INV-0005' }),
    ]);
    const av = (id) => r.propuestas.find(p => p.item.id === id).avisos.join(' | ');
    expect(av('x')).toMatch(/mismo cargador/);
    expect(av('z')).toMatch(/Ya es el cargador de/);
    expect(av('s')).toMatch(/mismo número del equipo/);
  });
});
