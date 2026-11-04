import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHmac, generateKeyPairSync, sign, webcrypto } from 'node:crypto';

// Exercise the real Worker without contacting Discord or using deployment secrets.
const source = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8')
  .replace("import appStyles from './styles/generated/app.css';", 'const appStyles = "";')
  .replace('export default {', 'globalThis.worker = {');
const secret = 'test-only-room-link-secret';
function fixture() {
  const sent = [], pending = [];
  const context = vm.createContext({ URL, Response, TextEncoder, btoa, crypto: webcrypto,
    console, fetch: async (url, init) => {
      sent.push({ url, body: JSON.parse(init.body) }); return new Response(null, { status: 204 });
    } });
  vm.runInContext(source, context);
  return { worker: context.worker, sent, pending, ctx: { waitUntil: promise => pending.push(promise) } };
}
function roomUrl(role = 'host', exp = Math.floor(Date.now() / 1000) + 600) {
  const sig = createHmac('sha256', secret).update(`room-test.${exp}.${role}`)
    .digest().subarray(0, 16).toString('base64url');
  return new URL(`https://example.invalid/?room=room-test&mode=${role}&exp=${exp}&sig=${sig}`);
}

test('signed links reject role swaps, expired signatures and unsigned remote access', async () => {
  const { worker } = fixture();
  const request = url => worker.fetch(new Request(url), { HOST_LINK_SECRET: secret });
  assert.equal((await request(roomUrl())).status, 200);
  const view = roomUrl('view');
  assert.equal((await request(view)).status, 200);
  view.searchParams.set('mode', 'host');
  assert.equal((await request(view)).status, 403);
  assert.equal((await request(roomUrl('host', 1))).status, 403);
  assert.equal((await request('https://example.invalid/?room=test&mode=host')).status, 403);
  assert.equal((await request('http://127.0.0.1:8787/?room=test&mode=host')).status, 200);
});

test('host invitation contains the viewer signature and never reuses the host signature', async () => {
  const { worker } = fixture();
  const host = roomUrl();
  const html = await (await worker.fetch(new Request(host), { HOST_LINK_SECRET: secret })).text();
  const invitation = new URL(JSON.parse(html.match(/const INVITE_HREF = (.*);/)[1]));
  assert.equal(invitation.searchParams.get('mode'), 'view');
  assert.notEqual(invitation.searchParams.get('sig'), host.searchParams.get('sig'));
  assert.equal((await worker.fetch(new Request(invitation), { HOST_LINK_SECRET: secret })).status, 200);
});

test('Discord response exposes only watching publicly and sends transmitting privately', async () => {
  const f = fixture();
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const key = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
  const body = JSON.stringify({ type: 2, application_id: 'test-app', token: 'test-token',
    user: { id: 'test-user' }, data: { name: 'tela', options: [] } });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sign(null, Buffer.from(timestamp + body), privateKey).toString('hex');
  const response = await f.worker.fetch(new Request('https://example.invalid/', {
    method: 'POST', body, headers: { 'X-Signature-Ed25519': signature, 'X-Signature-Timestamp': timestamp }
  }), { HOST_LINK_SECRET: secret, DISCORD_PUBLIC_KEY: key }, f.ctx);
  const reply = await response.json();
  assert.equal(reply.data.components[0].components.length, 1);
  assert.equal(new URL(reply.data.components[0].components[0].url).searchParams.get('mode'), 'view');
  await Promise.all(f.pending);
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].body.flags, 64);
  const host = new URL(f.sent[0].body.components[0].components[0].url);
  assert.equal(host.searchParams.get('mode'), 'host');
  assert.equal((await f.worker.fetch(new Request(host), { HOST_LINK_SECRET: secret })).status, 200);
});
