import { EstadoVazio } from '@/components/Estado';
import { AppShell } from '@/layouts/AppShell';

/** Destino do paciente após o login. O conteúdo é o RF-05. */
export function MeuPlano() {
  return (
    <AppShell titulo="Meu plano">
      <EstadoVazio titulo="Plano alimentar em construção">
        A visualização do plano ativo entra com o RF-05.
      </EstadoVazio>
    </AppShell>
  );
}
