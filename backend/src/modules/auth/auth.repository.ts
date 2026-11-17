import { Knex } from 'knex';
import { db } from '../../db/connection';
import { CrnAlreadyRegisteredError } from '../../shared/errors/AppError';

/** Criado pela migration crn_unico. */
export const INDICE_CRN_UNICO = 'tenants_crn_unico';

// 23505 = unique_violation; o driver `pg` informa qual restrição foi violada.
function violouIndiceUnico(erro: unknown, indice: string): boolean {
  const pg = erro as { code?: string; constraint?: string } | null;
  return pg?.code === '23505' && pg.constraint === indice;
}

export interface TenantRecord {
  id: string;
  nome: string;
  email: string;
  crn: string;
  /**
   * RF-07: celular com WhatsApp do consultório, alvo do link wa.me na PWA do
   * paciente. Obrigatório no cadastro; null só em contas anteriores a isso.
   */
  telefone: string | null;
  senha_hash: string;
  cancelamento_antecedencia_horas: number;
  /** Nulo até o nutricionista abrir o link de confirmação; sem ele o login é barrado. */
  email_confirmado_em: Date | null;
  confirmacao_token_hash: string | null;
  confirmacao_token_expira_em: Date | null;
  senha_token_hash: string | null;
  senha_token_expira_em: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Token de uso único guardado como hash, com a validade. */
export interface StoredToken {
  hash: string;
  expiraEm: Date;
}

export interface CreateTenantInput {
  nome: string;
  email: string;
  crn: string;
  telefone: string;
  senhaHash: string;
  confirmacao: StoredToken;
}

/**
 * Repositório isolado da camada de negócio para facilitar testes unitários
 * (mock de `AuthRepository` no lugar de subir um Postgres real).
 */
export class AuthRepository {
  constructor(private readonly connection: Knex = db) {}

  async findByEmail(email: string): Promise<TenantRecord | undefined> {
    return this.connection('tenants').where({ email }).first();
  }

  async findById(id: string): Promise<TenantRecord | undefined> {
    return this.connection('tenants').where({ id }).first();
  }

  /** O CRN chega normalizado (`normalizarCrn`), então a igualdade exata basta. */
  async findByCrn(crn: string): Promise<TenantRecord | undefined> {
    return this.connection('tenants').where({ crn }).first();
  }

  async create(input: CreateTenantInput): Promise<TenantRecord> {
    try {
      const [tenant] = await this.connection('tenants')
        .insert({
          nome: input.nome,
          email: input.email,
          crn: input.crn,
          telefone: input.telefone,
          senha_hash: input.senhaHash,
          confirmacao_token_hash: input.confirmacao.hash,
          confirmacao_token_expira_em: input.confirmacao.expiraEm,
        })
        .returning('*');

      return tenant;
    } catch (erro) {
      // Dois cadastros com o mesmo CRN ao mesmo tempo passam os dois pelo
      // findByCrn; o índice único segura o segundo, que vira o mesmo 409.
      if (violouIndiceUnico(erro, INDICE_CRN_UNICO)) throw new CrnAlreadyRegisteredError();
      throw erro;
    }
  }

  async saveConfirmationToken(id: string, token: StoredToken): Promise<void> {
    await this.connection('tenants')
      .where({ id })
      .whereNull('email_confirmado_em')
      .update({ confirmacao_token_hash: token.hash, confirmacao_token_expira_em: token.expiraEm, updated_at: this.connection.fn.now() });
  }

  /**
   * Confirma o e-mail e invalida o token numa única operação: dois cliques no
   * link não confirmam duas vezes, e um token vencido ou já usado não casa com
   * nada. Devolve o nutricionista confirmado, ou `undefined`.
   */
  async confirmEmail(tokenHash: string): Promise<TenantRecord | undefined> {
    const [tenant] = await this.connection('tenants')
      .where({ confirmacao_token_hash: tokenHash })
      .andWhere('confirmacao_token_expira_em', '>', this.connection.fn.now())
      .update({
        email_confirmado_em: this.connection.raw('COALESCE(email_confirmado_em, now())'),
        confirmacao_token_hash: null,
        confirmacao_token_expira_em: null,
        updated_at: this.connection.fn.now(),
      })
      .returning('*');
    return tenant;
  }

  async savePasswordResetToken(id: string, token: StoredToken): Promise<void> {
    await this.connection('tenants')
      .where({ id })
      .update({ senha_token_hash: token.hash, senha_token_expira_em: token.expiraEm, updated_at: this.connection.fn.now() });
  }

  /**
   * Troca a senha e invalida o token na mesma operação, pelo mesmo motivo do
   * consumeAccessToken do paciente: validar antes e gravar depois deixaria duas
   * requisições simultâneas com o mesmo link gravarem senhas diferentes.
   *
   * Quem recebeu o link no e-mail provou que o e-mail é dele, então a conta
   * sai confirmada também; e o link de confirmação pendente perde a validade.
   */
  async resetPassword(tokenHash: string, senhaHash: string): Promise<TenantRecord | undefined> {
    const [tenant] = await this.connection('tenants')
      .where({ senha_token_hash: tokenHash })
      .andWhere('senha_token_expira_em', '>', this.connection.fn.now())
      .update({
        senha_hash: senhaHash,
        senha_token_hash: null,
        senha_token_expira_em: null,
        email_confirmado_em: this.connection.raw('COALESCE(email_confirmado_em, now())'),
        confirmacao_token_hash: null,
        confirmacao_token_expira_em: null,
        updated_at: this.connection.fn.now(),
      })
      .returning('*');
    return tenant;
  }
}
