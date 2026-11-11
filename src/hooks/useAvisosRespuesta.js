// ─────────────────────────────────────────────
//  Avisos mientras la app está abierta (sin servidor), para los dos lados:
//  - Colaborador: "T.I. te respondió" (textos por defecto).
//  - T.I.: ticket nuevo o respuesta del colaborador (ver textoPestana y armarAviso).
//  - el título de la pestaña lleva el número: "(1) T.I. te respondió · …"
//  - si la persona aceptó, sale una notificación del navegador cuando llega algo
//    nuevo y no está mirando la pestaña.
//  No avisa con la app cerrada: para eso hace falta un servidor (plan Blaze).
//  Las respuestas que ya estaban sin leer al abrir no disparan notificación
//  (ya se ven en el aviso de arriba).
// ─────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react';
import { firmaRespuesta, tituloPestana, lineaParaColaborador } from '../utils/tickets';

const soportado = () => typeof window !== 'undefined' && 'Notification' in window;
const leerPermiso = () => (soportado() ? Notification.permission : 'no-soportado');

const useAvisosRespuesta = ({ nuevas, cargando, titulo, onAbrir, textoPestana = tituloPestana, armarAviso }) => {
  const [permiso, setPermiso] = useState(leerPermiso);
  const base = useRef(null);
  const conocidas = useRef(null); // firmas ya vistas; null hasta que cargan los tickets
  const abrir = useRef(onAbrir);
  abrir.current = onAbrir;

  // Título de la pestaña
  const cuantas = nuevas.length;
  useEffect(() => {
    if (base.current === null) base.current = document.title;
    document.title = textoPestana(base.current, cuantas);
    return () => { document.title = base.current; };
  }, [cuantas, textoPestana]);

  // Notificación del navegador para respuestas que llegan con la app abierta
  useEffect(() => {
    if (cargando) return;
    const actuales = nuevas.map(t => [firmaRespuesta(t), t]);
    if (conocidas.current === null) { conocidas.current = new Set(actuales.map(([f]) => f)); return; }
    for (const [firma, t] of actuales) {
      if (conocidas.current.has(firma)) continue;
      conocidas.current.add(firma);
      if (permiso !== 'granted' || document.hasFocus()) continue;
      try {
        const aviso = armarAviso ? armarAviso(t) : { titulo: 'T.I. te respondió', cuerpo: `${titulo(t)} · ${lineaParaColaborador(t)}` };
        const n = new Notification(aviso.titulo, {
          body: aviso.cuerpo, tag: `ticket-${t.id}`, icon: '/icono-192-v2.png', requireInteraction: !!aviso.urgente,
        });
        n.onclick = () => { window.focus(); abrir.current?.(t.id); n.close(); };
      } catch { /* el navegador no dejó crearla */ }
    }
  }, [nuevas, cargando, permiso, titulo, armarAviso]);

  const pedirPermiso = useCallback(async () => {
    if (!soportado()) return 'no-soportado';
    try { const p = await Notification.requestPermission(); setPermiso(p); return p; } catch { return leerPermiso(); }
  }, []);

  return { permiso, pedirPermiso };
};

export default useAvisosRespuesta;
