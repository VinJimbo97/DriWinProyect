import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Mismo formato que src/scanner/types.ts → RawPnpDevice (lo consume parsePnpDevice). */
export interface RawPnpDevice {
  instance_id: string;
  friendly_name: string;
  device_class: string;
  driver_version: string;
}

export interface NativeScanResult {
  os_environment: 'Win11_x64' | 'Win10_x64';
  devices: RawPnpDevice[];
}

/**
 * Consulta FIJA (no recibe nada del usuario → no hay inyección de comandos).
 * Win32_PnPSignedDriver entrega en una sola llamada el Instance ID, el nombre,
 * la clase y la versión del driver instalado. Clases: GPU, red, audio, Bluetooth.
 */
const POWERSHELL_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$classes = 'DISPLAY','NET','MEDIA','BLUETOOTH'
$devices = @(Get-CimInstance Win32_PnPSignedDriver |
  Where-Object { $_.DeviceID -and $classes -contains $_.DeviceClass } |
  Select-Object DeviceID, DeviceName, DeviceClass, DriverVersion)
ConvertTo-Json -InputObject $devices -Compress -Depth 2
`;

interface CimDriverRow {
  DeviceID: string | null;
  DeviceName: string | null;
  DeviceClass: string | null;
  DriverVersion: string | null;
}

/** Windows 11 = build 22000 o superior (os.release() → "10.0.26200"). */
function detectOsEnvironment(): NativeScanResult['os_environment'] {
  const build = Number(os.release().split('.')[2] ?? 0);
  return build >= 22000 ? 'Win11_x64' : 'Win10_x64';
}

export async function scanHardware(): Promise<NativeScanResult> {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', POWERSHELL_SCRIPT],
    { timeout: 20_000, maxBuffer: 5 * 1024 * 1024, windowsHide: true },
  );

  const rows = JSON.parse(stdout.trim() || '[]') as CimDriverRow[];
  const seen = new Set<string>();
  const devices: RawPnpDevice[] = [];

  for (const row of rows) {
    if (!row.DeviceID || seen.has(row.DeviceID)) {
      continue;
    }
    seen.add(row.DeviceID);
    devices.push({
      instance_id: row.DeviceID,
      friendly_name: row.DeviceName ?? 'Dispositivo desconocido',
      device_class: row.DeviceClass ?? 'Desconocida',
      driver_version: row.DriverVersion ?? '—',
    });
  }

  return { os_environment: detectOsEnvironment(), devices };
}
