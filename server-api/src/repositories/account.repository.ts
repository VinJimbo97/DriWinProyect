import type pg from 'pg';
import { pool } from '../config/db.js';

/**
 * Capa de datos de las cuentas DriWin. Reglas:
 *  - Columnas explícitas (nunca SELECT *) y 100 % parámetros $n.
 *  - Las operaciones que deben ser atómicas reciben el `client` de una
 *    transacción (withTransaction) y bloquean la fila de la cuenta con
 *    FOR UPDATE, para que dos equipos no superen juntos el límite de 3.
 *  - Sólo se leen/escriben huellas y datos cifrados: el descifrado lo hace el servicio.
 */

type Queryable = Pick<pg.Pool, 'query'> | Pick<pg.PoolClient, 'query'>;

export interface AccountRow {
  account_id: number;
  email_encrypted: Uint8Array;
  password_hash: string;
  failed_logins: number;
  locked_until: Date | null;
  created_at: Date;
  privacy_version: string | null;
  privacy_accepted_at: Date | null;
}

export interface SessionRow {
  session_id: number;
  account_id: number;
  device_hash: Uint8Array;
}

export interface DeviceRow {
  device_id: number;
  device_hash: Uint8Array;
  registered_at: Date;
  last_seen_at: Date;
}

export interface SubscriptionRow {
  subscription_id: number;
  tier_name: string;
  duration_months: number;
  starts_at: Date;
  ends_at: Date;
  price_paid_clp: string;
  payment_reference: string;
}

export interface TierRow {
  tier_id: number;
  tier_name: string;
  price_clp: string;
  duration_months: number;
  max_devices: number;
}

const ACCOUNT_COLUMNS =
  'account_id, email_encrypted, password_hash, failed_logins, locked_until, created_at, privacy_version, privacy_accepted_at';

/** Filas para "Descargar mis datos" (acceso y portabilidad, Ley 21.719). */
export interface SessionExportRow {
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface TicketExportRow {
  ticket_id: number;
  subject: string;
  message_encrypted: Uint8Array;
  status: string;
  created_at: Date;
}

export class AccountRepository {
  static async insertAccount(
    client: Queryable,
    emailLookup: Buffer,
    emailEncrypted: Buffer,
    passwordHash: string,
    privacyVersion: string,
  ): Promise<number> {
    // La aceptación del aviso se guarda en la MISMA fila: no existe cuenta sin consentimiento.
    const { rows } = await client.query(
      `INSERT INTO accounts (email_lookup, email_encrypted, password_hash, privacy_version, privacy_accepted_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING account_id`,
      [emailLookup, emailEncrypted, passwordHash, privacyVersion],
    );
    return rows[0].account_id as number;
  }

  static async findByEmailLookup(emailLookup: Buffer): Promise<AccountRow | null> {
    const { rows } = await pool.query(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE email_lookup = $1`, [
      emailLookup,
    ]);
    return (rows[0] as AccountRow | undefined) ?? null;
  }

  static async findById(client: Queryable, accountId: number): Promise<AccountRow | null> {
    const { rows } = await client.query(`SELECT ${ACCOUNT_COLUMNS} FROM accounts WHERE account_id = $1`, [accountId]);
    return (rows[0] as AccountRow | undefined) ?? null;
  }

  /** Bloquea la fila de la cuenta hasta el fin de la transacción. */
  static async lockAccount(client: Queryable, accountId: number): Promise<boolean> {
    const { rows } = await client.query('SELECT account_id FROM accounts WHERE account_id = $1 FOR UPDATE', [
      accountId,
    ]);
    return rows.length > 0;
  }

  /** Suma un intento fallido; al llegar al máximo bloquea la cuenta y reinicia el contador. */
  static async registerFailedLogin(accountId: number, maxAttempts: number, lockMinutes: number): Promise<void> {
    await pool.query(
      `UPDATE accounts
       SET failed_logins = CASE WHEN failed_logins + 1 >= $2 THEN 0 ELSE failed_logins + 1 END,
           locked_until  = CASE WHEN failed_logins + 1 >= $2
                                THEN now() + make_interval(mins => $3::int)
                                ELSE locked_until END
       WHERE account_id = $1`,
      [accountId, maxAttempts, lockMinutes],
    );
  }

  static async resetFailedLogins(accountId: number): Promise<void> {
    await pool.query(
      'UPDATE accounts SET failed_logins = 0, locked_until = NULL WHERE account_id = $1 AND (failed_logins > 0 OR locked_until IS NOT NULL)',
      [accountId],
    );
  }

  /** Registra la aceptación del aviso de privacidad vigente. */
  static async acceptPrivacy(accountId: number, privacyVersion: string): Promise<void> {
    await pool.query(
      'UPDATE accounts SET privacy_version = $2, privacy_accepted_at = now() WHERE account_id = $1',
      [accountId, privacyVersion],
    );
  }

  static async deleteAccount(accountId: number): Promise<boolean> {
    const { rowCount } = await pool.query('DELETE FROM accounts WHERE account_id = $1', [accountId]);
    return (rowCount ?? 0) > 0;
  }

  // ------------------------------------------------------------------ sesiones

  static async insertSession(
    client: Queryable,
    accountId: number,
    tokenHash: Buffer,
    deviceHash: Buffer,
    ttlDays: number,
  ): Promise<Date> {
    const { rows } = await client.query(
      `INSERT INTO account_sessions (account_id, token_hash, device_hash, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(days => $4::int))
       RETURNING expires_at`,
      [accountId, tokenHash, deviceHash, ttlDays],
    );
    return rows[0].expires_at as Date;
  }

  /** Sesión vigente: no revocada y no vencida. */
  static async findActiveSession(tokenHash: Buffer): Promise<SessionRow | null> {
    const { rows } = await pool.query(
      `SELECT session_id, account_id, device_hash
       FROM account_sessions
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [tokenHash],
    );
    return (rows[0] as SessionRow | undefined) ?? null;
  }

  static async revokeSession(sessionId: number): Promise<void> {
    await pool.query('UPDATE account_sessions SET revoked_at = now() WHERE session_id = $1 AND revoked_at IS NULL', [
      sessionId,
    ]);
  }

  static async listSessions(client: Queryable, accountId: number): Promise<SessionExportRow[]> {
    const { rows } = await client.query(
      `SELECT created_at, expires_at, revoked_at
       FROM account_sessions
       WHERE account_id = $1
       ORDER BY created_at, session_id`,
      [accountId],
    );
    return rows as SessionExportRow[];
  }

  /** Cierra la sesión en un equipo quitado de la cuenta. */
  static async revokeDeviceSessions(client: Queryable, accountId: number, deviceHash: Uint8Array): Promise<void> {
    await client.query(
      `UPDATE account_sessions SET revoked_at = now()
       WHERE account_id = $1 AND device_hash = $2 AND revoked_at IS NULL`,
      [accountId, deviceHash],
    );
  }

  // ------------------------------------------------------------------ equipos

  static async listDevices(client: Queryable, accountId: number): Promise<DeviceRow[]> {
    const { rows } = await client.query(
      `SELECT device_id, device_hash, registered_at, last_seen_at
       FROM account_devices
       WHERE account_id = $1
       ORDER BY registered_at, device_id`,
      [accountId],
    );
    return rows as DeviceRow[];
  }

  static async insertDevice(client: Queryable, accountId: number, deviceHash: Buffer): Promise<void> {
    await client.query('INSERT INTO account_devices (account_id, device_hash) VALUES ($1, $2)', [
      accountId,
      deviceHash,
    ]);
  }

  static async touchDevice(client: Queryable, accountId: number, deviceHash: Buffer): Promise<void> {
    await client.query(
      'UPDATE account_devices SET last_seen_at = now() WHERE account_id = $1 AND device_hash = $2',
      [accountId, deviceHash],
    );
  }

  static async deleteDevice(client: Queryable, accountId: number, deviceId: number): Promise<DeviceRow | null> {
    const { rows } = await client.query(
      `DELETE FROM account_devices
       WHERE account_id = $1 AND device_id = $2
       RETURNING device_id, device_hash, registered_at, last_seen_at`,
      [accountId, deviceId],
    );
    return (rows[0] as DeviceRow | undefined) ?? null;
  }

  // ------------------------------------------------------------------ suscripciones

  static async findTierByMonths(durationMonths: number): Promise<TierRow | null> {
    const { rows } = await pool.query(
      `SELECT tier_id, tier_name, price_clp, duration_months, max_devices
       FROM subscription_tiers
       WHERE duration_months = $1`,
      [durationMonths],
    );
    return (rows[0] as TierRow | undefined) ?? null;
  }

  /** Suscripción que termina más tarde (la vigente, si existe). */
  static async findLatestSubscription(client: Queryable, accountId: number): Promise<SubscriptionRow | null> {
    const { rows } = await client.query(
      `SELECT s.subscription_id, t.tier_name, t.duration_months, s.starts_at, s.ends_at,
              s.price_paid_clp, s.payment_reference
       FROM subscriptions s
       INNER JOIN subscription_tiers t ON t.tier_id = s.tier_id
       WHERE s.account_id = $1
       ORDER BY s.ends_at DESC
       LIMIT 1`,
      [accountId],
    );
    return (rows[0] as SubscriptionRow | undefined) ?? null;
  }

  /** Todas las compras de la cuenta (para el export de datos). */
  static async listSubscriptions(client: Queryable, accountId: number): Promise<SubscriptionRow[]> {
    const { rows } = await client.query(
      `SELECT s.subscription_id, t.tier_name, t.duration_months, s.starts_at, s.ends_at,
              s.price_paid_clp, s.payment_reference
       FROM subscriptions s
       INNER JOIN subscription_tiers t ON t.tier_id = s.tier_id
       WHERE s.account_id = $1
       ORDER BY s.starts_at, s.subscription_id`,
      [accountId],
    );
    return rows as SubscriptionRow[];
  }

  static async insertSubscription(
    client: Queryable,
    input: {
      accountId: number;
      tierId: number;
      startsAt: Date;
      durationMonths: number;
      priceClp: string;
      paymentReference: string;
    },
  ): Promise<void> {
    await client.query(
      `INSERT INTO subscriptions (account_id, tier_id, starts_at, ends_at, price_paid_clp, payment_reference)
       VALUES ($1, $2, $3::timestamptz, $3::timestamptz + make_interval(months => $4::int), $5, $6)`,
      [input.accountId, input.tierId, input.startsAt, input.durationMonths, input.priceClp, input.paymentReference],
    );
  }

  // ------------------------------------------------------------------ soporte

  static async insertTicket(
    accountId: number,
    subject: string,
    messageEncrypted: Buffer,
  ): Promise<{ ticket_id: number; created_at: Date }> {
    const { rows } = await pool.query(
      `INSERT INTO support_tickets (account_id, subject, message_encrypted)
       VALUES ($1, $2, $3)
       RETURNING ticket_id, created_at`,
      [accountId, subject, messageEncrypted],
    );
    return rows[0] as { ticket_id: number; created_at: Date };
  }

  static async listTickets(client: Queryable, accountId: number): Promise<TicketExportRow[]> {
    const { rows } = await client.query(
      `SELECT ticket_id, subject, message_encrypted, status, created_at
       FROM support_tickets
       WHERE account_id = $1
       ORDER BY created_at, ticket_id`,
      [accountId],
    );
    return rows as TicketExportRow[];
  }
}
