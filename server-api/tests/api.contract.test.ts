import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { closePool } from '../src/config/db';

const API_KEY = process.env.API_KEY as string;
const validHardware = {
  ven_id: '1002',
  dev_id: '1638',
  commercial_name: 'AMD Radeon(TM) Graphics (Vega Integrated)',
  category: 'GPU',
};

describe('Contrato HTTP /api/v1 (sin base de datos)', () => {
  afterAll(async () => {
    await closePool();
  });

  it('devuelve 401 si falta la API key en una escritura', async () => {
    const res = await request(app).post('/api/v1/hardware-components').send(validHardware);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.headers['x-request-id']).toMatch(/^req_/);
  });

  it('devuelve 401 si la API key es inválida', async () => {
    const res = await request(app)
      .post('/api/v1/hardware-components')
      .set('X-API-Key', 'clave_invalida_de_prueba')
      .send(validHardware);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('una clave revocada (como la de sólo lectura de un .exe antiguo) se rechaza incluso en lecturas públicas', async () => {
    // Sin clave, la lectura es pública: llega a la validación (400 por ven_id inválido, sin tocar la BD).
    const anonymous = await request(app).get('/api/v1/hardware-components?ven_id=AMD');
    expect(anonymous.status).toBe(400);

    // Con una clave que ya no existe, se corta antes con 401: nunca se ignora en silencio.
    const revoked = await request(app)
      .get('/api/v1/hardware-components?ven_id=AMD')
      .set('X-API-Key', 'clave_revocada_de_solo_lectura_123');
    expect(revoked.status).toBe(401);
    expect(revoked.body.error.code).toBe('UNAUTHORIZED');
  });

  it('devuelve 400 con detalle campo a campo para ven_id inválido', async () => {
    const res = await request(app).get('/api/v1/hardware-components?ven_id=AMD');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details[0].field).toBe('ven_id');
  });

  it('devuelve 400 si el id del path no es numérico', async () => {
    const res = await request(app).get('/api/v1/hardware-components/abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('devuelve 400 si el payload de driver no trae release_date', async () => {
    const res = await request(app)
      .post('/api/v1/driver-packages')
      .set('X-API-Key', API_KEY)
      .send({
        component_id: 1,
        profile_id: 1,
        os_environment: 'Win11_x64',
        edition_name: 'AMD Software',
        version_number: '24.9.1',
        download_url: 'https://driwinstorage.blob.core.windows.net/drivers/a.exe',
        file_size_mb: 540,
      });
    expect(res.status).toBe(400);
    expect(res.body.error.details.some((d: { field: string }) => d.field === 'release_date')).toBe(
      true,
    );
  });

  it('devuelve 404 con envoltorio uniforme en rutas desconocidas', async () => {
    const res = await request(app).get('/api/v1/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeTruthy();
  });

  describe('homogeneidad de los módulos nuevos (recommendations / bloatware)', () => {
    // Las recomendaciones son públicas (la app no lleva claves): sin credencial
    // la petición llega a la validación, que es la que responde 400.
    it('POST /recommendations/driver no exige credencial y valida el body', async () => {
      const res = await request(app).post('/api/v1/recommendations/driver').send({
        ven_id: 'AMD',
        dev_id: '1638',
        os_environment: 'Win11_x64',
        profiles: ['Gamer'],
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('GET /recommendations/apps no exige credencial y exige ?profiles=', async () => {
      const res = await request(app).get('/api/v1/recommendations/apps');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /recommendations/driver valida el body antes de tocar la BD', async () => {
      const res = await request(app)
        .post('/api/v1/recommendations/driver')
        .set('X-API-Key', API_KEY)
        .send({ os_environment: 'Win11_x64', profiles: ['Gamer'] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.some((d: { field: string }) => d.field === 'ven_id')).toBe(true);
    });

    it('GET /recommendations/apps rechaza ?profiles vacío', async () => {
      const res = await request(app)
        .get('/api/v1/recommendations/apps?profiles=')
        .set('X-API-Key', API_KEY);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('POST /bloatware-rules exige credencial de escritura', async () => {
      const res = await request(app).post('/api/v1/bloatware-rules').send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('POST /bloatware-rules rechaza risk_level fuera de ck_bloatware_risk', async () => {
      const res = await request(app)
        .post('/api/v1/bloatware-rules')
        .set('X-API-Key', API_KEY)
        .send({
          app_display_name: 'Regla de prueba',
          package_signature: '*Test*',
          detection_powershell_cmd: 'Get-AppxPackage *Test*',
          removal_powershell_cmd: 'Remove-AppxPackage *Test*',
          risk_level: 'CRITICO',
          description: 'Regla de prueba con riesgo inválido.',
        });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.some((d: { field: string }) => d.field === 'risk_level')).toBe(
        true,
      );
    });

    it('DELETE /bloatware-rules/:id valida que el id sea numérico', async () => {
      const res = await request(app)
        .delete('/api/v1/bloatware-rules/abc')
        .set('X-API-Key', API_KEY);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details[0].field).toBe('id');
    });

    it('PUT /bloatware-rules/:id rechaza un cuerpo vacío', async () => {
      const res = await request(app)
        .put('/api/v1/bloatware-rules/1')
        .set('X-API-Key', API_KEY)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
