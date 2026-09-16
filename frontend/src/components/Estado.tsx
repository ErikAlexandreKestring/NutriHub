import type { ReactNode } from 'react';

export function Carregando({ rotulo = 'Carregando…' }: { rotulo?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-8 text-slate-600">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-marca-700"
        aria-hidden="true"
      />
      {rotulo}
    </div>
  );
}

export function EstadoVazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="font-medium text-slate-800">{titulo}</p>
      {children && <p className="mt-1 text-sm text-slate-600">{children}</p>}
    </div>
  );
}
