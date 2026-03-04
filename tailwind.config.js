/** @type {import('tailwindcss').Config} */
export default {
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
        },
      },
      fontFamily: {
        sans:    ['Greycliff CF', 'SF Pro Text', 'system-ui', 'sans-serif'],
        display: ['Greycliff CF', 'sans-serif'],
        body:    ['SF Pro Text', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
