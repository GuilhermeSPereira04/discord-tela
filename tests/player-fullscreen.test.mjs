import test from 'node:test';
import assert from 'node:assert/strict';
import { requestPlayerFullscreen, waitForPlayerFrame } from '../public/player-controls.mjs';

test('requests the control-containing root synchronously, preserving user activation', async () => {
  let requested = false;
  let requestedOptions;
  const root = { requestFullscreen(options) { requested = true; requestedOptions = options; } };
  const video = { webkitEnterFullscreen() { assert.fail('native video would lose custom controls'); } };
  const result = requestPlayerFullscreen(root, video, { fullscreenEnabled: true });
  assert.equal(requested, true, 'must not defer the native request to another task');
  assert.equal(await result, 'element');
  assert.deepEqual(requestedOptions, { navigationUI: 'hide' });
});

test('preserves a rejected fullscreen request for explicit UI recovery', async () => {
  const denied = new Error('Permission denied');
  const root = { requestFullscreen: () => Promise.reject(denied) };
  await assert.rejects(requestPlayerFullscreen(root, {}, {}), error => error === denied);
});

test('uses the prefixed element API before native video fullscreen', async () => {
  let requested = false;
  const root = { webkitRequestFullscreen() { requested = true; } };
  const video = { readyState: 2, webkitEnterFullscreen() { assert.fail('prefer full player'); } };
  assert.equal(await requestPlayerFullscreen(root, video, {}), 'element');
  assert.equal(requested, true);
});

test('uses native video fullscreen when element fullscreen is unavailable', async () => {
  let requested = false;
  const video = { readyState: 2, webkitEnterFullscreen() { requested = true; } };
  const result = requestPlayerFullscreen({}, video, {});
  assert.equal(requested, true);
  assert.equal(await result, 'native-video');
});

test('an empty preview cannot invoke native video fullscreen', async () => {
  const video = { readyState: 0, webkitEnterFullscreen() { assert.fail('no video loaded'); } };
  assert.equal(await requestPlayerFullscreen({}, video, {}), 'expanded');
});

test('disabled element fullscreen has an explicit page expansion path', async () => {
  const root = { requestFullscreen() { assert.fail('fullscreen is disabled'); } };
  assert.equal(await requestPlayerFullscreen(root, {}, { fullscreenEnabled: false }), 'expanded');
});

test('reveals only after a real video frame callback, once per source', () => {
  const video = new EventTarget();
  let callback;
  let reveals = 0;
  video.requestVideoFrameCallback = fn => { callback = fn; return 42; };
  video.cancelVideoFrameCallback = () => {};
  waitForPlayerFrame(video, () => reveals++);
  assert.equal(reveals, 0, 'receiving a stream is not a displayed frame');
  video.dispatchEvent(new Event('loadeddata'));
  assert.equal(reveals, 0, 'prefer the compositor callback when available');
  callback();
  callback();
  assert.equal(reveals, 1);
});

test('a cancelled source cannot reveal a replacement stream', () => {
  const video = new EventTarget();
  let callback;
  let cancelledId;
  video.requestVideoFrameCallback = fn => { callback = fn; return 7; };
  video.cancelVideoFrameCallback = id => { cancelledId = id; };
  const cancel = waitForPlayerFrame(video, () => assert.fail('stale frame'));
  cancel();
  callback();
  assert.equal(cancelledId, 7);
});

test('media-event fallback waits for a decoded image and unsubscribes', () => {
  const video = new EventTarget();
  video.readyState = 1;
  video.videoWidth = 0;
  let reveals = 0;
  waitForPlayerFrame(video, () => reveals++);
  video.dispatchEvent(new Event('loadeddata'));
  assert.equal(reveals, 0);
  video.readyState = 2;
  video.videoWidth = 640;
  video.dispatchEvent(new Event('playing'));
  video.dispatchEvent(new Event('loadeddata'));
  assert.equal(reveals, 1);
});

test('cancelled media-event fallback ignores late loadeddata events', () => {
  const video = new EventTarget();
  video.readyState = 0;
  video.videoWidth = 0;
  const cancel = waitForPlayerFrame(video, () => assert.fail('cancelled fallback'));
  cancel();
  video.readyState = 2;
  video.videoWidth = 640;
  video.dispatchEvent(new Event('loadeddata'));
});
