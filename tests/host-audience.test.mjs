import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';

// Exercise the actual page script: repeated/stale PeerJS events must not invent
// audience members or remove a different, still-current connection.
const source = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
const renderer = vm.createContext();
vm.runInContext(source.replace("import appStyles from './styles/generated/app.css';", 'const appStyles = "";')
  .replace('export default {', 'globalThis.worker = {'), renderer);
class Element extends EventTarget {
  constructor() {
    super(); this.style = {}; this.dataset = {}; this.hidden = false;
    this.children = []; this.textContent = ''; this.attributes = {};
    const classes = new Set();
    this.classList = {
      add: name => classes.add(name), remove: name => classes.delete(name),
      contains: name => classes.has(name),
      toggle(name, force = !classes.has(name)) { force ? classes.add(name) : classes.delete(name); },
    };
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  replaceChildren(...children) { this.children = children; }
  append(...children) { this.children.push(...children); }
  querySelector() { return this.content ||= new Element(); }
  querySelectorAll() { return [this.querySelector()]; }
  showModal() { this.open = true; }
  close() { this.open = false; }
  remove() { this.removed = true; }
  focus() { this.focused = true; }
}
function fixture(mode = 'host', { fresh = false, nickname = '', storageBlocked = false, peerAvailable = true, preview = null } = {}) {
  const elements = new Map();
  const get = key => {
    if (!elements.has(key)) elements.set(key, new Element());
    return elements.get(key);
  };
  const document = new EventTarget();
  Object.assign(document, { getElementById: key => mode === 'view' && key === 'status-text' ? null : get(key),
    querySelector: get, body: get('body'), head: get('head'),
    createTextNode: value => value, createElement: () => new Element() });
  class Peer extends EventEmitter {
    constructor() { super(); this.calls = []; this.connections = []; this.reconnects = 0; }
    call(id, media, options) {
      const call = new EventEmitter();
      call.options = options;
      call.peerConnection = new EventTarget();
      call.peerConnection.connectionState = 'new';
      call.senders = media.getTracks().map(track => ({
        track, parameters: { encodings: [] },
        getParameters() { return this.parameters; },
        async setParameters(value) { this.parameters = value; },
        async replaceTrack(value) { this.track = value; },
      }));
      call.peerConnection.getSenders = () => call.senders;
      call.close = () => { call.closed = true; call.emit('close'); };
      this.calls.push(call); return call;
    }
    connect(id) {
      const conn = new EventEmitter(); conn.peer = id;
      conn.peerConnection = new EventTarget();
      conn.open = false; conn.messages = [];
      conn.on('open', () => { conn.open = true; });
      conn.send = value => { conn.sent = value; conn.messages.push(value); };
      conn.close = () => { conn.open = false; conn.closed = true; conn.emit('close'); };
      this.connections.push(conn); return conn;
    }
    reconnect() { this.reconnects++; }
    destroy() { this.destroyed = true; }
  }
  const track = { kind: 'video', stop() {} };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [] };
  let copied;
  const storage = new Map(fresh ? [] : [['viewer-nickname:canja_v2_audience', nickname]]);
  const sessionStorage = {
    getItem(key) { if (storageBlocked) throw new Error('Storage blocked'); return storage.get(key) ?? null; },
    setItem(key, value) { if (storageBlocked) throw new Error('Storage blocked'); storage.set(key, value); },
  };
  const context = vm.createContext({ document, Peer: peerAvailable ? Peer : undefined, Event, URL, console,
    window: { sessionStorage, location: { href: 'https://example.invalid/?room=audience&mode=' + mode + '&title=Call' } },
    navigator: { mediaDevices: { getDisplayMedia: async () => stream }, clipboard: { writeText: async text => { copied = text; } } },
    setTimeout() {}, setInterval() { return 1; }, clearInterval() {} });
  const html = renderer.renderModernApp('audience', mode, 'Call', preview, true);
  const script = html.match(/  <script>\r?\n([\s\S]*?)  <\/script>/)[1];
  vm.runInContext(script, context);
  return { get, storage, run: value => vm.runInContext(value, context), providePeer() { context.Peer = Peer; }, get copied() { return copied; },
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
  assert.equal(f.get('host-audio-label').textContent, 'Sem áudio compartilhado');
  assert.equal(f.get('host-audio-status').dataset.audio, 'off');
  assert.equal(f.get('status-text').textContent, 'Preparando a sala');
  f.run('peer').emit('open');
  assert.equal(f.get('status-text').textContent, 'Ao vivo');
  f.run(`const captureWithoutAudio = navigator.mediaDevices.getDisplayMedia;
    navigator.mediaDevices.getDisplayMedia = async () => ({
      ...await captureWithoutAudio(),
      getAudioTracks: () => [{ kind: 'audio' }]
    });`);
  await f.run('startHostStream()');
  assert.equal(f.get('host-audio-label').textContent, 'Áudio compartilhado');
  assert.equal(f.get('host-audio-status').dataset.audio, 'on');
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
  assert.equal(f.get('host-audio-label').textContent, '');
  assert.match(f.get('host-feedback').textContent, /^Compartilhamento encerrado/);
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

test('cancelling a source change keeps the stream live and reports beside its controls', async () => {
  const f = fixture();
  await f.run('startHostStream()');
  const originalStream = f.run('localStream');
  f.run(`navigator.mediaDevices.getDisplayMedia = async () => {
    throw Object.assign(new Error('Cancelled'), { name: 'NotAllowedError' });
  }`);
  await f.run('startHostStream()');
  assert.equal(f.run('localStream'), originalStream);
  assert.equal(f.get('host-actions').hidden, false);
  assert.match(f.get('host-live-feedback').textContent, /^Seleção cancelada/);
  assert.equal(f.get('host-feedback').hidden, true);
});

test('adding/removing capture audio replaces calls once and preserves the current audience', async () => {
  const f = fixture();
  await f.run('startHostStream()');
  f.connect().emit('data', 'REQUEST_STREAM');
  const originalCall = f.run('peer').calls[0];
  f.run(`const videoTrack = { kind: 'video', stop() {} };
    const audioTrack = { kind: 'audio', stop() {} };
    navigator.mediaDevices.getDisplayMedia = async () => ({
      getTracks: () => [videoTrack, audioTrack],
      getVideoTracks: () => [videoTrack], getAudioTracks: () => [audioTrack]
    });`);
  await f.run('startHostStream()');
  assert.equal(originalCall.closed, true);
  assert.equal(f.run('peer').calls.length, 2);
  assert.equal(f.get('viewer-count').textContent, '1');
  const replacement = f.run('peer').calls[1];
  assert.equal(replacement.senders[1].track.kind, 'audio');
  originalCall.emit('close');
  assert.equal(f.run('activeCalls.get("viewer")'), replacement);
  f.run(`navigator.mediaDevices.getDisplayMedia = async () => ({
    getTracks: () => [videoTrack],
    getVideoTracks: () => [videoTrack], getAudioTracks: () => []
  });`);
  await f.run('startHostStream()');
  assert.equal(replacement.senders[1].track, null);
  assert.equal(f.run('peer').calls.length, 2);
  assert.equal(f.get('host-audio-status').dataset.audio, 'off');
  await f.run('startHostStream()');
  assert.equal(f.run('peer').calls.length, 2);
});

test('a rejected track replacement cannot recreate a call after sharing stops', async () => {
  const f = fixture();
  await f.run('startHostStream()');
  f.connect().emit('data', 'REQUEST_STREAM');
  const call = f.run('peer').calls[0];
  let rejectReplacement;
  let replacementStarted;
  const started = new Promise(resolve => { replacementStarted = resolve; });
  call.senders[0].replaceTrack = () => new Promise((resolve, reject) => {
    rejectReplacement = reject;
    replacementStarted();
  });
  const pending = f.run('startHostStream()');
  await started;
  f.run('stopHostStream()');
  rejectReplacement(new Error('Track was stopped'));
  await pending;
  assert.equal(f.run('peer'), null);
  assert.equal(f.run('activeCalls.size'), 0);
  assert.equal(f.get('host-actions').hidden, true);
});

test('sender settings apply video and audio bitrate independently and initialize empty encodings', async () => {
  const f = fixture();
  await f.run('startHostStream()');
  f.connect().emit('data', 'REQUEST_STREAM');
  const call = f.run('peer').calls[0];
  const audioSender = { ...call.senders[0], track: { kind: 'audio' }, parameters: { encodings: [] } };
  call.senders.push(audioSender);
  f.run('boostSenderBitrate(activeCalls.get("viewer").peerConnection)');
  await Promise.resolve();
  assert.equal(call.senders[0].parameters.encodings[0].maxBitrate, 8500000);
  assert.equal(call.senders[0].parameters.encodings[0].maxFramerate, 60);
  assert.equal(audioSender.parameters.encodings[0].maxBitrate, 192000);
  assert.equal(audioSender.parameters.encodings[0].priority, 'high');
});

test('host and viewer reconnect signalling while obsolete connections cannot disturb replacements', async () => {
  const host = fixture();
  await host.run('startHostStream()');
  const hostPeer = host.run('peer');
  hostPeer.emit('disconnected');
  assert.equal(hostPeer.reconnects, 1);
  host.run('stopHostStream()');
  hostPeer.emit('disconnected');
  assert.equal(hostPeer.reconnects, 1);

  const viewer = fixture('view');
  const viewerPeer = viewer.run('peer');
  viewerPeer.emit('disconnected');
  assert.equal(viewerPeer.reconnects, 1);
  viewerPeer.emit('open');
  const previous = viewer.run('viewerDataConnection');
  viewer.run('connectToHost()');
  assert.equal(viewer.run('viewerDataConnection'), previous);
  assert.equal(viewerPeer.connections.length, 1);
  viewer.run('viewerAttemptStartedAt -= VIEWER_ATTEMPT_TIMEOUT_MS');
  viewer.run('connectToHost()');
  const current = viewer.run('viewerDataConnection');
  assert.equal(previous.closed, true);
  previous.emit('open');
  assert.equal(previous.sent, undefined);
  current.emit('open');
  assert.equal(current.sent, 'REQUEST_STREAM');
  const oldCall = new EventEmitter();
  oldCall.answer = () => {};
  oldCall.close = () => oldCall.emit('close');
  const newCall = new EventEmitter();
  newCall.answer = () => {};
  newCall.close = () => newCall.emit('close');
  viewerPeer.emit('call', oldCall);
  viewer.run('viewerConnected = true');
  viewerPeer.emit('call', newCall);
  assert.equal(viewer.run('viewerConnected'), true);
  oldCall.emit('error', new Error('Old call'));
  assert.equal(viewer.run('viewerConnected'), true);
  newCall.emit('error', new Error('Current call'));
  assert.equal(viewer.run('viewerConnected'), false);
});

test('capture requests retain window audio preferences at the API option level', async () => {
  const f = fixture();
  let requested;
  const capture = f.run('navigator.mediaDevices.getDisplayMedia');
  f.run('navigator.mediaDevices').getDisplayMedia = async options => { requested = options; return capture(); };
  await f.run('startHostStream()');
  assert.equal(requested.video.displaySurface, 'window');
  assert.equal(requested.selfBrowserSurface, 'exclude');
  assert.equal(requested.surfaceSwitching, 'include');
  assert.equal(requested.systemAudio, 'include');
  assert.equal(requested.windowAudio, 'window');
  assert.equal(requested.audio.suppressLocalAudioPlayback, false);
});

test('first entry waits for an optional nickname and sends it before requesting media', () => {
  const f = fixture('view', { fresh: true });
  assert.equal(f.run('peer'), null);
  assert.equal(f.get('nickname-dialog').open, undefined);
  assert.equal(f.get('nickname-screen').hidden, false);
  assert.equal(f.get('app-main').hidden, true);
  assert.equal(f.get('body').classList.contains('is-connecting'), false);
  f.get('viewer-nickname').value = '  Guilherme   🦊  ';
  f.get('nickname-form').dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(f.get('nickname-dialog').open, false);
  assert.equal(f.get('nickname-screen').hidden, true);
  assert.equal(f.get('app-main').hidden, false);
  assert.equal(f.storage.get('viewer-nickname:canja_v2_audience'), 'Guilherme 🦊');
  f.run('peer').emit('open');
  const conn = f.run('viewerDataConnection'); conn.emit('open');
  assert.equal(conn.messages[0].type, 'VIEWER_PROFILE');
  assert.equal(conn.messages[0].nickname, 'Guilherme 🦊');
  assert.equal(conn.messages[1], 'REQUEST_STREAM');
});

test('skipping, blank submission and Escape all permit anonymous entry without storage', () => {
  for (const action of ['skip', 'blank', 'escape']) {
    const f = fixture('view', { fresh: true, storageBlocked: true });
    if (action === 'skip') f.get('nickname-cancel').dispatchEvent(new Event('click'));
    if (action === 'blank') {
      f.get('viewer-nickname').value = '   ';
      f.get('nickname-form').dispatchEvent(new Event('submit', { cancelable: true }));
    }
    if (action === 'escape') {
      const escape = new Event('keydown', { cancelable: true });
      Object.defineProperty(escape, 'key', { value: 'Escape' });
      f.get('nickname-form').dispatchEvent(escape);
    }
    assert.ok(f.run('peer'));
    assert.equal(f.run('viewerNickname'), '');
  }
});

test('entry defers PeerJS until joining and a failed download can be retried without duplicate attempts', () => {
  const f = fixture('view', { fresh: true, peerAvailable: false });
  assert.equal(f.get('head').children.length, 0);
  assert.equal(f.run('peer'), null);
  f.get('nickname-cancel').dispatchEvent(new Event('click'));
  assert.equal(f.get('head').children.length, 1);
  assert.equal(f.get('nickname-screen').hidden, true);
  f.run('initViewer()');
  assert.equal(f.get('head').children.length, 1);
  const failed = f.get('head').children[0];
  failed.dispatchEvent(new Event('error'));
  assert.equal(failed.removed, true);
  assert.equal(f.get('card-btn').disabled, false);
  assert.equal(f.get('card-btn').style.display, 'inline-flex');
  assert.equal(f.get('body').classList.contains('is-connecting'), false);
  f.get('card-btn').onclick();
  assert.equal(f.get('head').children.length, 2);
  f.providePeer();
  f.get('head').children[1].dispatchEvent(new Event('load'));
  assert.ok(f.run('peer'));
  assert.equal(f.get('card-btn').style.display, 'none');
});

test('a remembered nickname skips the entry and starts the deferred script immediately', () => {
  const f = fixture('view', { nickname: 'Ana', peerAvailable: false });
  assert.equal(f.get('nickname-screen').hidden, true);
  assert.equal(f.get('app-main').hidden, false);
  assert.equal(f.get('head').children.length, 1);
  f.providePeer();
  f.get('head').children[0].dispatchEvent(new Event('load'));
  assert.ok(f.run('peer'));
});

test('the local nickname preview stays available for layout review even with a remembered name', () => {
  const f = fixture('view', { nickname: 'Ana', peerAvailable: false, preview: 'nickname' });
  assert.equal(f.run('peer'), null);
  assert.equal(f.get('head').children.length, 0);
  assert.equal(f.get('nickname-screen').hidden, false);
  assert.equal(f.get('app-main').hidden, true);
});

test('nicknames update existing calls as safe text, remain bounded and keep legacy viewers working', async () => {
  const f = fixture(); await f.run('startHostStream()');
  const conn = f.connect();
  conn.emit('data', { type: 'VIEWER_PROFILE', nickname: '  Ana\nSilva\u202e  ' });
  assert.equal(f.get('audience-list').children.length, 0);
  conn.emit('data', 'REQUEST_STREAM');
  assert.equal(f.get('audience-list').children[0].children[1].textContent, 'Ana Silva');
  assert.equal(f.get('audience-list').children[0].children[0].hidden, true);
  assert.equal(f.get('audience-identity').hidden, false);
  conn.emit('data', { type: 'VIEWER_PROFILE', nickname: '<img src=x onerror=x>' });
  assert.equal(f.get('audience-list').children[0].children[1].textContent, '<img src=x onerror=x>');
  conn.emit('data', { type: 'VIEWER_PROFILE', nickname: '🦊'.repeat(100) });
  assert.equal(Array.from(f.get('audience-list').children[0].children[1].textContent).length, 24);
  assert.equal(f.run('peer').calls.length, 1);
  conn.emit('data', { type: 'VIEWER_PROFILE', nickname: {} });
  assert.equal(Array.from(f.get('audience-list').children[0].children[1].textContent).length, 24);
  conn.emit('data', { type: 'VIEWER_PROFILE', nickname: '' });
  assert.equal(f.get('audience-list').children[0].children[1].textContent, 'Espectador 01');
  assert.equal(f.get('audience-identity').hidden, true);
});

test('editing, cancelling and clearing a nickname preserve media and resend the latest profile on reconnect', () => {
  const f = fixture('view', { nickname: 'Ana' });
  const peer = f.run('peer'); peer.emit('open');
  const conn = f.run('viewerDataConnection'); conn.emit('open');
  f.run('viewerConnected = true; showPlayer()');
  f.get('edit-player-nickname').dispatchEvent(new Event('click'));
  f.get('viewer-nickname').value = 'Não salvar';
  f.get('nickname-cancel').dispatchEvent(new Event('click'));
  assert.equal(f.run('viewerNickname'), 'Ana');
  f.get('edit-player-nickname').dispatchEvent(new Event('click'));
  f.get('viewer-nickname').value = 'Guilherme';
  f.get('nickname-form').dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(conn.sent.nickname, 'Guilherme');
  assert.equal(f.run('peer'), peer);
  assert.equal(f.run('viewerConnected'), true);
  conn.close();
  f.run('connectToHost()');
  const replacement = f.run('viewerDataConnection'); replacement.emit('open');
  assert.equal(replacement.messages[0].nickname, 'Guilherme');
  f.get('edit-waiting-nickname').dispatchEvent(new Event('click'));
  f.get('viewer-nickname').value = '';
  f.get('nickname-form').dispatchEvent(new Event('submit', { cancelable: true }));
  assert.equal(replacement.sent.nickname, '');
});

test('obsolete data channels cannot rename a replacement and ending clears all nicknames', async () => {
  const f = fixture(); await f.run('startHostStream()');
  const old = f.connect(); old.emit('data', { type: 'VIEWER_PROFILE', nickname: 'Ana' });
  old.emit('data', 'REQUEST_STREAM');
  const current = f.connect();
  current.emit('data', { type: 'VIEWER_PROFILE', nickname: 'Bia' });
  old.emit('data', { type: 'VIEWER_PROFILE', nickname: 'Obsoleto' }); old.emit('close');
  assert.equal(f.run('viewerNicknames.get("viewer")'), 'Bia');
  f.run('stopHostStream()');
  assert.equal(f.run('viewerNicknames.size'), 0);
});

// These settings come from upstream. UI integration must keep all three profiles
// effective before capture and while existing spectators remain connected.
test('quality choices control capture and existing senders without replacing media calls', async () => {
  const f = fixture();
  let requested;
  const capture = f.run('navigator.mediaDevices.getDisplayMedia');
  const stream = await capture();
  const track = stream.getVideoTracks()[0];
  track.contentHint = '';
  track.applyConstraints = async value => { track.constraints = value; };
  f.run('navigator.mediaDevices').getDisplayMedia = async options => { requested = options; return stream; };
  await f.run('setQuality("light"); startHostStream()');
  assert.equal(requested.video.width.ideal, 1280);
  assert.equal(requested.video.frameRate.max, 30);
  assert.equal(track.contentHint, 'motion');
  f.connect().emit('data', 'REQUEST_STREAM');
  const call = f.run('peer').calls[0];
  assert.equal(call.senders[0].parameters.encodings[0].maxBitrate, 2500000);
  assert.equal(call.senders[0].parameters.encodings[0].maxFramerate, 30);
  assert.equal(call.senders[0].parameters.degradationPreference, 'balanced');
  assert.equal(typeof call.options.sdpTransform, 'function');
  await f.run('setQuality("fluid")');
  assert.equal(track.constraints.height.ideal, 1080);
  assert.equal(track.constraints.frameRate.max, 60);
  assert.equal(call.senders[0].parameters.degradationPreference, 'maintain-framerate');
  await f.run('setQuality("sharp")');
  assert.equal(track.contentHint, 'detail');
  assert.equal(call.senders[0].parameters.degradationPreference, 'maintain-resolution');
  assert.equal(f.run('peer').calls.length, 1);
});

test('upstream bitrate limits follow the real audience and recover when viewers depart', async () => {
  const f = fixture(); await f.run('startHostStream()');
  const connections = [];
  for (let i = 0; i < 4; i++) {
    const conn = f.connect('viewer-' + i);
    connections.push(conn); conn.emit('data', 'REQUEST_STREAM');
    const expected = [8500000, 6000000, 4500000, 3500000][i];
    assert.ok(f.run('peer').calls.every(call => call.senders[0].parameters.encodings[0].maxBitrate === expected));
  }
  connections[3].close();
  assert.equal(f.run('peer').calls[0].senders[0].parameters.encodings[0].maxBitrate, 4500000);
});

test('failed P2P shows upstream network guidance and a recovered stream clears the blocked state', () => {
  const f = fixture('view'); const peer = f.run('peer'); peer.emit('open');
  const conn = f.run('viewerDataConnection');
  conn.peerConnection.connectionState = 'failed';
  conn.peerConnection.dispatchEvent(new Event('connectionstatechange'));
  assert.equal(f.get('card-title').children.filter(child => typeof child === 'string').join(''), 'Não foi possível conectar');
  assert.match(f.get('card-desc').textContent, /4G\/5G/);
  const call = new EventEmitter(); call.answer = () => {};
  f.get('screen-video').play = async () => {};
  peer.emit('call', call); call.emit('stream', {});
  assert.equal(f.run('networkBlocked'), false);
  assert.equal(f.run('viewerConnected'), true);
});
