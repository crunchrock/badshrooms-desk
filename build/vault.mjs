// Builds docs/vault.json from build/secret.json = {token, password, salt}.
// The vault holds the GitHub token, encrypted under the password (PBKDF2-SHA256, AES-GCM).
// Never prints the token or the password. Run: node build/vault.mjs
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const secretPath = join(root, 'build', 'secret.json');
const ITER = 600000;
const REPO = 'crunchrock/badshrooms-desk-data';
const b64 = u8 => Buffer.from(u8).toString('base64');

const secret = JSON.parse(readFileSync(secretPath, 'utf8'));
if (!secret.token || !secret.password) throw new Error('build/secret.json needs token and password');
if (!secret.salt) {
  secret.salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  writeFileSync(secretPath, JSON.stringify(secret, null, 1) + '\n');
}
if (!secret.keys_key) {
  secret.keys_key = b64(crypto.getRandomValues(new Uint8Array(32)));
  writeFileSync(secretPath, JSON.stringify(secret, null, 1) + '\n');
}
const salt = new Uint8Array(Buffer.from(secret.salt, 'base64'));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret.password), 'PBKDF2', false, ['deriveKey']);
const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const plain = new TextEncoder().encode(JSON.stringify({ token: secret.token, repo: REPO, keys_key: secret.keys_key }));
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
writeFileSync(join(root, 'docs', 'vault.json'), JSON.stringify({ v: 1, iter: ITER, salt: secret.salt, iv: b64(iv), ct: b64(ct) }) + '\n');
console.log('vault written');
