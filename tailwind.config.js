/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.html', './static/**/*.{html,js}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: { 900: '#1e3a8a', 800: '#1e40af', 700: '#1d4ed8' },
        // 500 is the brand orange from the Canva design. It is too light for white
        // text or for text on white, so use primary-900 text on it and accent-700
        // for orange text on light backgrounds.
        accent: { 500: '#ffbd59', 600: '#f5a524', 700: '#b45309' },
      },
    },
  },
  plugins: [],
};
