import { Link } from 'react-router-dom';
import { AuthShell } from '@/layouts/AuthShell';

export function NaoEncontrada() {
  return (
    <AuthShell titulo="Página não encontrada" descricao="O endereço acessado não existe.">
      <Link to="/" className="link-texto text-sm">
        Voltar ao início
      </Link>
    </AuthShell>
  );
}
