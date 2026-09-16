export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Erros mapeados diretamente às exceções descritas no RFC (seção 3.2)
export class InvalidCredentialsError extends AppError {
  constructor() {
    super('E-mail ou senha inválidos', 401, 'E-04');
  }
}

export class AccountLockedError extends AppError {
  constructor() {
    super('Conta bloqueada temporariamente após 5 tentativas inválidas. Tente novamente em 15 minutos.', 401, 'E-04');
  }
}

export class EmailAlreadyRegisteredError extends AppError {
  constructor() {
    super('E-mail já cadastrado', 409, 'CONFLICT');
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super('Token de autenticação ausente ou inválido', 401, 'UNAUTHORIZED');
  }
}

// RF-02: token válido, mas do papel errado (ex.: paciente chamando rota de
// nutricionista) ou apontando para outro paciente. 403, não 401: reautenticar
// não resolveria.
export class ForbiddenError extends AppError {
  constructor(message = 'Você não tem permissão para acessar este recurso') {
    super(message, 403, 'FORBIDDEN');
  }
}

// RF-02: token de primeiro acesso inexistente, já utilizado ou expirado.
// Código próprio (E-21): E-04 é do login por e-mail/senha, e reaproveitá-lo aqui
// misturava "credencial inválida" com "link de primeiro acesso vencido" — dois
// casos com tratamentos diferentes no front (reenviar link x tentar de novo).
// E-08 já é do plano alimentar vazio, e E-19/E-20 são da agenda.
export class InvalidAccessTokenError extends AppError {
  constructor() {
    super('Link de primeiro acesso inválido ou expirado. Solicite um novo ao seu nutricionista.', 400, 'E-21');
  }
}

// RF-03
export class PatientNotFoundError extends AppError {
  constructor() {
    super('Paciente não encontrado', 404, 'NOT_FOUND');
  }
}

// RF-04
export class MealPlanNotFoundError extends AppError {
  constructor() {
    super('Plano alimentar não encontrado', 404, 'NOT_FOUND');
  }
}

export class MealNotFoundError extends AppError {
  constructor() {
    super('Refeição não encontrada', 404, 'NOT_FOUND');
  }
}

// E-07: alimento não encontrado na base TACO (RN-03)
export class FoodNotFoundError extends AppError {
  constructor() {
    super('Alimento não encontrado na base TACO', 404, 'E-07');
  }
}

// E-08: publicação de plano sem nenhuma refeição/item
export class EmptyMealPlanError extends AppError {
  constructor() {
    super('Adicione ao menos uma refeição antes de publicar', 400, 'E-08');
  }
}

export class InvalidMealPlanStateError extends AppError {
  constructor(message = 'Operação não permitida no estado atual do plano') {
    super(message, 409, 'CONFLICT');
  }
}

// RF-08
export class AvailabilityNotFoundError extends AppError {
  constructor() {
    super('Horário de disponibilidade não encontrado', 404, 'NOT_FOUND');
  }
}

// RF-08/11/12: E-10, E-11, E-12 (e E-20, que reaproveita as mesmas mensagens na remarcação)
export class PastDateTimeError extends AppError {
  constructor() {
    super('Não é possível agendar consultas em datas ou horários passados.', 400, 'E-10');
  }
}

export class OutsideAvailabilityError extends AppError {
  constructor() {
    super('O horário selecionado está fora do período de atendimento do nutricionista.', 400, 'E-11');
  }
}

export class ScheduleConflictError extends AppError {
  constructor() {
    super('Este horário já está ocupado. Por favor, selecione outro horário disponível.', 409, 'E-12');
  }
}

export class AppointmentNotFoundError extends AppError {
  constructor() {
    super('Agendamento não encontrado', 404, 'NOT_FOUND');
  }
}

export class AppointmentAlreadyCancelledError extends AppError {
  constructor() {
    super('Este agendamento já foi cancelado', 409, 'CONFLICT');
  }
}

// E-19
export class CancellationWindowError extends AppError {
  constructor() {
    super(
      'O prazo para cancelamento desta consulta já encerrou. Entre em contato diretamente com o nutricionista.',
      400,
      'E-19',
    );
  }
}

export interface ValidationIssue {
  path: string;
  message: string;
}

// Substitui o antigo tratamento de ZodError: mesma forma de resposta
// ({ code, message, issues }), sem depender de biblioteca externa (RFC 5.5).
export class ValidationError extends AppError {
  public readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super('Dados inválidos', 400, 'VALIDATION_ERROR');
    this.issues = issues;
  }
}
