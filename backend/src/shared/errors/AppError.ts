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
