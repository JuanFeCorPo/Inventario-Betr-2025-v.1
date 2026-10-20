/** @type {import('tailwindcss').Config} */
export default {
  // Los :hover solo aplican con puntero real (en celular no quedan "pegados" tras tocar)
  future: { hoverOnlyWhenSupported: true },
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange:  '#E68E00',
          ember:   '#9A5700',   // naranja para TEXTO (5,6:1 sobre blanco); el naranja de marca va en fondos con texto de tinta
          amber:   '#EDAA00',
          yellow:  '#F4DB44',
          slate:   '#5E6A74',
          gray:    '#686D72',   // 5,2:1 sobre blanco (antes #8D8D8D, 3,3:1)
          ink:     '#1C2B35',
          bg:      '#F0F2F4',
          border:  '#E8EAED',
        },
      },
      // Curva ease-out fuerte (Emil Kowalski) y 150 ms como base de toda transición
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.23, 1, 0.32, 1)',
        out:     'cubic-bezier(0.23, 1, 0.32, 1)',
      },
      transitionDuration: { DEFAULT: '150ms' },
      // Sombras de tarjeta en dos capas, teñidas con la tinta de marca (profundidad suave, sin gris plano)
      boxShadow: {
        card:         '0 1px 2px rgba(28, 43, 53, 0.05), 0 4px 12px rgba(28, 43, 53, 0.05)',
        'card-hover': '0 2px 4px rgba(28, 43, 53, 0.06), 0 8px 24px rgba(28, 43, 53, 0.09)',
      },
      // Spinner más veloz: la carga se percibe más rápida
      animation: { spin: 'spin 0.7s linear infinite' },
      // IBM Plex Sans (texto) + IBM Plex Mono (solo códigos: Nº de inventario y serial).
      // Se sirven desde el propio sitio (@fontsource, ver main.jsx), sin depender de un CDN externo.
      fontFamily: {
        sans:    ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        body:    ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
