import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, ipcMain, net, protocol, safeStorage, shell, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { detectApps, installApp } from './appInstaller.js';
import { isAllowedOfficialPage, splitRequestedIds } from './appPolicy.js';
import { detectPackages, removePackages } from './bloatwareCleaner.js';
import { splitRequestedPackages } from './bloatwarePolicy.js';
import { installDriver } from './driverInstaller.js';
import { scanHardware } from './hardwareScanner.js';
import { clearSession, loadDeviceId, loadSession, saveSession } from './sessionStore.js';
import type { DriverInstallRequest } from './installerPolicy.js';

/**
 * Proceso PRINCIPAL de Electron: crea la ventana y es el único con acceso a
 * Windows (PowerShell, archivos). La interfaz React corre aislada y sólo puede
 * pedirle cosas a través de los canales IPC que se registran aquí.
 *
 *   React (renderer) ──window.driwin──▶ preload.cts ──IPC──▶ main.ts ──▶ PowerShell
 */

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.argv.includes('--dev');

/** En desarrollo se usa el servidor de Vite (recarga en caliente). */
const DEV_SERVER_URL = 'http://localhost:5173';

/**
 * En producción la interfaz se sirve desde el protocolo propio app://driwin
 * (no desde file://). Así el navegador envía "Origin: app://driwin", que el
 * backend puede autorizar en ALLOWED_ORIGINS (CORS).
 */
const APP_SCHEME = 'app';
const APP_ORIGIN = `${APP_SCHEME}://driwin`;

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

function serveRendererFiles(): void {
  const rendererDir = path.join(app.getAppPath(), 'dist');

  protocol.handle(APP_SCHEME, (request) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const filePath = path.normalize(path.join(rendererDir, pathname === '/' ? 'index.html' : pathname));

    // Nunca servir archivos fuera de dist/ (ej. app://driwin/../../secreto).
    if (!filePath.startsWith(rendererDir + path.sep)) {
      return new Response('No encontrado', { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

/**
 * Sólo nuestra propia interfaz puede usar los canales IPC.
 * Ojo: para protocolos propios `new URL('app://driwin/').origin` es "null",
 * por eso se comparan protocolo y host por separado.
 */
function isTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  if (!event.senderFrame) {
    return false;
  }
  const url = new URL(event.senderFrame.url);
  if (url.protocol === `${APP_SCHEME}:` && url.host === 'driwin') {
    return true;
  }
  return isDev && url.origin === DEV_SERVER_URL;
}

/** Un instalador a la vez: Windows no admite instalar varios drivers en paralelo. */
let installInProgress = false;

/** Una limpieza de bloatware a la vez. */
let cleanupInProgress = false;

/** Una app a la vez: winget no admite dos instalaciones en paralelo. */
let appInstallInProgress = false;

function registerIpcHandlers(): void {
  ipcMain.handle('hardware:scan', (event) => {
    if (!isTrustedSender(event)) {
      throw new Error('Origen no autorizado');
    }
    return scanHardware();
  });

  ipcMain.handle('driver:install', async (event, request: DriverInstallRequest) => {
    if (!isTrustedSender(event)) {
      throw new Error('Origen no autorizado');
    }
    if (installInProgress) {
      throw new Error('Ya hay una instalación en curso');
    }
    installInProgress = true;
    try {
      const workDir = path.join(app.getPath('userData'), 'instaladores');
      return await installDriver(request, workDir, (progress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('driver:progress', progress);
        }
      });
    } finally {
      installInProgress = false;
    }
  });

  // Detección: lo que no está en la lista permitida se informa como no soportado.
  ipcMain.handle('bloatware:detect', async (event, packageNames: unknown) => {
    if (!isTrustedSender(event)) {
      throw new Error('Origen no autorizado');
    }
    const split = splitRequestedPackages(packageNames);
    if (!split) {
      throw new Error('Petición de detección inválida');
    }
    return { installed: await detectPackages(split.allowed), unsupported: split.rejected };
  });

  // Eliminación: si UN solo paquete no está permitido, no se elimina nada.
  ipcMain.handle('bloatware:remove', async (event, packageNames: unknown) => {
    if (!isTrustedSender(event)) {
      throw new Error('Origen no autorizado');
    }
    const split = splitRequestedPackages(packageNames);
    if (!split || split.rejected.length > 0) {
      throw new Error('La limpieza incluye apps que esta versión de DriWin no permite quitar');
    }
    if (cleanupInProgress) {
      throw new Error('Ya hay una limpieza en curso');
    }
    cleanupInProgress = true;
    try {
      return await removePackages(split.allowed);
    } finally {
      cleanupInProgress = false;
    }
  });

  // Apps: sólo ids de la lista permitida; lo demás se informa como no soportado.
  ipcMain.handle('apps:detect', async (event, wingetIds: unknown) => {
    if (!isTrustedSender(event)) {
      throw new Error('Origen no autorizado');
    }
    const split = splitRequestedIds(wingetIds);
    if (!split) {
      throw new Error('Petición de detección inválida');
    }
    return { installed: await detectApps(split.allowed), unsupported: split.rejected };
  });

  ipcMain.handle('apps:install', async (event, wingetId: unknown) => {
    if (!isTrustedSender(event)) {
      throw new Error('Origen no autorizado');
    }
    if (appInstallInProgress) {
      throw new Error('Ya hay una instalación de app en curso');
    }
    appInstallInProgress = true;
    try {
      return await installApp(wingetId);
    } finally {
      appInstallInProgress = false;
    }
  });

  // Apps sin winget: se abre su página oficial en el navegador, nunca otra.
  ipcMain.handle('apps:open-official', async (event, url: unknown) => {
    if (!isTrustedSender(event) || !isAllowedOfficialPage(url)) {
      throw new Error('Página no autorizada');
    }
    await shell.openExternal(url);
  });

  // Cuenta DriWin: identificador aleatorio del equipo y sesión cifrada con DPAPI.
  const accountDir = () => path.join(app.getPath('userData'), 'cuenta');

  ipcMain.handle('account:device-id', (event) => {
    if (!isTrustedSender(event)) {
      throw new Error('Origen no autorizado');
    }
    return loadDeviceId(accountDir());
  });

  ipcMain.handle('account:load-session', (event) => {
    if (!isTrustedSender(event)) {
      throw new Error('Origen no autorizado');
    }
    return loadSession(accountDir(), safeStorage);
  });

  ipcMain.handle('account:save-session', (event, token: unknown) => {
    if (!isTrustedSender(event)) {
      throw new Error('Origen no autorizado');
    }
    return saveSession(accountDir(), token, safeStorage);
  });

  ipcMain.handle('account:clear-session', (event) => {
    if (!isTrustedSender(event)) {
      throw new Error('Origen no autorizado');
    }
    return clearSession(accountDir());
  });

  ipcMain.on('window:minimize', (event) => {
    if (isTrustedSender(event)) {
      BrowserWindow.fromWebContents(event.sender)?.minimize();
    }
  });

  ipcMain.on('window:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (isTrustedSender(event) && window) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  });

  ipcMain.on('window:close', (event) => {
    if (isTrustedSender(event)) {
      BrowserWindow.fromWebContents(event.sender)?.close();
    }
  });
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    // Sin marco de Windows: la app ya dibuja su barra con ─ □ ✕.
    frame: false,
    backgroundColor: '#222831',
    title: 'DriWin',
    // Logo DW en la barra de tareas. En desarrollo viene de public/; empaquetado,
    // Vite ya lo copió a dist/ (y el .exe además lo lleva incrustado).
    icon: path.join(app.getAppPath(), isDev ? 'public' : 'dist', 'icon.ico'),
    webPreferences: {
      preload: path.join(currentDir, 'preload.cjs'),
      // Aislamiento: React NO tiene acceso a Node ni a Windows directamente.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Bloquear ventanas emergentes y navegación a sitios externos.
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(isDev ? DEV_SERVER_URL : APP_ORIGIN)) {
      event.preventDefault();
    }
  });

  if (isDev) {
    loadDevServer(window);
  } else {
    void window.loadURL(`${APP_ORIGIN}/`);
  }
}

/** Página de aviso mientras el servidor de Vite no responde. */
const WAITING_FOR_VITE_HTML = `
<body style="background:#222831;color:#EEEEEE;font-family:Segoe UI,sans-serif;padding:40px">
  <h2 style="color:#00ADB5">Esperando el servidor de la interfaz (Vite)...</h2>
  <p>El modo desarrollo carga la interfaz desde ${DEV_SERVER_URL}, pero no responde.</p>
  <p>Abre <b>otra terminal</b> y ejecuta:</p>
  <pre style="background:#393E46;padding:12px;border-radius:6px">cd app-inicio-windows\nnpm run dev</pre>
  <p style="opacity:.7">Esta ventana se conectará sola apenas Vite esté listo.</p>
</body>`;

/**
 * Modo desarrollo: intenta cargar Vite; si no está corriendo, muestra el aviso
 * y reintenta cada 2 s, en vez de dejar la ventana en negro.
 */
function loadDevServer(window: BrowserWindow): void {
  window.loadURL(DEV_SERVER_URL).catch(() => {
    if (window.isDestroyed()) {
      return;
    }
    void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(WAITING_FOR_VITE_HTML)}`);
    setTimeout(() => {
      if (!window.isDestroyed()) {
        loadDevServer(window);
      }
    }, 2000);
  });
}

app.whenReady().then(() => {
  serveRendererFiles();
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});
