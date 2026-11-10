import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDetectScript,
  buildRemoveScript,
  detectPackages,
  parseDetectOutput,
  parseRemoveOutput,
  removePackages,
} from './bloatwareCleaner.js';
import { ALLOWED_PACKAGES, isAllowedPackage, isHighRiskPackage, splitRequestedPackages } from './bloatwarePolicy.js';

describe('lista permitida de bloatware', () => {
  it('acepta los paquetes del catálogo', () => {
    assert.equal(isAllowedPackage('Microsoft.BingNews'), true);
    assert.equal(isAllowedPackage('king.com.*'), true);
  });

  it('el inicio de sesión de Xbox es de riesgo alto: sólo con punto de restauración (migración 009)', () => {
    assert.equal(isAllowedPackage('Microsoft.XboxIdentityProvider'), true);
    assert.equal(isHighRiskPackage('Microsoft.XboxIdentityProvider'), true);
  });

  for (const name of [
    'Microsoft.WindowsStore',
    'Microsoft.MicrosoftEdge',
    'Microsoft.DesktopAppInstaller',
    "Microsoft.BingNews'; Remove-Item C:\\",
    '*',
    'Microsoft.*',
  ]) {
    it(`rechaza ${JSON.stringify(name)}`, () => {
      assert.equal(isAllowedPackage(name), false);
    });
  }

  it('ningún paquete permitido tiene caracteres peligrosos', () => {
    for (const name of ALLOWED_PACKAGES) {
      assert.match(name, /^[A-Za-z0-9][A-Za-z0-9._*-]+$/);
    }
  });

  it('separa lo permitido de lo rechazado y quita duplicados', () => {
    assert.deepEqual(splitRequestedPackages(['Microsoft.BingNews', 'Microsoft.BingNews', 'Microsoft.WindowsStore']), {
      allowed: ['Microsoft.BingNews'],
      rejected: ['Microsoft.WindowsStore'],
    });
  });

  it('rechaza peticiones mal formadas', () => {
    assert.equal(splitRequestedPackages('Microsoft.BingNews'), null);
    assert.equal(splitRequestedPackages([1, 2]), null);
    assert.equal(splitRequestedPackages(new Array(100).fill('Microsoft.BingNews')), null);
  });
});

describe('scripts de PowerShell', () => {
  it('sólo trabaja para el usuario actual (nunca -AllUsers)', () => {
    const scripts = buildDetectScript(['Microsoft.BingNews']) + buildRemoveScript(['Microsoft.BingNews']);
    assert.doesNotMatch(scripts, /AllUsers|Provisioned/i);
    assert.match(scripts, /'Microsoft\.BingNews'/);
  });

  it('se niega a armar un script con un paquete fuera de la lista', () => {
    assert.throws(() => buildRemoveScript(['Microsoft.WindowsStore']), /no permitido/);
  });
});

describe('interpretación de la respuesta', () => {
  it('normaliza listas de un elemento y paquetes ausentes', () => {
    const output = '{"king.com.*":["king.com.CandyCrushSaga","king.com.BubbleWitch3Saga"],"Microsoft.BingNews":"Microsoft.BingNews","Microsoft.BingWeather":[]}';
    assert.deepEqual(parseDetectOutput(output, ['king.com.*', 'Microsoft.BingNews', 'Microsoft.BingWeather', 'Microsoft.People']), {
      'king.com.*': ['king.com.CandyCrushSaga', 'king.com.BubbleWitch3Saga'],
      'Microsoft.BingNews': ['Microsoft.BingNews'],
      'Microsoft.BingWeather': [],
      'Microsoft.People': [],
    });
  });

  it('un resultado desconocido cuenta como fallo, con mensaje', () => {
    const output = '{"Microsoft.BingNews":{"status":"removed"},"Microsoft.People":{"status":"failed","message":"Acceso denegado"}}';
    assert.deepEqual(parseRemoveOutput(output, ['Microsoft.BingNews', 'Microsoft.People', 'Microsoft.SkypeApp']), {
      'Microsoft.BingNews': { status: 'removed' },
      'Microsoft.People': { status: 'failed', message: 'Acceso denegado' },
      'Microsoft.SkypeApp': { status: 'failed', message: 'Windows no informó el motivo.' },
    });
  });

  it('no ejecuta PowerShell si no hay nada que hacer', async () => {
    const neverRun = async () => {
      throw new Error('no debería ejecutarse');
    };
    assert.deepEqual(await detectPackages([], neverRun), {});
    assert.deepEqual(await removePackages([], neverRun), {});
  });

  it('pasa el script al ejecutor y devuelve el resultado', async () => {
    let received = '';
    const result = await removePackages(['Microsoft.WindowsMaps'], async (script) => {
      received = script;
      return '{"Microsoft.WindowsMaps":{"status":"not_installed"}}';
    });
    assert.match(received, /Remove-AppxPackage/);
    assert.deepEqual(result, { 'Microsoft.WindowsMaps': { status: 'not_installed' } });
  });
});
