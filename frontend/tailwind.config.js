/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Verde institucional do Nutri-Hub. Os tons 700/800 passam em contraste
        // AA sobre branco (RNF-08), por isso são eles que carregam texto.
        marca: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
      },
      minHeight: {
        // RNF-08: área clicável mínima de 44x44px.
        toque: '44px',
      },
      minWidth: {
        toque: '44px',
      },
    },
  },
  plugins: [],
};
