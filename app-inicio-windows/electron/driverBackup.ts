import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { dataPrelude, EXIT_UAC_DENIED, runElevatedScript, type ElevatedRunner } from './elevated.js';

/**
 * Respaldo de drivers (Premium): copia a una carpeta todos los drivers que se
 * instalaron aparte de los de Windows (los "oem*.inf"), con
 * `pnputil /export-driver * <carpeta>`. Si un driver nuevo da problemas, se
 * puede volver al anterior desde el Administrador de dispositivos →
 * Actualizar controlador → Buscar en mi equipo → esa carpeta.
 *
 * Necesita administrador (un aviso de UAC). No modifica nada del sistema.
 */

export type BackupFailure = 'INVALID_FOLDER' | 'UAC_DENIED' | 'FAILED';

export type DriverBackupResult =
  | { ok: true; folder: string; driverCount: number }
  | { ok: false; code: BackupFailure; message: string };

const MESSAGES: Record<BackupFailure, string> = {
  INVALID_FOLDER: 'La carpeta elegida no es válida. Elige una carpeta de tu disco.',
  UAC_DENIED: 'Cancelaste el permiso de administrador, así que no se hizo el respaldo.',
  FAILED: 'Windows no pudo copiar los drivers. Revisa que haya espacio en el disco e inténtalo de nuevo.',
};

/** Carpeta del respaldo: <base>\Respaldo de drivers 2026-11-10 2130 */
export function backupFolderName(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `Respaldo de drivers ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/** Rechaza a propósito caracteres de control y los que Windows no admite en rutas. */
// eslint-disable-next-line no-control-regex
const FORBIDDEN_PATH_CHARS = /[\u0000-\u001f<>"|?*]/;

/** Sólo rutas absolutas de un disco local (C:\...), sin caracteres de control. */
export function isValidBackupFolder(folder: unknown): folder is string {
  return (
    typeof folder === 'string' &&
    folder.length <= 240 &&
    /^[A-Za-z]:\\/.test(folder) &&
    !FORBIDDEN_PATH_CHARS.test(folder.slice(2))
  );
}

export function buildBackupScript(folder: string): string {
  return `
$ErrorActionPreference = 'Stop'
${dataPrelude({ folder })}
try {
  New-Item -ItemType Directory -Force -Path $data.folder | Out-Null
  & (Join-Path $env:SystemRoot 'System32\\pnputil.exe') /export-driver * $data.folder | Out-Null
  exit $LASTEXITCODE
} catch {
  exit 1
}
`;
}

/** pnputil crea una subcarpeta por cada driver exportado. */
async function countExportedDrivers(folder: string): Promise<number> {
  try {
    const entries = await readdir(folder, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).length;
  } catch {
    return 0;
  }
}

export async function backupDrivers(
  baseFolder: unknown,
  now: Date = new Date(),
  run?: ElevatedRunner,
  count: (folder: string) => Promise<number> = countExportedDrivers,
): Promise<DriverBackupResult> {
  if (!isValidBackupFolder(baseFolder)) {
    return { ok: false, code: 'INVALID_FOLDER', message: MESSAGES.INVALID_FOLDER };
  }
  const folder = path.join(baseFolder, backupFolderName(now));
  let exitCode: number;
  try {
    exitCode = await runElevatedScript(buildBackupScript(folder), 20 * 60_000, run);
  } catch {
    return { ok: false, code: 'FAILED', message: MESSAGES.FAILED };
  }
  if (exitCode === EXIT_UAC_DENIED) {
    return { ok: false, code: 'UAC_DENIED', message: MESSAGES.UAC_DENIED };
  }
  const driverCount = await count(folder);
  if (exitCode !== 0 && driverCount === 0) {
    return { ok: false, code: 'FAILED', message: MESSAGES.FAILED };
  }
  return { ok: true, folder, driverCount };
}
