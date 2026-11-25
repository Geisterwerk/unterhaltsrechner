/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Akzentfarbe der App – Hauptton #007D7D (petrol-600)
        petrol: {
          50: '#ecfdfd',
          100: '#cff7f7',
          200: '#a0eded',
          300: '#66dcdc',
          400: '#2bbcbc',
          500: '#009a9a',
          600: '#007d7d',
          700: '#006666',
          800: '#005252',
          900: '#003f3f',
          950: '#002a2a',
        },
      },
    },
  },
  plugins: [],
};
