/**
 * Domain error hierarchy. Each error carries an HTTP-friendly status and a stable
 * machine-readable `code`, so the HTTP error handler can translate domain failures
 * into consistent API responses without leaking internals.
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 422;
  readonly code = 'VALIDATION_ERROR';
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly code = 'UNAUTHORIZED';
  constructor(message = 'Authentication required') {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly code = 'FORBIDDEN';
  constructor(message = 'You are not allowed to perform this action') {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND';
  constructor(resource = 'Resource') {
    super(`${resource} not found`);
  }
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT';
}

/** Raised by the booking use-case when the requested slot is not bookable. */
export class SlotUnavailableError extends AppError {
  readonly statusCode = 409;
  readonly code = 'SLOT_UNAVAILABLE';
  constructor(
    message: string,
    details?: unknown,
  ) {
    super(message, details);
  }
}
