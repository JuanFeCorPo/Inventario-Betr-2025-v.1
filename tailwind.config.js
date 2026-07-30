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
          ink:     '#1C2B35',
          bg:      '#F0F2F4',
          border:  '#E8EAED',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
        body:    ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
