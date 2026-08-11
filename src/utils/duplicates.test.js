import { describe, it, expect } from 'vitest';
import { findDuplicateConflicts } from './duplicates';

const items = [
  { id: 'a', nombre: 'MacBook Air', estado: 'Disponible', numeroSerial: 'SN - C02WT379GFWM', numeroInventario: 'BM-INV-0062' },
  { id: 'b', nombre: 'MacBook Air', estado: 'De Baja',    numeroSerial: 'SN - C02WT379GFWM', numeroInventario: 'BM-INV-0031' },
  { id: 'c', nombre: 'CPU Diseño',  estado: 'En Uso',     numeroSerial: '',                  numeroInventario: 'BM-INV-0064' },
];

describe('findDuplicateConflicts', () => {
  it('encuentra el duplicado aunque el otro equipo esté dado de baja', () => {
    const conflicts = findDuplicateConflicts(items, items[0], { numeroSerial: 'SN - C02WT379GFWM' });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].item.id).toBe('b');
    expect(conflicts[0].item.estado).toBe('De Baja');
    expect(conflicts[0].label).toBe('número de serial');
  });

  it('avisa aunque el valor no haya cambiado (duplicado preexistente)', () => {
    // Es el caso real: se edita el equipo sin tocar el serial y hay que
    // enterarse igual de que está repetido.
    const conflicts = findDuplicateConflicts(items, items[0], items[0]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].item.id).toBe('b');
  });

  it('nunca choca consigo mismo', () => {
    const soloUno = [items[0]];
    expect(findDuplicateConflicts(soloUno, items[0], items[0])).toEqual([]);
  });

  it('ignora mayúsculas y espacios sobrantes', () => {
    const conflicts = findDuplicateConflicts(items, null, { numeroSerial: '  sn - c02wt379gfwm  ' });
    expect(conflicts).toHaveLength(1);
  });

  it('detecta choques en los dos campos a la vez', () => {
    const conflicts = findDuplicateConflicts(items, null, {
      numeroSerial: 'SN - C02WT379GFWM',
      numeroInventario: 'BM-INV-0064',
    });
    expect(conflicts).toHaveLength(2);
    expect(conflicts.map(c => c.field).sort()).toEqual(['numeroInventario', 'numeroSerial']);
  });

  it('ignora valores vacíos y no cuenta los seriales en blanco como coincidencia', () => {
    expect(findDuplicateConflicts(items, null, { numeroSerial: '' })).toEqual([]);
    expect(findDuplicateConflicts(items, null, { numeroSerial: '   ' })).toEqual([]);
    expect(findDuplicateConflicts(items, null, {})).toEqual([]);
  });

  it('no reporta nada cuando el equipo es realmente único', () => {
    expect(findDuplicateConflicts(items, null, { numeroSerial: 'SN - NUEVO123' })).toEqual([]);
  });
});
