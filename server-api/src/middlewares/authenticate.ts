import { timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { env } from '../config/env.js';
import { ApiError, ErrorCode } from '../domain/errors.js';
import { SESSION_TOKEN_PREFIX } from '../security/crypto.js';

/**
 * Un solo rol: la clave de administración (API_KEY) para escribir en el catálogo.
 * Las lecturas son públicas. La antigua clave de sólo lectura se eliminó porque
 * estuvo embebida en el .exe (credencial expuesta → revocada).
 */
export type ApiRole = 'read-write';

function extractApiKey(req: Request): string | null {
  const headerKey = req.header('X-API-Key');
  if (headerKey) {
    return headerKey.trim();
  }

  const authorization = req.header('Authorization');
  if (authorization?.startsWith('Bearer ')) {
    const token = authorization.slice('Bearer '.length).trim();
    // Los tokens de sesión de las cuentas (dws_...) los valida requireSession.
    return token.startsWith(SESSION_TOKEN_PREFIX) ? null : token;
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
  return safeEquals(key, env.API_KEY) ? 'read-write' : null;
}

/**
 * Autenticación opcional: si viene una credencial, la valida y deja el rol en
 * `req.apiRole`. Si no viene, la petición sigue como anónima y las rutas de
 * escritura la rechazan con `requireWriteAccess`.
 * Una credencial que SÍ viene pero es inválida (p. ej. la clave revocada de un
 * .exe antiguo) se rechaza con 401 en cualquier ruta: nunca se ignora en silencio.
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

  next();
};
