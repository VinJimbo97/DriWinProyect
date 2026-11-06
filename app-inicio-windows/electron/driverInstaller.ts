import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { promisify } from 'node:util';
import { validateInstallRequest, type DriverInstallRequest } from './installerPolicy.js';

const execFileAsync = promisify(execFile);

/** El instalador más grande del catálogo pesa cerca de 1 GB. */
const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024 * 1024;
const DOWNLOAD_STALL_MS = 60_000;
/** Holgado porque la persona puede tardar en leer los términos del asistente. */
const INSTALL_TIMEOUT_MS = 2 * 60 * 60_000;

const EXIT_OK = 0;
const EXIT_REBOOT_REQUIRED = 3010;
const EXIT_REBOOT_INITIATED = 1641;
const EXIT_UAC_DENIED = 1223;
/** Código estándar de Windows Installer cuando la persona cancela el asistente. */
const EXIT_USER_CANCELLED = 1602;

export type InstallStage = 'downloading' | 'verifying' | 'installing';
export type InstallProgress = { driverId: number; stage: InstallStage; percent: number | null };

export type InstallFailureCode =
  | 'NOT_VERIFIED'
  | 'INVALID_SOURCE'
  | 'DOWNLOAD_FAILED'
  | 'HASH_MISMATCH'
  | 'BAD_SIGNATURE'
  | 'UAC_DENIED'
  | 'USER_CANCELLED'
  | 'INSTALLER_FAILED';

export type DriverInstallResult =
  | { ok: true; rebootRequired: boolean }
  | { ok: false; code: InstallFailureCode; message: string };

const FAILURE_MESSAGES: Record<InstallFailureCode, string> = {
  NOT_VERIFIED: 'Este driver aún no tiene una huella de seguridad registrada, así que no se instalará.',
  INVALID_SOURCE: 'El origen de este driver no está autorizado.',
  DOWNLOAD_FAILED: 'No se pudo descargar el driver. Revisa tu conexión e inténtalo de nuevo.',
  HASH_MISMATCH: 'El archivo descargado no coincide con el original. Se eliminó sin instalarlo.',
  BAD_SIGNATURE: 'La firma digital del instalador no es válida. Se eliminó sin instalarlo.',
  UAC_DENIED: 'Cancelaste el permiso de administrador, así que no se instaló el driver.',
  USER_CANCELLED: 'Cancelaste el instalador, así que no se instaló el driver.',
  INSTALLER_FAILED: 'El instalador terminó sin confirmar la instalación. Si lo cancelaste, puedes reintentar cuando quieras.',
};

class InstallFailure extends Error {
  readonly code: InstallFailureCode;

  constructor(code: InstallFailureCode) {
    super(FAILURE_MESSAGES[code]);
    this.code = code;
  }
}

/** Descarga calculando el SHA-256 sobre lo recibido; si no coincide, el archivo no se usa. */
export async function downloadAndVerify(
  url: string,
  expectedSha256: string,
  filePath: string,
  onPercent: (percent: number | null) => void,
): Promise<void> {
  const controller = new AbortController();
  let stallTimer = setTimeout(() => controller.abort(), DOWNLOAD_STALL_MS);

  try {
    const response = await fetch(url, { redirect: 'error', signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new InstallFailure('DOWNLOAD_FAILED');
    }

    const totalBytes = Number(response.headers.get('content-length')) || 0;
    if (totalBytes > MAX_DOWNLOAD_BYTES) {
      throw new InstallFailure('DOWNLOAD_FAILED');
    }

    const hash = createHash('sha256');
    let receivedBytes = 0;
    let lastPercent = -1;
    onPercent(totalBytes ? 0 : null);

    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        clearTimeout(stallTimer);
        stallTimer = setTimeout(() => controller.abort(), DOWNLOAD_STALL_MS);

        receivedBytes += chunk.length;
        if (receivedBytes > MAX_DOWNLOAD_BYTES) {
          callback(new InstallFailure('DOWNLOAD_FAILED'));
          return;
        }
        hash.update(chunk);

        const percent = totalBytes ? Math.floor((receivedBytes / totalBytes) * 100) : null;
        if (percent !== null && percent !== lastPercent) {
          lastPercent = percent;
          onPercent(percent);
        }
        callback(null, chunk);
      },
    });

    await pipeline(
      Readable.fromWeb(response.body as WebReadableStream<Uint8Array>),
      meter,
      createWriteStream(filePath),
    );

    if (hash.digest('hex') !== expectedSha256) {
      throw new InstallFailure('HASH_MISMATCH');
    }
  } catch (error) {
    throw error instanceof InstallFailure ? error : new InstallFailure('DOWNLOAD_FAILED');
  } finally {
    clearTimeout(stallTimer);
  }
}

/** La ruta llega por variable de entorno: el script es fijo y no admite inyección. */
const SIGNATURE_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
(Get-AuthenticodeSignature -LiteralPath $env:DRIWIN_FILE).Status.ToString()
`;

export async function verifySignature(filePath: string): Promise<void> {
  let status = '';
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SIGNATURE_SCRIPT],
      { timeout: 60_000, windowsHide: true, env: { ...process.env, DRIWIN_FILE: filePath } },
    );
    status = stdout.trim();
  } catch {
    throw new InstallFailure('BAD_SIGNATURE');
  }
  if (status !== 'Valid') {
    throw new InstallFailure('BAD_SIGNATURE');
  }
}

/**
 * La app corre sin privilegios y sólo este instalador pide administrador (UAC).
 * Se abre sin argumentos: la persona ve sus ventanas y acepta sus términos.
 * Se usa Process.Start porque Start-Process oculta el error nativo de Windows:
 * al negar el permiso solo así llega el 1223, sea cual sea el idioma.
 * Un código de salida ausente nunca se trata como éxito (259 = sin resultado).
 */
const ELEVATE_SCRIPT = `
try {
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = $env:DRIWIN_FILE
  $info.UseShellExecute = $true
  $info.Verb = 'runas'
  $p = [System.Diagnostics.Process]::Start($info)
  if ($null -eq $p) { exit 259 }
  $p.WaitForExit()
  if ($null -eq $p.ExitCode) { exit 259 }
  exit $p.ExitCode
} catch {
  $e = $_.Exception
  while ($e) {
    if ($e.NativeErrorCode -eq 1223) { exit 1223 }
    $e = $e.InnerException
  }
  exit 1
}
`;

export async function runElevated(filePath: string): Promise<number> {
  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', ELEVATE_SCRIPT],
      {
        timeout: INSTALL_TIMEOUT_MS,
        windowsHide: true,
        env: { ...process.env, DRIWIN_FILE: filePath },
      },
    );
    return EXIT_OK;
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'number') {
      return code;
    }
    throw new InstallFailure('INSTALLER_FAILED');
  }
}

export interface InstallerSteps {
  download: typeof downloadAndVerify;
  verify: typeof verifySignature;
  run: typeof runElevated;
}

const REAL_STEPS: InstallerSteps = { download: downloadAndVerify, verify: verifySignature, run: runElevated };

/** Validar → descargar y comparar SHA-256 → revisar firma → instalar con UAC. Siempre borra el archivo. */
export async function installDriver(
  request: DriverInstallRequest,
  workDir: string,
  onProgress: (progress: InstallProgress) => void,
  steps: InstallerSteps = REAL_STEPS,
): Promise<DriverInstallResult> {
  const violation = validateInstallRequest(request);
  if (violation) {
    return { ok: false, code: violation, message: FAILURE_MESSAGES[violation] };
  }

  const { driverId } = request;
  const filePath = path.join(workDir, `driver-${driverId}.exe`);

  try {
    await mkdir(workDir, { recursive: true });
    await steps.download(request.downloadUrl, request.sha256 as string, filePath, (percent) =>
      onProgress({ driverId, stage: 'downloading', percent }),
    );

    onProgress({ driverId, stage: 'verifying', percent: null });
    await steps.verify(filePath);

    onProgress({ driverId, stage: 'installing', percent: null });
    const exitCode = await steps.run(filePath);

    if (exitCode === EXIT_OK) {
      return { ok: true, rebootRequired: false };
    }
    if (exitCode === EXIT_REBOOT_REQUIRED || exitCode === EXIT_REBOOT_INITIATED) {
      return { ok: true, rebootRequired: true };
    }
    if (exitCode === EXIT_UAC_DENIED) {
      return { ok: false, code: 'UAC_DENIED', message: FAILURE_MESSAGES.UAC_DENIED };
    }
    if (exitCode === EXIT_USER_CANCELLED) {
      return { ok: false, code: 'USER_CANCELLED', message: FAILURE_MESSAGES.USER_CANCELLED };
    }
    return {
      ok: false,
      code: 'INSTALLER_FAILED',
      message: `${FAILURE_MESSAGES.INSTALLER_FAILED} Código: ${exitCode}.`,
    };
  } catch (error) {
    const code = error instanceof InstallFailure ? error.code : 'INSTALLER_FAILED';
    return { ok: false, code, message: FAILURE_MESSAGES[code] };
  } finally {
    await rm(filePath, { force: true }).catch(() => {
      /* si Windows aún lo retiene, se reemplaza en el próximo intento */
    });
  }
}
