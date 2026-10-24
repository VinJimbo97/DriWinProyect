import { timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { env } from '../config/env.js';
import { ApiError, ErrorCode } from '../domain/errors.js';

export type ApiRole = 'read-write' | 'read-only';

function extractApiKey(req: Request): string | null {
  const headerKey = req.header('X-API-Key');
  if (headerKey) {
    return headerKey.trim();
  }

  const authorization = req.header('Authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  return null;
}

/**
 * Comparación en tiempo constante: evita filtrar longitud/prefijo de la clave
 * mediante mediciones de tiempo. Si las longitudes difieren se compara contra
 * un buffer ficticio del mismo tamaño para no cortocircuitar.
 */
function safeEquals(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');

  if (providedBuffer.length !== expectedBuffer.length) {
    timingSafeEqual(providedBuffer, Buffer.alloc(providedBuffer.length));
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function resolveRole(key: string): ApiRole | null {
  if (safeEquals(key, env.API_KEY)) {
    return 'read-write';
  }
  if (env.API_KEY_READ_ONLY && safeEquals(key, env.API_KEY_READ_ONLY)) {
    return 'read-only';
  }
  return null;
}

/**
 * Autenticación opcional: si viene una credencial, la valida y deja el rol en
 * `req.apiRole`. Si no viene, la petición sigue como anónima y las rutas de
 * escritura la rechazan con `requireWriteAccess`.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const key = extractApiKey(req);

  if (!key) {
    next();
    return;
  }

  const role = resolveRole(key);
  if (!role) {
    next(
      new ApiError(
        401,
        ErrorCode.UNAUTHORIZED,
        'Credencial de API inválida',
        undefined,
        'Use la cabecera X-API-Key o Authorization: Bearer <clave>.',
      ),
    );
    return;
  }

  req.apiRole = role;
  next();
};

/** Exige una credencial válida (cualquier rol). */
export const requireApiKey: RequestHandler = (req, _res, next) => {
  if (!req.apiRole) {
    next(
      new ApiError(
        401,
        ErrorCode.UNAUTHORIZED,
        'Credencial ausente',
        undefined,
        'Incluya X-API-Key (o Authorization: Bearer <clave>) para consumir este recurso.',
      ),
    );
    return;
  }
  next();
};

/** Exige permiso de escritura: POST, PUT, PATCH y DELETE. */
export const requireWriteAccess: RequestHandler = (req, _res, next) => {
  if (!req.apiRole) {
    next(
      new ApiError(
        401,
        ErrorCode.UNAUTHORIZED,
        'Credencial ausente',
        undefined,
        'Las operaciones de escritura requieren X-API-Key con permiso de escritura.',
      ),
    );
    return;
  }

  if (req.apiRole !== 'read-write') {
    next(
      new ApiError(
        403,
        ErrorCode.FORBIDDEN,
        'La credencial es de sólo lectura',
        undefined,
        'Solicite una clave con rol read-write para crear, actualizar o eliminar recursos.',
      ),
    );
    return;
  }

  next();
};
