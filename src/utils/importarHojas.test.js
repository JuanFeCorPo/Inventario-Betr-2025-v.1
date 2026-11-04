import { describe, it, expect } from 'vitest';
import { prepararImportacion, codigoInventario, validarPlan, yaImportado, cargadorEnTexto } from './importarHojas';

const item = (id, codigo, categoria, extra = {}) =>
  ({ id, numeroInventario: codigo, categoria, nombre: `${categoria} ${codigo}`, estado: 'En Uso', personaEncargada: 'Betrmedia', ...extra });

const planBase = (extra = {}) => ({
  version: 1, avisos: [], crear: [], historialEquipos: [],
  puestos: [{
    clave: 'hv-opt-1', nombre: 'Optimización #1', area: 'Operaciones', hoja: 'Opt/EQUIPO #1.xlsx',
    personas: [{ nombre: 'Ana', correo: '' }], observaciones: 'Accesorios: Pad mouse',
    equipos: ['BM-INV-0001', 'BM-INV-0002'], retirados: ['BM-INV-0009'], hardware: { ram: '16 GB' },
    historial: [
      { fecha: '2024-01-10', tipo: 'preventivo', descripcion: 'Limpieza', responsable: 'Juan' },
      { fecha: '2024-06-01', tipo: 'correctivo', descripcion: 'Se cambia el mouse BM-INV-0009 por fallas', responsable: 'Juan' },
      { fecha: '2025-02-01', tipo: 'novedad', descripcion: 'No prende', reporta: 'Ana' },
    ],
  }],
  ...extra,
});

describe('codigoInventario', () => {
  it('normaliza variantes', () => {
    expect(codigoInventario('BM-INV0538')).toBe('BM-INV-0538');
    expect(codigoInventario('bm inv 77')).toBe(null);
    expect(codigoInventario('BM-INV-077')).toBe('BM-INV-0077');
  });
});

describe('cargadorEnTexto', () => {
  it('saca el código del cargador de las observaciones', () => {
    expect(cargadorEnTexto('Model: A1466 / Cargador Portatil: BM-INV-0226')).toBe('BM-INV-0226');
    expect(cargadorEnTexto('Cargador BM-INV-0201 ')).toBe('BM-INV-0201');
    expect(cargadorEnTexto('Cargador Poratil: BM-INV0238')).toBe('BM-INV-0238');
    expect(cargadorEnTexto('Teclado BM-INV-0100')).toBe(null);
  });
  it('lo pone en los portátiles que no lo tienen', () => {
    const items = [
      { id: 'l', numeroInventario: 'BM-INV-0225', categoria: 'Laptops', estado: 'Disponible', observaciones: 'Cargador: BM-INV-0226' },
      { id: 'm', numeroInventario: 'BM-INV-0237', categoria: 'Laptops', estado: 'En Uso', observaciones: 'Cargador: BM-INV-0238', cargador: 'BM-INV-0999' },
    ];
    const r = prepararImportacion({ version: 1, puestos: [], historialEquipos: [], crear: [] }, items);
    expect(r.actualizar.get('l')).toEqual({ cargador: 'BM-INV-0226' });
    expect(r.actualizar.has('m')).toBe(false);
    expect(r.resumen.cargadores).toBe(1);
  });
});

describe('fichas F-MAN-03', () => {
  it('pone los accesorios a equipos que no los tienen y a los que se crean', () => {
    const plan = { version: 1, puestos: [], historialEquipos: [], crear: [{ codigo: 'BM-INV-0300', categoria: 'Cámaras', nombre: 'GoPro' }],
      fichas: [{ codigo: 'BM-INV-0197', accesorios: 'Lente 18-55' }, { codigo: 'BM-INV-0198', accesorios: 'Correa' }, { codigo: 'BM-INV-0300', accesorios: 'Estuche' }] };
    const items = [
      { id: 'c', numeroInventario: 'BM-INV-0197', categoria: 'Cámaras', estado: 'En Uso' },
      { id: 'd', numeroInventario: 'BM-INV-0198', categoria: 'Cámaras', estado: 'En Uso', accesorios: 'Ya tiene' },
    ];
    const r = prepararImportacion(plan, items);
    expect(r.actualizar.get('c')).toEqual({ accesorios: 'Lente 18-55' });
    expect(r.actualizar.has('d')).toBe(false);
    expect(r.crear[0].data.accesorios).toBe('Estuche');
  });
});

describe('validarPlan / yaImportado', () => {
  it('reconoce un plan y una importación previa', () => {
    expect(validarPlan(planBase())).toBe(true);
    expect(validarPlan({ version: 2 })).toBe(false);
    expect(yaImportado([{ origen: 'hoja-de-vida' }])).toBe(true);
    expect(yaImportado([{ nombre: 'Manual' }])).toBe(false);
  });
});

describe('prepararImportacion', () => {
  const items = [
    item('a', 'BM-INV-0001', 'CPU'),
    item('b', 'BM-INV-0002', 'Monitores', { personaEncargada: 'Optimización #1' }),
    item('z', 'BM-INV-0009', 'Periféricos', { nombre: 'Mouse viejo' }),
  ];

  it('asigna equipos al puesto y pone al día el principal', () => {
    const r = prepararImportacion(planBase(), items);
    expect(r.puestos).toHaveLength(1);
    expect(r.puestos[0].data).toMatchObject({ nombre: 'Optimización #1', origen: 'hoja-de-vida', correos: [] });
    expect(r.actualizar.get('a')).toEqual({ puestoId: 'hv-opt-1', personaEncargada: 'Optimización #1', ultimoMantenimiento: '2024-01-10', ram: '16 GB' });
    // El encargado ya coincide: solo se enlaza
    expect(r.actualizar.get('b')).toEqual({ puestoId: 'hv-opt-1' });
  });

  it('historial: mantenimientos ligados al principal y retirados fechados por su mención', () => {
    const h = prepararImportacion(planBase(), items).puestos[0].historial;
    expect(h.find(x => x.tipo === 'preventivo').equipoRef).toBe('a');
    expect(h.find(x => x.tipo === 'novedad')).toMatchObject({ reporta: 'Ana' });
    expect(h.find(x => x.tipo === 'cambio')).toMatchObject({ fecha: '2024-06-01', descripcion: 'Sale Mouse viejo (BM-INV-0009) (tachado en la hoja de vida).' });
  });

  it('no mueve un mantenimiento a una fecha anterior', () => {
    const conFecha = [{ ...items[0], ultimoMantenimiento: { toDate: () => new Date(2025, 0, 1, 12) } }, ...items.slice(1)];
    expect(prepararImportacion(planBase(), conFecha).actualizar.get('a')).not.toHaveProperty('ultimoMantenimiento');
  });

  it('crea los equipos decididos dentro de su puesto', () => {
    const plan = planBase({ crear: [{ codigo: 'BM-INV-0002', categoria: 'Monitores', nombre: 'Monitor LG', marca: 'LG', modelo: '', numeroSerial: 'X1' }] });
    const r = prepararImportacion(plan, [items[0]]);
    expect(r.crear).toHaveLength(1);
    expect(r.crear[0]).toMatchObject({ codigo: 'BM-INV-0002', puestoId: 'hv-opt-1' });
    expect(r.crear[0].data).toMatchObject({ estado: 'En Uso', personaEncargada: 'Optimización #1', marca: 'LG', numeroSerial: 'X1' });
  });

  it('avisa lo que no está y no toca códigos repetidos ni dados de baja', () => {
    const dup = [items[0], item('c', 'BM-INV-0002', 'Monitores'), item('d', 'BM-INV-0002', 'Monitores')];
    const r = prepararImportacion(planBase(), dup);
    expect(r.actualizar.has('c')).toBe(false);
    expect(r.avisos.some(a => a.includes('BM-INV-0002 está repetido'))).toBe(true);

    const baja = prepararImportacion(planBase(), [items[0], item('b', 'BM-INV-0002', 'Monitores', { estado: 'De Baja' })]);
    expect(baja.actualizar.has('b')).toBe(false);
    expect(baja.puestos[0].historial.some(h => h.descripcion.includes('De Baja'))).toBe(true);
  });

  it('historial de equipos sueltos va al CPU o portátil de la hoja', () => {
    const plan = planBase({
      puestos: [],
      historialEquipos: [{ hoja: 'Backup/BM-INV-0001.xlsx', formato: 'F-MAN-02', codigos: ['BM-INV-0002', 'BM-INV-0001'], historial: [
        { fecha: '2023-05-02', tipo: 'preventivo', descripcion: 'Formateo', responsable: 'Fabian' },
      ] }],
    });
    const r = prepararImportacion(plan, items);
    expect(r.historialEquipos).toEqual([{ ref: 'a', entradas: [{ fecha: '2023-05-02', tipo: 'preventivo', descripcion: 'Formateo', responsable: 'Fabian', reporta: '', action: 'Mantenimiento preventivo (hoja de vida).\nFormateo\nResponsable: Fabian' }] }]);
    expect(r.actualizar.get('a')).toEqual({ ultimoMantenimiento: '2023-05-02' });
  });
});
