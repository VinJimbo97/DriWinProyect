import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Datos de la cuenta DriWin guardados en este equipo (carpeta userData):
 *
 *  - device-id.txt: identificador ALEATORIO del equipo (UUID). No sale del
 *    hardware ni identifica a la persona; el servidor sólo guarda su SHA-256
 *    para contar los 3 equipos de la suscripción.
 *  - session.bin: token de sesión cifrado con la protección de datos de
 *    Windows (DPAPI, vía safeStorage de Electron). Sólo este usuario de Windows
 *    en este equipo puede descifrarlo; copiado a otro PC no sirve.
 *
 * Si el cifrado no está disponible, la sesión NO se guarda en disco (dura
 * sólo mientras la app está abierta): nunca se escribe el token en claro.
 */

export interface Encryptor {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

const DEVICE_FILE = 'device-id.txt';
const SESSION_FILE = 'session.bin';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** Mismo formato que genera server-api: "dws_" + 32 bytes en base64url. */
const SESSION_TOKEN_PATTERN = /^dws_[A-Za-z0-9_-]{43}$/;

export function isValidSessionToken(value: unknown): value is string {
  return typeof value === 'string' && SESSION_TOKEN_PATTERN.test(value);
}

/** Lee el identificador del equipo o crea uno nuevo si falta o está dañado. */
export async function loadDeviceId(dir: string): Promise<string> {
  const file = path.join(dir, DEVICE_FILE);
  try {
    const saved = (await readFile(file, 'utf8')).trim();
    if (UUID_PATTERN.test(saved)) {
      return saved;
    }
  } catch {
    /* primera vez en este equipo */
  }
  const id = randomUUID();
  await mkdir(dir, { recursive: true });
  await writeFile(file, id, 'utf8');
  return id;
}

/** Guarda el token cifrado. Devuelve false si no se pudo cifrar (no se guarda). */
export async function saveSession(dir: string, token: unknown, encryptor: Encryptor): Promise<boolean> {
  if (!isValidSessionToken(token)) {
    throw new Error('Token de sesión inválido');
  }
  if (!encryptor.isEncryptionAvailable()) {
    return false;
  }
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, SESSION_FILE), encryptor.encryptString(token));
  return true;
}

/** Devuelve el token guardado, o null si no hay, no se puede descifrar o está dañado. */
export async function loadSession(dir: string, encryptor: Encryptor): Promise<string | null> {
  if (!encryptor.isEncryptionAvailable()) {
    return null;
  }
  try {
    const token = encryptor.decryptString(await readFile(path.join(dir, SESSION_FILE)));
    return isValidSessionToken(token) ? token : null;
  } catch {
    return null;
  }
}

export async function clearSession(dir: string): Promise<void> {
  await rm(path.join(dir, SESSION_FILE), { force: true });
}
