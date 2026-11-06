import test from 'node:test';
import assert from 'node:assert/strict';
import { attachQualityFlow } from '../public/quality-flow.mjs';

function fixture({ reduced = false, supported = true, compiled = true, live = true, complete = true } = {}) {
  const frames = new Map(), observers = [];
  let next = 0, now = 0, top = 20, draws = 0, reads = 0, contexts = 0, programs = 0, deleted = 0;
  const targets = [], poses = [], pointers = [], ripples = [];
  let textures = 0, removedTextures = 0, removedTargets = 0;
  const gl = {
    createProgram() { programs++; return {}; }, createShader: () => ({}), shaderSource() {}, compileShader() {},
    getShaderParameter: () => compiled, attachShader() {}, deleteShader() {}, linkProgram() {},
    getProgramParameter: () => true, getUniformLocation: (_, name) => name,
    useProgram() {}, disable() {}, enable() {}, clearColor() {}, clear() {}, viewport() {},
    uniform1f() {}, uniform2f() {}, uniform3fv(name, value) { if (name === 'pointer') pointers.push([...value]); if (name === 'ripple') ripples.push([...value]); },
    drawArrays() { draws++; }, deleteProgram() { deleted++; },
    createTexture() { textures++; return {}; }, bindTexture() {}, texParameteri() {},
    texImage2D(...args) { if (args.length === 9) targets.push([args[3], args[4]]); },
    createFramebuffer: () => ({}), bindFramebuffer() {}, framebufferTexture2D() {},
    FRAMEBUFFER_COMPLETE: 1, checkFramebufferStatus: () => complete ? 1 : 0,
    activeTexture() {}, uniform1i() {}, uniform4fv(name, values) { if (name === 'sharks[0]') poses.push([...values]); },
    deleteTexture() { removedTextures++; }, deleteFramebuffer() { removedTargets++; },

  };
  class Element extends EventTarget {
    constructor() { super(); this.dataset = {}; this.hidden = false; this.width = 0; this.height = 0; }
    setAttribute() {}
    getContext(kind) {
      if (kind === '2d') return { fillRect() {}, fillText() {} };
      assert.equal(kind, 'webgl2'); contexts++; return supported ? gl : null;
    }
    remove() { this.removed = true; }
  }
  const root = new Element();
  root.getBoundingClientRect = () => { reads++; return { width: 600, height: 128, top, bottom: top + 128, left: 0 }; };
  const cards = ['sharp', 'fluid', 'light'].map((value, i) => ({
    input: { value, checked: i === 0 },
    querySelector() { return this.input; },
    getBoundingClientRect() { reads++; return { left: i * 204, right: i * 204 + 192, top, bottom: top + 128, width: 192, height: 128 }; }
  }));
  root.querySelectorAll = () => cards;
  root.prepend = value => { root.canvas = value; };
  const motion = new EventTarget(); motion.matches = reduced;
  const contrast = new EventTarget(); contrast.matches = false;
  const view = new EventTarget();
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {} disconnect() { this.disconnected = true; }
  }
  Object.assign(view, { innerHeight: 800, devicePixelRatio: 3, ResizeObserver: Observer, IntersectionObserver: Observer,
    matchMedia: query => query.includes('reduced-motion') ? motion : contrast,
    performance: { now: () => now },
    requestAnimationFrame(callback) { frames.set(++next, callback); return next; },
    cancelAnimationFrame(id) { frames.delete(id); }
  });
  const body = new Element(), player = new Element(), doc = new EventTarget();
  body.classList = { active: live, contains() { return this.active; } };
  Object.assign(doc, { defaultView: view, body, hidden: false, createElement: () => new Element(), getElementById: () => player });
  const dispose = attachQualityFlow(root, doc);
  return { root, view, doc, body, player, motion, contrast, frames, observers, targets, poses, pointers, ripples, cards, dispose,
    get draws() { return draws; }, get reads() { return reads; }, get contexts() { return contexts; },
    get programs() { return programs; }, get deleted() { return deleted; },
    get textures() { return textures; }, get removedTextures() { return removedTextures; }, get removedTargets() { return removedTargets; },
    flush(time = now) { now = time; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(now)); },
    intersect(visible) { observers[1].callback([{ isIntersecting: visible }]); this.flush(); },
    move(value) { top = value; view.dispatchEvent(new Event('scroll')); this.flush(); }
  };
}

test('live cards use the same bounded ocean and retain one renderer across frames', () => {
  const f = fixture(); f.flush();
  assert.equal(f.root.dataset.qualityScene, 'ascii-ocean');
  assert.equal(f.contexts, 1); assert.equal(f.programs, 2); assert.equal(f.textures, 2);
  assert.equal(f.draws, 2); assert.deepEqual(f.targets, [[120, 16]]);
  assert.ok(f.root.canvas.width * f.root.canvas.height <= 360000);
  const reads = f.reads;
  f.flush(8); assert.equal(f.draws, 2);
  f.flush(17); assert.equal(f.draws, 4); assert.equal(f.reads, reads);
  assert.equal(f.targets.length, 1);
  const same = attachQualityFlow(f.root, f.doc); same(); assert.equal(f.contexts, 1);
  f.dispose(); assert.equal(f.frames.size, 0); assert.equal(f.deleted, 2);
  assert.equal(f.removedTextures, 2); assert.equal(f.removedTargets, 1);
});

test('touch leaves the ocean undisturbed and mouse and radio changes use cached layout', () => {
  const active = fixture(), control = fixture(); active.flush(); control.flush();
  const reads = active.reads;
  const pointer = type => Object.assign(new Event('pointermove'), { clientX: 150, clientY: 55, pointerType: type });
  active.root.dispatchEvent(pointer('touch')); active.flush(34); control.flush(34);
  assert.deepEqual(active.pointers.at(-1), control.pointers.at(-1));
  active.root.dispatchEvent(pointer('mouse')); active.flush(68); control.flush(68);
  assert.notDeepEqual(active.pointers.at(-1), control.pointers.at(-1));
  const change = new Event('change'); Object.defineProperty(change, 'target', { value: active.cards[0].input });
  active.root.dispatchEvent(change); active.flush(102);
  assert.deepEqual(active.ripples.at(-1).slice(0, 2), [96, 128 * .28]);
  active.root.dispatchEvent(new Event('pointerleave')); active.flush(136);
  assert.ok(active.pointers.at(-1)[2] < 1);
  assert.equal(active.reads, reads); assert.equal(active.programs, 2);
  active.dispose(); control.dispose();
});

test('resize reuses ocean resources and failed targets release every allocated GPU object', () => {
  const f = fixture(); f.flush();
  f.view.devicePixelRatio = 1; f.view.dispatchEvent(new Event('resize')); f.flush(34);
  assert.equal(f.programs, 2); assert.equal(f.textures, 2); assert.equal(f.contexts, 1);
  assert.deepEqual(f.targets, [[120, 16]]); f.dispose();
  const failed = fixture({ complete: false }); failed.flush();
  assert.equal(failed.root.canvas.hidden, true); assert.equal(failed.frames.size, 0);
  assert.equal(failed.deleted, 2); assert.equal(failed.removedTextures, 2);
  assert.equal(failed.removedTargets, 1); failed.dispose();
});

test('motion and contrast preferences avoid WebGL; unsupported or invalid shaders retain static cards', () => {
  for (const options of [{ reduced: true }, { supported: false }, { compiled: false },
    { reduced: true, live: false }, { supported: false, live: false }, { compiled: false, live: false }, { complete: false }]) {
    const f = fixture(options); f.flush();
    assert.equal(f.draws, 0); assert.equal(f.frames.size, 0); assert.equal(f.root.canvas.hidden, true);
    assert.equal(f.root.dataset.flowRenderer, undefined);
    f.dispose();
  }
  const f = fixture(); f.contrast.matches = true; f.flush();
  assert.equal(f.contexts, 0); assert.equal(f.frames.size, 0); f.dispose();
});

test('hidden, offscreen and capture-pending states pause rendering, then reuse the program', () => {
  const f = fixture(); f.flush();
  f.intersect(false); const draws = f.draws;
  assert.equal(f.frames.size, 0); assert.equal(f.root.canvas.hidden, true);
  f.intersect(true); assert.equal(f.draws, draws + 2); assert.equal(f.programs, 2);
  f.doc.hidden = true; f.doc.dispatchEvent(new Event('visibilitychange')); f.flush();
  assert.equal(f.frames.size, 0);
  f.doc.hidden = false; f.doc.dispatchEvent(new Event('visibilitychange')); f.flush();
  f.body.dataset.capturePending = 'true'; f.body.dispatchEvent(new Event('hostcapturechange')); f.flush();
  assert.equal(f.frames.size, 0);
  delete f.body.dataset.capturePending; f.body.dispatchEvent(new Event('hostcapturechange')); f.flush();
  assert.equal(f.root.dataset.flowRenderer, 'webgl2'); assert.equal(f.programs, 2);
  f.motion.matches = true; f.motion.dispatchEvent(new Event('change')); f.flush();
  assert.equal(f.frames.size, 0); assert.equal(f.root.canvas.hidden, true);
  f.dispose();
});

test('context loss, restoration, bfcache and disposal have bounded resource lifetimes', () => {
  const f = fixture(); f.flush();
  f.root.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  assert.equal(f.frames.size, 0); assert.equal(f.root.canvas.hidden, true);
  f.root.canvas.dispatchEvent(new Event('webglcontextrestored')); f.flush();
  assert.equal(f.root.dataset.flowRenderer, 'webgl2'); assert.equal(f.programs, 4);
  f.view.dispatchEvent(new Event('pagehide')); assert.equal(f.frames.size, 0);
  f.view.dispatchEvent(new Event('pageshow')); f.flush(); assert.equal(f.programs, 6);
  f.move(900); assert.equal(f.frames.size, 0);
  f.move(20); assert.equal(f.root.dataset.flowRenderer, 'webgl2');
  f.dispose(); assert.ok(f.observers.every(observer => observer.disconnected));
  assert.equal(f.root.canvas.removed, true); assert.equal(f.root.dataset.flowAttached, undefined);
  f.player.dispatchEvent(new Event('playerstatechange')); assert.equal(f.frames.size, 0);
});

test('preparation samples one shared ocean per cell and retains its resources across interaction', () => {
  const f = fixture({ live: false }); f.flush();
  assert.equal(f.root.dataset.qualityScene, 'ascii-ocean');
  assert.equal(f.root.dataset.flowRenderer, 'webgl2');
  assert.equal(f.contexts, 1); assert.equal(f.programs, 2); assert.equal(f.textures, 2);
  assert.equal(f.draws, 2); assert.deepEqual(f.targets, [[120, 16]]);
  const reads = f.reads;
  f.root.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 210, clientY: 55, pointerType: 'mouse' }));
  f.flush(34);
  assert.equal(f.draws, 4); assert.equal(f.reads, reads);
  assert.equal(f.targets.length, 1); assert.equal(f.textures, 2);
  assert.notDeepEqual(f.poses[0], f.poses[1]);
  f.dispose();
  assert.equal(f.deleted, 2); assert.equal(f.removedTextures, 2); assert.equal(f.removedTargets, 1);
});

test('capture pauses the ocean and both host transitions preserve its renderer and animation time', () => {
  const f = fixture({ live: false }); f.flush(); f.flush(17);
  f.body.dataset.capturePending = 'true'; f.body.dispatchEvent(new Event('hostcapturechange')); f.flush(34);
  assert.equal(f.frames.size, 0); assert.equal(f.draws, 4);
  f.body.classList.active = true; delete f.body.dataset.capturePending;
  f.player.dispatchEvent(new Event('playerstatechange')); f.flush(68);
  assert.equal(f.root.dataset.qualityScene, 'ascii-ocean'); assert.equal(f.programs, 2);
  assert.equal(f.deleted, 0); assert.equal(f.removedTextures, 0); assert.equal(f.removedTargets, 0);
  assert.equal(f.draws, 6); assert.deepEqual(f.poses.at(-1), f.poses.at(-2));
  f.body.classList.active = false; f.player.dispatchEvent(new Event('playerstatechange')); f.flush(102);
  assert.equal(f.root.dataset.qualityScene, 'ascii-ocean'); assert.equal(f.programs, 2); assert.equal(f.draws, 8);
  assert.equal(f.contexts, 1);
  f.dispose(); assert.equal(f.deleted, 2); assert.equal(f.removedTextures, 2); assert.equal(f.removedTargets, 1);
});

test('ocean context loss and bfcache rebuild the bounded targets and leave no animation after disposal', () => {
  const f = fixture({ live: false }); f.flush();
  f.root.canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  assert.equal(f.frames.size, 0);
  f.root.canvas.dispatchEvent(new Event('webglcontextrestored')); f.flush(50);
  assert.equal(f.draws, 4); assert.equal(f.targets.length, 2);
  f.view.dispatchEvent(new Event('pagehide')); assert.equal(f.frames.size, 0);
  f.view.dispatchEvent(new Event('pageshow')); f.flush(100);
  assert.equal(f.draws, 6); f.dispose();
  f.player.dispatchEvent(new Event('playerstatechange')); assert.equal(f.frames.size, 0);
});
