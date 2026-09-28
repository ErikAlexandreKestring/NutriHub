/**
 * Logotipo em texto dos mockups: "NUTRI" + "HUB" em coral. O leitor de tela
 * lê o nome do produto, não as duas metades soletradas.
 */
export function Marca({ claro = false, className = '' }: { claro?: boolean; className?: string }) {
  return (
    <span aria-label="Nutri-Hub" role="img" className={`text-sm font-bold tracking-[0.18em] ${className}`}>
      <span aria-hidden="true" className={claro ? 'text-white' : 'text-slate-900'}>
        NUTRI
      </span>
      <span aria-hidden="true" className={claro ? 'text-marca-400' : 'text-marca-700'}>
        HUB
      </span>
    </span>
  );
}
