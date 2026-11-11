import type { OsEnvironment } from '../api/types';
import type { RawPnpDevice } from '../scanner/types';

/**
 * Funciones que el .exe (Electron) expone en `window.driwin` desde
 * electron/preload.cts. En el navegador (npm run dev) no existe.
 */
export interface DriverInstallRequest {
  driverId: number;
  downloadUrl: string;
  sha256: string | null;
}

export type DriverInstallResult =
  | { ok: true; rebootRequired: boolean }
  | { ok: false; code: string; message: string };

export interface DriverInstallProgress {
  driverId: number;
  stage: 'downloading' | 'verifying' | 'installing';
  percent: number | null;
}

/** Resultado de buscar bloatware (electron/bloatwareCleaner.ts). */
export interface BloatwareDetection {
  /** paquete pedido → nombres reales instalados (vacío = no está) */
  installed: Record<string, string[]>;
  /** paquetes que esta versión de la app no permite tocar */
  unsupported: string[];
}

export interface PackageRemovalResult {
  status: 'removed' | 'not_installed' | 'failed';
  message?: string;
}

/** Resultado de buscar apps con winget (electron/appInstaller.ts). `null` = no se pudo comprobar. */
export interface AppDetection {
  installed: Record<string, boolean | null>;
  /** ids que esta versión de la app no permite instalar */
  unsupported: string[];
}

export type AppInstallResult =
  | { ok: true; alreadyInstalled: boolean; rebootRequired: boolean }
  | { ok: false; code: string; message: string };

/** Funciones Premium (electron/restorePoint.ts, installQueue.ts, driverBackup.ts, ghostDevices.ts). */
export interface RestorePointResult {
  ok: boolean;
  status: 'created' | 'recent' | 'disabled' | 'denied' | 'failed';
  message: string;
}

export interface QueueRequest {
  drivers: DriverInstallRequest[];
  apps: string[];
}

export type QueueItemStatus = 'pending' | 'downloading' | 'verifying' | 'ready' | 'installing' | 'done' | 'failed';

export interface QueueItem {
  kind: 'driver' | 'app';
  id: string;
  status: QueueItemStatus;
  percent: number | null;
  message?: string;
  rebootRequired?: boolean;
}

export type DriverBackupResult =
  | { ok: true; folder: string; driverCount: number }
  | { ok: false; code: string; message: string };

export interface GhostDevice {
  instanceId: string;
  name: string;
  deviceClass: string;
}

export type GhostRemovalResult =
  | { ok: true; removed: number; failed: number }
  | { ok: false; code: string; message: string };

export type SaveExportResult =
  | { ok: true; path: string }
  | { ok: false; code: 'CANCELLED' | 'INVALID_CONTENT'; message: string };

export interface DriwinDesktopBridge {
  createRestorePoint(): Promise<RestorePointResult>;
  installQueue(request: QueueRequest): Promise<QueueItem[]>;
  /** Devuelve la función que cancela la suscripción. */
  onQueueProgress(listener: (items: QueueItem[]) => void): () => void;
  getBackupDefaultFolder(): Promise<string>;
  /** null si la persona cerró el diálogo sin elegir. */
  chooseBackupFolder(): Promise<string | null>;
  backupDrivers(folder: string): Promise<DriverBackupResult>;
  openBackupFolder(): Promise<void>;
  detectGhostDevices(): Promise<GhostDevice[]>;
  removeGhostDevices(instanceIds: string[]): Promise<GhostRemovalResult>;
  detectApps(wingetIds: string[]): Promise<AppDetection>;
  installApp(wingetId: string): Promise<AppInstallResult>;
  openOfficialPage(url: string): Promise<void>;
  detectBloatware(packageNames: string[]): Promise<BloatwareDetection>;
  removeBloatware(packageNames: string[]): Promise<Record<string, PackageRemovalResult>>;
  scanHardware(): Promise<{ os_environment: OsEnvironment; devices: RawPnpDevice[] }>;
  installDriver(request: DriverInstallRequest): Promise<DriverInstallResult>;
  /** Devuelve la función que cancela la suscripción. */
  onDriverInstallProgress(listener: (progress: DriverInstallProgress) => void): () => void;
  /** Identificador aleatorio de este equipo (para el límite de 3 equipos). */
  getDeviceId(): Promise<string>;
  /** Sesión de la cuenta guardada cifrada con DPAPI; null si no hay. */
  loadSession(): Promise<string | null>;
  /** Devuelve false si Windows no permite cifrar (la sesión dura sólo esta vez). */
  saveSession(token: string): Promise<boolean>;
  clearSession(): Promise<void>;
  /** "Descargar mis datos": abre el diálogo de Guardar y escribe el JSON. */
  saveAccountExport(content: string): Promise<SaveExportResult>;
  minimizeWindow(): void;
  toggleMaximizeWindow(): void;
  closeWindow(): void;
}

declare global {
  interface Window {
    driwin?: DriwinDesktopBridge;
  }
}

/** Puente de escritorio, o `undefined` si la app corre en un navegador. */
export const desktop: DriwinDesktopBridge | undefined = window.driwin;
