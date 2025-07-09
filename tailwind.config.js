/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'fond-clair-principal': '#F5F6F8',
        'texte-principal': '#2D2D2D',
        'accent-neutre': {
          DEFAULT: '#1A4F8B',
          hover: '#3C6EAE', //  Vous pouvez l'utiliser comme bg-accent-neutre-hover
        },
        'vert-validation': '#6BAF92',
        'rouge-accent': '#FF6161',
        'gris-moyen': '#C3C3C3',
      },
    },
  },
  plugins: [],
};
