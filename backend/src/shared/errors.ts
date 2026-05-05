export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 400,
    public readonly code: string = 'BAD_REQUEST'
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autorizado') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') {
    super(message, 404, 'NOT_FOUND')
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(message, 409, 'BUSINESS_RULE')
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly details?: Record<string, string[]>
  ) {
    super(message, 422, 'VALIDATION_ERROR')
  }
}
