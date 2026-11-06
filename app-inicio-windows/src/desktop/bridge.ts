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
  silentFlags: string;
}

export type DriverInstallResult =
  | { ok: true; rebootRequired: boolean }
  | { ok: false; code: string; message: string };

export interface DriverInstallProgress {
  driverId: number;
  stage: 'downloading' | 'verifying' | 'installing';
  percent: number | null;
}

export interface DriwinDesktopBridge {
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
