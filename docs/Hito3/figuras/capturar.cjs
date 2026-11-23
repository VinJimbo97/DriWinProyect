/**
 * Genera las imágenes del documento final (Hito 3) a partir de sus HTML.
 * Desde la raíz del repositorio (PowerShell):
 *   $env:ELECTRON_RUN_AS_NODE = $null
 *   app-inicio-windows\node_modules\.bin\electron docs\Hito3\figuras\capturar.cjs
 */
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const FIGURAS = [
  { html: 'tapa.html', width: 1870, height: 2420, out: 'tapa.png' },
  { html: 'flujo-principal.html', width: 1400, height: 362, out: 'flujo-principal.png' },
  { html: 'linea-de-tiempo.html', width: 1400, height: 470, out: 'linea-de-tiempo.png' },
];

// Sin esto, Electron cierra la app al destruir la primera ventana.
app.on('window-all-closed', () => {});

app.whenReady().then(async () => {
  for (const fig of FIGURAS) {
    const file = path.join(__dirname, fig.html);
    if (!fs.existsSync(file)) continue;
    const win = new BrowserWindow({ show: false, frame: false, width: fig.width, height: fig.height, useContentSize: true, enableLargerThanScreen: true, webPreferences: { offscreen: true } });
    win.setContentSize(fig.width, fig.height);
    await win.loadFile(file);
    await new Promise((resolve) => setTimeout(resolve, 700));
    const image = await win.webContents.capturePage({ x: 0, y: 0, width: fig.width, height: fig.height });
    fs.writeFileSync(path.join(__dirname, fig.out), image.toPNG());
    console.log('Generada', fig.out, image.getSize());
    win.destroy();
  }
  app.quit();
});
