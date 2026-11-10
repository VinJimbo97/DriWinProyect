import { describe, expect, it } from 'vitest';
import {
  decryptText,
  deriveDataKeys,
  emailLookup,
  encryptText,
  hashPassword,
  maskEmail,
  newSessionToken,
  verifyPassword,
} from '../src/security/crypto.js';

const keys = deriveDataKeys('0123456789abcdef'.repeat(4));
const otherKeys = deriveDataKeys('fedcba9876543210'.repeat(4));

describe('contraseñas (scrypt)', () => {
  it('verifica la contraseña correcta y rechaza otra', async () => {
    const hash = await hashPassword('mi-clave-segura');
    expect(hash.startsWith('scrypt$16384$8$1$')).toBe(true);
    expect(await verifyPassword('mi-clave-segura', hash)).toBe(true);
    expect(await verifyPassword('mi-clave-segurA', hash)).toBe(false);
  });

  it('usa una sal distinta cada vez (mismo texto, hash distinto)', async () => {
    expect(await hashPassword('igual')).not.toBe(await hashPassword('igual'));
  });

  it('un hash con formato desconocido nunca coincide', async () => {
    expect(await verifyPassword('x', 'sha256$abc')).toBe(false);
  });
});

describe('correo cifrado (AES-256-GCM + HMAC)', () => {
  it('cifra y descifra; el texto cifrado no contiene el correo', () => {
    const encrypted = encryptText('vicente@correo.cl', keys);
    expect(encrypted.toString('utf8')).not.toContain('vicente');
    expect(decryptText(encrypted, keys)).toBe('vicente@correo.cl');
  });

  it('detecta datos alterados o cifrados con otra clave', () => {
    const encrypted = encryptText('dato', keys);
    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decryptText(tampered, keys)).toThrow();
    expect(() => decryptText(encrypted, otherKeys)).toThrow();
  });

  it('la huella del correo no depende de mayúsculas ni espacios y cambia con la clave', () => {
    expect(emailLookup(' Vicente@Correo.CL ', keys).equals(emailLookup('vicente@correo.cl', keys))).toBe(true);
    expect(emailLookup('vicente@correo.cl', keys).equals(emailLookup('vicente@correo.cl', otherKeys))).toBe(false);
  });

  it('rechaza una clave maestra de largo incorrecto', () => {
    expect(() => deriveDataKeys('abc')).toThrow(/64 caracteres/);
  });
});

describe('utilidades', () => {
  it('genera tokens de sesión distintos con prefijo dws_', () => {
    const a = newSessionToken();
    expect(a).toMatch(/^dws_[A-Za-z0-9_-]{43}$/);
    expect(newSessionToken()).not.toBe(a);
  });

  it('oculta el correo al mostrarlo', () => {
    expect(maskEmail('vicente@gmail.com')).toBe('vi*****@gmail.com');
    expect(maskEmail('ab@x.cl')).toBe('ab***@x.cl');
  });
});
