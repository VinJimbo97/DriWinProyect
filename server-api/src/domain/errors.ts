/**
 * Catálogo único de códigos de error del API.
 * Se documenta en el contrato §3.1 del Documento Técnico Backend (Hito 2).
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MALFORMED_JSON: 'MALFORMED_JSON',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  FK_VIOLATION: 'FK_VIOLATION',
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  /** Hardware/perfil existe, pero no hay paquete para esa combinación (HTTP 422). */
  NO_DRIVER_FOR_PROFILE: 'NO_DRIVER_FOR_PROFILE',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DB_UNAVAILABLE: 'DB_UNAVAILABLE',
  /** La cuenta ya tiene sus 3 equipos registrados (HTTP 409). */
  DEVICE_LIMIT_REACHED: 'DEVICE_LIMIT_REACHED',
  /** La función necesita una suscripción Premium activa en este equipo (HTTP 403). */
  PREMIUM_REQUIRED: 'PREMIUM_REQUIRED',
  /** Demasiados intentos fallidos: la cuenta queda bloqueada unos minutos (HTTP 429). */
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  /** El servidor no tiene configurada la clave de cifrado de cuentas (HTTP 503). */
  ACCOUNTS_DISABLED: 'ACCOUNTS_DISABLED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Detalle campo a campo para que el frontend pueda mostrar un "tooltip" útil. */
export interface ErrorDetail {
  field: string;
  issue: string;
  expected?: string;
}

/**
 * Error controlado de la aplicación.
 * Los servicios y repositorios lo lanzan; el errorHandler lo serializa.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: ErrorDetail[];
  readonly hint?: string;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: ErrorDetail[],
    hint?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.hint = hint;
  }

  static notFound(resource: string, id: number | string): ApiError {
    return new ApiError(
      404,
      ErrorCode.NOT_FOUND,
      `${resource} con id=${id} no existe`,
      undefined,
      'Verifique el identificador en la colección antes de reintentar.',
    );
  }

  static conflict(message: string, hint?: string): ApiError {
    return new ApiError(409, ErrorCode.CONFLICT, message, undefined, hint);
  }

  static businessRule(message: string, hint?: string): ApiError {
    return new ApiError(422, ErrorCode.BUSINESS_RULE_VIOLATION, message, undefined, hint);
  }

  static validation(message: string, details: ErrorDetail[]): ApiError {
    return new ApiError(400, ErrorCode.VALIDATION_ERROR, message, details);
  }
}

/** Forma exacta del bloque `error` devuelto por el API. */
export interface SerializedApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    timestamp: string;
    path: string;
    requestId: string;
    hint?: string;
  };
}
