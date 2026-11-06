import { describe, it, expect } from 'vitest';
import { codigoTicket, tituloTicket, ordenarTickets, pendientesTI, haceCuanto, validarTicket, estaAbierto, quienAtiende, lineaParaColaborador, ordenarParaColaborador, firmaRespuesta, tituloPestana } from './tickets';

const ts = (ms) => ({ toMillis: () => ms });

describe('tickets', () => {
  it('código corto con día, mes y sufijo', () => {
    expect(codigoTicket(new Date(2026, 10, 3), () => 0)).toBe('T-0311-000');
    expect(codigoTicket(new Date(2026, 0, 9), () => 0.5)).toMatch(/^T-0901-[0-9A-Z]{3}$/);
  });
  it('título según el tipo', () => {
    expect(tituloTicket({ categoria: 'equipo', equipoNombre: 'Mouse Logitech', equipoCodigo: 'BM-INV-0538' })).toBe('Mouse Logitech (BM-INV-0538)');
    expect(tituloTicket({ categoria: 'internet' })).toBe('Internet o red');
  });
  it('orden: abiertos primero, urgentes y luego los más antiguos; resueltos recientes primero', () => {
    const out = ordenarTickets([
      { id: 'r1', estado: 'resuelto', resueltoAt: ts(10) },
      { id: 'a', estado: 'recibido', urgencia: 'normal', creadoAt: ts(1) },
      { id: 'b', estado: 'en_proceso', urgencia: 'bloquea', creadoAt: ts(5) },
      { id: 'r2', estado: 'resuelto', resueltoAt: ts(20) },
      { id: 'c', estado: 'recibido', urgencia: 'normal', creadoAt: ts(0) },
    ]).map(t => t.id);
    expect(out).toEqual(['b', 'c', 'a', 'r2', 'r1']);
  });
  it('pendientes para T.I.: nuevos o con mensaje sin leer', () => {
    const out = pendientesTI([
      { id: 1, estado: 'recibido' },
      { id: 2, estado: 'en_proceso', vistoPorTI: false },
      { id: 3, estado: 'en_proceso', vistoPorTI: true },
      { id: 4, estado: 'resuelto', vistoPorTI: false },
    ]).map(t => t.id);
    expect(out).toEqual([1, 2]);
    expect(estaAbierto({ estado: 'resuelto' })).toBe(false);
  });
  it('tiempo relativo', () => {
    const ahora = 1_000_000_000_000;
    expect(haceCuanto(ts(ahora - 30_000), ahora)).toBe('ahora');
    expect(haceCuanto(ts(ahora - 5 * 60_000), ahora)).toBe('hace 5 min');
    expect(haceCuanto(ts(ahora - 3 * 3_600_000), ahora)).toBe('hace 3 h');
    expect(haceCuanto(ts(ahora - 26 * 3_600_000), ahora)).toBe('hace 1 día');
  });
  it('valida lo que escribe el colaborador', () => {
    expect(validarTicket({ categoria: 'equipo', descripcion: 'no prende' })).toEqual({ equipoId: 'Elige el equipo que falla.' });
    expect(validarTicket({ categoria: 'internet', descripcion: 'no' }).descripcion).toBeTruthy();
    expect(validarTicket({ categoria: 'software', descripcion: 'Photoshop se cierra solo' })).toEqual({});
  });
});

describe('vista del colaborador', () => {
  const ts = (n) => ({ toMillis: () => n });
  const ahora = 10_000_000_000;
  it('quién atiende: primer nombre o lo de antes de la @', () => {
    expect(quienAtiende({ tomadoPor: 'Juan Felipe Cortés' })).toBe('Juan');
    expect(quienAtiende({ tomadoPor: 'sistemas@betrmedia.com' })).toBe('sistemas');
    expect(quienAtiende({})).toBe('');
    // se tomó con el correo y luego respondió con su nombre
    expect(quienAtiende({ tomadoPor: 'juanfecortes@betrmedia.com', mensajes: [{ autor: 'ti', nombre: 'Juan Felipe Cortés' }] })).toBe('Juan');
    expect(quienAtiende({ tomadoPor: 'juanfecortes@betrmedia.com', mensajes: [{ autor: 'ti', nombre: 'juanfecortes@betrmedia.com' }] })).toBe('juanfecortes');
  });
  it('línea de estado humana', () => {
    expect(lineaParaColaborador({ estado: 'recibido', creadoAt: ts(ahora - 25 * 60_000) }, ahora)).toBe('T.I. lo revisará pronto · hace 25 min');
    expect(lineaParaColaborador({ estado: 'en_proceso', tomadoPor: 'Juan Felipe', actualizado: ts(ahora - 2 * 3_600_000) }, ahora)).toBe('Lo atiende Juan · hace 2 h');
    expect(lineaParaColaborador({ estado: 'resuelto', resueltoAt: ts(ahora - 2 * 86_400_000) }, ahora)).toBe('Resuelto hace 2 días');
  });
  it('respuestas nuevas primero, luego abiertos recientes, luego resueltos', () => {
    const out = ordenarParaColaborador([
      { id: 'res', estado: 'resuelto', actualizado: ts(9) },
      { id: 'viejo', estado: 'recibido', actualizado: ts(1) },
      { id: 'nuevo', estado: 'en_proceso', actualizado: ts(5) },
      { id: 'resp', estado: 'en_proceso', actualizado: ts(2), vistoPorColaborador: false },
    ]);
    expect(out.map(t => t.id)).toEqual(['resp', 'nuevo', 'viejo', 'res']);
  });
});

describe('avisos con la app abierta', () => {
  it('la firma cambia cuando T.I. vuelve a escribir o cambia el estado', () => {
    const t = { id: 'a', estado: 'en_proceso', mensajes: [{}] };
    expect(firmaRespuesta(t)).toBe(firmaRespuesta({ ...t }));
    expect(firmaRespuesta(t)).not.toBe(firmaRespuesta({ ...t, mensajes: [{}, {}] }));
    expect(firmaRespuesta(t)).not.toBe(firmaRespuesta({ ...t, estado: 'resuelto' }));
  });
  it('título de la pestaña con el número de respuestas', () => {
    expect(tituloPestana('BETR MEDIA TECH', 0)).toBe('BETR MEDIA TECH');
    expect(tituloPestana('BETR MEDIA TECH', 2)).toBe('(2) T.I. te respondió · BETR MEDIA TECH');
  });
});
