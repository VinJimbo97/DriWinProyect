import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { en } from './en.ts';
import { es } from './es.ts';
import { createTranslator, format } from './translate.ts';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe('diccionarios', () => {
  it('inglés tiene exactamente las mismas claves que español', () => {
    assert.deepEqual(Object.keys(en).sort(), Object.keys(es).sort());
  });

  it('cada traducción usa los mismos {parámetros} que el español', () => {
    for (const key of Object.keys(es) as (keyof typeof es)[]) {
      assert.deepEqual(placeholders(en[key]), placeholders(es[key]), `clave ${key}`);
    }
  });

  it('ningún texto está vacío', () => {
    for (const [key, text] of [...Object.entries(es), ...Object.entries(en)]) {
      assert.ok(text.trim().length > 0, `clave ${key}`);
    }
  });
});

describe('traducción', () => {
  it('reemplaza los parámetros', () => {
    assert.equal(format('Descargando {percent}%', { percent: 40 }), 'Descargando 40%');
  });

  it('deja visible un parámetro que falta', () => {
    assert.equal(format('Hola {nombre}', {}), 'Hola {nombre}');
  });

  it('elige el idioma pedido', () => {
    assert.equal(createTranslator('es')('drivers.install'), 'Instalar');
    assert.equal(createTranslator('en')('drivers.install'), 'Install');
  });
});
