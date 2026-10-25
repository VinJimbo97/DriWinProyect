import type { OsEnvironment } from '../api/types';
import type { RawPnpDevice } from '../scanner/types';

/**
 * Funciones que el .exe (Electron) expone en `window.driwin` desde
 * electron/preload.cts. En el navegador (npm run dev) no existe.
 */
export interface DriwinDesktopBridge {
  scanHardware(): Promise<{ os_environment: OsEnvironment; devices: RawPnpDevice[] }>;
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
