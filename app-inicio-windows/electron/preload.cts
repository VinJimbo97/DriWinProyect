import { contextBridge, ipcRenderer } from 'electron';

/**
 * PUENTE entre la interfaz React y el proceso principal.
 * Expone en `window.driwin` SÓLO estas funciones; React no puede ejecutar
 * PowerShell ni leer archivos por su cuenta. El contrato que ve React está en
 * src/desktop/bridge.ts y debe coincidir con este objeto.
 */
contextBridge.exposeInMainWorld('driwin', {
  scanHardware: () => ipcRenderer.invoke('hardware:scan'),
  installDriver: (request: unknown) => ipcRenderer.invoke('driver:install', request),
  onDriverInstallProgress: (listener: (progress: unknown) => void) => {
    const handler = (_event: unknown, progress: unknown) => listener(progress);
    ipcRenderer.on('driver:progress', handler);
    return () => ipcRenderer.removeListener('driver:progress', handler);
  },
  detectBloatware: (packageNames: unknown) => ipcRenderer.invoke('bloatware:detect', packageNames),
  removeBloatware: (packageNames: unknown) => ipcRenderer.invoke('bloatware:remove', packageNames),
  detectApps: (wingetIds: unknown) => ipcRenderer.invoke('apps:detect', wingetIds),
  installApp: (wingetId: unknown) => ipcRenderer.invoke('apps:install', wingetId),
  openOfficialPage: (url: unknown) => ipcRenderer.invoke('apps:open-official', url),
  createRestorePoint: () => ipcRenderer.invoke('premium:restore-point'),
  installQueue: (request: unknown) => ipcRenderer.invoke('premium:install-queue', request),
  onQueueProgress: (listener: (items: unknown) => void) => {
    const handler = (_event: unknown, items: unknown) => listener(items);
    ipcRenderer.on('queue:progress', handler);
    return () => ipcRenderer.removeListener('queue:progress', handler);
  },
  getBackupDefaultFolder: () => ipcRenderer.invoke('premium:backup-default-folder'),
  chooseBackupFolder: () => ipcRenderer.invoke('premium:backup-choose-folder'),
  backupDrivers: (folder: unknown) => ipcRenderer.invoke('premium:backup-drivers', folder),
  openBackupFolder: () => ipcRenderer.invoke('premium:open-backup-folder'),
  detectGhostDevices: () => ipcRenderer.invoke('premium:ghost-detect'),
  removeGhostDevices: (instanceIds: unknown) => ipcRenderer.invoke('premium:ghost-remove', instanceIds),
  getDeviceId: () => ipcRenderer.invoke('account:device-id'),
  loadSession: () => ipcRenderer.invoke('account:load-session'),
  saveSession: (token: unknown) => ipcRenderer.invoke('account:save-session', token),
  clearSession: () => ipcRenderer.invoke('account:clear-session'),
  saveAccountExport: (content: unknown) => ipcRenderer.invoke('account:save-export', content),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
});
