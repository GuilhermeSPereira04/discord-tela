import test from 'node:test';
import assert from 'node:assert/strict';
import { attachButtonMotion } from '../public/button-motion.mjs';

// Minimal DOM doubles exercise the shared behavior, not Sass coordinates.
class Element extends EventTarget {
  constructor() {
    super(); this.childNodes = []; this.attributes = {}; this.dataset = {}; this.style = {};
    this.classes = new Set(); this.classList = { add: (...values) => values.forEach(value => this.classes.add(value)) };
  }
  set className(value) { this.classes = new Set(value.split(' ')); }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  matches(selector) { return selector === ':focus-visible' ? !!this.focusVisible : false; }
  append(...children) { this.childNodes.push(...children); }
  querySelectorAll(selector) {
    return this.childNodes.flatMap(child => [
      ...((selector === '[id]' ? child.attributes.id : selector.split(', ').some(part => child.classes.has(part.slice(1)))) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0]; }
  cloneNode() {
    const node = new Element(); node.classes = new Set(this.classes); node.attributes = {...this.attributes};
    node.childNodes = this.childNodes.map(child => child.cloneNode()); return node;
  }
}
function fixture() {
  const motion = new EventTarget(); motion.matches = false;
  const pointer = new EventTarget(); pointer.matches = true;
  const doc = { createElement: () => new Element(), defaultView: {
    matchMedia: query => query.includes('reduced') ? motion : pointer,
    getComputedStyle: () => ({ getPropertyValue: () => '350ms' }),
  }};
  const button = new Element(), content = new Element(), label = new Element();
  content.className = 'button-motion-content'; label.setAttribute('id', 'label');
  content.append(label); button.append(content);
  return {doc, button, motion};
}
function pointerEvent(type, pointerType = 'mouse') {
  const event = new Event(type); event.pointerType = pointerType; return event;
}
test('attaching twice preserves one accessible label and one decoration', () => {
  const {button,doc} = fixture();
  attachButtonMotion(button,doc); attachButtonMotion(button,doc);
  assert.equal(button.querySelectorAll('.button-motion-surface').length, 1);
  assert.equal(button.querySelectorAll('[id]').length, 1);
  assert.equal(button.querySelector('.button-motion-surface').attributes['aria-hidden'], 'true');
});
test('touch does not latch hover; focus works and reduced motion settles immediately', () => {
  const {button,doc,motion} = fixture(); attachButtonMotion(button,doc);
  button.dispatchEvent(pointerEvent('pointerenter','touch'));
  assert.equal(button.dataset.fillState, 'idle');
  button.focusVisible = true; button.dispatchEvent(new Event('focus'));
  assert.equal(button.dataset.fillState, 'hover');
  motion.matches = true; button.focusVisible = false; button.dispatchEvent(new Event('blur'));
  assert.equal(button.dataset.fillState, 'idle');
});
test('the functional click is synchronous and unaffected by optional particles', () => {
  const {button,doc,motion} = fixture();
  let operations = 0;
  button.addEventListener('click', () => operations++);
  attachButtonMotion(button,doc,{particles:true});
  motion.matches = true; button.dispatchEvent(new Event('click'));
  assert.equal(operations, 1);
  assert.equal(button.querySelectorAll('.button-motion-particle').length, 5);
  button.disabled = true; button.dispatchEvent(pointerEvent('pointerenter'));
  assert.notEqual(button.dataset.fillState, 'hover');
});
