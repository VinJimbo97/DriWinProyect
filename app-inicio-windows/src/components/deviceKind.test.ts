import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deviceKind } from './deviceKind.ts';

test('cada categoría del escáner tiene su ícono', () => {
  assert.equal(deviceKind('GPU', 'Intel(R) UHD Graphics'), 'gpu');
  assert.equal(deviceKind('Audio', 'USB Audio Device'), 'audio');
  assert.equal(deviceKind('Bluetooth', 'Intel(R) Wireless Bluetooth(R)'), 'bluetooth');
  assert.equal(deviceKind('USB', 'Hub USB genérico'), 'usb');
});

test('la red se separa en Wi-Fi y cable según el nombre', () => {
  assert.equal(deviceKind('Network', 'Intel(R) Wi-Fi 6 AX201 160MHz'), 'wifi');
  assert.equal(deviceKind('Network', 'Intel(R) Ethernet Connection (16) I219-LM'), 'ethernet');
});

test('una clase desconocida usa el chip genérico', () => {
  assert.equal(deviceKind('System', 'Intel(R) Dynamic Platform and Thermal Framework'), 'chip');
});
