import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { isAllowedWingetId } from './appPolicy.js';
import { buildInstallArgs, interpretInstallCode, WINGET_NOT_FOUND } from './appInstaller.js';
import {
  downloadAndVerify,
  failureFromError,
  interpretDriverExitCode,
  verifySignature,
} from './driverInstaller.js';
import { dataPrelude, EXIT_UAC_DENIED, runElevatedScript, type ElevatedRunner } from './elevated.js';
import { validateInstallRequest, type DriverInstallRequest } from './installerPolicy.js';

/**
 * "Instalar todo" (Premium): drivers y apps en cola con UN SOLO permiso de
 * administrador.
 *
 * 1. DriWin descarga cada driver y revisa su huella SHA-256 y su firma digital
 *    (igual que la instalación de a uno). Lo que no pase se marca como fallido.
 * 2. Un único script elevado abre los instaladores UNO TRAS OTRO, sin
 *    argumentos silenciosos: la persona ve cada asistente y sus términos, pero
 *    Windows pide permiso una sola vez. Las apps se instalan con winget.
 * 3. El script anota cada inicio y término en un archivo de resultados que
 *    DriWin lee cada segundo para mostrar el avance.
 */

export type QueueItemStatus =
  | 'pending'
  | 'downloading'
  | 'verifying'
  | 'ready'
  | 'installing'
  | 'done'
  | 'failed';

export interface QueueItem {
  kind: 'driver' | 'app';
  /** driverId o id de winget. */
  id: string;
  status: QueueItemStatus;
  percent: number | null;
  message?: string;
  rebootRequired?: boolean;
}

export interface QueueRequest {
  drivers: DriverInstallRequest[];
  apps: string[];
}

const MAX_DRIVERS = 20;
const MAX_APPS = 40;
/** La persona puede tardar en leer los términos de cada asistente. */
const QUEUE_TIMEOUT_MS = 6 * 60 * 60_000;
const POLL_MS = 1000;

/** Valida la forma de la petición. null = no es una petición de cola válida. */
export function parseQueueRequest(raw: unknown): QueueRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const { drivers, apps } = raw as Record<string, unknown>;
  if (!Array.isArray(drivers) || !Array.isArray(apps)) return null;
  if (drivers.length > MAX_DRIVERS || apps.length > MAX_APPS || drivers.length + apps.length === 0) return null;
  const validDriver = (value: unknown): value is DriverInstallRequest => {
    if (!value || typeof value !== 'object') return false;
    const d = value as Record<string, unknown>;
    return (
      Number.isInteger(d.driverId) &&
      typeof d.downloadUrl === 'string' &&
      (d.sha256 === null || typeof d.sha256 === 'string')
    );
  };
  if (!drivers.every(validDriver) || !apps.every((id) => typeof id === 'string')) return null;
  return { drivers: drivers as DriverInstallRequest[], apps: [...new Set(apps as string[])] };
}

export function buildQueueScript(
  drivers: { id: string; path: string }[],
  apps: { id: string; args: string[] }[],
  resultsPath: string,
): string {
  return `
${dataPrelude({ drivers, apps, results: resultsPath })}
function Write-Event($event, $kind, $id, $code) {
  $line = @{ event = $event; kind = $kind; id = [string]$id; code = $code } | ConvertTo-Json -Compress
  Add-Content -LiteralPath $data.results -Value $line -Encoding UTF8
}
foreach ($d in @($data.drivers)) {
  Write-Event 'start' 'driver' $d.id 0
  try {
    $p = Start-Process -FilePath $d.path -PassThru -Wait
    $code = if ($null -eq $p.ExitCode) { 259 } else { [int64]$p.ExitCode }
  } catch { $code = 1 }
  Write-Event 'end' 'driver' $d.id $code
}
$winget = (Get-Command winget.exe -ErrorAction SilentlyContinue).Source
foreach ($a in @($data.apps)) {
  Write-Event 'start' 'app' $a.id 0
  if (-not $winget) { $code = -1 }
  else {
    try { & $winget @($a.args) | Out-Null; $code = [int64]$LASTEXITCODE } catch { $code = 1 }
  }
  Write-Event 'end' 'app' $a.id $code
}
exit 0
`;
}

interface QueueEvent {
  event: 'start' | 'end';
  kind: 'driver' | 'app';
  id: string;
  code: number;
}

export function parseResults(text: string): QueueEvent[] {
  const events: QueueEvent[] = [];
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as Partial<QueueEvent>;
      if ((parsed.event === 'start' || parsed.event === 'end') && (parsed.kind === 'driver' || parsed.kind === 'app')) {
        events.push({ event: parsed.event, kind: parsed.kind, id: String(parsed.id), code: Number(parsed.code) });
      }
    } catch {
      /* línea a medio escribir: se lee en la siguiente vuelta */
    }
  }
  return events;
}

/** Aplica los eventos del script elevado al estado de la cola. */
export function applyEvents(items: QueueItem[], events: QueueEvent[]): QueueItem[] {
  const next = items.map((item) => ({ ...item }));
  for (const event of events) {
    const item = next.find((candidate) => candidate.kind === event.kind && candidate.id === event.id);
    if (!item || (item.status === 'failed' && event.event === 'start')) continue;
    if (event.event === 'start') {
      item.status = 'installing';
      continue;
    }
    const result =
      event.kind === 'driver'
        ? interpretDriverExitCode(event.code)
        : interpretInstallCode(event.code === -1 ? WINGET_NOT_FOUND : event.code >>> 0);
    item.status = result.ok ? 'done' : 'failed';
    item.message = result.ok ? undefined : result.message;
    item.rebootRequired = result.ok ? result.rebootRequired : undefined;
  }
  return next;
}

export interface QueueDeps {
  download: typeof downloadAndVerify;
  verify: typeof verifySignature;
  runElevated?: ElevatedRunner;
  readText: (file: string) => Promise<string>;
}

const REAL_DEPS: QueueDeps = {
  download: downloadAndVerify,
  verify: verifySignature,
  readText: (file) => readFile(file, 'utf8'),
};

export async function runInstallQueue(
  request: QueueRequest,
  workDir: string,
  onProgress: (items: QueueItem[]) => void,
  deps: QueueDeps = REAL_DEPS,
): Promise<QueueItem[]> {
  let items: QueueItem[] = [
    ...request.drivers.map((d): QueueItem => ({ kind: 'driver', id: String(d.driverId), status: 'pending', percent: null })),
    ...request.apps.map((id): QueueItem => ({ kind: 'app', id, status: 'pending', percent: null })),
  ];
  const update = (id: string, kind: QueueItem['kind'], patch: Partial<QueueItem>) => {
    items = items.map((item) => (item.id === id && item.kind === kind ? { ...item, ...patch } : item));
    onProgress(items);
  };
  onProgress(items);

  await mkdir(workDir, { recursive: true });
  const resultsPath = path.join(workDir, 'cola-resultados.jsonl');
  const files: string[] = [];

  try {
    // 1. Descargar y verificar cada driver.
    const readyDrivers: { id: string; path: string }[] = [];
    for (const driver of request.drivers) {
      const id = String(driver.driverId);
      const violation = validateInstallRequest(driver);
      if (violation) {
        update(id, 'driver', {
          status: 'failed',
          message: violation === 'NOT_VERIFIED'
            ? 'Este driver aún no tiene una huella de seguridad registrada, así que no se instalará.'
            : 'El origen de este driver no está autorizado.',
        });
        continue;
      }
      const filePath = path.join(workDir, `cola-driver-${driver.driverId}.exe`);
      files.push(filePath);
      try {
        update(id, 'driver', { status: 'downloading', percent: null });
        await deps.download(driver.downloadUrl, driver.sha256 as string, filePath, (percent) =>
          update(id, 'driver', { percent }),
        );
        update(id, 'driver', { status: 'verifying', percent: null });
        await deps.verify(filePath);
        update(id, 'driver', { status: 'ready' });
        readyDrivers.push({ id, path: filePath });
      } catch (error) {
        const failure = failureFromError(error);
        update(id, 'driver', { status: 'failed', message: failure.ok ? undefined : failure.message });
      }
    }

    // Apps: sólo ids de la lista permitida.
    const readyApps: { id: string; args: string[] }[] = [];
    for (const id of request.apps) {
      if (isAllowedWingetId(id)) {
        update(id, 'app', { status: 'ready' });
        readyApps.push({ id, args: buildInstallArgs(id) });
      } else {
        update(id, 'app', { status: 'failed', message: 'Esta versión de DriWin no permite instalar esa app.' });
      }
    }

    if (readyDrivers.length + readyApps.length === 0) {
      return items;
    }

    // 2. Un solo permiso de administrador para toda la cola.
    await rm(resultsPath, { force: true });
    const baseItems = items;
    const poll = async () => {
      const text = await deps.readText(resultsPath).catch(() => '');
      const next = applyEvents(baseItems, parseResults(text));
      if (JSON.stringify(next) !== JSON.stringify(items)) {
        items = next;
        onProgress(items);
      }
    };
    const timer = setInterval(() => void poll(), POLL_MS);
    let exitCode: number;
    try {
      exitCode = await runElevatedScript(buildQueueScript(readyDrivers, readyApps, resultsPath), QUEUE_TIMEOUT_MS, deps.runElevated);
    } finally {
      clearInterval(timer);
    }
    await poll();

    if (exitCode === EXIT_UAC_DENIED) {
      items = items.map((item) =>
        item.status === 'ready'
          ? { ...item, status: 'failed', message: 'Cancelaste el permiso de administrador, así que no se instaló.' }
          : item,
      );
    } else {
      // Lo que quedó listo o "instalando" sin resultado no se confirmó.
      items = items.map((item) =>
        item.status === 'ready' || item.status === 'installing'
          ? { ...item, status: 'failed', message: 'No se recibió el resultado de esta instalación.' }
          : item,
      );
    }
    onProgress(items);
    return items;
  } finally {
    await Promise.all([...files, resultsPath].map((file) => rm(file, { force: true }).catch(() => {})));
  }
}
