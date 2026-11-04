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
  const context = vm.createContext({ URL, URLSearchParams, Response, TextEncoder, btoa, crypto: webcrypto,
    console, fetch: async (url, init) => {
      sent.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null });
      if (/\/channels\/\d+\/messages$/.test(url) && init.method === 'POST') return Response.json({ id: '456' });
      return new Response(null, { status: 204 });
    } });
  vm.runInContext(source, context);
  return { worker: context.worker, sent, pending, ctx: { waitUntil: promise => pending.push(promise) } };
}
function roomUrl(role = 'host', exp = Math.floor(Date.now() / 1000) + 600) {
  const payload = `room-test.${exp}.${role}` + (role === 'host' ? '...' : '');
  const sig = createHmac('sha256', secret).update(payload)
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

test('remote signed viewers cannot enable the local simulated player or preview navigation', async () => {
  const { worker }=fixture();
  const url=roomUrl('view');url.searchParams.set('preview','connected');
  const response=await worker.fetch(new Request(url),{HOST_LINK_SECRET:secret});
  const html=await response.text();
  assert.equal(response.status,200);
  assert.match(html,/<main id="nickname-screen"/);
  assert.ok(!/<body[^>]+class="[^"]*\bviewer-preview\b/.test(html));
  assert.ok(!html.includes('<nav class="preview-nav"'));
});

test('real host enables the approved audience eyes without study flags or synthetic viewers', async () => {
  const { worker } = fixture();
  const request = mode => worker.fetch(new Request('http://127.0.0.1:8787/?room=approved&mode=' + mode), {});
  const host = await (await request('host')).text();
  assert.match(host, /import \{ attachAudienceEyes \} from '\/audience-eyes\.mjs'/);
  assert.match(host, /attachAudienceEyes\(document.getElementById\('audience-list'\)\)/);
  assert.ok(!host.includes('study=') && !host.includes('QaEmitter') && !host.includes('qaAddViewer'));
  const viewer = await (await request('view')).text();
  assert.ok(!viewer.includes('attachAudienceEyes'));
});

test('nickname entry is a dedicated initial page with the player hidden and no eager PeerJS download', async () => {
  const { worker } = fixture();
  const html = await (await worker.fetch(new Request('http://127.0.0.1:8787/?room=entry&mode=view'), {})).text();
  assert.match(html, /<main id="nickname-screen" class="nickname-screen">/);
  assert.match(html, /<main id="app-main" hidden>/);
  assert.match(html, /<form id="nickname-form" class="nickname-form"/);
  assert.match(html, /<canvas id="nickname-crowd"[^>]+aria-hidden="true"/);
  assert.ok(!/<script[^>]+src=/.test(html));
  const controlsModule = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  assert.ok(controlsModule.indexOf("addEventListener('viewerjoined'") < controlsModule.indexOf("import('/player-controls.mjs')"));
  assert.ok(controlsModule.includes("import('/nickname-crowd.mjs')"));
  assert.ok(controlsModule.includes("if (!screen.hidden"),'late scene import must respect a quick submit');
});

test('invalid links retain a readable announcement and 403 while loading only the decorative walking scene', async () => {
  const { worker }=fixture();
  const response=await worker.fetch(new Request('https://example.invalid/?room=test&mode=host'),{HOST_LINK_SECRET:secret});
  const html=await response.text();
  assert.equal(response.status,403);
  assert.match(html,/<main class="expired-message"><h1>Link expirado ou inválido<\/h1>/);
  assert.match(html,/Use <strong>\/tela<\/strong> no Discord para criar uma nova sala\./);
  assert.match(html,/<canvas[^>]+aria-hidden="true"/);
  assert.match(html,/import \{ attachExpiredWalkers \} from '\/expired-walkers\.mjs'/);
  assert.ok(!html.includes('peerjs')&&!html.includes('nickname-dialog'));
});

async function invokeCommand(f, extra = {}, env = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const key = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('hex');
  const body = JSON.stringify({ type: 2, application_id: 'test-app', token: 'test-token',
    user: { id: '123' }, data: { name: 'tela', options: [] }, ...extra });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sign(null, Buffer.from(timestamp + body), privateKey).toString('hex');
  const response = await f.worker.fetch(new Request('https://example.invalid/', {
    method: 'POST', body, headers: { 'X-Signature-Ed25519': signature, 'X-Signature-Timestamp': timestamp }
  }), { HOST_LINK_SECRET: secret, DISCORD_PUBLIC_KEY: key, ...env }, f.ctx);
  const reply = await response.json();
  assert.equal(reply.type, 5);
  assert.equal(reply.data.flags, 64);
  await Promise.all(f.pending);
}

test('Discord defers privately, delivers the host link first and posts only watching publicly in fallback mode', async () => {
  const f = fixture();
  await invokeCommand(f);
  assert.equal(f.sent.length, 2);
  assert.match(f.sent[0].url, /\/messages\/@original$/);
  assert.equal(f.sent[1].body.components[0].components.length, 1);
  assert.equal(new URL(f.sent[1].body.components[0].components[0].url).searchParams.get('mode'), 'view');
  const host = new URL(f.sent[0].body.components[0].components[0].url);
  assert.equal(host.searchParams.get('mode'), 'host');
  assert.equal((await f.worker.fetch(new Request(host), { HOST_LINK_SECRET: secret })).status, 200);
});

test('bot-owned announcement has a signed private host link and supports live, closed and ended status', async () => {
  const f = fixture();
  const env = { HOST_LINK_SECRET: secret, DISCORD_TOKEN: 'test-only-bot-token' };
  await invokeCommand(f, { channel_id: '789', guild_id: '321' }, env);
  assert.equal(f.sent.length, 2);
  assert.match(f.sent[0].url, /\/channels\/789\/messages$/);
  assert.equal(f.sent[0].method, 'POST');
  assert.equal(new URL(f.sent[0].body.components[0].components[0].url).searchParams.get('mode'), 'view');
  assert.equal(f.sent[1].method, 'PATCH');
  const host = new URL(f.sent[1].body.components[0].components[0].url);
  assert.equal(host.searchParams.get('msg'), '456');
  const html = await (await f.worker.fetch(new Request(host), env)).text();
  assert.match(html, /const HOST_STATUS = true;/);
  const invitation = new URL(JSON.parse(html.match(/const INVITE_HREF = (.*);/)[1]));
  for (const name of ['ch', 'msg', 'uid']) assert.equal(invitation.searchParams.has(name), false);
  for (const [state, method] of [['live', 'PATCH'], ['closed', 'PATCH'], ['ended', 'DELETE']]) {
    const response = await f.worker.fetch(new Request('https://example.invalid/api/status', {
      method: 'POST', body: JSON.stringify({ query: host.search, state, viewers: 2 })
    }), env);
    assert.equal(response.status, 204);
    const message = f.sent.at(-1);
    assert.equal(message.method, method);
    assert.match(message.url, /\/channels\/789\/messages\/456$/);
    if (state === 'live') assert.match(message.body.embeds[0].description, /2 assistindo/);
    if (state === 'closed') assert.equal(message.body.components.length, 0);
  }
  const sentCount = f.sent.length;
  for (const field of ['ch', 'msg', 'uid']) {
    const tampered = new URL(host); tampered.searchParams.set(field, '999');
    assert.equal((await f.worker.fetch(new Request(tampered), env)).status, 403);
    assert.equal((await f.worker.fetch(new Request('https://example.invalid/api/status', {
      method: 'POST', body: JSON.stringify({ query: tampered.search, state: 'ended' })
    }), env)).status, 403);
  }
  assert.equal(f.sent.length, sentCount);
});
