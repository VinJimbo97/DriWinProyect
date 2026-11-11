import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PRIVACY_NOTICE_VERSION } from '../src/domain/privacy';

/**
 * La versión del aviso de privacidad vive en la API y en la app. Si no
 * coinciden, la API rechaza TODOS los registros nuevos (400 privacy_version).
 * Esta prueba lo detecta antes de publicar.
 */
describe('Aviso de privacidad: misma versión en la API y en la app', () => {
  it('server-api/src/domain/privacy.ts = app-inicio-windows/src/privacy/notice.ts', () => {
    const appNotice = fs.readFileSync(
      new URL('../../app-inicio-windows/src/privacy/notice.ts', import.meta.url),
      'utf8',
    );
    const match = appNotice.match(/PRIVACY_NOTICE_VERSION\s*=\s*'([^']+)'/);
    expect(match?.[1]).toBe(PRIVACY_NOTICE_VERSION);
  });
});
