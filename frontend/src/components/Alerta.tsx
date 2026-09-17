import type { ReactNode } from 'react';

type Tom = 'erro' | 'sucesso' | 'aviso';

const TONS: Record<Tom, string> = {
  erro: 'bg-red-50 text-red-800 ring-red-200',
  sucesso: 'bg-marca-50 text-marca-800 ring-marca-200',
  aviso: 'bg-amber-50 text-amber-900 ring-amber-200',
};

export function Alerta({ tom = 'erro', children }: { tom?: Tom; children: ReactNode }) {
  return (
    <div
      // `alert` faz o leitor de tela anunciar a falha assim que ela aparece,
      // sem depender de o usuário navegar até o texto.
      role={tom === 'erro' ? 'alert' : 'status'}
      className={`rounded-lg px-4 py-3 text-sm ring-1 ring-inset ${TONS[tom]}`}
    >
      {children}
    </div>
  );
}
