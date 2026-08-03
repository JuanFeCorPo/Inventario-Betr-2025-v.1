import { describe, it, expect } from 'vitest';
import { normalize, matchFromList, parseRow } from './excel';
import { CATEGORIAS, ESTADOS } from '../config/constants';

describe('normalize', () => {
  it('quita tildes, mayúsculas y espacios extremos', () => {
    expect(normalize('  Periféricos  ')).toBe('perifericos');
    expect(normalize('EN MANTENIMIENTO')).toBe('en mantenimiento');
    expect(normalize(null)).toBe('');
    expect(normalize(undefined)).toBe('');
  });
});

describe('matchFromList', () => {
  it('encuentra coincidencia exacta ignorando tildes/mayúsculas', () => {
    expect(matchFromList('perifericos', CATEGORIAS)).toBe('Periféricos');
    expect(matchFromList('EN USO', ESTADOS)).toBe('En Uso');
  });

  it('encuentra coincidencia parcial', () => {
    expect(matchFromList('laptop', CATEGORIAS)).toBe('Laptops');
  });

  it('devuelve null si no hay ninguna coincidencia razonable', () => {
    expect(matchFromList('xyz123', CATEGORIAS)).toBeNull();
    expect(matchFromList('', CATEGORIAS)).toBeNull();
  });
});

describe('parseRow', () => {
  it('parsea una fila válida sin advertencias ni errores', () => {
    const row = {
      'Nombre': 'Laptop Dell XPS',
      'Categoría': 'Laptops',
      'Estado': 'Disponible',
      'N° Inventario': 'INV-001',
      'Fecha de Ingreso': '2026-01-15',
    };
    const result = parseRow(row, 0);
    expect(result.errors).toEqual([]);
    expect(result.nombre).toBe('Laptop Dell XPS');
    expect(result.categoria).toBe('Laptops');
    expect(result.estado).toBe('Disponible');
    expect(result.condicion).toBe('Usado'); // sin dato -> por defecto Usado
  });

  it('marca error cuando faltan campos obligatorios', () => {
    const result = parseRow({ 'Nombre': '', 'N° Inventario': '', 'Fecha de Ingreso': '' }, 0);
    expect(result.errors).toContain('Falta el nombre.');
    expect(result.errors).toContain('Falta el número de inventario.');
    expect(result.errors).toContain('Falta o es inválida la fecha de ingreso.');
  });

  it('cae a "Otros"/"Disponible" con advertencia si la categoría/estado no se reconoce', () => {
    const result = parseRow({
      'Nombre': 'Cosa rara', 'N° Inventario': 'INV-9', 'Fecha de Ingreso': '2026-01-01',
      'Categoría': 'Categoría inventada', 'Estado': 'Estado inventado',
    }, 0);
    expect(result.categoria).toBe('Otros');
    expect(result.estado).toBe('Disponible');
    expect(result.warnings.some(w => w.includes('Categoría'))).toBe(true);
    expect(result.warnings.some(w => w.includes('Estado'))).toBe(true);
  });

  it('nunca deja un equipo "Nuevo" si su estado importado es "En Uso"', () => {
    const result = parseRow({
      'Nombre': 'Mouse', 'N° Inventario': 'INV-10', 'Fecha de Ingreso': '2026-01-01',
      'Estado': 'En Uso', 'Condición': 'Nuevo',
    }, 0);
    expect(result.estado).toBe('En Uso');
    expect(result.condicion).toBe('Usado');
  });

  it('reconoce encabezados en minúsculas o con variaciones', () => {
    const result = parseRow({
      'nombre': 'Monitor', 'numero inventario': 'INV-20', 'fecha': '2026-02-01', 'serial': 'SN-1',
    }, 3);
    expect(result.nombre).toBe('Monitor');
    expect(result.numeroInventario).toBe('INV-20');
    expect(result.numeroSerial).toBe('SN-1');
    expect(result._row).toBe(5); // index 3 + 2 (encabezado + 1-based)
  });
});
