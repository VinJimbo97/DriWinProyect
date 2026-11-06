import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { driverUpdateState, nvidiaDisplayVersion } from './driverVersion.ts';

describe('driverUpdateState', () => {
  it('no ofrece bajar de versión un Wi-Fi Intel (24.70 instalado, 23.40 en catálogo)', () => {
    assert.equal(driverUpdateState('8086', '24.70.0.3', '23.40.0'), 'current');
  });

  it('ofrece actualizar cuando el catálogo es más nuevo', () => {
    assert.equal(driverUpdateState('8086', '22.0.0.1', '23.40.0'), 'update');
    assert.equal(driverUpdateState('8087', '23.30.0.2', '23.40.0'), 'update');
  });

  it('considera al día la misma versión', () => {
    assert.equal(driverUpdateState('8086', '23.40.0.5', '23.40.0'), 'current');
  });

  it('traduce la numeración de Windows para NVIDIA', () => {
    assert.equal(nvidiaDisplayVersion('32.0.15.6109'), '561.09');
    assert.equal(nvidiaDisplayVersion('32.0.15.5585'), '555.85');
    assert.equal(nvidiaDisplayVersion('32.0.16.1088'), '610.88');
    assert.equal(driverUpdateState('10DE', '32.0.16.1088', '561.09'), 'current');
    assert.equal(driverUpdateState('10de', '32.0.15.5585', '561.09'), 'update');
  });

  it('no asume nada si no puede comparar', () => {
    assert.equal(driverUpdateState('1002', '32.0.12011.1036', '24.9.1'), 'unknown');
    assert.equal(driverUpdateState('14C3', '3.0.0.1', '3.4.0.1023'), 'unknown');
    assert.equal(driverUpdateState('8086', '—', '23.40.0'), 'unknown');
    assert.equal(driverUpdateState('10DE', '561.09', '561.09'), 'unknown');
  });
});
