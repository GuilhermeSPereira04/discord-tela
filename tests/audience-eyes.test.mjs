import test from 'node:test';
import assert from 'node:assert/strict';
import { attachAudienceEyes, eyeVariants, createEyeAssignments, gazeAt, gazePeriod } from '../public/audience-eyes.mjs';

test('gaze remains bounded, holds still, wraps continuously and gives eye pairs separate phases', () => {
  for (let time = 0; time < gazePeriod * 2; time += 13) {
    const sample = gazeAt(time);
    assert.ok(Number.isFinite(sample.gaze) && Math.abs(sample.gaze) <= 0.78);
    assert.ok(sample.remaining > 0);
  }
  assert.equal(gazeAt(300).gaze, gazeAt(2000).gaze);
  assert.equal(gazeAt(300).moving, false);
  assert.ok(Math.abs(gazeAt(gazePeriod - 0.001).gaze - gazeAt(0).gaze) < 0.001);
  assert.notEqual(gazeAt(100).gaze, gazeAt(100, 751).gaze);
});

function fixture({ reduced = false, supported = true, count = 2, random = () => 0 } = {}) {
  const frames = new Map(), timers = new Map(), observers = [], canvases = [], contexts = new Set();
  let next = 0, now = 0, rootTop = 0, draws = 0, programs = 0, deleted = 0, uploads = 0;
  const patterns = [];
  const motion = new EventTarget(); motion.matches = reduced;
  const view = new EventTarget();
  const gl = {
    createProgram() { programs++; return {}; }, createShader: () => ({}),
    shaderSource() {}, compileShader() {}, getShaderParameter: () => true,
    attachShader() {}, deleteShader() {}, linkProgram() {}, getProgramParameter: () => true,
    useProgram() {}, createTexture: () => ({}), bindTexture() {}, texParameteri() {},
    texImage2D() { uploads++; }, uniform1i(name, value) { if (name === 'pattern') patterns.push(value); }, getUniformLocation: (_program, name) => name,
    uniform3fv() {}, uniform4fv() {},
    uniform1f() {}, viewport() {}, clearColor() {}, clear() {},
    drawArrays() { draws++; }, deleteTexture() {}, deleteProgram() { deleted++; },
  };
  class Element extends EventTarget {
    constructor(tag) { super(); this.tag = tag; this.dataset = {}; this.style = {}; this.children = []; this.textContent = ''; this.hidden = false;
      const classes = new Set(); this.classList = { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) }; }
    setAttribute() {}
    removeAttribute() {}
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    remove() { this.removed = true; }
    getContext() { contexts.add(this); return supported ? gl : null; }
  }
  const root = new Element('ul');
  root.parentElement = { getBoundingClientRect: () => ({ top: 0, left: 0 }) };
  root.getBoundingClientRect = () => ({ top: rootTop, bottom: rootTop + root.children.length * 64 });
  root.before = canvas => canvases.push(canvas);
  function row(index) {
    const element = new Element('li'); element.dataset.named = 'true';
    const marker = new Element('span'); marker.textContent = String(index).padStart(2, '0'); marker.hidden = true;
    marker.closest = () => element;
    marker.getBoundingClientRect = () => ({ top: rootTop + (index - 1) * 64, bottom: rootTop + (index - 1) * 64 + 32, height: 32, width: 68, left: 0 });
    element.querySelector = () => marker;
    return element;
  }
  root.children = Array.from({ length: count }, (_, i) => row(i + 1));
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {} disconnect() { this.disconnected = true; }
  }
  Object.assign(view, { innerHeight: 800, devicePixelRatio: 2,
    MutationObserver: Observer, ResizeObserver: Observer,
    matchMedia: () => motion, performance: { now: () => now },
    requestAnimationFrame(callback) { frames.set(++next, callback); return next; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(callback, delay) { timers.set(++next, { callback, delay }); return next; },
    clearTimeout(id) { timers.delete(id); },
  });
  const doc = new EventTarget(); Object.assign(doc, { defaultView: view, hidden: false, createElement: tag => new Element(tag) });
  const dispose = attachAudienceEyes(root, doc, { random });
  return { root, doc, view, motion, frames, timers, canvases, contexts, observers, dispose,
    patterns, get uploads() { return uploads; }, get draws() { return draws; }, get programs() { return programs; }, get deleted() { return deleted; },
    flush(time = now) { now = time; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); },
    move(top) { rootTop = top; view.dispatchEvent(new Event('scroll')); this.flush(); },
    replace() { root.children = root.children.map((_, i) => row(i + 1)); observers[0].callback(); this.flush(); },
  };
}

test('all visible eye pairs share one context and holds schedule no continuous animation frames', () => {
  const f = fixture(); f.flush();
  assert.equal(f.contexts.size, 1); assert.equal(f.draws, 2);
  assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 1);
  assert.equal(f.root.dataset.eyesRenderer, 'webgl2');
  f.replace();
  assert.equal(f.programs, 1);
  assert.equal(f.root.children[0].querySelector().dataset.eyesKey, '01');
  f.dispose(); assert.equal(f.timers.size, 0); assert.equal(f.deleted, 1);
});

test('reduced motion and unsupported WebGL keep the static neon eye pairs', () => {
  for (const options of [{ reduced: true }, { supported: false }]) {
    const f = fixture(options); f.flush();
    assert.equal(f.draws, 0); assert.equal(f.timers.size, 0);
    assert.equal(f.root.dataset.eyesRenderer, undefined);
    assert.ok(f.root.children[0].querySelector().children[0].innerHTML.includes('radialGradient'));
    f.dispose();
  }
});

test('five stable iris and pupil variants use a single renderer without texture uploads', () => {
  const ids = eyeVariants.map(variant => variant.id);
  assert.deepEqual(ids, ['ice','red','gold','green','violet']);
  assert.equal(new Set(eyeVariants.map(variant=>variant.pattern)).size,5);
  const f=fixture({count:5}); f.flush();
  assert.equal(f.contexts.size,1); assert.equal(f.programs,1); assert.equal(f.uploads,0);
  assert.equal(f.draws,5); assert.deepEqual(f.patterns,[0,1,2,3,4]);
  assert.deepEqual(f.root.children.map(row=>row.querySelector().dataset.eyeStyle),ids);
  f.replace(); assert.equal(f.programs,1); assert.equal(f.uploads,0);
  assert.deepEqual(f.root.children.map(row=>row.querySelector().dataset.eyeStyle),ids);
  f.dispose();
});

test('new connections draw randomly without repeats among five, while existing identities stay fixed', () => {
  let draws = 0;
  const first = createEyeAssignments(() => { draws++; return 0; });
  const second = createEyeAssignments(() => 0.999);
  const keys = ['01','02','03','04','05'];
  const firstIds = keys.map(key => first.get(key).id);
  const secondIds = keys.map(key => second.get(key).id);
  assert.equal(new Set(firstIds).size,5);
  assert.equal(new Set(secondIds).size,5);
  assert.notDeepEqual(firstIds,secondIds);
  assert.deepEqual(keys.map(key=>first.get(key).id),firstIds);
  assert.equal(draws,5);
  first.retain(keys.slice(0,4));
  assert.equal(first.get('06').id,firstIds[4]);
  const balanced = createEyeAssignments(() => .4);
  const styles = Array.from({length:12},(_,index)=>balanced.get(String(index)).id);
  const counts = eyeVariants.map(variant=>styles.filter(id=>id===variant.id).length);
  assert.ok(Math.max(...counts)-Math.min(...counts)<=1);
});

test('hidden pages stop scheduling and scrolling out releases resources that can be recreated', () => {
  const f = fixture(); f.flush();
  f.doc.hidden = true; f.doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
  f.doc.hidden = false; f.doc.dispatchEvent(new Event('visibilitychange')); f.flush();
  assert.equal(f.programs, 1);
  f.move(1000); assert.equal(f.deleted, 1); assert.equal(f.timers.size, 0);
  f.move(0); assert.equal(f.programs, 2); assert.equal(f.contexts.size, 1);
  f.motion.matches = true; f.motion.dispatchEvent(new Event('change')); f.flush();
  assert.equal(f.root.dataset.eyesRenderer, undefined);
  f.motion.matches = false; f.motion.dispatchEvent(new Event('change')); f.flush();
  assert.equal(f.root.dataset.eyesRenderer, 'webgl2');
  f.dispose();
});

test('context loss restores static eyes and disposal removes observers, canvas and decorations', () => {
  const f = fixture(); f.flush();
  f.canvases[0].dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  assert.equal(f.root.dataset.eyesRenderer, undefined); assert.equal(f.timers.size, 0);
  f.view.dispatchEvent(new Event('pageshow')); f.flush(); assert.equal(f.programs, 1);
  f.dispose();
  assert.equal(f.canvases[0].removed, true);
  assert.ok(f.observers.every(observer => observer.disconnected));
  assert.equal(f.root.children[0].querySelector().textContent, '01');
  assert.equal(f.root.children[0].querySelector().hidden, true);
  f.view.dispatchEvent(new Event('resize')); assert.equal(f.frames.size, 0);
});
