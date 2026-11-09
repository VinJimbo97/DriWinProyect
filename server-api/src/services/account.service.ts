import { env } from '../config/env.js';
import { withTransaction } from '../config/db.js';
import { ApiError, ErrorCode } from '../domain/errors.js';
import { AccountRepository, type DeviceRow, type SubscriptionRow } from '../repositories/account.repository.js';
import {
  decryptText,
  deriveDataKeys,
  dummyPasswordHash,
  emailLookup,
  encryptText,
  hashPassword,
  maskEmail,
  newSessionToken,
  newSimulatedPaymentReference,
  normalizeEmail,
  sha256,
  verifyPassword,
  type DataKeys,
} from '../security/crypto.js';

/** Equipos por cuenta (igual que max_devices de los planes). */
export const MAX_DEVICES = 3;
/** Intentos fallidos antes de bloquear la cuenta y minutos de bloqueo. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

let cachedKeys: DataKeys | null = null;

/** Claves de cifrado; sin DATA_ENCRYPTION_KEY las cuentas quedan deshabilitadas (503). */
function dataKeys(): DataKeys {
  if (!env.DATA_ENCRYPTION_KEY) {
    throw new ApiError(
      503,
      ErrorCode.ACCOUNTS_DISABLED,
      'Las cuentas DriWin no están disponibles en este servidor.',
      undefined,
      'Configure DATA_ENCRYPTION_KEY en el servidor (openssl rand -hex 32).',
    );
  }
  cachedKeys ??= deriveDataKeys(env.DATA_ENCRYPTION_KEY);
  return cachedKeys;
}

export interface AccountSessionDto {
  token: string;
  expires_at: string;
  account: AccountStatusDto;
}

export interface AccountStatusDto {
  email: string;
  created_at: string;
  premium_active: boolean;
  subscription: {
    plan: string;
    years: number;
    starts_at: string;
    ends_at: string;
    active: boolean;
    payment_reference: string;
  } | null;
  this_device: { registered: boolean };
  devices: { device_id: number; registered_at: string; last_seen_at: string; current: boolean }[];
  max_devices: number;
}

const invalidCredentials = () =>
  new ApiError(401, ErrorCode.UNAUTHORIZED, 'Correo o contraseña incorrectos.', undefined, 'Revise los datos e inténtelo de nuevo.');

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

function sameHash(a: Uint8Array, b: Uint8Array): boolean {
  return Buffer.from(a).equals(Buffer.from(b));
}

function subscriptionDto(row: SubscriptionRow | null, now: Date): AccountStatusDto['subscription'] {
  if (!row) {
    return null;
  }
  return {
    plan: row.tier_name,
    years: row.duration_months / 12,
    starts_at: new Date(row.starts_at).toISOString(),
    ends_at: new Date(row.ends_at).toISOString(),
    active: new Date(row.ends_at) > now,
    payment_reference: row.payment_reference,
  };
}

function statusDto(
  email: string,
  createdAt: Date,
  subscription: SubscriptionRow | null,
  devices: DeviceRow[],
  deviceHash: Buffer,
): AccountStatusDto {
  const now = new Date();
  const sub = subscriptionDto(subscription, now);
  const registered = devices.some((device) => sameHash(device.device_hash, deviceHash));
  return {
    email,
    created_at: new Date(createdAt).toISOString(),
    premium_active: Boolean(sub?.active) && registered,
    subscription: sub,
    this_device: { registered },
    devices: devices.map((device) => ({
      device_id: device.device_id,
      registered_at: new Date(device.registered_at).toISOString(),
      last_seen_at: new Date(device.last_seen_at).toISOString(),
      current: sameHash(device.device_hash, deviceHash),
    })),
    max_devices: MAX_DEVICES,
  };
}

export class AccountService {
  /** Crea la cuenta, registra este equipo y abre sesión (todo o nada). */
  static async register(email: string, password: string, deviceId: string): Promise<AccountSessionDto> {
    const keys = dataKeys();
    const normalized = normalizeEmail(email);
    const passwordHash = await hashPassword(password);
    const deviceHash = sha256(deviceId);
    const token = newSessionToken();

    try {
      const { accountId, expiresAt } = await withTransaction(async (client) => {
        const newId = await AccountRepository.insertAccount(
          client,
          emailLookup(normalized, keys),
          encryptText(normalized, keys),
          passwordHash,
        );
        await AccountRepository.insertDevice(client, newId, deviceHash);
        const expires = await AccountRepository.insertSession(client, newId, sha256(token), deviceHash, env.SESSION_TTL_DAYS);
        return { accountId: newId, expiresAt: expires };
      });
      return { token, expires_at: new Date(expiresAt).toISOString(), account: await AccountService.status(accountId, deviceHash) };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiError(409, ErrorCode.CONFLICT, 'Ya existe una cuenta con ese correo.', undefined, 'Inicie sesión con esa cuenta.');
      }
      throw error;
    }
  }

  /**
   * Inicia sesión. Mensaje genérico ante cualquier fallo (no revela si el correo
   * existe) y bloqueo temporal tras MAX_FAILED_LOGINS intentos.
   * Si la cuenta ya tiene 3 equipos, la sesión se abre igual pero este equipo
   * queda sin registrar (sin Premium) hasta que el usuario quite otro.
   */
  static async login(email: string, password: string, deviceId: string): Promise<AccountSessionDto> {
    const keys = dataKeys();
    const account = await AccountRepository.findByEmailLookup(emailLookup(email, keys));

    if (!account) {
      await verifyPassword(password, await dummyPasswordHash());
      throw invalidCredentials();
    }
    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      throw new ApiError(
        429,
        ErrorCode.ACCOUNT_LOCKED,
        'Demasiados intentos fallidos. La cuenta está bloqueada temporalmente.',
        undefined,
        `Vuelva a intentarlo en ${LOCK_MINUTES} minutos.`,
      );
    }
    if (!(await verifyPassword(password, account.password_hash))) {
      await AccountRepository.registerFailedLogin(account.account_id, MAX_FAILED_LOGINS, LOCK_MINUTES);
      throw invalidCredentials();
    }

    await AccountRepository.resetFailedLogins(account.account_id);
    const deviceHash = sha256(deviceId);
    const token = newSessionToken();

    const expiresAt = await withTransaction(async (client) => {
      await AccountRepository.lockAccount(client, account.account_id);
      const devices = await AccountRepository.listDevices(client, account.account_id);
      if (devices.some((device) => sameHash(device.device_hash, deviceHash))) {
        await AccountRepository.touchDevice(client, account.account_id, deviceHash);
      } else if (devices.length < MAX_DEVICES) {
        await AccountRepository.insertDevice(client, account.account_id, deviceHash);
      }
      return AccountRepository.insertSession(client, account.account_id, sha256(token), deviceHash, env.SESSION_TTL_DAYS);
    });

    return { token, expires_at: new Date(expiresAt).toISOString(), account: await AccountService.status(account.account_id, deviceHash) };
  }

  static async logout(sessionId: number): Promise<void> {
    await AccountRepository.revokeSession(sessionId);
  }

  /** Estado de la cuenta para este equipo: plan, equipos y si Premium está activo aquí. */
  static async status(accountId: number, deviceHash: Buffer): Promise<AccountStatusDto> {
    const keys = dataKeys();
    return withTransaction(async (client) => {
      const account = await AccountRepository.findById(client, accountId);
      if (!account) {
        throw new ApiError(401, ErrorCode.UNAUTHORIZED, 'La cuenta ya no existe.', undefined, 'Inicie sesión de nuevo.');
      }
      await AccountRepository.touchDevice(client, accountId, deviceHash);
      const [devices, subscription] = await Promise.all([
        AccountRepository.listDevices(client, accountId),
        AccountRepository.findLatestSubscription(client, accountId),
      ]);
      return statusDto(decryptText(account.email_encrypted, keys), account.created_at, subscription, devices, deviceHash);
    });
  }

  /** Registra este equipo si hay cupo (máximo 3). */
  static async registerDevice(accountId: number, deviceHash: Buffer): Promise<AccountStatusDto> {
    await withTransaction(async (client) => {
      await AccountRepository.lockAccount(client, accountId);
      const devices = await AccountRepository.listDevices(client, accountId);
      if (devices.some((device) => sameHash(device.device_hash, deviceHash))) {
        return;
      }
      if (devices.length >= MAX_DEVICES) {
        throw new ApiError(
          409,
          ErrorCode.DEVICE_LIMIT_REACHED,
          `Tu cuenta ya tiene ${MAX_DEVICES} equipos registrados.`,
          undefined,
          'Quita uno de tus equipos para usar DriWin Premium en este.',
        );
      }
      await AccountRepository.insertDevice(client, accountId, deviceHash);
    });
    return AccountService.status(accountId, deviceHash);
  }

  /** Quita un equipo de la cuenta y cierra su sesión en ese equipo. */
  static async removeDevice(accountId: number, deviceId: number, currentDeviceHash: Buffer): Promise<AccountStatusDto> {
    await withTransaction(async (client) => {
      const removed = await AccountRepository.deleteDevice(client, accountId, deviceId);
      if (!removed) {
        throw ApiError.notFound('Equipo', deviceId);
      }
      if (!sameHash(removed.device_hash, currentDeviceHash)) {
        await AccountRepository.revokeDeviceSessions(client, accountId, removed.device_hash);
      }
    });
    return AccountService.status(accountId, currentDeviceHash);
  }

  /**
   * Compra simulada de un plan (no hay cobro real en esta versión).
   * Si ya hay una suscripción vigente, la nueva empieza cuando esa termina.
   */
  static async purchase(accountId: number, years: number, deviceHash: Buffer): Promise<AccountStatusDto> {
    const tier = await AccountRepository.findTierByMonths(years * 12);
    if (!tier) {
      throw new ApiError(422, ErrorCode.BUSINESS_RULE_VIOLATION, `No existe un plan de ${years} año(s).`);
    }
    await withTransaction(async (client) => {
      await AccountRepository.lockAccount(client, accountId);
      const latest = await AccountRepository.findLatestSubscription(client, accountId);
      const now = new Date();
      const startsAt = latest && new Date(latest.ends_at) > now ? new Date(latest.ends_at) : now;
      await AccountRepository.insertSubscription(client, {
        accountId,
        tierId: tier.tier_id,
        startsAt,
        durationMonths: tier.duration_months,
        priceClp: tier.price_clp,
        paymentReference: newSimulatedPaymentReference(),
      });
    });
    return AccountService.status(accountId, deviceHash);
  }

  /**
   * "Borrar mis datos" (Ley 21.719): exige la contraseña y elimina la cuenta con
   * sus equipos, sesiones y consultas. Las ventas quedan anónimas.
   */
  static async deleteAccount(accountId: number, password: string): Promise<void> {
    const account = await withTransaction((client) => AccountRepository.findById(client, accountId));
    if (!account || !(await verifyPassword(password, account.password_hash))) {
      throw new ApiError(401, ErrorCode.UNAUTHORIZED, 'La contraseña no es correcta.', undefined, 'Escriba la contraseña de su cuenta para confirmar.');
    }
    await AccountRepository.deleteAccount(accountId);
  }

  /** Consulta al soporte técnico: sólo con Premium activo en este equipo. */
  static async createSupportTicket(
    accountId: number,
    deviceHash: Buffer,
    subject: string,
    message: string,
  ): Promise<{ ticket_id: number; created_at: string; reply_to: string }> {
    const keys = dataKeys();
    const status = await AccountService.status(accountId, deviceHash);
    if (!status.premium_active) {
      throw new ApiError(
        403,
        ErrorCode.PREMIUM_REQUIRED,
        'El soporte técnico es parte de DriWin Premium.',
        undefined,
        'Activa una suscripción Premium en este equipo.',
      );
    }
    const ticket = await AccountRepository.insertTicket(accountId, subject, encryptText(message, keys));
    return { ticket_id: ticket.ticket_id, created_at: new Date(ticket.created_at).toISOString(), reply_to: maskEmail(status.email) };
  }
}
