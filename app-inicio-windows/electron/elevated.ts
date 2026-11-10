import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Ejecuta un script de PowerShell CON permisos de administrador (un solo
 * aviso de UAC) y devuelve su código de salida.
 *
 * Seguridad:
 *  - El script es fijo (lo escribe DriWin). Los datos variables (rutas, ids)
 *    viajan como JSON en base64 y el script los decodifica: no hay forma de
 *    inyectar comandos aunque una ruta tenga comillas o símbolos.
 *  - El script se pasa con -EncodedCommand (sin archivos temporales que otro
 *    programa pueda modificar entre que DriWin lo escribe y Windows lo ejecuta).
 *  - powershell.exe se llama por su ruta completa en System32.
 *  - Como el proceso elevado no puede devolver texto, el resultado es el código
 *    de salida (y, si hace falta, un archivo de resultados que DriWin lee).
 */

/** Código de Windows cuando la persona responde "No" al aviso de UAC. */
export const EXIT_UAC_DENIED = 1223;
/** El proceso no entregó código de salida. */
export const EXIT_NO_RESULT = 259;

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;
/** Windows limita la línea de comandos a 32.767 caracteres. */
const MAX_ENCODED_LENGTH = 30_000;

/** PowerShell -EncodedCommand espera el script en UTF-16LE y base64. */
export function encodePowerShell(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64');
}

/** Datos para el script: JSON en base64 (sólo letras, números, + / =). */
export function encodeData(data: unknown): string {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64');
}

/** Línea de PowerShell que recupera los datos en la variable $data. */
export function dataPrelude(data: unknown): string {
  return `$data = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${encodeData(data)}')) | ConvertFrom-Json`;
}

/**
 * Script NO elevado que lanza el elevado y espera. Igual que el instalador de
 * drivers: Process.Start con Verb runas, para recibir 1223 si se niega el UAC.
 */
const LAUNCHER_SCRIPT = `
try {
  $info = New-Object System.Diagnostics.ProcessStartInfo
  $info.FileName = Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'
  $info.Arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -EncodedCommand ' + $env:DRIWIN_ENCODED
  $info.UseShellExecute = $true
  $info.Verb = 'runas'
  $info.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
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

export type ElevatedRunner = (encodedScript: string, timeoutMs: number) => Promise<number>;

export const defaultElevatedRunner: ElevatedRunner = async (encodedScript, timeoutMs) => {
  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', LAUNCHER_SCRIPT],
      { timeout: timeoutMs, windowsHide: true, env: { ...process.env, DRIWIN_ENCODED: encodedScript } },
    );
    return 0;
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'number' ? code : 1;
  }
};

export async function runElevatedScript(
  script: string,
  timeoutMs: number,
  run: ElevatedRunner = defaultElevatedRunner,
): Promise<number> {
  const encoded = encodePowerShell(script);
  if (!BASE64_PATTERN.test(encoded) || encoded.length > MAX_ENCODED_LENGTH) {
    throw new Error('El script elevado es demasiado largo o inválido');
  }
  return run(encoded, timeoutMs);
}
