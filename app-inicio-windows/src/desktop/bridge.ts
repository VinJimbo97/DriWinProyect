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

export interface DriwinDesktopBridge {
  detectApps(wingetIds: string[]): Promise<AppDetection>;
  installApp(wingetId: string): Promise<AppInstallResult>;
  openOfficialPage(url: string): Promise<void>;
  detectBloatware(packageNames: string[]): Promise<BloatwareDetection>;
  removeBloatware(packageNames: string[]): Promise<Record<string, PackageRemovalResult>>;
  scanHardware(): Promise<{ os_environment: OsEnvironment; devices: RawPnpDevice[] }>;
  installDriver(request: DriverInstallRequest): Promise<DriverInstallResult>;
  /** Devuelve la función que cancela la suscripción. */
  onDriverInstallProgress(listener: (progress: DriverInstallProgress) => void): () => void;
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
