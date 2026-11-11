import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkExportContent, exportFileName, MAX_EXPORT_BYTES } from './dataExport.js';

describe('Descargar mis datos: validación antes de escribir en disco', () => {
  it('acepta un objeto JSON', () => {
    const content = JSON.stringify({ account: { email: 'a@correo.cl' } });
    assert.deepEqual(checkExportContent(content), { ok: true, content });
  });

  it('rechaza lo que no es texto, texto vacío, JSON inválido o un JSON que no es objeto', () => {
    for (const value of [undefined, null, 42, {}, '', 'no es json', '[1,2]', '"texto"', 'null']) {
      assert.equal(checkExportContent(value).ok, false, `valor ${String(value)}`);
    }
  });

  it('rechaza contenido demasiado grande', () => {
    const big = JSON.stringify({ relleno: 'x'.repeat(MAX_EXPORT_BYTES) });
    assert.equal(checkExportContent(big).ok, false);
  });

  it('sugiere un nombre con la fecha local', () => {
    assert.equal(exportFileName(new Date(2026, 10, 9)), 'driwin-mis-datos-2026-11-09.json');
  });
});
