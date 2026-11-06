import { createOceanRenderer, oceanResolution } from './quality-ocean.mjs';

// Keep the same shared shark ocean as the native fieldset moves into the player.
export function attachQualityFlow(root, doc = root?.ownerDocument) {
  if (!root || root.dataset.flowAttached) return () => {};
  root.dataset.flowAttached = 'true';
  const view = doc.defaultView;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const contrast = view.matchMedia('(forced-colors: active)');
  const canvas = doc.createElement('canvas');
  canvas.className = 'quality-flow-layer'; canvas.setAttribute('aria-hidden', 'true'); canvas.hidden = true;
  root.prepend(canvas);
  const cards = Array.from(root.querySelectorAll('.quality-option'));
  let renderer, entries = [], frame, layoutFrame, disposed = false, failed = false, intersecting = true;
  let box, lastTime, activeTime = 0, pointerTarget = [-1000, -1000, 0];
  const scene = { width: 1, height: 1, pointer: [-1000, -1000, 0], ripple: [-1000, -1000, -100] };
  let last = -Infinity;
  function pause() { view.cancelAnimationFrame(frame); frame = undefined; lastTime = undefined; }
  function fallback() { pause(); canvas.hidden = true; delete root.dataset.flowRenderer; }
  function blocked() { return disposed || doc.hidden || reduced.matches || contrast.matches || doc.body.dataset.capturePending === 'true'; }
  function paint(now) {
    frame = undefined;
    if (blocked() || !intersecting || !renderer) return;
    if (now - last >= 1000 / 60 - 0.5) {
      const dt = lastTime === undefined ? 0 : Math.min((now - lastTime) / 1000, .06);
      activeTime += dt * 1000; lastTime = now;
      const blend = 1 - Math.exp(-dt * 7);
      for (let i = 0; i < 3; i++) scene.pointer[i] += (pointerTarget[i] - scene.pointer[i]) * blend;
      try { renderer.draw(entries, activeTime, scene); }
      catch { failed = true; renderer.dispose(); renderer = undefined; fallback(); return; }
      last = now;
    }
    frame = view.requestAnimationFrame(paint);
  }
  function layout() {
    layoutFrame = undefined; pause();
    root.dataset.qualityScene = 'ascii-ocean';
    if (blocked() || failed || !intersecting) { fallback(); return; }
    box = root.getBoundingClientRect();
    if (!box.width || !box.height || box.bottom <= 0 || box.top >= view.innerHeight) { fallback(); return; }
    const resolution = oceanResolution(box.width, box.height, view.devicePixelRatio);
    if (canvas.width !== resolution.width) canvas.width = resolution.width;
    if (canvas.height !== resolution.height) canvas.height = resolution.height;
    entries = cards.map(card => {
      const rect = card.getBoundingClientRect();
      return { input: card.querySelector('input'), cssLeft: rect.left - box.left, cssTop: rect.top - box.top,
        cssWidth: rect.width, cssHeight: rect.height };
    });
    scene.width = box.width; scene.height = box.height;
    if (!renderer) renderer = createOceanRenderer(canvas, doc);
    if (!renderer) { failed = true; fallback(); return; }
    canvas.hidden = false; root.dataset.flowRenderer = 'webgl2'; last = -Infinity;
    paint(view.performance.now());
  }
  function queueLayout() {
    pause(); view.cancelAnimationFrame(layoutFrame);
    if (!disposed) layoutFrame = view.requestAnimationFrame(layout);
  }
  function movePointer(event) {
    if (!box || event.pointerType === 'touch') return;
    if (!pointerTarget[2]) scene.pointer = [event.clientX - box.left, event.clientY - box.top, 0];
    pointerTarget = [event.clientX - box.left, event.clientY - box.top, 1];
  }
  function leavePointer() { pointerTarget[2] = 0; }
  function selection(event) {
    const entry = entries.find(value => value.input === event.target);
    if (entry) scene.ripple = [entry.cssLeft + entry.cssWidth * .5, entry.cssTop + entry.cssHeight * .28, activeTime / 1000];
  }
  function lost(event) { event.preventDefault(); failed = true; renderer = undefined; fallback(); }
  function restored() { failed = false; queueLayout(); }
  function pageHide() { view.cancelAnimationFrame(layoutFrame); fallback(); renderer?.dispose(); renderer = undefined; }
  const resize = view.ResizeObserver ? new view.ResizeObserver(queueLayout) : null;
  resize?.observe(root);
  const intersection = view.IntersectionObserver ? new view.IntersectionObserver(records => {
    intersecting = records.some(record => record.isIntersecting); queueLayout();
  }) : null;
  intersection?.observe(root);
  canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored);
  root.addEventListener('pointermove', movePointer, { passive: true });
  root.addEventListener('pointerleave', leavePointer); root.addEventListener('pointercancel', leavePointer);
  root.addEventListener('change', selection);
  reduced.addEventListener('change', queueLayout); contrast.addEventListener('change', queueLayout);
  doc.addEventListener('visibilitychange', queueLayout);
  doc.body.addEventListener('hostcapturechange', queueLayout);
  doc.getElementById('video-wrapper')?.addEventListener('playerstatechange', queueLayout);
  view.addEventListener('resize', queueLayout); view.addEventListener('scroll', queueLayout, { passive: true, capture: true });
  view.addEventListener('pagehide', pageHide); view.addEventListener('pageshow', queueLayout);
  queueLayout();
  return () => {
    disposed = true; pageHide(); resize?.disconnect(); intersection?.disconnect();
    canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored);
    root.removeEventListener('pointermove', movePointer); root.removeEventListener('pointerleave', leavePointer);
    root.removeEventListener('pointercancel', leavePointer); root.removeEventListener('change', selection);
    reduced.removeEventListener('change', queueLayout); contrast.removeEventListener('change', queueLayout);
    doc.removeEventListener('visibilitychange', queueLayout); doc.body.removeEventListener('hostcapturechange', queueLayout);
    doc.getElementById('video-wrapper')?.removeEventListener('playerstatechange', queueLayout);
    view.removeEventListener('resize', queueLayout); view.removeEventListener('scroll', queueLayout, true);
    view.removeEventListener('pagehide', pageHide); view.removeEventListener('pageshow', queueLayout);
    canvas.remove(); delete root.dataset.flowAttached; delete root.dataset.qualityScene;
  };
}
