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
          hover: '#3C6EAE',
        },
        'vert-validation': '#6BAF92',
        'rouge-accent': '#FF6161',
        'gris-moyen': '#C3C3C3',
        gray: {
          50: '#F5F6F8', // Aligns with fond-clair-principal
          100: '#E5E7EB',
          200: '#D1D5DB',
          300: '#C3C3C3', // Aligns with gris-moyen
          700: '#4B5563',
          800: '#2D2D2D', // Aligns with texte-principal
        },
        blue: {
          600: '#1A4F8B', // Aligns with accent-neutre
          700: '#3C6EAE', // Aligns with accent-neutre-hover
        },
        green: {
          100: '#DCFCE7',
          800: '#6BAF92', // Aligns with vert-validation
        },
        red: {
          100: '#FEE2E2',
          800: '#FF6161', // Aligns with rouge-accent
        }
      }
    }
  },
  plugins: [require('@tailwindcss/forms')] // Optional: include for better form styling
};