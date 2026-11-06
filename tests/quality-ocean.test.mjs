import test from 'node:test';
import assert from 'node:assert/strict';
import { OCEAN_SHARKS, oceanGrid, oceanPath, oceanResolution } from '../public/quality-ocean.mjs';

test('ASCII cell decisions and final raster stay bounded for horizontal and stacked windows', () => {
  for (const [w, h] of [[512, 240], [336, 496], [2000, 300], [100, 10000], [8000, 8000]]) {
    const size = oceanResolution(w, h, 4), grid = oceanGrid(w, h);
    assert.ok(size.width * size.height <= 360000);
    assert.ok(Math.max(size.width, size.height) <= 2048);
    assert.ok(grid.columns * grid.rows <= 16000);
    assert.ok(Math.max(grid.columns, grid.rows) <= 512);
  }
});

test('the same shark crosses every window without a discontinuity at the interior boundaries', () => {
  for (const [w, h] of [[576, 288], [356, 592]]) {
    const vertical = h > w * .75, extent = vertical ? h : w;
    for (let i = 0; i < OCEAN_SHARKS.length; i++) {
      const windows = new Set();
      let previous;
      for (let t = 0; t < 60; t += .025) {
        const pose = oceanPath(t, i, w, h), p = vertical ? pose.y : pose.x;
        assert.ok(Object.values(pose).every(Number.isFinite));
        if (p >= 0 && p <= extent) windows.add(Math.min(2, Math.floor(p / extent * 3)));
        if (previous) {
          const before = vertical ? previous.y : previous.x;
          const distance = Math.hypot(pose.x - previous.x, pose.y - previous.y);
          if (distance > 5) assert.ok((before < -pose.length * .7 && p > extent + pose.length * .7) ||
            (p < -pose.length * .7 && before > extent + pose.length * .7), 'wrap must happen fully outside the cards');
          else assert.ok(Math.abs(Math.atan2(Math.sin(pose.angle - previous.angle), Math.cos(pose.angle - previous.angle))) < .02);
        }
        previous = pose;
      }
      assert.deepEqual([...windows].sort(), [0, 1, 2]);
    }
  }
});

test('species retain distinct proportions, two white shark sizes and independent swimming profiles', () => {
  assert.deepEqual(OCEAN_SHARKS.map(profile => profile.species), ['white', 'hammerhead', 'tiger', 'reef', 'white']);
  for (const [w, h] of [[576, 288], [356, 592]]) {
    const poses = OCEAN_SHARKS.map((_, i) => oceanPath(0, i, w, h));
    assert.ok(poses[0].length > poses[2].length && poses[2].length > poses[1].length);
    assert.ok(poses[4].length > poses[3].length * 1.5);
    assert.equal(new Set(poses.map(pose => pose.kind)).size, 4);
    assert.equal(new Set(poses.map(pose => pose.cadence)).size, 5);
    assert.ok(poses.every(pose => pose.depth > .5 && pose.depth <= 1));
  }
});
