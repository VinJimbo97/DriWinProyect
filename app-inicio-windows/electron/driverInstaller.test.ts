import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { downloadAndVerify, installDriver, type InstallerSteps, type InstallProgress } from './driverInstaller.js';
import { isAllowedDriverUrl, validateInstallRequest, type DriverInstallRequest } from './installerPolicy.js';

const VALID_SHA = 'a'.repeat(64);
const validRequest: DriverInstallRequest = {
  driverId: 6,
  downloadUrl: 'https://driwinstorage.blob.core.windows.net/drivers/MediaTek_WLAN_r2cmw13w.exe',
  sha256: VALID_SHA,
};

describe('política de instalación', () => {
  it('acepta las URL reales del catálogo, con espacios y paréntesis codificados', () => {
    assert.equal(isAllowedDriverUrl(validRequest.downloadUrl), true);
    assert.equal(
      isAllowedDriverUrl('https://driwinstorage.blob.core.windows.net/drivers/NVIDIA%20GeForce%20v561.09%20(DCH).exe'),
      true,
    );
  });

  for (const [name, url] of [
    ['http', 'http://driwinstorage.blob.core.windows.net/drivers/a.exe'],
    ['otro dominio', 'https://evil.example/drivers/a.exe'],
    ['dominio parecido', 'https://driwinstorage.blob.core.windows.net.evil.example/drivers/a.exe'],
    ['credenciales en la URL', 'https://x@driwinstorage.blob.core.windows.net/drivers/a.exe'],
    ['otro contenedor', 'https://driwinstorage.blob.core.windows.net/apps/a.exe'],
    ['salir del contenedor', 'https://driwinstorage.blob.core.windows.net/drivers/../apps/a.exe'],
    ['no ejecutable', 'https://driwinstorage.blob.core.windows.net/drivers/a.ps1'],
    ['con parámetros', 'https://driwinstorage.blob.core.windows.net/drivers/a.exe?x=1'],
    ['texto inválido', 'no es una url'],
  ] as const) {
    it(`rechaza URL: ${name}`, () => assert.equal(isAllowedDriverUrl(url), false));
  }

  it('exige una huella SHA-256 válida', () => {
    assert.equal(validateInstallRequest({ ...validRequest, sha256: null }), 'NOT_VERIFIED');
    assert.equal(validateInstallRequest({ ...validRequest, sha256: 'abc' }), 'NOT_VERIFIED');
    assert.equal(validateInstallRequest(validRequest), null);
  });
});

describe('descarga verificada', () => {
  const payload = Buffer.alloc(256 * 1024, 7);
  const payloadSha = createHash('sha256').update(payload).digest('hex');
  let server: Server;
  let baseUrl: string;
  let dir: string;

  before(async () => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'driwin-test-'));
    server = createServer((request, response) => {
      if (request.url === '/redirect') {
        response.writeHead(302, { Location: '/ok' }).end();
      } else if (request.url === '/missing') {
        response.writeHead(404).end();
      } else {
        response.writeHead(200, { 'Content-Length': payload.length }).end(payload);
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('guarda el archivo y reporta el avance hasta 100 %', async () => {
    const file = path.join(dir, 'ok.exe');
    const seen: (number | null)[] = [];
    await downloadAndVerify(`${baseUrl}/ok`, payloadSha, file, (percent) => seen.push(percent));
    assert.deepEqual(readFileSync(file), payload);
    assert.equal(seen.at(-1), 100);
  });

  it('falla si el SHA-256 no coincide', async () => {
    await assert.rejects(downloadAndVerify(`${baseUrl}/ok`, VALID_SHA, path.join(dir, 'bad.exe'), () => {}), {
      code: 'HASH_MISMATCH',
    });
  });

  it('no sigue redirecciones ni acepta respuestas de error', async () => {
    const file = path.join(dir, 'x.exe');
    await assert.rejects(downloadAndVerify(`${baseUrl}/redirect`, payloadSha, file, () => {}), { code: 'DOWNLOAD_FAILED' });
    await assert.rejects(downloadAndVerify(`${baseUrl}/missing`, payloadSha, file, () => {}), { code: 'DOWNLOAD_FAILED' });
  });
});

describe('flujo de instalación', () => {
  const makeDir = () => mkdtempSync(path.join(os.tmpdir(), 'driwin-flow-'));

  function fakeSteps(overrides: Partial<InstallerSteps> = {}): InstallerSteps {
    return {
      download: async (_url, _sha, file, onPercent) => {
        writeFileSync(file, 'x');
        onPercent(100);
      },
      verify: async () => {},
      run: async () => 0,
      ...overrides,
    };
  }

  it('recorre las etapas en orden y borra el instalador', async () => {
    const dir = makeDir();
    const stages: InstallProgress['stage'][] = [];
    let fileExistedWhenRun = false;
    const result = await installDriver(
      validRequest,
      dir,
      (progress) => stages.push(progress.stage),
      fakeSteps({
        run: async (file) => {
          fileExistedWhenRun = existsSync(file);
          return 0;
        },
      }),
    );
    assert.deepEqual(result, { ok: true, rebootRequired: false });
    assert.deepEqual(stages, ['downloading', 'verifying', 'installing']);
    assert.equal(fileExistedWhenRun, true);
    assert.equal(existsSync(path.join(dir, 'driver-6.exe')), false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('abre el instalador sin argumentos, para que muestre sus ventanas y términos', async () => {
    const dir = makeDir();
    let received: unknown[] = [];
    const requestWithFlags = { ...validRequest, silentFlags: '/S /v/qn' };
    await installDriver(requestWithFlags, dir, () => {}, fakeSteps({
      run: async (...args: unknown[]) => {
        received = args;
        return 0;
      },
    }));
    assert.deepEqual(received, [path.join(dir, 'driver-6.exe')]);
    rmSync(dir, { recursive: true, force: true });
  });

  it('no descarga nada si la solicitud no pasa la política', async () => {
    const dir = makeDir();
    let downloaded = false;
    const result = await installDriver({ ...validRequest, sha256: null }, dir, () => {}, fakeSteps({
      download: async () => {
        downloaded = true;
      },
    }));
    assert.equal(downloaded, false);
    assert.equal(result.ok === false && result.code, 'NOT_VERIFIED');
    rmSync(dir, { recursive: true, force: true });
  });

  it('no ejecuta el instalador si la firma falla, y lo borra', async () => {
    const dir = makeDir();
    let executed = false;
    const result = await installDriver(validRequest, dir, () => {}, fakeSteps({
      verify: async () => {
        throw new Error('firma inválida');
      },
      run: async () => {
        executed = true;
        return 0;
      },
    }));
    assert.equal(executed, false);
    assert.equal(result.ok, false);
    assert.equal(existsSync(path.join(dir, 'driver-6.exe')), false);
    rmSync(dir, { recursive: true, force: true });
  });

  it('interpreta los códigos de salida del instalador', async () => {
    const cases: [number, unknown][] = [
      [3010, { ok: true, rebootRequired: true }],
      [1641, { ok: true, rebootRequired: true }],
      [1223, 'UAC_DENIED'],
      [1602, 'USER_CANCELLED'],
      [5, 'INSTALLER_FAILED'],
      [259, 'INSTALLER_FAILED'],
    ];
    for (const [exitCode, expected] of cases) {
      const dir = makeDir();
      const result = await installDriver(validRequest, dir, () => {}, fakeSteps({ run: async () => exitCode }));
      if (typeof expected === 'string') {
        assert.equal(result.ok === false && result.code, expected, String(exitCode));
      } else {
        assert.deepEqual(result, expected);
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
