/**
 * Convierte las figuras HTML de esta carpeta en imágenes (PNG y JPG) para el documento.
 * Usa el Electron que ya trae app-inicio-windows (no instala nada).
 *
 * Desde la raíz del repositorio (PowerShell):
 *   $env:ELECTRON_RUN_AS_NODE = $null
 *   app-inicio-windows\node_modules\.bin\electron docs\Hito2\figuras\capturar.cjs
 */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const FIGURAS = [
  { html: 'figura1-arquitectura.html', width: 1300, height: 860 },
  { html: 'figura2-modelo-datos.html', width: 1500, height: 970 },
];

// Sin esto, Electron cierra la app al destruir la primera ventana y las demás figuras no se generan.
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  for (const fig of FIGURAS) {
    const file = path.join(__dirname, fig.html);
    if (!fs.existsSync(file)) continue;
    const win = new BrowserWindow({
      show: false,
      frame: false,
      width: fig.width,
      height: fig.height,
      useContentSize: true,
      enableLargerThanScreen: true,
      webPreferences: { offscreen: true },
    });
    win.setContentSize(fig.width, fig.height);
    // OneDrive puede bloquear un archivo recién guardado: se reintenta antes de rendirse.
    for (let intento = 1; ; intento++) {
      try {
        await win.loadFile(file);
        break;
      } catch (error) {
        if (intento === 3) {
          console.error(`No se pudo abrir ${fig.html}: ${error.message}`);
          process.exitCode = 1;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 600)); // espera al dibujo de las líneas
    const image = await win.webContents.capturePage({ x: 0, y: 0, width: fig.width, height: fig.height });
    const base = path.join(__dirname, fig.html.replace(/\.html$/, ''));
    fs.writeFileSync(`${base}.png`, image.toPNG());
    fs.writeFileSync(`${base}.jpg`, image.toJPEG(92));
    console.log('Generada', path.basename(base), image.getSize());
    win.destroy();
  }
  app.quit();
});
