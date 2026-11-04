import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';

// Exercise the actual page script: repeated/stale PeerJS events must not invent
// audience members or remove a different, still-current connection.
const source = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
class Element extends EventTarget {
  constructor() {
    super(); this.style = {}; this.dataset = {}; this.hidden = false;
    this.children = []; this.textContent = ''; this.attributes = {};
    this.classList = { add() {}, remove() {}, toggle() {} };
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
}
function fixture() {
  const elements = new Map();
  const get = key => {
    if (!elements.has(key)) elements.set(key, new Element());
    return elements.get(key);
  };
  const document = new EventTarget();
  Object.assign(document, { getElementById: get, querySelector: get, body: get('body'),
    createTextNode: value => value, createElement: () => new Element() });
  class Peer extends EventEmitter {
    constructor() { super(); this.calls = []; }
    call(id) {
      const call = new EventEmitter();
      call.peerConnection = new EventTarget();
      call.peerConnection.connectionState = 'new';
      call.close = () => { call.closed = true; call.emit('close'); };
      this.calls.push(call); return call;
    }
    destroy() { this.destroyed = true; }
  }
  const track = { kind: 'video', stop() {} };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [] };
  let copied;
  const context = vm.createContext({ document, Peer, Event, URL, console,
    window: { location: { href: 'https://example.invalid/?room=audience&mode=host&title=Call' } },
    navigator: { mediaDevices: { getDisplayMedia: async () => stream }, clipboard: { writeText: async text => { copied = text; } } },
    setTimeout() {} });
  const script = source.match(/  <script>\r?\n([\s\S]*?)  <\/script>/)[1]
    .replace('${JSON.stringify(safeRoom)}', '"audience"')
    .replace('${JSON.stringify(safeMode)}', '"host"')
    .replace('${JSON.stringify(inviteHref)}', '""')
    .replace('${JSON.stringify(isPreview ? preview : null)}', 'null');
  vm.runInContext(script, context);
  return { get, run: value => vm.runInContext(value, context), get copied() { return copied; },
    connect(id = 'viewer') {
      const conn = new EventEmitter(); conn.peer = id;
      conn.close = () => conn.emit('close');
      this.run('peer').emit('connection', conn); return conn;
    } };
}

test('host starts with no invented spectators; media audio indicator is truthful', async () => {
  const f = fixture();
  await f.run('startHostStream()');
  assert.equal(f.get('audience-list').children.length, 0);
  assert.equal(f.get('host-audio-status').textContent, 'Sem áudio compartilhado');
  assert.equal(f.get('status-text').textContent, 'Preparando a sala');
  f.run('peer').emit('open');
  assert.equal(f.get('status-text').textContent, 'Ao vivo');
});

test('repeated stream requests create a single audience member and media call', async () => {
  const f = fixture(); await f.run('startHostStream()');
  const conn = f.connect();
  conn.emit('data', 'REQUEST_STREAM'); conn.emit('data', 'REQUEST_STREAM');
  assert.equal(f.run('peer').calls.length, 1);
  assert.equal(f.get('viewer-count').textContent, '1');
  assert.equal(f.get('audience-list').children[0].children[1].textContent, 'Espectador 01');
});

test('audience status follows actual transport changes and departure closes media', async () => {
  const f = fixture(); await f.run('startHostStream()');
  const conn = f.connect(); conn.emit('data', 'REQUEST_STREAM');
  const call = f.run('peer').calls[0];
  assert.equal(f.get('audience-list').children[0].children[2].textContent, 'Conectando');
  call.peerConnection.connectionState = 'connected';
  call.peerConnection.dispatchEvent(new Event('connectionstatechange'));
  assert.equal(f.get('audience-list').children[0].children[2].textContent, 'Conectado');
  conn.close();
  assert.equal(call.closed, true);
  assert.equal(f.get('viewer-count').textContent, '0');
  assert.equal(f.get('audience-empty').hidden, false);
});

test('stale connection and call events cannot delete a current spectator', async () => {
  const f = fixture(); await f.run('startHostStream()');
  const old = f.connect(); old.emit('data', 'REQUEST_STREAM');
  const oldCall = f.run('peer').calls[0];
  oldCall.close();
  const current = f.connect(); current.emit('data', 'REQUEST_STREAM');
  old.emit('close'); old.emit('data', 'REQUEST_STREAM'); oldCall.emit('close');
  assert.equal(f.get('viewer-count').textContent, '1');
  assert.equal(f.run('activeCalls.size'), 1);
  assert.equal(f.run('peer').calls.length, 2);
});

test('invite points to the viewer, not the transmitter or a simulated state', async () => {
  const f = fixture();
  f.get('copy-view-link').dispatchEvent(new Event('click'));
  await Promise.resolve();
  const url = new URL(f.copied);
  assert.equal(url.searchParams.get('mode'), 'view');
  assert.equal(url.searchParams.get('room'), 'audience');
  assert.equal(url.searchParams.has('preview'), false);
});

test('ending resets the real audience and a new session starts with spectator 01', async () => {
  const f = fixture(); await f.run('startHostStream()');
  const conn = f.connect(); conn.emit('data', 'REQUEST_STREAM');
  const oldCall = f.run('peer').calls[0];
  f.run('stopHostStream()');
  assert.equal(oldCall.closed, true);
  assert.equal(f.get('viewer-count').textContent, '0');
  assert.equal(f.get('host-actions').hidden, true);
  assert.equal(f.get('host-audio-status').hidden, true);
  await f.run('startHostStream()');
  f.connect('new-viewer').emit('data', 'REQUEST_STREAM');
  oldCall.emit('close');
  assert.equal(f.get('viewer-count').textContent, '1');
  assert.equal(f.get('audience-list').children[0].children[1].textContent, 'Espectador 01');
});

test('capture is signalled before requesting media and cancellation releases decoration', async () => {
  const f = fixture();
  const states = [];
  f.get('body').addEventListener('hostcapturechange', () => states.push(f.get('body').dataset.capturePending));
  f.run(`navigator.mediaDevices.getDisplayMedia = async () => {
    if (document.body.dataset.capturePending !== 'true') throw new Error('Capture not signalled');
    const error = new Error('Cancelled'); error.name = 'NotAllowedError'; throw error;
  }`);
  await f.run('startHostStream()');
  assert.deepEqual(states, ['true', undefined]);
  assert.equal(f.get('host-feedback').textContent, 'Seleção cancelada. Você pode tentar novamente.');
  assert.equal(f.get('card-btn').disabled, false);
});

test('focus follows entry and exit without jumping again during a screen swap', async () => {
  const f = fixture();
  let entries = 0, exits = 0;
  f.get('host-live-title').focus = () => entries++;
  f.get('card-btn').focus = () => exits++;
  f.run('window.scrollTo = () => { window.scrolls = (window.scrolls || 0) + 1; }');
  await f.run('startHostStream()');
  await f.run('startHostStream()');
  assert.equal(entries, 1);
  assert.equal(f.run('window.scrolls'), 1);
  f.run('stopHostStream()');
  assert.equal(exits, 1);
  assert.equal(f.run('window.scrolls'), 2);
});
