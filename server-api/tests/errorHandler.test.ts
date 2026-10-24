import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../src/middlewares/errorHandler.js';
import { requestId } from '../src/middlewares/requestId.js';

function buildApp(handler: RequestHandler) {
  const app = express();
  app.use(requestId);
  app.get('/boom', handler);
  app.use(errorHandler);
  return app;
}

/** Simula el error que entrega `pg` sin necesidad de una base real. */
function pgError(code: string, constraint?: string, column?: string) {
  return Object.assign(new Error('fallo simulado de PostgreSQL'), { code, constraint, column });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorHandler — mapeo SQLSTATE → HTTP', () => {
  it('23505 (UNIQUE) → 409 CONFLICT con detalle de la firma', async () => {
    const res = await request(
      buildApp((_req, _res, next) => next(pgError('23505', 'uq_hardware_signature'))),
    ).get('/boom');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual([
      'ven_id',
      'dev_id',
      'subsys_id',
    ]);
    expect(res.body.error).toHaveProperty('timestamp');
    expect(res.body.error).toHaveProperty('path');
    expect(res.body.error).toHaveProperty('requestId');
  });

  it('23505 de uq_bloatware_signature → 409 con field package_signature', async () => {
    const res = await request(
      buildApp((_req, _res, next) => next(pgError('23505', 'uq_bloatware_signature'))),
    ).get('/boom');

    expect(res.status).toBe(409);
    expect(res.body.error.details[0].field).toBe('package_signature');
  });

  it('23503 (FOREIGN KEY) → 422 FK_VIOLATION', async () => {
    const res = await request(
      buildApp((_req, _res, next) => next(pgError('23503', 'fk_driver_component'))),
    ).get('/boom');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('FK_VIOLATION');
    expect(res.body.error.details[0].field).toBe('component_id');
  });

  it('23514 (CHECK ck_bloatware_risk) → 400 VALIDATION_ERROR', async () => {
    const res = await request(
      buildApp((_req, _res, next) => next(pgError('23514', 'ck_bloatware_risk'))),
    ).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('risk_level');
  });

  it('22P02 (formato inválido) → 400 VALIDATION_ERROR', async () => {
    const res = await request(
      buildApp((_req, _res, next) => next(pgError('22P02'))),
    ).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('error desconocido → 500 INTERNAL_ERROR sin filtrar el stack', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(
      buildApp((_req, _res, next) => next(new Error('secreto interno que no debe salir'))),
    ).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('secreto interno');
    expect(res.body.error).not.toHaveProperty('stack');
  });
});
