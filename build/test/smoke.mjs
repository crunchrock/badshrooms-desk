// Decrypts docs/vault.json with the password in build/secret.json. Prints only "vault ok" or the error.
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
try {
  const secret = JSON.parse(readFileSync(join(root, 'build', 'secret.json'), 'utf8'));
  const v = JSON.parse(readFileSync(join(root, 'docs', 'vault.json'), 'utf8'));
  const d = s => new Uint8Array(Buffer.from(s, 'base64'));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret.password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: d(v.salt), iterations: v.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const out = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: d(v.iv) }, key, d(v.ct))));
  if (out.token !== secret.token || !out.repo || out.keys_key !== secret.keys_key) throw new Error('vault decrypts but does not match secret.json');
  console.log('vault ok');
} catch (e) {
  console.log('vault FAILED: ' + e.message);
  process.exitCode = 1;
}
