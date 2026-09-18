import { Link } from 'react-router-dom';
import { AuthShell } from '@/layouts/AuthShell';

export function NaoEncontrada() {
  return (
    <AuthShell titulo="Página não encontrada" descricao="O endereço acessado não existe.">
      <Link to="/" className="text-sm font-semibold text-marca-700 underline">
        Voltar ao início
      </Link>
    </AuthShell>
  );
}
