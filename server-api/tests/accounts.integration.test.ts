import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * Prueba de integración de las cuentas DriWin: la API completa (HTTP → Zod →
 * servicio → SQL real) contra PostgreSQL en memoria (PGlite) creado con
 * db/init.sql + migraciones 007 y 008, ejecutando todo COMO driwin_api, es
 * decir, con los mismos permisos mínimos que tiene la API en Azure.
 */
const h = vi.hoisted(() => {
  type Db = import('@electric-sql/pglite').PGlite;
  let ready: Promise<Db> | null = null;

  async function getDb(): Promise<Db> {
    ready ??= (async () => {
      const { PGlite } = await import('@electric-sql/pglite');
      const fs = await import('node:fs');
      const read = (relative: string) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
      const db = new PGlite();
      await db.exec(read('../../db/init.sql'));
      await db.exec(read('../../db/migrations/007_roles_minimo_privilegio.sql'));
      await db.exec(read('../../db/migrations/008_cuentas_y_suscripciones.sql'));
      await db.exec('SET ROLE driwin_api');
      return db;
    })();
    return ready;
  }

  const toPg = (result: { rows: unknown[]; affectedRows?: number }) => ({
    rows: result.rows,
    rowCount: result.affectedRows ?? result.rows.length,
  });

  return { getDb, toPg };
});

vi.mock('../src/config/db.js', () => ({
  pool: {
    query: async (text: string, params?: unknown[]) => h.toPg(await (await h.getDb()).query(text, params)),
  },
  withTransaction: async <T>(work: (client: { query: (t: string, p?: unknown[]) => Promise<unknown> }) => Promise<T>) => {
    const db = await h.getDb();
    return db.transaction((tx) =>
      work({ query: async (text: string, params?: unknown[]) => h.toPg(await tx.query(text, params)) }),
    );
  },
  closePool: async () => {},
}));

const { app } = await import('../src/app.js');

const PASSWORD = 'clave-segura-123';
const api = () => request(app);
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function register(email: string, deviceId = randomUUID()) {
  const res = await api().post('/api/v1/auth/register').send({ email, password: PASSWORD, device_id: deviceId });
  expect(res.status).toBe(201);
  return { token: res.body.data.token as string, deviceId, body: res.body.data };
}

async function login(email: string, deviceId: string, password = PASSWORD) {
  return api().post('/api/v1/auth/login').send({ email, password, device_id: deviceId });
}

beforeAll(async () => {
  await h.getDb();
}, 60_000);

afterAll(async () => {
  await (await h.getDb()).close();
});

describe('Cuentas DriWin (integración con SQL real y rol driwin_api)', () => {
  it('registra una cuenta: abre sesión, registra el equipo y parte sin Premium', async () => {
    const { token, body } = await register('Vicente.Prueba@Correo.cl');
    expect(token).toMatch(/^dws_/);
    expect(body.account.email).toBe('vicente.prueba@correo.cl');
    expect(body.account.premium_active).toBe(false);
    expect(body.account.subscription).toBeNull();
    expect(body.account.devices).toHaveLength(1);
    expect(body.account.devices[0].current).toBe(true);
  });

  it('guarda el correo cifrado y la contraseña con scrypt (nunca en texto plano)', async () => {
    await register('privacidad@correo.cl');
    const db = await h.getDb();
    const { rows } = await db.query<{ email_encrypted: Uint8Array; email_lookup: Uint8Array; password_hash: string }>(
      'SELECT email_encrypted, email_lookup, password_hash FROM accounts',
    );
    for (const row of rows) {
      // Ningún correo registrado aparece en claro dentro de la columna cifrada.
      const stored = Buffer.from(row.email_encrypted).toString('latin1');
      expect(stored).not.toMatch(/correo.cl/);
      expect(row.email_lookup.length).toBe(32);
      expect(row.password_hash.startsWith('scrypt$')).toBe(true);
      expect(row.password_hash).not.toContain(PASSWORD);
    }
  });

  it('no permite dos cuentas con el mismo correo (aunque cambien mayúsculas)', async () => {
    await register('duplicado@correo.cl');
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email: ' DUPLICADO@correo.cl ', password: PASSWORD, device_id: randomUUID() });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('valida la contraseña mínima al registrarse', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'corta@correo.cl', password: 'corta', device_id: randomUUID() });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('password');
  });

  it('responde lo mismo si el correo no existe o si la contraseña es incorrecta', async () => {
    const { deviceId } = await register('generico@correo.cl');
    const wrongPassword = await login('generico@correo.cl', deviceId, 'otra-clave-999');
    const unknownEmail = await login('nadie@correo.cl', deviceId);
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('bloquea la cuenta 15 minutos después de 5 contraseñas incorrectas', async () => {
    const { deviceId } = await register('bloqueo@correo.cl');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await login('bloqueo@correo.cl', deviceId, 'incorrecta-123')).status).toBe(401);
    }
    const res = await login('bloqueo@correo.cl', deviceId);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  it('exige sesión para ver la cuenta', async () => {
    expect((await api().get('/api/v1/account')).status).toBe(401);
    expect((await api().get('/api/v1/account').set(bearer('dws_inventado'))).status).toBe(401);
  });

  it('compra simulada: activa Premium y una segunda compra empieza cuando termina la primera', async () => {
    const { token } = await register('compra@correo.cl');
    const first = await api().post('/api/v1/account/subscription').set(bearer(token)).send({ plan_years: 2 });
    expect(first.status).toBe(201);
    expect(first.body.data.premium_active).toBe(true);
    expect(first.body.data.subscription.plan).toBe('DriWin Premium 2 años');
    expect(first.body.data.subscription.payment_reference).toMatch(/^SIM-/);
    const firstEnd = new Date(first.body.data.subscription.ends_at);

    const second = await api().post('/api/v1/account/subscription').set(bearer(token)).send({ plan_years: 1 });
    expect(second.status).toBe(201);
    expect(new Date(second.body.data.subscription.starts_at).getTime()).toBe(firstEnd.getTime());

    const invalid = await api().post('/api/v1/account/subscription').set(bearer(token)).send({ plan_years: 5 });
    expect(invalid.status).toBe(400);
  });

  it('respeta el límite de 3 equipos y deja liberar uno', async () => {
    const email = 'equipos@correo.cl';
    const pc1 = await register(email);
    await api().post('/api/v1/account/subscription').set(bearer(pc1.token)).send({ plan_years: 1 });

    const pc2 = randomUUID();
    const pc3 = randomUUID();
    const pc4 = randomUUID();
    const session2 = await login(email, pc2);
    expect(session2.body.data.account.this_device.registered).toBe(true);
    expect((await login(email, pc3)).body.data.account.premium_active).toBe(true);

    // El cuarto equipo puede iniciar sesión, pero no tiene Premium.
    const fourth = await login(email, pc4);
    expect(fourth.status).toBe(200);
    expect(fourth.body.data.account.this_device.registered).toBe(false);
    expect(fourth.body.data.account.premium_active).toBe(false);
    expect(fourth.body.data.account.devices).toHaveLength(3);
    const token4 = fourth.body.data.token as string;

    const blocked = await api().post('/api/v1/account/devices').set(bearer(token4));
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('DEVICE_LIMIT_REACHED');

    // Desde el cuarto equipo se quita el segundo: su sesión se cierra.
    const second = fourth.body.data.account.devices[1].device_id as number;
    const removed = await api().delete(`/api/v1/account/devices/${second}`).set(bearer(token4));
    expect(removed.status).toBe(200);
    expect(removed.body.data.devices).toHaveLength(2);
    expect((await api().get('/api/v1/account').set(bearer(session2.body.data.token))).status).toBe(401);

    const registered = await api().post('/api/v1/account/devices').set(bearer(token4));
    expect(registered.status).toBe(200);
    expect(registered.body.data.premium_active).toBe(true);
  });

  it('soporte técnico: sólo con Premium y el mensaje queda cifrado', async () => {
    const free = await register('gratis@correo.cl');
    const ticket = { subject: 'No instala el driver', message: 'El instalador de NVIDIA se cierra al abrirlo.' };
    const denied = await api().post('/api/v1/support-tickets').set(bearer(free.token)).send(ticket);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('PREMIUM_REQUIRED');

    const premium = await register('premium@correo.cl');
    await api().post('/api/v1/account/subscription').set(bearer(premium.token)).send({ plan_years: 3 });
    const created = await api().post('/api/v1/support-tickets').set(bearer(premium.token)).send(ticket);
    expect(created.status).toBe(201);
    expect(created.body.data.reply_to).toBe('pr*****@correo.cl');

    const db = await h.getDb();
    const { rows } = await db.query<{ message_encrypted: Uint8Array }>(
      'SELECT message_encrypted FROM support_tickets WHERE ticket_id = $1',
      [created.body.data.ticket_id],
    );
    expect(Buffer.from(rows[0].message_encrypted).toString('utf8')).not.toContain('NVIDIA');
  });

  it('cerrar sesión invalida el token', async () => {
    const { token } = await register('logout@correo.cl');
    expect((await api().post('/api/v1/auth/logout').set(bearer(token))).status).toBe(204);
    expect((await api().get('/api/v1/account').set(bearer(token))).status).toBe(401);
  });

  it('borrar mis datos: pide la contraseña, elimina la cuenta y deja la venta anónima', async () => {
    const { token, deviceId } = await register('borrar@correo.cl');
    await api().post('/api/v1/account/subscription').set(bearer(token)).send({ plan_years: 1 });

    const wrong = await api().post('/api/v1/account/delete').set(bearer(token)).send({ password: 'no-es-la-clave' });
    expect(wrong.status).toBe(401);

    const db = await h.getDb();
    const before = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM subscriptions WHERE account_id IS NULL');

    expect((await api().post('/api/v1/account/delete').set(bearer(token)).send({ password: PASSWORD })).status).toBe(204);
    expect((await login('borrar@correo.cl', deviceId)).status).toBe(401);
    expect((await api().get('/api/v1/account').set(bearer(token))).status).toBe(401);

    const after = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM subscriptions WHERE account_id IS NULL');
    expect(after.rows[0].n).toBe(before.rows[0].n + 1);
  });
});
