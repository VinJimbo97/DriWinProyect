import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appIcon, foregroundFor } from './appIcons.ts';

test('las apps del catálogo con logo usan el de su marca', () => {
  const discord = appIcon('Discord');
  assert.equal(discord.type, 'logo');
  assert.equal(discord.color, '#5865F2');
  assert.equal(appIcon('  docker desktop ').type, 'logo');
});

test('las marcas sin logo libre usan sus iniciales', () => {
  assert.deepEqual(appIcon('Visual Studio Code'), { type: 'initials', text: 'VS', color: '#007ACC' });
});

test('una app nueva recibe iniciales y siempre el mismo color', () => {
  const first = appIcon('Mi App Nueva');
  assert.equal(first.type, 'initials');
  assert.equal(first.type === 'initials' && first.text, 'MA');
  assert.deepEqual(appIcon('Mi App Nueva'), first);
});

test('el logo se ve sobre fondos claros y oscuros', () => {
  assert.equal(foregroundFor('#000000'), '#ffffff');
  assert.equal(foregroundFor('#FFD400'), '#1b1f24');
});
