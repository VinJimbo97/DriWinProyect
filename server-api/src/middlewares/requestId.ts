import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Genera/reutiliza un identificador de trazabilidad por petición.
 * El valor del cliente sólo se acepta si cumple un patrón estricto; así se
 * evita inyectar contenido arbitrario en logs o cabeceras.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('X-Request-Id');
  const id =
    incoming && SAFE_REQUEST_ID.test(incoming)
      ? incoming
      : `req_${randomUUID().replace(/-/g, '').slice(0, 20)}`;

  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};
