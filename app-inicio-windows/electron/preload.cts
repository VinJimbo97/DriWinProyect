import { contextBridge, ipcRenderer } from 'electron';

/**
 * PUENTE entre la interfaz React y el proceso principal.
 * Expone en `window.driwin` SÓLO estas funciones; React no puede ejecutar
 * PowerShell ni leer archivos por su cuenta. El contrato que ve React está en
 * src/desktop/bridge.ts y debe coincidir con este objeto.
 */
contextBridge.exposeInMainWorld('driwin', {
  scanHardware: () => ipcRenderer.invoke('hardware:scan'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
});
