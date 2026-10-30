import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { app } from '../src/app';
import { closePool } from '../src/config/db';
import { HealthRepository } from '../src/repositories/health.repository';

describe('GET /api/v1/health (capas: controlador → servicio → repositorio)', () => {
  afterAll(async () => {
    await closePool();
  });

  it('responde 200 con la latencia cuando la base de datos responde', async () => {
    vi.spyOn(HealthRepository, 'ping').mockResolvedValue(3.21);

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({
      status: 'ok',
      version: '1.0.0',
      database: 'up',
      latency_ms: 3.21,
    });
  });

  it('responde 503 DB_UNAVAILABLE cuando la base de datos no responde', async () => {
    vi.spyOn(HealthRepository, 'ping').mockRejectedValue(new Error('connection timeout'));

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('DB_UNAVAILABLE');
    // Nunca filtra el detalle técnico de la conexión al cliente.
    expect(JSON.stringify(res.body)).not.toContain('connection timeout');
  });
});
