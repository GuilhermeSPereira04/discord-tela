import test from 'node:test';
import assert from 'node:assert/strict';
import { attachHostDiorama } from '../public/host-diorama.mjs';

function fixture({ reduced = false, supported = true } = {}) {
  const workers = [];
  const motion = new EventTarget(); motion.matches = reduced;
  const poster = { dataset: { src: '/diorama/poster.jpg' }, getAttribute(name) { return this[name] || null; } };
  const container = { dataset: {}, children: [], getBoundingClientRect: () => ({ width: 350 }), querySelector: () => poster, append(canvas) { canvas.parent = this; this.children.push(canvas); } };
  class Canvas {
    setAttribute() {}
    transferControlToOffscreen() { return {}; }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
  }
  class Worker {
    constructor() { this.messages = []; workers.push(this); }
    postMessage(message) { this.messages.push(message.type); }
    terminate() { this.terminated = true; }
  }
  const body = new EventTarget(); body.dataset = {};
  body.classList = { active: false, contains() { return this.active; } };
  const view = new EventTarget();
  Object.assign(view, { AbortController, Worker: supported ? Worker : undefined, HTMLCanvasElement: Canvas, matchMedia: () => motion });
  const doc = new EventTarget();
  Object.assign(doc, { defaultView: view, body, hidden: false, createElement: () => new Canvas() });
  const player = new EventTarget();
  const controller = attachHostDiorama(container, player, doc);
  return { workers, container, poster, doc, motion, body, player, controller,
    ready() { workers.at(-1).onmessage({ data: { type: 'ready', bootMs: 100, calls: 27, triangles: 1 } }); },
    capture(value) { if (value) body.dataset.capturePending = 'true'; else delete body.dataset.capturePending; body.dispatchEvent(new Event('hostcapturechange')); } };
}

test('capture interrupts even an unfinished bake and a stale ready cannot restart it', () => {
  const f = fixture();
  const first = f.workers[0];
  f.capture(true);
  assert.equal(first.terminated, true);
  assert.equal(f.container.children.length, 0);
  first.onmessage({ data: { type: 'ready' } });
  assert.equal(f.container.dataset.state, 'idle');
  assert.equal(f.workers.length, 1);
  f.controller.dispose();
});

test('cancelled capture restarts; live capture keeps all decorative workers stopped', () => {
  const f = fixture();
  f.capture(true); f.capture(false);
  assert.equal(f.workers.length, 2);
  f.capture(true);
  f.body.classList.active = true;
  f.capture(false);
  assert.equal(f.workers.length, 2);
  assert.equal(f.container.children.length, 0);
  f.body.classList.active = false;
  f.player.dispatchEvent(new Event('playerstatechange'));
  assert.equal(f.workers.length, 3);
  f.controller.dispose();
});

test('a hidden page pauses a ready worker and resumes without another bake', () => {
  const f = fixture(); f.ready();
  f.doc.hidden = true; f.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.workers[0].messages.at(-1), 'pause');
  assert.equal(f.container.dataset.state, 'paused');
  f.doc.hidden = false; f.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.workers[0].messages.at(-1), 'resume');
  assert.equal(f.workers.length, 1);
  f.controller.dispose();
});

test('reduced motion and missing OffscreenCanvas support leave a static poster', () => {
  for (const options of [{ reduced: true }, { supported: false }]) {
    const f = fixture(options);
    assert.equal(f.workers.length, 0);
    assert.equal(f.container.children.length, 0);
    assert.equal(f.container.dataset.state, 'fallback');
    assert.equal(f.poster.src, '/diorama/poster.jpg');
    f.controller.dispose();
  }
});

test('worker failure leaves the poster and disposal removes lifecycle listeners', () => {
  const f = fixture();
  f.workers[0].onmessage({ data: { type: 'error' } });
  assert.equal(f.workers[0].terminated, true);
  assert.equal(f.container.dataset.state, 'fallback');
  assert.equal(f.poster.src, '/diorama/poster.jpg');
  f.controller.dispose();
  f.capture(true); f.capture(false);
  assert.equal(f.workers.length, 1);
});

test('normal startup reveals the live canvas without requesting a still image', () => {
  const f = fixture();
  assert.equal(f.container.dataset.state, 'loading');
  assert.equal(f.poster.getAttribute('src'), null);
  f.ready();
  assert.equal(f.container.dataset.state, 'running');
  assert.equal(f.poster.getAttribute('src'), null);
  f.capture(true); f.capture(false);
  assert.equal(f.container.dataset.state, 'loading');
  assert.equal(f.poster.getAttribute('src'), null);
  f.controller.dispose();
});

test('changing reduced motion swaps between genuine fallback and live startup', () => {
  const f = fixture(); f.ready();
  f.motion.matches = true; f.motion.dispatchEvent(new Event('change'));
  assert.equal(f.workers[0].terminated, true);
  assert.equal(f.container.dataset.state, 'fallback');
  assert.equal(f.poster.src, '/diorama/poster.jpg');
  f.motion.matches = false; f.motion.dispatchEvent(new Event('change'));
  assert.equal(f.container.dataset.state, 'loading');
  assert.equal(f.workers.length, 2);
  f.ready();
  assert.equal(f.container.dataset.state, 'running');
  f.controller.dispose();
});
