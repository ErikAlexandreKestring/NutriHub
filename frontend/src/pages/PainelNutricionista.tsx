import { EstadoVazio } from '@/components/Estado';
import { AppShell } from '@/layouts/AppShell';

/** Destino do nutricionista após o login. O conteúdo é o RF-10. */
export function PainelNutricionista() {
  return (
    <AppShell titulo="Painel">
      <EstadoVazio titulo="Painel em construção">
        A visão consolidada de pacientes, planos e agenda entra com o RF-10.
      </EstadoVazio>
    </AppShell>
  );
}
