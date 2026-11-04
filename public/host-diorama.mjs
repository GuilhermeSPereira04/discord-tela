// Only loaded by the host page. All baking, Three.js and frame rendering run in
// a dedicated worker; the capture gesture never awaits this decoration.
export function attachHostDiorama(container, player, doc = document) {
  const view = doc.defaultView;
  const motion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const poster = container.querySelector('img');
  let worker = null, canvas = null, ready = false, visible = true, failed = false;
  const supported = typeof view.Worker === 'function' &&
    typeof view.HTMLCanvasElement?.prototype.transferControlToOffscreen === 'function';
  const events = new view.AbortController();

  function stop() {
    // Terminating also interrupts an in-progress CPU bake. The worker owns its
    // OffscreenCanvas/context, buffers and image bitmaps; no frame loop survives.
    worker?.terminate(); worker = null;
    canvas?.remove(); canvas = null;
    ready = false;
    const fallback = failed || motion.matches || !supported;
    // A photograph during normal boot looks like a frozen animation. Reserve
    // the layout, but only request/show the still for a genuine static fallback.
    if (fallback && poster && !poster.getAttribute('src')) poster.src = poster.dataset.src;
    container.dataset.state = fallback ? 'fallback' : 'idle';
  }
  function sync() {
    const capturing = doc.body.dataset.capturePending === 'true' || doc.body.classList.contains('player-active');
    if (capturing || motion.matches || !supported || failed) { stop(); return; }
    if (doc.hidden || !visible) {
      if (!ready) stop();
      else { worker?.postMessage({ type: 'pause' }); container.dataset.state = 'paused'; }
      return;
    }
    if (worker) {
      worker.postMessage({ type: 'resume' });
      container.dataset.state = ready ? 'running' : 'loading';
      return;
    }
    try {
      // Match the larger presentation without paying desktop pixel cost on
      // small screens. Pick once per worker boot; resizing does not restart it.
      const renderSize = container.getBoundingClientRect().width >= 400 ? 768 : 512;
      canvas = doc.createElement('canvas');
      canvas.width = canvas.height = renderSize;
      canvas.setAttribute('aria-hidden', 'true');
      container.append(canvas);
      const offscreen = canvas.transferControlToOffscreen();
      worker = new view.Worker('/diorama/scene-worker.mjs', { type: 'module', name: 'host-miniature' });
      container.dataset.state = 'loading';
      const currentWorker = worker;
      worker.onmessage = ({ data }) => {
        if (worker !== currentWorker) return;
        if (data.type === 'ready') {
          ready = true;
          container.dataset.bootMs = String(data.bootMs);
          if (data.startup) container.dataset.startup = JSON.stringify(data.startup);
          if (view.performance) container.dataset.pageReadyMs = String(Math.round(view.performance.now()));
          container.dataset.drawCalls = String(data.calls);
          container.dataset.triangles = String(data.triangles);
          container.dataset.renderSize = String(data.renderSize);
          container.dataset.asciiGrid = data.grid;
          sync();
        } else if (data.type === 'error') {
          failed = true;
          stop();
        }
      };
      worker.onerror = () => { if (worker === currentWorker) { failed = true; stop(); } };
      worker.postMessage({ type: 'init', canvas: offscreen, renderSize }, [offscreen]);
    } catch { failed = true; stop(); }
  }
  const options = { signal: events.signal };
  doc.addEventListener('visibilitychange', sync, options);
  doc.body.addEventListener('hostcapturechange', sync, options);
  player.addEventListener('playerstatechange', sync, options);
  motion.addEventListener('change', sync, options);
  view.addEventListener('pagehide', stop, options);
  view.addEventListener('pageshow', sync, options);
  const observer = typeof view.IntersectionObserver === 'function' ? new view.IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    sync();
  }) : null;
  observer?.observe(container);
  sync();
  return { dispose() { events.abort(); observer?.disconnect(); stop(); } };
}
