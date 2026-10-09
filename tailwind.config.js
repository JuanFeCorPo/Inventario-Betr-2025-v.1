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
          amber:   '#EDAA00',
          yellow:  '#F4DB44',
          slate:   '#5E6A74',
          gray:    '#8D8D8D',
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
      // Spinner más veloz: la carga se percibe más rápida
      animation: { spin: 'spin 0.7s linear infinite' },
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
