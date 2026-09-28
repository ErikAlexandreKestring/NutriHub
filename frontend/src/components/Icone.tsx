import type { SVGProps } from 'react';

export type NomeDoIcone = 'prato' | 'calendario' | 'pessoas' | 'relogio' | 'seta' | 'voltar' | 'sair';

// Traços de 24×24 no estilo "outline" das abas dos mockups. Sempre
// decorativos: o texto ao lado (ou o aria-label do botão) é que dá o nome.
const TRACOS: Record<NomeDoIcone, string> = {
  prato: 'M3 12h18M5 12a7 7 0 0 0 14 0M12 5v2M8.5 6l.8 1.7M15.5 6l-.8 1.7',
  calendario: 'M7 3v3M17 3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
  pessoas:
    'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19v-1a4 4 0 0 0-3-3.9M15 4.1a3 3 0 0 1 0 5.8',
  relogio: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  seta: 'M5 12h14M13 6l6 6-6 6',
  voltar: 'M19 12H5M11 6l-6 6 6 6',
  sair: 'M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l4-4-4-4M14 12H4',
};

export function Icone({ nome, className = 'h-5 w-5', ...props }: { nome: NomeDoIcone } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path d={TRACOS[nome]} />
    </svg>
  );
}
