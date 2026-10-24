import type { Request, RequestHandler } from 'express';
import type { ZodIssue, ZodTypeAny } from 'zod';
import { ApiError, ErrorCode, type ErrorDetail } from '../domain/errors.js';

export interface RequestSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

export type RequestPart = 'body' | 'params' | 'query';

function toDetail(issue: ZodIssue): ErrorDetail {
  const detail: ErrorDetail = {
    field: issue.path.length > 0 ? issue.path.join('.') : '(cuerpo de la petición)',
    issue: issue.message,
  };

  if (issue.code === 'invalid_type') {
    detail.expected = `tipo ${issue.expected}`;
  }

  return detail;
}

/**
 * Middleware de validación y sanitización con Zod ("nunca confiar en el cliente").
 * - Valida body, params y query por separado.
 * - Sustituye la entrada por el resultado parseado (sin campos desconocidos).
 * - Devuelve 400 VALIDATION_ERROR con detalle campo a campo.
 *
 * Nota: en Express 5 `req.query` es de sólo lectura; por eso el resultado
 * sanitizado se expone en `req.validated` y los controladores leen desde ahí.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  const parts: RequestPart[] = ['body', 'params', 'query'];

  return (req, _res, next) => {
    const validated: Partial<Record<RequestPart, unknown>> = { ...req.validated };

    for (const part of parts) {
      const schema = schemas[part];
      if (!schema) {
        continue;
      }

      const raw = part === 'body' ? (req.body ?? {}) : req[part];
      const result = schema.safeParse(raw);

      if (!result.success) {
        next(
          new ApiError(
            400,
            ErrorCode.VALIDATION_ERROR,
            'La petición contiene datos inválidos',
            result.error.issues.map(toDetail),
            'Corrija los campos señalados en details y reintente.',
          ),
        );
        return;
      }

      validated[part] = result.data;
    }

    req.validated = validated;
    next();
  };
}

/** Acceso tipado al resultado ya validado. */
export function getValidated<T>(req: Request, part: RequestPart): T {
  const value = req.validated?.[part];
  if (value === undefined) {
    throw new Error(`No existe esquema de validación registrado para "${part}".`);
  }
  return value as T;
}
