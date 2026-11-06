// ─────────────────────────────────────────────
//  Avisos de "T.I. te respondió" mientras la app está abierta (sin servidor):
//  - el título de la pestaña lleva el número: "(1) T.I. te respondió · …"
//  - si la persona aceptó, sale una notificación del navegador cuando llega una
//    respuesta nueva y no está mirando la pestaña.
//  No avisa con la app cerrada: para eso hace falta un servidor (plan Blaze).
//  Las respuestas que ya estaban sin leer al abrir no disparan notificación
//  (ya se ven en el aviso de arriba).
// ─────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react';
import { firmaRespuesta, tituloPestana, lineaParaColaborador } from '../utils/tickets';

const soportado = () => typeof window !== 'undefined' && 'Notification' in window;
const leerPermiso = () => (soportado() ? Notification.permission : 'no-soportado');

const useAvisosRespuesta = ({ nuevas, cargando, titulo, onAbrir }) => {
  const [permiso, setPermiso] = useState(leerPermiso);
  const base = useRef(null);
  const conocidas = useRef(null); // firmas ya vistas; null hasta que cargan los tickets
  const abrir = useRef(onAbrir);
  abrir.current = onAbrir;

  // Título de la pestaña
  const cuantas = nuevas.length;
  useEffect(() => {
    if (base.current === null) base.current = document.title;
    document.title = tituloPestana(base.current, cuantas);
    return () => { document.title = base.current; };
  }, [cuantas]);

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
        const n = new Notification('T.I. te respondió', {
          body: `${titulo(t)} · ${lineaParaColaborador(t)}`, tag: `ticket-${t.id}`, icon: '/pwa-192x192.png',
        });
        n.onclick = () => { window.focus(); abrir.current?.(t.id); n.close(); };
      } catch { /* el navegador no dejó crearla */ }
    }
  }, [nuevas, cargando, permiso, titulo]);

  const pedirPermiso = useCallback(async () => {
    if (!soportado()) return 'no-soportado';
    try { const p = await Notification.requestPermission(); setPermiso(p); return p; } catch { return leerPermiso(); }
  }, []);

  return { permiso, pedirPermiso };
};

export default useAvisosRespuesta;
