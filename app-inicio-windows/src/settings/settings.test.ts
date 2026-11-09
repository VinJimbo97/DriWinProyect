import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defaultSettings, parseSettings, PREMIUM_FEATURES, resolveTheme } from './settings.ts';

describe('parseSettings', () => {
  it('usa los valores predeterminados si no hay nada guardado o está dañado', () => {
    assert.deepEqual(parseSettings(null), defaultSettings());
    assert.deepEqual(parseSettings('texto'), defaultSettings());
    assert.deepEqual(parseSettings([1, 2]), defaultSettings());
  });

  it('parte en español, con el tema de Windows', () => {
    const settings = defaultSettings();
    assert.equal(settings.language, 'es');
    assert.equal(settings.theme, 'system');
  });

  it('deja desactivada por defecto la función que borra drivers antiguos', () => {
    const { premiumFeatures } = defaultSettings();
    assert.equal(premiumFeatures.removeOldDrivers, false);
    assert.equal(premiumFeatures.installAll, true);
    assert.deepEqual(Object.keys(premiumFeatures).sort(), [...PREMIUM_FEATURES].sort());
  });

  it('respeta valores válidos y descarta los desconocidos', () => {
    const settings = parseSettings({
      language: 'en',
      theme: 'light',
      premiumFeatures: { installAll: false, removeOldDrivers: true, inventada: true, driverBackup: 'si' },
    });
    assert.equal(settings.language, 'en');
    assert.equal(settings.theme, 'light');
    assert.equal(settings.premiumFeatures.installAll, false);
    assert.equal(settings.premiumFeatures.removeOldDrivers, true);
    assert.equal(settings.premiumFeatures.driverBackup, true);
    assert.equal('inventada' in settings.premiumFeatures, false);
  });

  it('rechaza un idioma o tema que la app no tiene', () => {
    const settings = parseSettings({ language: 'fr', theme: 'rosado' });
    assert.equal(settings.language, 'es');
    assert.equal(settings.theme, 'system');
  });
});

describe('resolveTheme', () => {
  it('"igual que Windows" sigue al sistema', () => {
    assert.equal(resolveTheme('system', true), 'dark');
    assert.equal(resolveTheme('system', false), 'light');
  });

  it('una elección fija ignora al sistema', () => {
    assert.equal(resolveTheme('light', true), 'light');
    assert.equal(resolveTheme('dark', false), 'dark');
  });
});
