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
