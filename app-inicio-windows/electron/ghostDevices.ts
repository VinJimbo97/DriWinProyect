import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dataPrelude, EXIT_UAC_DENIED, runElevatedScript, type ElevatedRunner } from './elevated.js';

const execFileAsync = promisify(execFile);

/**
 * Dispositivos desconectados (Premium): Windows guarda los dispositivos que
 * alguna vez se conectaron (pendrives, mouse, audífonos Bluetooth, monitores)
 * aunque ya no estén. Quitarlos ordena el Administrador de dispositivos; si
 * se vuelven a conectar, Windows los reconoce de nuevo.
 *
 * Seguridad:
 *  - Sólo se ofrecen clases de dispositivos externos o reemplazables (lista
 *    permitida). Nunca dispositivos de sistema, procesador, discos de Windows
 *    ni dispositivos "de software" (SWD\, ROOT\).
 *  - Sólo se quitan ids que DriWin detectó en la última revisión.
 *  - Se usa `pnputil /remove-device` (herramienta oficial de Windows).
 */

export interface GhostDevice {
  instanceId: string;
  name: string;
  deviceClass: string;
}

/** Clases que se pueden quitar sin riesgo (en minúsculas). */
export const REMOVABLE_CLASSES: ReadonlySet<string> = new Set([
  'usb',
  'usbdevice',
  'hidclass',
  'mouse',
  'keyboard',
  'bluetooth',
  'net',
  'monitor',
  'diskdrive',
  'wpd',
  'image',
  'camera',
  'media',
  'audioendpoint',
  'ports',
  'printer',
  'smartcardreader',
]);

/**
 * Componentes de Windows, aunque estén en una clase permitida: nunca se ofrecen.
 * SWD\ y SW\ = dispositivos de software; BTH\MS_ = enumeradores Bluetooth de
 * Microsoft; DISPLAY\DEFAULT_MONITOR = monitor genérico o integrado.
 */
const BLOCKED_PREFIXES = ['SWD\\', 'SW\\', 'ROOT\\', 'HTREE\\', 'ACPI\\', 'BTH\\MS_', 'DISPLAY\\DEFAULT_MONITOR'];
// Rechaza a propósito caracteres de control y símbolos de PowerShell.
// eslint-disable-next-line no-control-regex
const INSTANCE_ID_PATTERN = /^[A-Za-z0-9][^\u0000-\u001f"'`$;|<>]{2,299}$/;
const MAX_REMOVE = 100;

export function isSafeGhost(device: GhostDevice): boolean {
  const id = device.instanceId.toUpperCase();
  return (
    INSTANCE_ID_PATTERN.test(device.instanceId) &&
    REMOVABLE_CLASSES.has(device.deviceClass.toLowerCase()) &&
    !BLOCKED_PREFIXES.some((prefix) => id.startsWith(prefix))
  );
}

export const DETECT_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ProgressPreference = 'SilentlyContinue'
$list = @(Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object { $_.Present -eq $false } |
  ForEach-Object { @{ instanceId = [string]$_.InstanceId; name = [string]$_.FriendlyName; deviceClass = [string]$_.Class } })
ConvertTo-Json -InputObject $list -Compress -Depth 3
`;

export function parseGhostOutput(stdout: string): GhostDevice[] {
  const text = stdout.trim();
  if (!text) {
    return [];
  }
  const parsed: unknown = JSON.parse(text);
  const items = Array.isArray(parsed) ? parsed : [parsed];
  const devices: GhostDevice[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const { instanceId, name, deviceClass } = item as Record<string, unknown>;
    if (typeof instanceId !== 'string' || typeof deviceClass !== 'string') continue;
    const device = {
      instanceId,
      name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 120) : instanceId.split('\\')[1] ?? instanceId,
      deviceClass,
    };
    if (isSafeGhost(device)) {
      devices.push(device);
    }
  }
  return devices.sort((a, b) => a.deviceClass.localeCompare(b.deviceClass) || a.name.localeCompare(b.name));
}

export type PowerShellRunner = (script: string, timeoutMs: number) => Promise<string>;

const defaultRunner: PowerShellRunner = async (script, timeoutMs) => {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { timeout: timeoutMs, maxBuffer: 5 * 1024 * 1024, windowsHide: true },
  );
  return stdout;
};

export async function detectGhostDevices(run: PowerShellRunner = defaultRunner): Promise<GhostDevice[]> {
  return parseGhostOutput(await run(DETECT_SCRIPT, 60_000));
}

export function buildRemoveScript(instanceIds: string[]): string {
  return `
${dataPrelude({ ids: instanceIds })}
$pnputil = Join-Path $env:SystemRoot 'System32\\pnputil.exe'
$failed = 0
foreach ($id in @($data.ids)) {
  & $pnputil /remove-device $id | Out-Null
  if ($LASTEXITCODE -ne 0) { $failed++ }
}
exit $failed
`;
}

export type GhostRemovalResult =
  | { ok: true; removed: number; failed: number }
  | { ok: false; code: 'NOT_ALLOWED' | 'UAC_DENIED' | 'FAILED'; message: string };

/**
 * Quita los dispositivos pedidos, sólo si TODOS están en la última detección.
 * Después vuelve a revisar para contar cuáles se quitaron de verdad.
 */
export async function removeGhostDevices(
  requested: unknown,
  lastDetected: GhostDevice[],
  run?: ElevatedRunner,
  redetect: () => Promise<GhostDevice[]> = () => detectGhostDevices(),
): Promise<GhostRemovalResult> {
  const allowed = new Set(lastDetected.map((device) => device.instanceId));
  if (
    !Array.isArray(requested) ||
    requested.length === 0 ||
    requested.length > MAX_REMOVE ||
    !requested.every((id) => typeof id === 'string' && allowed.has(id))
  ) {
    return { ok: false, code: 'NOT_ALLOWED', message: 'Esos dispositivos no están en la última revisión. Vuelve a revisar el equipo.' };
  }
  const ids = [...new Set(requested as string[])];
  let exitCode: number;
  try {
    exitCode = await runElevatedScript(buildRemoveScript(ids), 10 * 60_000, run);
  } catch {
    return { ok: false, code: 'FAILED', message: 'No se pudieron quitar los dispositivos.' };
  }
  if (exitCode === EXIT_UAC_DENIED) {
    return { ok: false, code: 'UAC_DENIED', message: 'Cancelaste el permiso de administrador, así que no se quitó nada.' };
  }
  const remaining = new Set((await redetect().catch(() => lastDetected)).map((device) => device.instanceId));
  const failed = ids.filter((id) => remaining.has(id)).length;
  return { ok: true, removed: ids.length - failed, failed };
}
