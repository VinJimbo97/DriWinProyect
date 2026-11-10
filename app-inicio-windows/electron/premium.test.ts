import assert from 'node:assert/strict';
import { appendFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { isAllowedPackage, isHighRiskPackage } from './bloatwarePolicy.js';
import { backupDrivers, backupFolderName, isValidBackupFolder } from './driverBackup.js';
import { dataPrelude, encodeData, encodePowerShell, runElevatedScript } from './elevated.js';
import { parseGhostOutput, removeGhostDevices, type GhostDevice } from './ghostDevices.js';
import { applyEvents, parseQueueRequest, parseResults, runInstallQueue, type QueueItem } from './installQueue.js';
import { createRestorePoint } from './restorePoint.js';

const SHA = 'a'.repeat(64);
const URL_OK = 'https://driwinstorage.blob.core.windows.net/drivers/driver.exe';

const dirs: string[] = [];
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'driwin-premium-'));
  dirs.push(dir);
  return dir;
}
after(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

/** Decodifica el script que recibió el runner elevado (para revisar su contenido). */
const decodeScript = (encoded: string) => Buffer.from(encoded, 'base64').toString('utf16le');

describe('script elevado', () => {
  it('codifica el script para -EncodedCommand (UTF-16LE + base64)', () => {
    assert.equal(decodeScript(encodePowerShell("Write-Host 'hola'")), "Write-Host 'hola'");
  });

  it('los datos viajan en base64: una ruta con comillas no puede inyectar comandos', () => {
    const ruta = "C:\\Users\\O'Brien\\x'; Remove-Item C:\\ -Recurse; '";
    const encoded = encodeData({ ruta });
    assert.match(encoded, /^[A-Za-z0-9+/=]+$/);
    assert.ok(!dataPrelude({ ruta }).includes('Remove-Item'));
    assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')), { ruta });
  });

  it('entrega el script codificado al runner y devuelve su código', async () => {
    let received = '';
    const code = await runElevatedScript('exit 7', 1000, async (encoded) => {
      received = decodeScript(encoded);
      return 7;
    });
    assert.equal(code, 7);
    assert.equal(received, 'exit 7');
  });
});

describe('punto de restauración', () => {
  const run = (code: number) => createRestorePoint(async () => code);

  it('creado o reciente (menos de 24 h) cuentan como listos', async () => {
    assert.deepEqual([(await run(0)).status, (await run(0)).ok], ['created', true]);
    assert.deepEqual([(await run(10)).status, (await run(10)).ok], ['recent', true]);
  });

  it('protección desactivada, UAC negado o fallo NO permiten seguir', async () => {
    assert.deepEqual([(await run(20)).status, (await run(20)).ok], ['disabled', false]);
    assert.deepEqual([(await run(1223)).status, (await run(1223)).ok], ['denied', false]);
    assert.deepEqual([(await run(30)).status, (await run(30)).ok], ['failed', false]);
  });
});

describe('respaldo de drivers', () => {
  it('nombra la carpeta con fecha y hora', () => {
    assert.equal(backupFolderName(new Date(2026, 10, 10, 9, 5)), 'Respaldo de drivers 2026-11-10 0905');
  });

  it('sólo acepta carpetas absolutas de un disco', () => {
    assert.equal(isValidBackupFolder('C:\\Users\\vicente\\Documents\\DriWin'), true);
    assert.equal(isValidBackupFolder('\\\\servidor\\compartido'), false);
    assert.equal(isValidBackupFolder('respaldo'), false);
    assert.equal(isValidBackupFolder('C:\\a"b'), false);
  });

  it('cuenta los drivers exportados', async () => {
    const result = await backupDrivers('D:\\Respaldos', new Date(2026, 0, 1), async () => 0, async () => 14);
    assert.deepEqual(result, { ok: true, folder: path.join('D:\\Respaldos', 'Respaldo de drivers 2026-01-01 0000'), driverCount: 14 });
  });

  it('informa UAC negado y fallos sin drivers', async () => {
    const denied = await backupDrivers('D:\\R', new Date(), async () => 1223, async () => 0);
    assert.equal(denied.ok ? '' : denied.code, 'UAC_DENIED');
    const failed = await backupDrivers('D:\\R', new Date(), async () => 5, async () => 0);
    assert.equal(failed.ok ? '' : failed.code, 'FAILED');
  });
});

describe('dispositivos desconectados', () => {
  const output = JSON.stringify([
    { instanceId: 'USB\\VID_0781&PID_5567\\4C530001', name: 'SanDisk Cruzer', deviceClass: 'DiskDrive' },
    { instanceId: 'SWD\\MMDEVAPI\\{0.0.1}', name: 'Altavoces', deviceClass: 'AudioEndpoint' },
    { instanceId: 'ACPI\\PNP0A08\\0', name: 'Bus PCI', deviceClass: 'System' },
    { instanceId: 'BTHENUM\\{0000110B}_VID&0001004C', name: '', deviceClass: 'Bluetooth' },
  ]);

  it('sólo ofrece clases externas y nunca dispositivos de software o de sistema', () => {
    const devices = parseGhostOutput(output);
    assert.deepEqual(devices.map((device) => device.deviceClass), ['Bluetooth', 'DiskDrive']);
    assert.equal(devices[0].name, '{0000110B}_VID&0001004C');
  });

  it('nunca ofrece componentes de Windows aunque su clase esté permitida', () => {
    const windowsParts = JSON.stringify([
      { instanceId: 'BTH\\MS_BTHLE\\7&1', name: 'Enumerador de Bluetooth LE de Microsoft', deviceClass: 'Bluetooth' },
      { instanceId: 'SW\\{97EBAACC-95BD}\\{X}', name: 'Proxy del reloj de streaming', deviceClass: 'MEDIA' },
      { instanceId: 'DISPLAY\\DEFAULT_MONITOR\\4&1', name: 'Integrated Monitor', deviceClass: 'Monitor' },
      { instanceId: 'DISPLAY\\SAM7016\\5&2', name: 'Generic Monitor (SAMSUNG)', deviceClass: 'Monitor' },
    ]);
    assert.deepEqual(parseGhostOutput(windowsParts).map((device) => device.name), ['Generic Monitor (SAMSUNG)']);
  });

  it('acepta la respuesta de un solo dispositivo (objeto, no lista)', () => {
    assert.equal(parseGhostOutput(JSON.stringify({ instanceId: 'USB\\VID_1\\2', name: 'Mouse', deviceClass: 'Mouse' })).length, 1);
    assert.deepEqual(parseGhostOutput(''), []);
  });

  it('sólo quita ids de la última revisión', async () => {
    const detected: GhostDevice[] = parseGhostOutput(output);
    const result = await removeGhostDevices(['USB\\INVENTADO\\1'], detected, async () => 0, async () => []);
    assert.equal(result.ok ? '' : result.code, 'NOT_ALLOWED');
  });

  it('cuenta quitados y fallidos volviendo a revisar', async () => {
    const detected = parseGhostOutput(output);
    const ids = detected.map((device) => device.instanceId);
    const result = await removeGhostDevices(ids, detected, async () => 1, async () => [detected[0]]);
    assert.deepEqual(result, { ok: true, removed: 1, failed: 1 });
    const denied = await removeGhostDevices(ids, detected, async () => 1223, async () => detected);
    assert.equal(denied.ok ? '' : denied.code, 'UAC_DENIED');
  });
});

describe('bloatware de riesgo alto', () => {
  it('está permitido pero marcado como riesgo alto', () => {
    assert.equal(isAllowedPackage('Microsoft.Windows.Photos'), true);
    assert.equal(isHighRiskPackage('Microsoft.Windows.Photos'), true);
    assert.equal(isHighRiskPackage('Microsoft.BingNews'), false);
  });

  it('nunca permite la Tienda, winget, Edge ni Defender', () => {
    for (const name of ['Microsoft.WindowsStore', 'Microsoft.DesktopAppInstaller', 'Microsoft.MicrosoftEdge.Stable', 'Microsoft.SecHealthUI']) {
      assert.equal(isAllowedPackage(name), false, name);
    }
  });
});

describe('Instalar todo (cola con un solo permiso)', () => {
  it('rechaza peticiones mal formadas o vacías', () => {
    assert.equal(parseQueueRequest(null), null);
    assert.equal(parseQueueRequest({ drivers: [], apps: [] }), null);
    assert.equal(parseQueueRequest({ drivers: [{ driverId: 'x' }], apps: [] }), null);
    assert.deepEqual(parseQueueRequest({ drivers: [], apps: ['7zip.7zip', '7zip.7zip'] }), { drivers: [], apps: ['7zip.7zip'] });
  });

  it('interpreta los eventos del script: drivers con reinicio y apps con códigos de winget', () => {
    const base: QueueItem[] = [
      { kind: 'driver', id: '1', status: 'ready', percent: null },
      { kind: 'app', id: '7zip.7zip', status: 'ready', percent: null },
      { kind: 'app', id: 'VideoLAN.VLC', status: 'ready', percent: null },
    ];
    const events = parseResults(
      [
        '\uFEFF{"event":"start","kind":"driver","id":"1","code":0}',
        '{"event":"end","kind":"driver","id":"1","code":3010}',
        '{"event":"start","kind":"app","id":"7zip.7zip","code":0}',
        // winget cancelado: 0x8A15010C, que PowerShell entrega como número con signo
        `{"event":"end","kind":"app","id":"7zip.7zip","code":${0x8a15010c | 0}}`,
        '{"event":"start","kind":"app","id":"VideoLAN.VLC","code":0}',
        '{"event":"end","kind":"app","id":"VideoLAN.VLC"', // a medio escribir
      ].join('\n'),
    );
    const items = applyEvents(base, events);
    assert.deepEqual(items.map((item) => item.status), ['done', 'failed', 'installing']);
    assert.equal(items[0].rebootRequired, true);
    assert.match(items[1].message ?? '', /Cancelaste/);
  });

  it('descarga y verifica, instala con un solo UAC y marca lo que no pasó la seguridad', async () => {
    const workDir = await tempDir();
    const resultsPath = path.join(workDir, 'cola-resultados.jsonl');
    let elevatedCalls = 0;
    const progress: QueueItem[][] = [];

    const items = await runInstallQueue(
      {
        drivers: [
          { driverId: 1, downloadUrl: URL_OK, sha256: SHA },
          { driverId: 2, downloadUrl: URL_OK, sha256: null },
          { driverId: 3, downloadUrl: URL_OK, sha256: SHA },
        ],
        apps: ['7zip.7zip', 'Malware.Inventado'],
      },
      workDir,
      (snapshot) => progress.push(snapshot),
      {
        download: async (_url, _sha, _file, onPercent) => onPercent(100),
        verify: async (file) => {
          if (file.endsWith('cola-driver-3.exe')) throw new Error('firma inválida');
        },
        readText: async (file) => (await import('node:fs/promises')).readFile(file, 'utf8'),
        runElevated: async (encoded) => {
          elevatedCalls += 1;
          const script = decodeScript(encoded);
          assert.ok(!script.includes(workDir), 'las rutas viajan en base64, no en el texto del script');
          await appendFile(resultsPath, '{"event":"start","kind":"driver","id":"1","code":0}\n{"event":"end","kind":"driver","id":"1","code":0}\n');
          await appendFile(resultsPath, '{"event":"start","kind":"app","id":"7zip.7zip","code":0}\n{"event":"end","kind":"app","id":"7zip.7zip","code":0}\n');
          return 0;
        },
      },
    );

    assert.equal(elevatedCalls, 1);
    const byId = Object.fromEntries(items.map((item) => [item.id, item]));
    assert.equal(byId['1'].status, 'done');
    assert.equal(byId['2'].status, 'failed');
    assert.match(byId['2'].message ?? '', /huella/);
    assert.equal(byId['3'].status, 'failed');
    assert.equal(byId['7zip.7zip'].status, 'done');
    assert.equal(byId['Malware.Inventado'].status, 'failed');
    assert.ok(progress.some((snapshot) => snapshot.some((item) => item.status === 'downloading')));
  });

  it('si se niega el permiso, nada queda como instalado', async () => {
    const workDir = await tempDir();
    const items = await runInstallQueue(
      { drivers: [{ driverId: 1, downloadUrl: URL_OK, sha256: SHA }], apps: ['7zip.7zip'] },
      workDir,
      () => {},
      {
        download: async () => {},
        verify: async () => {},
        readText: async () => '',
        runElevated: async () => 1223,
      },
    );
    assert.deepEqual(items.map((item) => item.status), ['failed', 'failed']);
    assert.match(items[0].message ?? '', /permiso/);
  });
});
