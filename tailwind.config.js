/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Barlow', 'Segoe UI', 'sans-serif'],
        display: ['Barlow Condensed', 'Barlow', 'sans-serif'],
      },
      colors: {
        brand: { DEFAULT: '#ee3444', soft: '#fff0f1' },
      },
    },
  },
  plugins: [],
};
