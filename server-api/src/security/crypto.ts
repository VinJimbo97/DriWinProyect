import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

/**
 * Criptografía de las cuentas DriWin (sólo node:crypto, sin dependencias).
 *
 *  - Contraseñas: scrypt (lento a propósito y con sal única). Un SHA-256 simple
 *    NO sirve para contraseñas: es tan rápido que permite probar miles de
 *    millones por segundo si se filtra la base.
 *  - Correo: cifrado con AES-256-GCM (confidencial y a prueba de alteraciones)
 *    + huella HMAC-SHA256 para buscar la cuenta sin descifrar todos los correos.
 *  - Tokens de sesión e identificadores de equipo: sólo se guarda su SHA-256.
 *
 * Las dos claves (cifrado y huella) se derivan con HKDF de DATA_ENCRYPTION_KEY,
 * que vive en el servidor y nunca en la base de datos ni en el código.
 */

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const SCRYPT_KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/** Prefijo de los tokens de sesión: permite distinguirlos de las API keys. */
export const SESSION_TOKEN_PREFIX = 'dws_';

export interface DataKeys {
  encryption: Buffer;
  lookup: Buffer;
}

/** Deriva las claves de cifrado y de huella desde la clave maestra (64 caracteres hex). */
export function deriveDataKeys(masterKeyHex: string): DataKeys {
  const master = Buffer.from(masterKeyHex, 'hex');
  if (master.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY debe tener 32 bytes (64 caracteres hexadecimales).');
  }
  const derive = (info: string) => Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), info, 32));
  return { encryption: derive('driwin:email-encryption:v1'), lookup: derive('driwin:email-lookup:v1') };
}

function scryptAsync(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derived) => (error ? reject(error) : resolve(derived)));
  });
}

/** Hash de contraseña en formato autodescriptivo: scrypt$N$r$p$sal$hash (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const { N, r, p } = SCRYPT_PARAMS;
  const derived = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, { N, r, p });
  return ['scrypt', N, r, p, salt.toString('base64'), derived.toString('base64')].join('$');
}

/** Compara en tiempo constante. Un hash con formato desconocido nunca coincide. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const derived = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** Hash ficticio para gastar el mismo tiempo cuando el correo no existe (evita enumerar cuentas). */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash;
}

/** Correo normalizado: sin espacios y en minúsculas. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Huella HMAC-SHA256 del correo normalizado (32 bytes). */
export function emailLookup(email: string, keys: DataKeys): Buffer {
  return createHmac('sha256', keys.lookup).update(normalizeEmail(email), 'utf8').digest();
}

/** AES-256-GCM: devuelve iv (12) + tag (16) + texto cifrado. */
export function encryptText(plain: string, keys: DataKeys): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', keys.encryption, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

/** Lanza error si el dato fue alterado o se cifró con otra clave. */
export function decryptText(payload: Uint8Array, keys: DataKeys): string {
  const data = Buffer.from(payload);
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', keys.encryption, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data.subarray(IV_LENGTH + TAG_LENGTH)), decipher.final()]).toString('utf8');
}

export function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/** Token de sesión opaco: 32 bytes aleatorios. Sólo su SHA-256 se guarda en la base. */
export function newSessionToken(): string {
  return SESSION_TOKEN_PREFIX + randomBytes(32).toString('base64url');
}

/** Referencia de pago simulado (no hay cobro real en esta versión). */
export function newSimulatedPaymentReference(): string {
  return `SIM-${randomBytes(8).toString('hex').toUpperCase()}`;
}

/** "vicente@gmail.com" → "vi*****@gmail.com" (para mostrar sin exponer el correo completo). */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) {
    return '***';
  }
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}
