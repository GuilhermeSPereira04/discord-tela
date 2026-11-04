// A single same-document entry lets browser/mouse Back close presentation before
// leaving the room. Native mobile close requests may exit fullscreen directly;
// update(false) then consumes that same entry. Never reinsert it on Back.
export function attachFullscreenNavigation(view, { exit, onSettled = () => {} }) {
  const history = view?.history;
  const key = '__screenPlayerFullscreen';
  const token = view?.crypto?.randomUUID?.() || `player-${Date.now()}-${Math.random()}`;
  let armed = false;
  let settling = false;
  let wasActive = false;

  function ownsEntry() {
    return history?.state?.[key] === token;
  }

  function update(active) {
    if (active === wasActive) return;
    wasActive = active;
    if (!history || settling) return;
    if (active && !armed) {
      try {
        // Preserve application state and URL; no reload, hash or media remount.
        history.pushState({ ...history.state, [key]: token }, '');
        armed = true;
      } catch {
        // Fullscreen must still work if a restricted webview denies History API.
      }
    } else if (!active && armed) {
      armed = false;
      if (ownsEntry()) {
        settling = true;
        history.back();
      }
    }
  }

  view?.addEventListener('popstate', () => {
    if (settling) {
      settling = false;
      onSettled();
    } else if (armed && !ownsEntry()) {
      // Disarm first: exit's fullscreenchange must not navigate a second time.
      armed = false;
      exit();
    }
  });

  return { update, get settling() { return settling; } };
}
