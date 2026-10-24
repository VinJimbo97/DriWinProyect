import type { RequestHandler } from 'express';
import { env } from '../config/env.js';

/**
 * Logger de peticiones propio, minimizado por privacidad (Ley 21.719).
 *
 * Qué NO se registra:
 *  - Query string (puede contener correos, nombres de perfil o identificadores).
 *  - Cabeceras (Authorization, X-API-Key, cookies).
 *  - Body (payloads con PII como email/full_name).
 *
 * Qué SÍ se registra: método, ruta base, status, duración y requestId.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  if (env.NODE_ENV === 'test') {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const safePath = req.originalUrl.split('?')[0] || req.path;
    const line = [
      `[http] ${req.method}`,
      safePath,
      `${res.statusCode}`,
      `${durationMs.toFixed(1)}ms`,
      `requestId=${req.requestId ?? '-'}`,
    ].join(' ');

    if (res.statusCode >= 500) {
      console.error(line);
      return;
    }
    if (res.statusCode >= 400) {
      console.warn(line);
      return;
    }
    if (env.LOG_LEVEL === 'debug' || env.LOG_LEVEL === 'info') {
      console.log(line);
    }
  });

  next();
};
