import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { clearSession, isValidSessionToken, loadDeviceId, loadSession, saveSession, type Encryptor } from './sessionStore.js';

/** Cifrado de prueba (en la app real es DPAPI de Windows). */
const fakeEncryptor: Encryptor = {
  isEncryptionAvailable: () => true,
  encryptString: (plain) => Buffer.from([...Buffer.from(plain, 'utf8')].map((byte) => byte ^ 0x5a)),
  decryptString: (encrypted) => Buffer.from([...encrypted].map((byte) => byte ^ 0x5a)).toString('utf8'),
};
const noEncryption: Encryptor = { ...fakeEncryptor, isEncryptionAvailable: () => false };

const TOKEN = `dws_${'A'.repeat(43)}`;
const dirs: string[] = [];
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'driwin-session-'));
  dirs.push(dir);
  return dir;
}
after(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('identificador del equipo', () => {
  it('se crea una vez y se reutiliza', async () => {
    const dir = await tempDir();
    const first = await loadDeviceId(dir);
    assert.match(first, /^[0-9a-f-]{36}$/);
    assert.equal(await loadDeviceId(dir), first);
  });

  it('si el archivo está dañado, crea uno nuevo válido', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'device-id.txt'), 'no-es-un-uuid');
    assert.match(await loadDeviceId(dir), /^[0-9a-f]{8}-/);
  });
});

describe('sesión guardada', () => {
  it('guarda el token cifrado (nunca en claro) y lo recupera', async () => {
    const dir = await tempDir();
    assert.equal(await saveSession(dir, TOKEN, fakeEncryptor), true);
    const raw = await readFile(path.join(dir, 'session.bin'));
    assert.ok(!raw.toString('utf8').includes('dws_'));
    assert.equal(await loadSession(dir, fakeEncryptor), TOKEN);
  });

  it('sin cifrado disponible no escribe nada en disco', async () => {
    const dir = await tempDir();
    assert.equal(await saveSession(dir, TOKEN, noEncryption), false);
    await assert.rejects(readFile(path.join(dir, 'session.bin')));
    assert.equal(await loadSession(dir, noEncryption), null);
  });

  it('rechaza tokens con otro formato', async () => {
    const dir = await tempDir();
    await assert.rejects(saveSession(dir, 'clave-cualquiera', fakeEncryptor));
    assert.equal(isValidSessionToken(`dws_${'A'.repeat(42)}`), false);
    assert.equal(isValidSessionToken(TOKEN), true);
  });

  it('cerrar sesión borra el archivo', async () => {
    const dir = await tempDir();
    await saveSession(dir, TOKEN, fakeEncryptor);
    await clearSession(dir);
    assert.equal(await loadSession(dir, fakeEncryptor), null);
    await clearSession(dir); // borrar dos veces no falla
  });

  it('un archivo alterado no se acepta como sesión', async () => {
    const dir = await tempDir();
    await writeFile(path.join(dir, 'session.bin'), Buffer.from('basura'));
    assert.equal(await loadSession(dir, fakeEncryptor), null);
  });
});
