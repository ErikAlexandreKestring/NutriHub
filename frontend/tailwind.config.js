/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Coral da identidade visual do RFC (capítulo 4, mockups). O 500 é a
        // cor da marca, mas branco sobre ele fica em 3,1:1 — só serve para
        // fundo de texto grande e para decoração. Texto e botões usam os tons
        // escurecidos até passar no AA (RNF-08):
        //   600: branco sobre ele 4,55:1 — fundo de botão e de cabeçalho
        //   700: sobre branco/creme/50 acima de 5:1 — links e texto em coral
        marca: {
          50: '#FEF3F2',
          100: '#FDE4E2',
          200: '#FACBC8',
          300: '#F6A7A3',
          400: '#F2837E',
          500: '#EF6661',
          600: '#D2433E',
          700: '#B23A35',
          800: '#93302C',
          900: '#7A2A27',
        },
        // Azul-marinho quase preto das telas de boas-vindas e do topo do app
        // do paciente. Coral 400/500 sobre ele passa no AA (acima de 5:1).
        tinta: {
          700: '#2E3647',
          800: '#212838',
          900: '#171D29',
          950: '#0F131B',
        },
        // Fundo off-white e preenchimento dos campos, tirados dos mockups.
        creme: {
          DEFAULT: '#F7F5F1',
          campo: '#EFECE6',
        },
      },
      fontFamily: {
        // Serifada condensada dos títulos ("Coma bem. Viva melhor."). O texto
        // corrido continua na fonte do sistema.
        titulo: ['"Instrument Serif"', 'Georgia', 'serif'],
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
