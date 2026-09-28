/** "Maria da Silva" → "MS": duas iniciais, como o "P1" dos mockups. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return `${primeira}${ultima}`.toUpperCase();
}

const TAMANHOS = {
  p: 'h-10 w-10 text-sm',
  g: 'h-20 w-20 text-2xl',
} as const;

/** Círculo com as iniciais. Decorativo: o nome sempre aparece ao lado. */
export function Avatar({ nome, tamanho = 'p', apagado = false }: { nome: string; tamanho?: keyof typeof TAMANHOS; apagado?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-semibold ${TAMANHOS[tamanho]} ${
        apagado ? 'bg-slate-200 text-slate-600' : 'bg-marca-100 text-marca-800'
      }`}
    >
      {iniciais(nome)}
    </span>
  );
}
