import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { ApiError, ErrorCode } from '../domain/errors.js';

/**
 * Límite de tasa por IP para proteger el API público (60 req/min por defecto).
 * La respuesta usa el mismo envoltorio de error del contrato.
 */
export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(
      new ApiError(
        429,
        ErrorCode.RATE_LIMITED,
        'Se superó el límite de peticiones permitido.',
        undefined,
        `Máximo ${env.RATE_LIMIT_MAX} peticiones cada ${Math.round(env.RATE_LIMIT_WINDOW_MS / 1000)} segundos por IP.`,
      ),
    );
  },
});
