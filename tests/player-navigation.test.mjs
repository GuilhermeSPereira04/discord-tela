import test from 'node:test';
import assert from 'node:assert/strict';
import { attachFullscreenNavigation } from '../public/fullscreen-navigation.mjs';

// Queue traversal like a browser: back() does not dispatch popstate inline.
// A previous page lets these tests detect accidental double-Back/page exits.
function fixture({ denied = false } = {}) {
  const view = new EventTarget();
  const entries = [{ previousPage: true }, { room: 'test', nested: { preserve: true } }];
  let index = 1;
  const queue = [];
  let pushes = 0;
  let exits = 0;
  let settled = 0;
  view.history = {
    get state() { return entries[index]; },
    pushState(state) {
      if (denied) throw new Error('History API denied');
      pushes++;
      entries.splice(++index, entries.length, state);
    },
    back() { queue.push(-1); }
  };
  const guard = attachFullscreenNavigation(view, {
    exit() { exits++; guard.update(true); guard.update(false); },
    onSettled() { settled++; }
  });
  function traverse(delta = -1) {
    index += delta;
    const event = new Event('popstate');
    view.dispatchEvent(event);
  }
  function flush() {
    while (queue.length) traverse(queue.shift());
  }
  return { guard, view, entries, traverse, flush,
    get index() { return index; }, get pushes() { return pushes; },
    get exits() { return exits; }, get settled() { return settled; },
    get queued() { return queue.length; } };
}

test('normal playback leaves browser history untouched', () => {
  const f = fixture();
  f.guard.update(false);
  assert.equal(f.pushes, 0);
});

test('one fullscreen session creates one entry and preserves room state', () => {
  const f = fixture();
  f.guard.update(true);
  f.guard.update(true); // audio/frame/fullscreen events may call sync again
  assert.equal(f.pushes, 1);
  assert.equal(f.view.history.state.room, 'test');
  assert.deepEqual(f.view.history.state.nested, { preserve: true });
});

test('browser Back exits fullscreen without leaving the room or rearming', () => {
  const f = fixture();
  f.guard.update(true);
  f.traverse();
  f.flush();
  assert.equal(f.exits, 1);
  assert.equal(f.index, 1, 'must stay on room, not previous page');
  assert.equal(f.pushes, 1, 'exit synchronization must not reinsert the marker');
  assert.equal(f.queued, 0, 'fullscreenchange after Back must not go Back twice');
});

test('normal browser Back works again after leaving fullscreen', () => {
  const f = fixture();
  f.guard.update(true);
  f.traverse();
  f.traverse();
  assert.equal(f.index, 0);
  assert.equal(f.exits, 1);
});

test('button/Escape/native mobile exit consumes only the player entry', () => {
  const f = fixture();
  f.guard.update(true);
  f.guard.update(false);
  f.guard.update(false);
  assert.equal(f.guard.settling, true);
  assert.equal(f.queued, 1);
  f.flush();
  assert.equal(f.index, 1);
  assert.equal(f.exits, 0, 'cleanup must not ask for a second fullscreen exit');
  assert.equal(f.guard.settling, false);
  assert.equal(f.settled, 1);
});

test('repeated enter/exit does not accumulate history entries', () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) {
    f.guard.update(true);
    f.guard.update(false);
    f.flush();
  }
  assert.equal(f.index, 1);
  assert.equal(f.entries.length, 3, 'at most one forward entry remains');
  f.traverse();
  assert.equal(f.index, 0);
});

test('Forward after an exit never reopens fullscreen without user activation', () => {
  const f = fixture();
  f.guard.update(true);
  f.traverse();
  f.traverse(1);
  assert.equal(f.exits, 1);
  assert.equal(f.pushes, 1);
});

test('a restricted webview denying history does not break fullscreen', () => {
  const f = fixture({ denied: true });
  assert.doesNotThrow(() => { f.guard.update(true); f.guard.update(false); });
  assert.equal(f.queued, 0);
});
