import test from 'node:test';
import assert from 'node:assert/strict';
import { attachVolumeDisclosure } from '../public/player-controls.mjs';

// Exercise disclosure/focus lifetime without replacing the browser's native
// range drag or claiming to emulate its vertical track geometry.
function fixture(touch = false) {
  const doc = new EventTarget();
  const view = new EventTarget();
  const media = new EventTarget();
  media.matches = touch;
  view.matchMedia = () => media;
  doc.defaultView = view;
  function node(parent) {
    const element = new EventTarget();
    element.parent = parent;
    element.attrs = new Map();
    const classes = new Set();
    element.classList = { toggle(name, on) { on ? classes.add(name) : classes.delete(name); }, contains: name => classes.has(name) };
    element.setAttribute = (name, value) => element.attrs.set(name, value);
    element.contains = other => {
      for (let current = other; current; current = current.parent) if (current === element) return true;
      return false;
    };
    element.matches = () => Boolean(element.keyboard);
    element.focus = () => {
      doc.activeElement = element;
      audio.dispatchEvent(new Event('focusin'));
    };
    return element;
  }
  const audio = node();
  const toggle = node(audio);
  const panel = node(audio);
  const mute = node(panel);
  const range = node(panel);
  const volume = node(range);
  audio.querySelector = selector => ({ '#volume-toggle': toggle, '#mute-btn': mute, '#volume-panel': panel, '.volume-control': range })[selector];
  const controller = attachVolumeDisclosure(audio, volume, doc);
  function emit(target, name, fields = {}) {
    const event = Object.assign(new Event(name, { cancelable: true }), fields);
    target.dispatchEvent(event);
    return event;
  }
  return { doc, view, media, audio, toggle, panel, mute, range, volume, controller, emit,
    get open() { return toggle.attrs.get('aria-expanded') === 'true'; } };
}

test('touch trigger opens a vertical panel without muting; outside tap closes hidden tab stops', () => {
  const f = fixture(true);
  let mutes = 0;
  f.mute.addEventListener('click', () => mutes++);
  assert.equal(f.volume.attrs.get('aria-orientation'), 'vertical');
  assert.equal(f.range.inert, true);
  assert.equal(f.mute.inert, true);
  f.emit(f.toggle, 'click');
  assert.equal(f.open, true);
  assert.equal(f.range.inert, false);
  assert.equal(f.mute.inert, false);
  assert.equal(mutes, 0);
  f.emit(f.doc, 'pointerdown');
  assert.equal(f.open, false);
  assert.equal(f.panel.attrs.get('aria-hidden'), 'true');
  assert.equal(f.range.inert, true);
});

test('Escape closes the volume first and returns focus to its touch trigger', () => {
  const f = fixture(true);
  f.emit(f.toggle, 'click');
  f.volume.focus();
  const event = f.emit(f.doc, 'keydown', { key: 'Escape' });
  assert.equal(event.defaultPrevented, true);
  assert.equal(f.doc.activeElement, f.toggle);
  assert.equal(f.open, false);
});

test('desktop hover stays expanded while dragging outside and closes after release or cancellation', () => {
  const f = fixture();
  assert.equal(f.toggle.inert, true);
  assert.equal(f.mute.inert, false);
  assert.equal(f.volume.attrs.get('aria-orientation'), 'horizontal');
  f.emit(f.audio, 'pointerenter', { pointerType: 'touch' });
  assert.equal(f.open, false);
  for (const ending of ['pointerup', 'pointercancel']) {
    f.emit(f.audio, 'pointerenter', { pointerType: 'mouse' });
    f.emit(f.volume, 'pointerdown');
    f.emit(f.audio, 'pointerleave');
    assert.equal(f.open, true);
    f.emit(f.doc, ending);
    assert.equal(f.open, false);
  }
});

test('keyboard focus reveals the desktop range and leaving the group closes it', () => {
  const f = fixture();
  f.mute.keyboard = true;
  f.mute.focus();
  assert.equal(f.open, true);
  f.emit(f.mute, 'keydown', { key: 'ArrowUp' });
  assert.equal(f.doc.activeElement, f.volume);
  f.volume.keyboard = true;
  f.emit(f.audio, 'pointerleave');
  assert.equal(f.open, true);
  f.doc.activeElement = null;
  f.emit(f.audio, 'focusout', { relatedTarget: null });
  assert.equal(f.open, false);
});

test('changing interaction mode, losing the window or hiding player chrome resets disclosure', () => {
  const f = fixture();
  f.mute.focus();
  f.volume.focus();
  f.media.matches = true;
  f.emit(f.media, 'change');
  assert.equal(f.open, false);
  assert.equal(f.doc.activeElement, f.toggle);
  assert.equal(f.volume.attrs.get('aria-orientation'), 'vertical');
  f.emit(f.toggle, 'click');
  f.emit(f.view, 'blur');
  assert.equal(f.open, false);
  f.emit(f.toggle, 'click');
  f.controller.close();
  assert.equal(f.open, false);
  assert.equal(f.range.inert, true);
});
