// Initializes or checks the encrypted creator-key pool without printing any Steam keys.
import { randomUUID, webcrypto as crypto } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const secret = JSON.parse(readFileSync(join(root, 'build', 'secret.json'), 'utf8'));
if (!secret.keys_key) throw new Error('Run node build/vault.mjs first to create keys_key.');
const command = process.argv[2], target = process.argv[3] ? resolve(process.argv[3]) : '';
if (!target || !['init', 'check', 'import'].includes(command)) throw new Error('Usage: node build/keypool.mjs <init|check|import> <keys.enc.json> [batch]');
const b64 = u8 => Buffer.from(u8).toString('base64');
const bytes = s => new Uint8Array(Buffer.from(s, 'base64'));
const key = await crypto.subtle.importKey('raw', bytes(secret.keys_key), 'AES-GCM', false, ['encrypt', 'decrypt']);
async function encrypt(data) { const iv=crypto.getRandomValues(new Uint8Array(12)), plain=new TextEncoder().encode(JSON.stringify(data)), ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,plain)); return {v:1,iv:b64(iv),ct:b64(ct)}; }
async function decrypt(envelope) { const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv)},key,bytes(envelope.ct)); return JSON.parse(new TextDecoder().decode(plain)); }
if (command === 'init') {
  if (existsSync(target)) throw new Error('Refusing to overwrite existing key pool: ' + target);
  writeFileSync(target, JSON.stringify(await encrypt({version:1,updated_at:new Date().toISOString(),items:[]}), null, 1) + '\n');
  console.log('key pool initialized');
} else if (command === 'check') {
  const data=await decrypt(JSON.parse(readFileSync(target,'utf8'))), counts=data.items.reduce((o,item)=>(o[item.status||'available']=(o[item.status||'available']||0)+1,o),{});
  console.log(JSON.stringify({version:data.version,total:data.items.length,counts}));
} else {
  const input = await new Promise((resolveInput, rejectInput) => { let raw=''; process.stdin.setEncoding('utf8'); process.stdin.on('data',c=>raw+=c); process.stdin.on('end',()=>resolveInput(raw)); process.stdin.on('error',rejectInput); });
  const keys=[...new Set(input.split(/\r?\n/).map(s=>s.trim().toUpperCase()).filter(Boolean))];
  if (!keys.length) throw new Error('No keys received on stdin.');
  if (keys.some(k=>!/^[A-Z0-9]{4,}(?:-[A-Z0-9]{4,}){2,}$/.test(k))) throw new Error('One or more lines do not look like Steam keys. Nothing was imported.');
  const data=await decrypt(JSON.parse(readFileSync(target,'utf8'))), known=new Set(data.items.map(i=>String(i.key).toUpperCase())), batch=process.argv[4]||new Date().toISOString().slice(0,10);
  const fresh=keys.filter(k=>!known.has(k));
  fresh.forEach(k=>data.items.push({id:randomUUID(),key:k,batch,key_type:'Release State Override',status:'available',imported_at:new Date().toISOString(),outreach_id:null,assigned_to:null,assigned_at:null,sent_at:null}));
  data.updated_at=new Date().toISOString();
  writeFileSync(target, JSON.stringify(await encrypt(data), null, 1) + '\n');
  console.log(JSON.stringify({received:keys.length,imported:fresh.length,duplicates:keys.length-fresh.length,total:data.items.length}));
}
