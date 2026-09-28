import type { ReactNode } from 'react';

type Tom = 'erro' | 'sucesso' | 'aviso';

const TONS: Record<Tom, string> = {
  erro: 'bg-red-50 text-red-800 ring-red-200',
  // Verde, e não o coral da marca: com a marca avermelhada, sucesso em coral
  // seria lido como erro.
  sucesso: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  aviso: 'bg-amber-50 text-amber-900 ring-amber-200',
};

export function Alerta({ tom = 'erro', children }: { tom?: Tom; children: ReactNode }) {
  return (
    <div
      // `alert` faz o leitor de tela anunciar a falha assim que ela aparece,
      // sem depender de o usuário navegar até o texto.
      role={tom === 'erro' ? 'alert' : 'status'}
      className={`rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${TONS[tom]}`}
    >
      {children}
    </div>
  );
}
