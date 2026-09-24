import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alerta } from '@/components/Alerta';
import { Carregando, EstadoVazio } from '@/components/Estado';
import { Selo } from '@/components/Selo';
import { AppShell } from '@/layouts/AppShell';
import { formatarData } from '@/lib/formato';
import { mensagemDeFalha } from '@/lib/useErrosDeFormulario';
import { useRecurso } from '@/lib/useRecurso';
import { buscarPaciente } from '@/pacientes/pacientesApi';
import { kcalPrevisto } from '@/plano/calculos';
import { FormularioDeDetalhes } from '@/plano/construtor/FormularioDeDetalhes';
import { NovaRefeicao } from '@/plano/construtor/NovaRefeicao';
import { RefeicaoEditavel } from '@/plano/construtor/RefeicaoEditavel';
import { ListaDeRefeicoes } from '@/plano/ListaDeRefeicoes';
import {
  adicionarItem,
  adicionarRefeicao,
  buscarPlano,
  corrigirPlanoAtivo,
  publicarPlano,
  removerItem,
  removerRefeicao,
  type DetalhesDoPlano,
} from '@/plano/planoApi';
import { ResumoNutricional } from '@/plano/ResumoNutricional';
import { SELO_DO_STATUS } from '@/plano/status';
import type { PlanoAlimentar } from '@/plano/tipos';

function detalhesDe(plano: PlanoAlimentar): DetalhesDoPlano {
  return {
    // "1800.00" → "1800": o input numérico mostraria as casas decimais à toa.
    meta_kcal: plano.meta_kcal === null ? '' : String(Number(plano.meta_kcal)),
    orientacoes: plano.orientacoes ?? '',
  };
}

/**
 * RF-04 / UC-02: construtor do plano alimentar. Em rascunho, monta refeições e
 * alimentos e publica; ativo, só permite corrigir meta e orientações (issue
 * #10); encerrado, é apenas consulta.
 */
export function ConstrutorDePlano() {
  const { id = '' } = useParams();
  const plano = useRecurso(id, (sinal) => buscarPlano(id, sinal));
  const pacienteId = plano.estado.situacao === 'pronto' ? plano.estado.dados.patient_id : null;
  const paciente = useRecurso(pacienteId, (sinal) => buscarPaciente(pacienteId ?? '', sinal));

  const [detalhes, setDetalhes] = useState<DetalhesDoPlano>({ meta_kcal: '', orientacoes: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Preenche o formulário quando o plano chega (ou muda de status). Não a cada
  // atualização: adicionar um alimento recarrega o plano e apagaria a meta que
  // o nutricionista está digitando para publicar.
  const statusCarregado = plano.estado.situacao === 'pronto' ? plano.estado.dados.status : null;
  useEffect(() => {
    if (plano.estado.situacao === 'pronto') setDetalhes(detalhesDe(plano.estado.dados));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ver comentário acima
  }, [id, statusCarregado]);

  const nomeDoPaciente = paciente.estado.situacao === 'pronto' ? paciente.estado.dados.nome : null;
  const voltar = pacienteId
    ? { para: `/pacientes/${pacienteId}`, rotulo: nomeDoPaciente ?? 'Voltar ao paciente' }
    : { para: '/pacientes', rotulo: 'Pacientes' };

  const dados = plano.estado.situacao === 'pronto' ? plano.estado.dados : null;
  const selo = dados ? SELO_DO_STATUS[dados.status] : null;
  // No rascunho, o resumo acompanha a meta enquanto ela é digitada.
  const metaDoResumo = dados?.status === 'rascunho' ? detalhes.meta_kcal.trim() || null : (dados?.meta_kcal ?? null);

  /** Ações de formulário: a falha sobe para o formulário mostrar no campo. */
  async function alterarEAtualizar(acao: () => Promise<unknown>) {
    setErro(null);
    setSucesso(null);
    await acao();
    await plano.atualizar();
  }

  /** Remoções: a falha vira alerta na página, não há campo a apontar. */
  async function remover(acao: () => Promise<unknown>) {
    try {
      await alterarEAtualizar(acao);
    } catch (falha) {
      setErro(mensagemDeFalha(falha, 'Não foi possível remover.'));
    }
  }

  async function publicar() {
    const confirmou = window.confirm(
      'Publicar este plano? O paciente passa a vê-lo no app e, se já tiver um plano ativo, ele será encerrado e substituído por este.',
    );
    if (!confirmou) return;

    await alterarEAtualizar(() => publicarPlano(id, detalhes));
    setSucesso('Plano publicado. O paciente já pode vê-lo no app.');
  }

  async function corrigir() {
    setErro(null);
    setSucesso(null);
    const atualizado = await corrigirPlanoAtivo(id, detalhes);
    plano.definirDados(atualizado);
    setDetalhes(detalhesDe(atualizado));
    setSucesso('Correção salva. O paciente já vê a versão corrigida.');
  }

  return (
    <AppShell titulo="Plano alimentar" voltar={voltar}>
      {plano.estado.situacao === 'carregando' && <Carregando rotulo="Carregando plano…" />}
      {plano.estado.situacao === 'erro' && <Alerta>{plano.estado.mensagem}</Alerta>}

      {dados && (
        <div className="space-y-6">
          <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            {selo && <Selo tom={selo.tom}>{selo.rotulo}</Selo>}
            {nomeDoPaciente && <span>Paciente: {nomeDoPaciente}</span>}
            {dados.published_at && <span>· Publicado em {formatarData(dados.published_at)}</span>}
          </p>

          {sucesso && <Alerta tom="sucesso">{sucesso}</Alerta>}
          {erro && <Alerta>{erro}</Alerta>}

          <ResumoNutricional totais={dados.totais} metaKcal={metaDoResumo} previstoKcal={kcalPrevisto(dados.meals)} />

          {dados.status === 'rascunho' ? (
            <>
              <section aria-labelledby="refeicoes-titulo" className="space-y-4">
                <h2 id="refeicoes-titulo" className="font-semibold text-slate-900">
                  Refeições
                </h2>
                {dados.meals.length > 0 && (
                  <ol className="space-y-4">
                    {dados.meals.map((refeicao) => (
                      <RefeicaoEditavel
                        key={refeicao.id}
                        refeicao={refeicao}
                        aoAdicionarItem={(item) => alterarEAtualizar(() => adicionarItem(id, refeicao.id, item))}
                        aoRemoverItem={(itemId) => remover(() => removerItem(id, refeicao.id, itemId))}
                        aoRemover={() => remover(() => removerRefeicao(id, refeicao.id))}
                      />
                    ))}
                  </ol>
                )}
                <NovaRefeicao
                  aoAdicionar={(dadosRefeicao) => alterarEAtualizar(() => adicionarRefeicao(id, dadosRefeicao))}
                />
              </section>

              <FormularioDeDetalhes
                titulo="Publicar plano"
                descricao="Defina a meta e as orientações que o paciente vai ver. Depois de publicado, refeições e alimentos não podem mais ser alterados."
                valores={detalhes}
                aoMudar={setDetalhes}
                rotuloEnviar="Publicar plano"
                aoEnviar={publicar}
              />
            </>
          ) : (
            <>
              {dados.orientacoes && (
                <section aria-labelledby="orientacoes-titulo">
                  <h2 id="orientacoes-titulo" className="text-sm font-semibold text-slate-800">
                    Orientações ao paciente
                  </h2>
                  <p className="mt-2 whitespace-pre-line rounded-xl bg-marca-50 px-4 py-3 text-sm text-marca-900">
                    {dados.orientacoes}
                  </p>
                </section>
              )}

              <section aria-labelledby="refeicoes-titulo">
                <h2 id="refeicoes-titulo" className="mb-3 font-semibold text-slate-900">
                  Refeições
                </h2>
                {dados.meals.length === 0 ? (
                  <EstadoVazio titulo="Nenhuma refeição neste plano" />
                ) : (
                  <ListaDeRefeicoes refeicoes={dados.meals} />
                )}
              </section>

              {dados.status === 'ativo' ? (
                <FormularioDeDetalhes
                  titulo="Corrigir meta e orientações"
                  descricao="Corrige o plano vigente sem publicar um novo: o paciente continua com este plano e vê o texto corrigido."
                  valores={detalhes}
                  aoMudar={setDetalhes}
                  rotuloEnviar="Salvar correção"
                  aoEnviar={corrigir}
                />
              ) : (
                <p className="text-sm text-slate-600">
                  Este plano foi encerrado quando outro plano foi publicado e fica guardado apenas para consulta.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </AppShell>
  );
}
