import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildInstallArgs,
  detectApps,
  installApp,
  interpretInstallCode,
  WINGET,
  WINGET_NOT_FOUND,
  type WingetRunner,
} from './appInstaller.js';
import { isAllowedOfficialPage, splitRequestedIds } from './appPolicy.js';

describe('política de apps', () => {
  it('separa ids permitidos de los que no lo están', () => {
    assert.deepEqual(splitRequestedIds(['Valve.Steam', 'Malware.App', 'Valve.Steam']), {
      allowed: ['Valve.Steam'],
      rejected: ['Malware.App'],
    });
  });

  it('rechaza peticiones con forma inválida', () => {
    assert.equal(splitRequestedIds('Valve.Steam'), null);
    assert.equal(splitRequestedIds([1, 2]), null);
    assert.equal(splitRequestedIds(Array.from({ length: 41 }, () => 'Valve.Steam')), null);
  });

  it('no acepta ids con espacios o separadores aunque parezcan válidos', () => {
    assert.deepEqual(splitRequestedIds(['Valve.Steam & calc', 'Valve.Steam;calc'])?.allowed, []);
  });

  it('sólo abre páginas oficiales exactas de la lista', () => {
    assert.equal(isAllowedOfficialPage('https://www.blackmagicdesign.com/products/davinciresolve'), true);
    assert.equal(isAllowedOfficialPage('https://www.blackmagicdesign.com.evil.example/'), false);
    assert.equal(isAllowedOfficialPage('file:///C:/Windows/System32/calc.exe'), false);
  });
});

describe('instalación con winget', () => {
  it('pide a winget el id exacto, desde su repositorio y con el asistente visible', () => {
    const args = buildInstallArgs('Valve.Steam');
    assert.deepEqual(args.slice(0, 5), ['install', '--id', 'Valve.Steam', '--source', 'winget']);
    assert.ok(args.includes('--exact'));
    assert.ok(args.includes('--interactive'));
    assert.ok(!args.includes('--silent'));
  });

  it('no llama a winget si el id no está permitido', async () => {
    let called = false;
    const run: WingetRunner = async () => {
      called = true;
      return 0;
    };
    const result = await installApp('Malware.App', run);
    assert.equal(called, false);
    assert.equal(result.ok === false && result.code, 'NOT_ALLOWED');
  });

  it('interpreta los códigos de salida de winget', () => {
    assert.deepEqual(interpretInstallCode(0), { ok: true, alreadyInstalled: false, rebootRequired: false });
    assert.deepEqual(interpretInstallCode(WINGET.REBOOT_REQUIRED_TO_FINISH), {
      ok: true,
      alreadyInstalled: false,
      rebootRequired: true,
    });
    assert.equal(interpretInstallCode(WINGET.PACKAGE_ALREADY_INSTALLED).ok, true);
    const cases: [number, string][] = [
      [WINGET.CANCELLED_BY_USER, 'CANCELLED'],
      [WINGET.NO_NETWORK, 'NO_NETWORK'],
      [WINGET.DISK_FULL, 'DISK_FULL'],
      [WINGET_NOT_FOUND, 'WINGET_MISSING'],
      [0x8a150006, 'INSTALL_FAILED'],
    ];
    for (const [code, expected] of cases) {
      const result = interpretInstallCode(code);
      assert.equal(result.ok === false && result.code, expected, code.toString(16));
    }
  });

  it('muestra el código en hexadecimal cuando el error es desconocido', () => {
    const result = interpretInstallCode(0x8a150006);
    assert.ok(result.ok === false && result.message.includes('0x8A150006'));
  });
});

describe('detección de apps instaladas', () => {
  it('marca instaladas, no instaladas y desconocidas según el código de salida', async () => {
    const codes: Record<string, number> = {
      'Valve.Steam': 0,
      '7zip.7zip': WINGET.NO_APPLICATIONS_FOUND,
      'Git.Git': 0x8a150001,
    };
    const run: WingetRunner = async (args) => codes[args[2]];
    assert.deepEqual(await detectApps(['Valve.Steam', '7zip.7zip', 'Git.Git'], run), {
      'Valve.Steam': true,
      '7zip.7zip': false,
      'Git.Git': null,
    });
  });

  it('ignora ids no permitidos y no repite la consulta si falta winget', async () => {
    const asked: string[] = [];
    const run: WingetRunner = async (args) => {
      asked.push(args[2]);
      return WINGET_NOT_FOUND;
    };
    const result = await detectApps(['Malware.App', 'Valve.Steam', 'Git.Git', 'KDE.Krita', 'VideoLAN.VLC'], run);
    assert.equal('Malware.App' in result, false);
    assert.ok(asked.length <= 3, `consultó ${asked.length} veces`);
    assert.ok(Object.values(result).every((value) => value === null));
  });
});
