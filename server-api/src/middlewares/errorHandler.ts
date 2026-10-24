import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ApiError, ErrorCode, type ErrorDetail, type SerializedApiError } from '../domain/errors.js';

const DOC_BASE = 'https://driwin-api.azurewebsites.net/api/v1/errores';

function docHint(code: ErrorCode): string {
  return `${DOC_BASE}#${code.toLowerCase()}`;
}

interface ConstraintInfo {
  message: string;
  fields: string[];
}

/** Traducción de restricciones UNIQUE a mensajes entendibles por el frontend. */
const UNIQUE_CONSTRAINTS: Record<string, ConstraintInfo> = {
  uq_hardware_signature: {
    message:
      'Ya existe un componente de hardware con la misma firma VEN_ID + DEV_ID + SUBSYS_ID.',
    fields: ['ven_id', 'dev_id', 'subsys_id'],
  },
  uq_driver_recommendation: {
    message:
      'Ya existe un paquete de controladores para ese componente, perfil y sistema operativo.',
    fields: ['component_id', 'profile_id', 'os_environment'],
  },
  uq_bloatware_signature: {
    message: 'Ya existe una regla de bloatware con esa firma de paquete.',
    fields: ['package_signature'],
  },
  // Restricciones UNIQUE declaradas en la columna (PostgreSQL genera el nombre).
  user_profiles_profile_name_key: {
    message: 'Ya existe un perfil de intención con ese nombre.',
    fields: ['profile_name'],
  },
  recommended_apps_app_name_key: {
    message: 'Ya existe una aplicación recomendada con ese nombre.',
    fields: ['app_name'],
  },
  synthetic_users_email_key: {
    message: 'Ya existe un usuario sintético con ese correo.',
    fields: ['email'],
  },
  subscription_tiers_tier_name_key: {
    message: 'Ya existe un plan comercial con ese nombre.',
    fields: ['tier_name'],
  },
  pk_profile_apps: {
    message: 'La aplicación ya está asignada a ese perfil.',
    fields: ['profile_id', 'app_id'],
  },
};

/** Traducción de claves foráneas a un campo concreto del payload. */
const FK_CONSTRAINTS: Record<string, { field: string; message: string }> = {
  fk_driver_component: {
    field: 'component_id',
    message: 'El componente de hardware indicado no existe.',
  },
  fk_driver_profile: {
    field: 'profile_id',
    message: 'El perfil de intención indicado no existe.',
  },
  fk_pa_profile: {
    field: 'profile_id',
    message: 'El perfil de intención indicado no existe.',
  },
  fk_pa_app: {
    field: 'app_id',
    message: 'La aplicación indicada no existe.',
  },
  fk_user_tier: {
    field: 'tier_id',
    message: 'El plan de suscripción indicado no existe.',
  },
};

/** Traducción de CHECK constraints. */
const CHECK_CONSTRAINTS: Record<string, string> = {
  ck_app_size: 'file_size_mb debe ser mayor que 0.',
  ck_bloatware_risk: 'risk_level debe ser BAJO, MEDIO o ALTO.',
  ck_tier_price: 'price_clp debe ser nulo o mayor o igual a 0.',
  ck_tier_devices: 'max_devices debe ser nulo o mayor que 0.',
  ck_active_devices: 'active_devices_count no puede ser negativo.',
  ck_profiles_not_empty: 'selected_profiles_array debe contener al menos un perfil.',
};

interface PgLikeError {
  code?: string;
  constraint?: string;
  column?: string;
  type?: string;
  status?: number;
  statusCode?: number;
}

function isPgLikeError(error: unknown): error is PgLikeError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof SyntaxError && (error as PgLikeError).type === 'entity.parse.failed') {
    return new ApiError(
      400,
      ErrorCode.MALFORMED_JSON,
      'El cuerpo de la petición no es JSON válido.',
      undefined,
      'Revise comas, comillas y llaves; el Content-Type debe ser application/json.',
    );
  }

  if ((error as PgLikeError)?.type === 'entity.too.large') {
    return new ApiError(
      413,
      ErrorCode.PAYLOAD_TOO_LARGE,
      'El cuerpo de la petición excede el tamaño permitido (100 kb).',
      undefined,
      'Envíe sólo la metadata; los binarios se descargan desde Azure Blob Storage.',
    );
  }

  if (isPgLikeError(error)) {
    if (error.code === '23505') {
      const info = error.constraint ? UNIQUE_CONSTRAINTS[error.constraint] : undefined;
      const message = info?.message ?? 'El registro ya existe (violación de unicidad).';
      const details: ErrorDetail[] | undefined = info
        ? info.fields.map((field) => ({ field, issue: message }))
        : undefined;
      return new ApiError(409, ErrorCode.CONFLICT, message, details);
    }

    if (error.code === '23503') {
      const info = error.constraint ? FK_CONSTRAINTS[error.constraint] : undefined;
      return new ApiError(
        422,
        ErrorCode.FK_VIOLATION,
        info?.message ?? 'Una referencia a otro recurso no existe.',
        info ? [{ field: info.field, issue: info.message }] : undefined,
        'Cree primero el recurso referenciado o corrija el identificador.',
      );
    }

    if (error.code === '23514') {
      const message =
        (error.constraint && CHECK_CONSTRAINTS[error.constraint]) ??
        'Un valor incumple una regla de integridad de la base de datos.';
      return new ApiError(400, ErrorCode.VALIDATION_ERROR, message);
    }

    if (error.code === '23502') {
      return new ApiError(
        400,
        ErrorCode.VALIDATION_ERROR,
        `El campo ${error.column ?? 'obligatorio'} es requerido y no puede ser nulo.`,
      );
    }

    if (error.code === '22P02') {
      return new ApiError(
        400,
        ErrorCode.VALIDATION_ERROR,
        'Uno de los identificadores o valores enviados no tiene el formato esperado por la base de datos.',
        undefined,
        'Revise que los IDs sean enteros y las fechas usen formato ISO-8601 (YYYY-MM-DD).',
      );
    }

    if (error.code === '22001') {
      return new ApiError(
        400,
        ErrorCode.VALIDATION_ERROR,
        'Uno de los textos enviados supera el largo máximo permitido.',
      );
    }

    if (
      error.code === '53300' ||
      error.code === '08000' ||
      error.code === '08001' ||
      error.code === '08003' ||
      error.code === '08006' ||
      error.code === '57014' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT'
    ) {
      return new ApiError(
        503,
        ErrorCode.DB_UNAVAILABLE,
        'La base de datos no está disponible en este momento.',
        undefined,
        'Reintente en unos segundos; si persiste, revise el estado de Azure PostgreSQL.',
      );
    }
  }

  return new ApiError(
    500,
    ErrorCode.INTERNAL_ERROR,
    'Ocurrió un error interno al procesar la petición.',
    undefined,
    'Si el problema persiste, contacte al equipo con el requestId incluido en esta respuesta.',
  );
}

/** Ruta desconocida → 404 con el mismo envoltorio de error. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(
    new ApiError(
      404,
      ErrorCode.NOT_FOUND,
      `La ruta ${req.method} ${req.path} no existe en este API.`,
      undefined,
      'Consulte el contrato en /api/v1 y verifique el prefijo de versión.',
    ),
  );
};

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const normalized = normalizeError(error);

  // Log técnico del lado servidor. Nunca incluye body, query, headers ni PII.
  if (normalized.statusCode >= 500) {
    console.error(
      `[error] ${req.method} ${req.originalUrl.split('?')[0]} requestId=${req.requestId ?? '-'} code=${normalized.code}`,
      error instanceof Error ? error.message : 'error desconocido',
    );
  }

  const body: SerializedApiError = {
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details ? { details: normalized.details } : {}),
      timestamp: new Date().toISOString(),
      path: req.originalUrl.split('?')[0] ?? req.path,
      requestId: req.requestId ?? 'req_unknown',
      hint: normalized.hint ?? docHint(normalized.code),
    },
  };

  res.status(normalized.statusCode).json(body);
};
