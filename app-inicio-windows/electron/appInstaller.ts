import { execFile } from 'node:child_process';
import { isAllowedWingetId } from './appPolicy.js';

/**
 * Instalación de apps con winget, el instalador oficial de Windows.
 *
 * - winget descarga desde el sitio del fabricante y comprueba la huella que
 *   publica su repositorio: nuestro servidor no guarda ni entrega las apps.
 * - `--interactive` abre el asistente del fabricante, para que la persona vea
 *   y acepte sus términos. Si la app necesita administrador, Windows pide permiso.
 * - Se llama a winget con una lista de argumentos (sin shell) y sólo con ids
 *   de la lista permitida: no hay forma de inyectar comandos.
 * - Se decide por el código de salida, no por el texto, que cambia con el idioma.
 */

/** `null` = no se pudo comprobar (ej. winget no está instalado). */
export type InstalledApps = Record<string, boolean | null>;

export type AppInstallFailureCode =
  | 'NOT_ALLOWED'
  | 'WINGET_MISSING'
  | 'CANCELLED'
  | 'NO_NETWORK'
  | 'DISK_FULL'
  | 'BUSY'
  | 'INSTALL_FAILED';

export type AppInstallResult =
  | { ok: true; alreadyInstalled: boolean; rebootRequired: boolean }
  | { ok: false; code: AppInstallFailureCode; message: string };

/** Ejecuta winget y devuelve su código de salida (sin signo, como lo documenta Microsoft). */
export type WingetRunner = (args: string[], timeoutMs: number) => Promise<number>;

const MESSAGES: Record<AppInstallFailureCode, string> = {
  NOT_ALLOWED: 'Esta versión de DriWin no permite instalar esa app.',
  WINGET_MISSING:
    'Este PC no tiene winget. Instala "Instalador de aplicación" (App Installer) desde Microsoft Store y vuelve a intentarlo.',
  CANCELLED: 'Cancelaste la instalación, así que la app no se instaló.',
  NO_NETWORK: 'No hay conexión a internet para descargar la app.',
  DISK_FULL: 'No hay espacio suficiente en el disco para instalar la app.',
  BUSY: 'Windows está terminando otra instalación. Espera a que termine e inténtalo de nuevo.',
  INSTALL_FAILED: 'La instalación no se completó. Si cancelaste el permiso o el asistente, puedes reintentar.',
};

/** Códigos de winget (https://github.com/microsoft/winget-cli/blob/master/doc/windows/package-manager/winget/returnCodes.md). */
export const WINGET = {
  OK: 0,
  NO_APPLICATIONS_FOUND: 0x8a150014,
  UPDATE_NOT_APPLICABLE: 0x8a15002b,
  PACKAGE_ALREADY_INSTALLED: 0x8a150061,
  INSTALL_IN_PROGRESS: 0x8a150102,
  DISK_FULL: 0x8a150105,
  NO_NETWORK: 0x8a150107,
  REBOOT_REQUIRED_TO_FINISH: 0x8a150109,
  REBOOT_INITIATED: 0x8a15010b,
  CANCELLED_BY_USER: 0x8a15010c,
  INSTALL_ALREADY_INSTALLED: 0x8a15010d,
} as const;

/** Código especial para "no existe winget.exe" (Node devuelve ENOENT). */
export const WINGET_NOT_FOUND = -1;

const DETECT_TIMEOUT_MS = 60_000;
/** Holgado porque la persona puede tardar en leer los términos del asistente. */
const INSTALL_TIMEOUT_MS = 2 * 60 * 60_000;
const DETECT_CONCURRENCY = 3;

const COMMON_FLAGS = ['--exact', '--accept-source-agreements', '--disable-interactivity'];

export const defaultRunner: WingetRunner = (args, timeoutMs) =>
  new Promise((resolve, reject) => {
    execFile('winget', args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (error) => {
      if (!error) {
        resolve(WINGET.OK);
        return;
      }
      const code = (error as { code?: unknown }).code;
      if (code === 'ENOENT') {
        resolve(WINGET_NOT_FOUND);
      } else if (typeof code === 'number') {
        resolve(code >>> 0);
      } else {
        reject(error);
      }
    });
  });

export function buildListArgs(id: string): string[] {
  return ['list', '--id', id, ...COMMON_FLAGS];
}

export function buildInstallArgs(id: string): string[] {
  return ['install', '--id', id, '--source', 'winget', '--interactive', '--accept-package-agreements', ...COMMON_FLAGS];
}

/** ¿Qué apps de la lista ya están instaladas? Consulta pocas a la vez para no saturar el PC. */
export async function detectApps(ids: string[], run: WingetRunner = defaultRunner): Promise<InstalledApps> {
  const result: InstalledApps = {};
  const queue = ids.filter(isAllowedWingetId);
  let wingetMissing = false;

  async function worker(): Promise<void> {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      if (wingetMissing) {
        result[id] = null;
        continue;
      }
      let code: number;
      try {
        code = await run(buildListArgs(id), DETECT_TIMEOUT_MS);
      } catch {
        result[id] = null;
        continue;
      }
      if (code === WINGET_NOT_FOUND) {
        wingetMissing = true;
      }
      result[id] = code === WINGET.OK ? true : code === WINGET.NO_APPLICATIONS_FOUND ? false : null;
    }
  }

  await Promise.all(Array.from({ length: DETECT_CONCURRENCY }, worker));
  return result;
}

export function interpretInstallCode(code: number): AppInstallResult {
  switch (code) {
    case WINGET.OK:
      return { ok: true, alreadyInstalled: false, rebootRequired: false };
    case WINGET.REBOOT_REQUIRED_TO_FINISH:
    case WINGET.REBOOT_INITIATED:
      return { ok: true, alreadyInstalled: false, rebootRequired: true };
    case WINGET.PACKAGE_ALREADY_INSTALLED:
    case WINGET.INSTALL_ALREADY_INSTALLED:
    case WINGET.UPDATE_NOT_APPLICABLE:
      return { ok: true, alreadyInstalled: true, rebootRequired: false };
    case WINGET_NOT_FOUND:
      return { ok: false, code: 'WINGET_MISSING', message: MESSAGES.WINGET_MISSING };
    case WINGET.CANCELLED_BY_USER:
      return { ok: false, code: 'CANCELLED', message: MESSAGES.CANCELLED };
    case WINGET.NO_NETWORK:
      return { ok: false, code: 'NO_NETWORK', message: MESSAGES.NO_NETWORK };
    case WINGET.DISK_FULL:
      return { ok: false, code: 'DISK_FULL', message: MESSAGES.DISK_FULL };
    case WINGET.INSTALL_IN_PROGRESS:
      return { ok: false, code: 'BUSY', message: MESSAGES.BUSY };
    default:
      return {
        ok: false,
        code: 'INSTALL_FAILED',
        message: `${MESSAGES.INSTALL_FAILED} (código 0x${(code >>> 0).toString(16).toUpperCase()})`,
      };
  }
}

export async function installApp(id: unknown, run: WingetRunner = defaultRunner): Promise<AppInstallResult> {
  if (!isAllowedWingetId(id)) {
    return { ok: false, code: 'NOT_ALLOWED', message: MESSAGES.NOT_ALLOWED };
  }
  try {
    return interpretInstallCode(await run(buildInstallArgs(id), INSTALL_TIMEOUT_MS));
  } catch {
    return { ok: false, code: 'INSTALL_FAILED', message: MESSAGES.INSTALL_FAILED };
  }
}
