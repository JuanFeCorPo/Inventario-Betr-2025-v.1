import { describe, it, expect } from 'vitest';
import {
  entradasDeEquipo, retiradosDelPuesto, datosHojaPuesto, datosHojaEquipo, htmlHojaPuesto, htmlHojaEquipo, nombreArchivo,
} from './hojaDeVida';

const ts = (y, m, d) => ({ toDate: () => new Date(y, m - 1, d, 12) });

describe('entradasDeEquipo', () => {
  it('usa los campos nuevos y reconoce los registros anteriores por su texto', () => {
    const out = entradasDeEquipo([
      { timestamp: ts(2025, 3, 1), user: 'a@b.co', action: 'Equipo modificado.' },
      { timestamp: ts(2024, 1, 5), user: 'a@b.co', action: 'Mantenimiento preventivo realizado.\nLimpieza' },
      { timestamp: ts(2025, 6, 1), user: 'x', tipo: 'novedad', fecha: ts(2025, 5, 30), descripcion: 'No enciende', reporta: 'Ana', action: '…' },
      { timestamp: ts(2024, 8, 1), user: 'a@b.co', action: 'Nota: se le cambió la batería' },
    ]);
    expect(out.map(e => [e.tipo, e.descripcion])).toEqual([
      ['preventivo', 'Limpieza'], ['nota', 'se le cambió la batería'], ['novedad', 'No enciende'],
    ]);
  });
});

describe('retiradosDelPuesto', () => {
  const items = [
    { numeroInventario: 'BM-INV-0236', nombre: 'Mouse Genius', categoria: 'Periféricos', numeroSerial: 'S1' },
    { numeroInventario: 'BM-INV-0116', nombre: 'Teclado Logitech', categoria: 'Periféricos' },
  ];
  it('lee los tachados importados, los nuevos con casilla y no repite ni incluye lo que volvió', () => {
    const out = retiradosDelPuesto([
      { tipo: 'cambio', fecha: ts(2022, 4, 4), descripcion: 'Sale Mouse Genius (BM-INV-0236) (tachado en la hoja de vida).' },
      { tipo: 'cambio', fecha: ts(2023, 1, 1), descripcion: 'Teclado Logitech (BM-INV-0116) se reemplaza por Teclado X (BM-INV-0579). El anterior queda Disponible.' },
      { tipo: 'cambio', fecha: ts(2024, 1, 1), descripcion: 'x', retirado: { codigo: 'BM-INV-0900', nombre: 'Combo', casilla: 'teclado' } },
      { tipo: 'cambio', fecha: ts(2024, 2, 1), descripcion: 'Se retira UPS (BM-INV-0288) (queda Disponible).' },
      { tipo: 'preventivo', fecha: ts(2024, 2, 1), descripcion: 'Sale humo (BM-INV-0111)' },
    ], items, [{ numeroInventario: 'BM-INV-0288' }]);
    expect(out.map(r => [r.codigo, r.casilla])).toEqual([
      ['BM-INV-0236', 'mouse'], ['BM-INV-0116', 'teclado'], ['BM-INV-0900', 'teclado'],
    ]);
    expect(out[0].serial).toBe('S1');
  });
  it('si el código ya no está en el inventario, la casilla sale de lo que dice el historial', () => {
    const out = retiradosDelPuesto([
      { tipo: 'correctivo', fecha: ts(2022, 4, 4), descripcion: 'El mouse BM-INV-0236 presenta fallas se congela' },
      { tipo: 'cambio', fecha: ts(2022, 5, 1), descripcion: 'Sale BM-INV-0236 (tachado en la hoja de vida).' },
    ], [], []);
    expect(out).toMatchObject([{ codigo: 'BM-INV-0236', casilla: 'mouse' }]);
  });
});

describe('datosHojaPuesto (F-MAN-02)', () => {
  const principal = { id: 'c', categoria: 'CPU', numeroInventario: 'BM-INV-0667', nombre: 'CPU Thermaltake', marca: 'Thermaltake', ram: '32 GB', estado: 'En Uso' };
  const equipos = [principal, { id: 'm', categoria: 'Monitores', numeroInventario: 'BM-INV-0115', nombre: 'Monitor Samsung', numeroSerial: '0ACH', estado: 'En Uso' }];
  const puesto = {
    nombre: 'Optimización #1', area: 'Operaciones', personas: [{ nombre: 'Tatiana' }, { nombre: 'Dayanna' }],
    observaciones: 'Audifonos: CV22513DM (Hyperx) - Andres\nAccesorios: PAD MOUSE\nNota suelta',
  };
  const historial = [
    { tipo: 'nota', fecha: ts(2026, 11, 3), descripcion: 'Puesto importado de la hoja de vida en Excel.' },
    { tipo: 'correctivo', fecha: ts(2022, 4, 4), descripcion: 'Cambio de mouse', responsable: 'Juan' },
    { tipo: 'cambio', fecha: ts(2022, 4, 4), descripcion: 'Sale Mouse (BM-INV-0236) (tachado en la hoja de vida).' },
    { tipo: 'preventivo', fecha: ts(2022, 3, 26), descripcion: 'Revisión', responsable: 'Gabriela' },
    { tipo: 'novedad', fecha: ts(2022, 7, 25), descripcion: 'Fallan los puertos', reporta: 'Juan Sebastián' },
  ];
  const d = datosHojaPuesto({ puesto, equipos, principal, historial, items: [] });

  it('identificación con NO APLICA como en la hoja', () => {
    expect(d.identificacion).toEqual({
      equipo: 'Optimización #1', tipo: 'COMPUTADOR DE ESCRITORIO', inventario: 'BM-INV-0667', marca: 'Thermaltake', modelo: 'NO APLICA', serial: 'NO APLICA',
    });
    expect(d.personas).toEqual(['Tatiana', 'Dayanna']);
  });
  it('componentes por columna, con lo de Observaciones y lo tachado', () => {
    expect(d.componentes.principal).toEqual([{ texto: 'BM-INV-0667 - CPU Thermaltake', retirado: false }]);
    expect(d.componentes.monitor[0].texto).toBe('BM-INV-0115 - Monitor Samsung / SN - 0ACH');
    expect(d.componentes.audifonos).toEqual([{ texto: 'CV22513DM (Hyperx) - Andres', retirado: false }]);
    expect(d.componentes.accesorios).toEqual([{ texto: 'PAD MOUSE', retirado: false }]);
    expect(d.componentes.mouse).toEqual([{ texto: 'BM-INV-0236', retirado: true }]);
  });
  it('historial en orden y sin los registros del sistema; novedades aparte', () => {
    expect(d.historial.map(h => h.descripcion)).toEqual(['Revisión', 'Cambio de mouse']);
    expect(d.novedades).toHaveLength(1);
    expect(d.hardware.ram).toBe('32 GB');
  });
  it('PDF con la cuadrícula del formato y el texto escapado', () => {
    const html = htmlHojaPuesto({ ...d, personas: ['<b>x</b>'] });
    expect(html).toContain('CÓDIGO: F-MAN-02');
    expect(html).toContain('<s>BM-INV-0236</s>');
    expect(html).toContain('#EA4335');
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('ACCESORIOS');
  });
});

describe('datosHojaEquipo (F-MAN-03)', () => {
  it('identificación, accesorios e historial', () => {
    const d = datosHojaEquipo(
      { nombre: 'Cámara Fotográfica', numeroInventario: 'BM-INV-0197', marca: 'Canon', modelo: 'T8i', numeroSerial: 'DS1', personaEncargada: 'Realizadores', accesorios: 'Lente 18-55' },
      [{ timestamp: ts(2025, 1, 2), tipo: 'preventivo', fecha: ts(2025, 1, 2), descripcion: 'Limpieza de sensor', responsable: 'Juan' }],
    );
    expect(d.identificacion).toMatchObject({ responsable: 'Realizadores', serial: 'SN - DS1', accesorios: 'Lente 18-55' });
    expect(d.historial).toHaveLength(1);
    expect(nombreArchivo(d)).toBe('F-MAN-03 Cámara Fotográfica BM-INV-0197');
    const html = htmlHojaEquipo(d);
    expect(html).toContain('ADICIONALES O ACCESORIOS');
    expect(html).toContain('#ED7D31');
  });
});

describe('cargador del celular', () => {
  const celular = { id: 'k', categoria: 'Smartphones', numeroInventario: 'BM-INV-0207', nombre: 'Celular Huawei', cargador: 'BM-INV-0226', estado: 'En Uso' };
  it('F-MAN-02: sale junto al celular en su casilla', () => {
    const principal = { id: 'p', categoria: 'Laptops', numeroInventario: 'BM-INV-0001', nombre: 'MacBook', cargador: 'BM-INV-0002', estado: 'En Uso' };
    const d = datosHojaPuesto({ puesto: { nombre: 'Puesto', personas: [] }, equipos: [principal, celular], principal, historial: [], items: [] });
    expect(d.componentes.celular[0].texto).toBe('BM-INV-0207 - Celular Huawei / Cargador - BM-INV-0226');
    // el del portátil sigue en su casilla "Fuente" y no se repite en la celda del computador
    expect(d.hardware.fuente).toBe('Cargador BM-INV-0002');
    expect(d.componentes.principal[0].texto).toBe('BM-INV-0001 - MacBook');
  });
  it('F-MAN-03: el cargador queda en "Adicionales o accesorios"', () => {
    const d = datosHojaEquipo({ ...celular, accesorios: 'Funda' }, []);
    expect(d.identificacion.accesorios).toBe('Funda, Cargador BM-INV-0226');
  });
});
