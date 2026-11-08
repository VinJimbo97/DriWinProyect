import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isAllowedPackage } from './bloatwarePolicy.js';

const execFileAsync = promisify(execFile);

/**
 * Detección y eliminación de apps de la Microsoft Store (bloatware).
 *
 * - Sólo para el USUARIO ACTUAL (Get-AppxPackage / Remove-AppxPackage sin
 *   -AllUsers): no pide permisos de administrador y todo se puede reinstalar
 *   desde la Store.
 * - Los nombres se validan contra la lista permitida ANTES de armar el script,
 *   y el patrón no admite comillas: no hay forma de inyectar comandos.
 */

export type RemovalStatus = 'removed' | 'not_installed' | 'failed';

export interface PackageRemovalResult {
  status: RemovalStatus;
  message?: string;
}

/** paquete pedido (puede tener comodín) → nombres reales instalados */
export type InstalledMap = Record<string, string[]>;

export type PowerShellRunner = (script: string, timeoutMs: number) => Promise<string>;

const defaultRunner: PowerShellRunner = async (script, timeoutMs) => {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { timeout: timeoutMs, maxBuffer: 5 * 1024 * 1024, windowsHide: true },
  );
  return stdout;
};

function namesLiteral(names: string[]): string {
  for (const name of names) {
    if (!isAllowedPackage(name)) {
      throw new Error(`Paquete no permitido: ${name}`);
    }
  }
  return `@(${names.map((name) => `'${name}'`).join(', ')})`;
}

const SCRIPT_HEADER = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = 'SilentlyContinue'`;

export function buildDetectScript(names: string[]): string {
  return `${SCRIPT_HEADER}
$result = @{}
foreach ($n in ${namesLiteral(names)}) {
  $result[$n] = @(Get-AppxPackage -Name $n -ErrorAction SilentlyContinue | ForEach-Object { $_.Name } | Sort-Object -Unique)
}
ConvertTo-Json -InputObject $result -Compress -Depth 3`;
}

export function buildRemoveScript(names: string[]): string {
  return `${SCRIPT_HEADER}
$result = @{}
foreach ($n in ${namesLiteral(names)}) {
  $pkgs = @(Get-AppxPackage -Name $n -ErrorAction SilentlyContinue)
  if ($pkgs.Count -eq 0) { $result[$n] = @{ status = 'not_installed' }; continue }
  try {
    foreach ($p in $pkgs) {
      if ($p.NonRemovable) { throw 'Windows marca esta app como parte del sistema y no permite quitarla.' }
      Remove-AppxPackage -Package $p.PackageFullName -ErrorAction Stop
    }
    $result[$n] = @{ status = 'removed' }
  } catch {
    $result[$n] = @{ status = 'failed'; message = [string]$_.Exception.Message }
  }
}
ConvertTo-Json -InputObject $result -Compress -Depth 3`;
}

function parseJsonObject(stdout: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(stdout.trim() || '{}');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Respuesta inesperada de PowerShell');
  }
  return parsed as Record<string, unknown>;
}

/** PowerShell 5.1 a veces convierte una lista de un elemento en texto suelto. */
export function parseDetectOutput(stdout: string, names: string[]): InstalledMap {
  const raw = parseJsonObject(stdout);
  const installed: InstalledMap = {};
  for (const name of names) {
    const value = raw[name];
    const list = Array.isArray(value) ? value : value ? [value] : [];
    installed[name] = list.filter((item): item is string => typeof item === 'string');
  }
  return installed;
}

export function parseRemoveOutput(stdout: string, names: string[]): Record<string, PackageRemovalResult> {
  const raw = parseJsonObject(stdout);
  const results: Record<string, PackageRemovalResult> = {};
  for (const name of names) {
    const entry = raw[name] as { status?: unknown; message?: unknown } | undefined;
    const status = entry?.status;
    if (status === 'removed' || status === 'not_installed') {
      results[name] = { status };
    } else {
      const message = typeof entry?.message === 'string' ? entry.message.trim().slice(0, 300) : '';
      results[name] = { status: 'failed', message: message || 'Windows no informó el motivo.' };
    }
  }
  return results;
}

export async function detectPackages(names: string[], run: PowerShellRunner = defaultRunner): Promise<InstalledMap> {
  if (names.length === 0) {
    return {};
  }
  return parseDetectOutput(await run(buildDetectScript(names), 30_000), names);
}

export async function removePackages(
  names: string[],
  run: PowerShellRunner = defaultRunner,
): Promise<Record<string, PackageRemovalResult>> {
  if (names.length === 0) {
    return {};
  }
  // Quitar varias apps puede tardar: hasta 5 minutos en total.
  return parseRemoveOutput(await run(buildRemoveScript(names), 5 * 60_000), names);
}
