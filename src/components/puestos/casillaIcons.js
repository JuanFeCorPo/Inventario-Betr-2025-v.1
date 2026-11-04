// Ícono de cada casilla del puesto (formato F-MAN-02): uno distinto por tipo,
// para reconocer de un vistazo qué tiene y qué le falta a cada puesto.
import { Cpu, Laptop, Monitor, BatteryCharging, Keyboard, Mouse, Smartphone, Headphones, Package } from 'lucide-react';

export const CASILLA_ICONS = {
  principal: Cpu,
  monitor: Monitor,
  ups: BatteryCharging,
  teclado: Keyboard,
  mouse: Mouse,
  celular: Smartphone,
  audifonos: Headphones,
  accesorios: Package,
};

// La casilla principal muestra portátil o CPU según lo que tenga el puesto.
export const iconoCasilla = (key, equipos = []) =>
  key === 'principal' && equipos.some(e => e.categoria === 'Laptops') && !equipos.some(e => e.categoria === 'CPU')
    ? Laptop
    : CASILLA_ICONS[key] ?? Package;
