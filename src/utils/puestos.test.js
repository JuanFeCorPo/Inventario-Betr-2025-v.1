import { describe, it, expect } from 'vitest';
import {
  equiposDelPuesto, equipoPrincipal, ordenarPuestos, buscarEquiposAsignables,
  etiquetaEquipo, limpiarPersonas, correoValido,
} from './puestos';

const eq = (id, categoria, extra = {}) => ({ id, categoria, nombre: `${categoria} ${id}`, numeroInventario: `BM-INV-${id}`, estado: 'En Uso', ...extra });

describe('equiposDelPuesto', () => {
  const items = [
    eq('0003', 'Periféricos', { puestoId: 'p1' }),
    eq('0001', 'Monitores', { puestoId: 'p1' }),
    eq('0002', 'CPU', { puestoId: 'p1' }),
    eq('0004', 'CPU', { puestoId: 'p2' }),
    eq('0005', 'UPS', { puestoId: 'p1', estado: 'De Baja' }),
  ];
  it('solo los del puesto, sin bajas, CPU primero', () => {
    expect(equiposDelPuesto(items, 'p1').map(e => e.id)).toEqual(['0002', '0001', '0003']);
  });
});

describe('equipoPrincipal', () => {
  it('prefiere CPU, luego portátil', () => {
    expect(equipoPrincipal([eq('1', 'Monitores'), eq('2', 'Laptops'), eq('3', 'CPU')]).id).toBe('3');
    expect(equipoPrincipal([eq('1', 'Monitores'), eq('2', 'Laptops')]).id).toBe('2');
    expect(equipoPrincipal([eq('1', 'Monitores')])).toBeNull();
  });
});

describe('ordenarPuestos', () => {
  it('por área y con orden natural de números', () => {
    const out = ordenarPuestos([
      { nombre: 'Diseño #10', area: 'Operaciones' },
      { nombre: 'Coor. Contable', area: 'Administrativos' },
      { nombre: 'Diseño #2', area: 'Operaciones' },
    ]).map(p => p.nombre);
    expect(out).toEqual(['Diseño #2', 'Diseño #10', 'Coor. Contable']);
  });
});

describe('buscarEquiposAsignables', () => {
  const items = [
    eq('0599', 'Periféricos', { nombre: 'Teclado Logitech' }),
    eq('0600', 'Periféricos', { nombre: 'Mouse Logitech', puestoId: 'otro' }),
    eq('0601', 'Periféricos', { nombre: 'Mouse Genius' }),
    eq('0602', 'Periféricos', { nombre: 'Mouse viejo', estado: 'De Baja' }),
    eq('0603', 'Periféricos', { nombre: 'Mouse ya aquí', puestoId: 'p1' }),
  ];
  it('busca por número sin el prefijo', () => {
    expect(buscarEquiposAsignables(items, '599', 'p1').map(e => e.id)).toEqual(['0599']);
  });
  it('busca por nombre sin tildes, excluye bajas y los del mismo puesto; libres primero', () => {
    expect(buscarEquiposAsignables(items, 'MOUSE', 'p1').map(e => e.id)).toEqual(['0601', '0600']);
  });
  it('sin texto no devuelve nada', () => {
    expect(buscarEquiposAsignables(items, '  ', 'p1')).toEqual([]);
  });
});

describe('utilidades', () => {
  it('etiquetaEquipo', () => {
    expect(etiquetaEquipo({ nombre: 'Teclado', numeroInventario: 'BM-INV-0599' })).toBe('Teclado (BM-INV-0599)');
    expect(etiquetaEquipo({ nombre: 'Teclado', numeroInventario: '' })).toBe('Teclado');
  });
  it('limpiarPersonas quita filas vacías y normaliza el correo', () => {
    expect(limpiarPersonas([{ nombre: ' Carol ', correo: ' Carol@Betrmedia.com ' }, { nombre: '', correo: '' }]))
      .toEqual([{ nombre: 'Carol', correo: 'carol@betrmedia.com' }]);
  });
  it('correoValido acepta vacío', () => {
    expect(correoValido('')).toBe(true);
    expect(correoValido('x@y.co')).toBe(true);
    expect(correoValido('xy.co')).toBe(false);
  });
});

import { casillaDe, equiposPorCasilla, casillasVacias, grupoDe, agruparPuestos, candidatosParaCasilla } from './puestos';

describe('casillas F-MAN-02', () => {
  it('ubica cada equipo por categoría y nombre', () => {
    expect(casillaDe({ categoria: 'CPU' })).toBe('principal');
    expect(casillaDe({ categoria: 'Laptops' })).toBe('principal');
    expect(casillaDe({ categoria: 'Periféricos', nombre: 'Teclado Logitech' })).toBe('teclado');
    expect(casillaDe({ categoria: 'Periféricos', nombre: 'Mouse Genius' })).toBe('mouse');
    expect(casillaDe({ categoria: 'Periféricos', nombre: 'Pad mouse' })).toBe('mouse');
    expect(casillaDe({ categoria: 'Periféricos', nombre: 'Base refrigerante' })).toBe('accesorios');
    expect(casillaDe({ categoria: 'Audio', nombre: 'Audífonos HyperX' })).toBe('audifonos');
    expect(casillaDe({ categoria: 'Audio', nombre: 'Micrófono Boya' })).toBe('accesorios');
    expect(casillaDe({ categoria: 'Bases y Soportes', nombre: 'Soporte Monitor' })).toBe('accesorios');
    // Fijada a mano al asignarlo
    expect(casillaDe({ categoria: 'Periféricos', nombre: 'Combo inalámbrico', casilla: 'mouse' })).toBe('mouse');
  });
  it('agrupa por casilla y detecta las básicas vacías', () => {
    const eqs = [{ categoria: 'CPU' }, { categoria: 'Monitores' }, { categoria: 'Monitores' }];
    const por = equiposPorCasilla(eqs);
    expect(por.monitor).toHaveLength(2);
    expect(por.ups).toEqual([]);
    expect(casillasVacias(eqs)).toEqual(['teclado', 'mouse']);
    // Con portátil no le faltan monitor, teclado ni mouse
    expect(casillasVacias([{ categoria: 'Laptops' }])).toEqual([]);
    expect(casillasVacias([{ categoria: 'Monitores' }])).toEqual(['principal']);
  });
});

describe('equipos de trabajo', () => {
  it('sale de la carpeta de Drive del archivo importado', () => {
    expect(grupoDe({ hojaOriginal: '1. Hoja de Vida - Equipos de Optimización/EQUIPO # 1 - OPTIMIZACION.xlsx' })).toEqual({ nombre: 'Optimización', orden: 1 });
    expect(grupoDe({ hojaOriginal: '14. Hoja de Vida - Equipos Lideres Tráfico Operativo/EQUIPO #1.xlsx' })).toEqual({ nombre: 'Lideres Tráfico Operativo', orden: 14 });
    expect(grupoDe({ nombre: 'Operaciones - Compartidos' }).nombre).toBe('Compartidos');
    expect(grupoDe({ grupo: 'Diseño', grupoOrden: 5, hojaOriginal: '1. X/y.xlsx' })).toEqual({ nombre: 'Diseño', orden: 5 });
    expect(grupoDe({ nombre: 'Nuevo' }).nombre).toBe('Sin equipo de trabajo');
  });
  it('ordena área → equipo de trabajo (orden de carpetas) → puesto', () => {
    const out = agruparPuestos([
      { nombre: 'Diseño #10', area: 'Operaciones', grupo: 'Diseño', grupoOrden: 5 },
      { nombre: 'Diseño #2', area: 'Operaciones', grupo: 'Diseño', grupoOrden: 5 },
      { nombre: 'Optimización #1', area: 'Operaciones', grupo: 'Optimización', grupoOrden: 1 },
      { nombre: 'Coor. Contable', area: 'Administrativos', grupo: 'Administración', grupoOrden: 1 },
    ]);
    expect(out.map(a => a.area)).toEqual(['Operaciones', 'Administrativos']);
    expect(out[0].grupos.map(g => g.nombre)).toEqual(['Optimización', 'Diseño']);
    expect(out[0].grupos[1].puestos.map(p => p.nombre)).toEqual(['Diseño #2', 'Diseño #10']);
  });
});

describe('candidatosParaCasilla', () => {
  const items = [
    { id: '1', numeroInventario: 'BM-INV-0001', nombre: 'Monitor LG', categoria: 'Monitores', estado: 'Disponible' },
    { id: '2', numeroInventario: 'BM-INV-0002', nombre: 'Monitor Samsung', categoria: 'Monitores', estado: 'En Uso', puestoId: 'otro' },
    { id: '3', numeroInventario: 'BM-INV-0003', nombre: 'Teclado', categoria: 'Periféricos', estado: 'Disponible' },
    { id: '4', numeroInventario: 'BM-INV-0004', nombre: 'Monitor viejo', categoria: 'Monitores', estado: 'De Baja' },
    { id: '5', numeroInventario: 'BM-INV-0005', nombre: 'Monitor aquí', categoria: 'Monitores', estado: 'En Uso', puestoId: 'p1' },
  ];
  it('separa disponibles de los que están en uso y filtra por tipo', () => {
    const r = candidatosParaCasilla(items, { casilla: 'monitor', puestoId: 'p1' });
    expect(r.disponibles.map(i => i.id)).toEqual(['1']);
    expect(r.enUso.map(i => i.id)).toEqual(['2']);
  });
  it('busca y puede quitar el filtro por tipo', () => {
    expect(candidatosParaCasilla(items, { casilla: 'monitor', puestoId: 'p1', term: 'samsung' }).total).toBe(1);
    expect(candidatosParaCasilla(items, { casilla: 'monitor', puestoId: 'p1', todos: true }).disponibles.map(i => i.id)).toEqual(['1', '3']);
  });
});
