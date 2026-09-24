import { chamarApi } from '@/lib/api';
import type { Alimento, PlanoAlimentar, PlanoAtivo, ResumoDoPlano } from './tipos';

/**
 * RF-05. O id vai na URL (e não é lido do token no backend) porque a mesma rota
 * serve ao nutricionista inspecionando um paciente; o `ensurePatientScope` no
 * servidor é quem impede um paciente de pedir o plano de outro.
 */
export function buscarPlanoAtivo(patientId: string, sinal?: AbortSignal): Promise<PlanoAtivo> {
  return chamarApi<PlanoAtivo>(`/patients/${patientId}/meal-plans/ativo`, { sinal });
}

// ---- Construtor de plano (RF-04) — rotas exclusivas do nutricionista ----

export function listarPlanosDoPaciente(patientId: string, sinal?: AbortSignal): Promise<ResumoDoPlano[]> {
  return chamarApi<ResumoDoPlano[]>(`/patients/${patientId}/meal-plans`, { sinal });
}

export function criarRascunho(patientId: string): Promise<ResumoDoPlano> {
  return chamarApi<ResumoDoPlano>(`/patients/${patientId}/meal-plans`, { metodo: 'POST' });
}

export function buscarPlano(id: string, sinal?: AbortSignal): Promise<PlanoAlimentar> {
  return chamarApi<PlanoAlimentar>(`/meal-plans/${id}`, { sinal });
}

export function adicionarRefeicao(planoId: string, dados: { nome: string; horario: string }): Promise<unknown> {
  return chamarApi(`/meal-plans/${planoId}/meals`, { metodo: 'POST', corpo: dados });
}

export function removerRefeicao(planoId: string, refeicaoId: string): Promise<void> {
  return chamarApi<void>(`/meal-plans/${planoId}/meals/${refeicaoId}`, { metodo: 'DELETE' });
}

export function adicionarItem(
  planoId: string,
  refeicaoId: string,
  dados: { food_id: string; quantidade_g: number },
): Promise<unknown> {
  return chamarApi(`/meal-plans/${planoId}/meals/${refeicaoId}/items`, { metodo: 'POST', corpo: dados });
}

export function removerItem(planoId: string, refeicaoId: string, itemId: string): Promise<void> {
  return chamarApi<void>(`/meal-plans/${planoId}/meals/${refeicaoId}/items/${itemId}`, { metodo: 'DELETE' });
}

/** Meta e orientações como o backend recebe: string vazia vira "sem valor". */
export interface DetalhesDoPlano {
  meta_kcal: string;
  orientacoes: string;
}

/** RN-02: publicar encerra o plano ativo anterior do paciente. */
export function publicarPlano(planoId: string, detalhes: DetalhesDoPlano): Promise<unknown> {
  return chamarApi(`/meal-plans/${planoId}/publish`, { metodo: 'POST', corpo: detalhes });
}

/**
 * Corrige meta/orientações de um plano já ativo sem republicá-lo (issue #10).
 * Os dois campos vão sempre: o formulário mostra ambos, e apagar um deles é
 * uma escolha explícita do nutricionista.
 */
export function corrigirPlanoAtivo(planoId: string, detalhes: DetalhesDoPlano): Promise<PlanoAlimentar> {
  return chamarApi<PlanoAlimentar>(`/meal-plans/${planoId}`, {
    metodo: 'PATCH',
    corpo: { meta_kcal: detalhes.meta_kcal.trim() || null, orientacoes: detalhes.orientacoes },
  });
}

export function buscarAlimentos(termo: string, sinal?: AbortSignal): Promise<Alimento[]> {
  return chamarApi<Alimento[]>(`/foods?search=${encodeURIComponent(termo)}`, { sinal });
}
