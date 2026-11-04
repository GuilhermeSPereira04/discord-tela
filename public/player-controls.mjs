import { attachFullscreenFeedback, attachPipFeedback } from './fullscreen-feedback.mjs';
import { attachFullscreenNavigation } from './fullscreen-navigation.mjs';

// Fullscreen requests must start synchronously inside the user's click handler.
// Request the entire player so custom controls remain in the fullscreen root.
export function requestPlayerFullscreen(root, video, doc = document) {
  if (typeof root.requestFullscreen === 'function' && doc.fullscreenEnabled !== false) {
    return Promise.resolve(root.requestFullscreen({ navigationUI: 'hide' })).then(() => 'element');
  }
  if (typeof root.webkitRequestFullscreen === 'function' && doc.webkitFullscreenEnabled !== false) {
    return Promise.resolve(root.webkitRequestFullscreen()).then(() => 'element');
  }
  if (typeof video.webkitEnterFullscreen === 'function' && video.readyState >= 1) {
    return Promise.resolve(video.webkitEnterFullscreen()).then(() => 'native-video');
  }
  return Promise.resolve('expanded');
}

// One callback per source, never a rendering loop. Cancelled sources cannot reveal
// a replacement stream. Older browsers use media events instead of a timer.
export function waitForPlayerFrame(video, onReady) {
  let cancelled = false;
  let frameRequest;
  function cleanup() {
    video.removeEventListener('loadeddata', check);
    video.removeEventListener('playing', check);
    if (frameRequest !== undefined && typeof video.cancelVideoFrameCallback === 'function') {
      video.cancelVideoFrameCallback(frameRequest);
    }
  }
  function complete() {
    if (cancelled) return;
    cancelled = true;
    cleanup();
    onReady();
  }
  function check() {
    if (video.readyState >= 2 && video.videoWidth > 0) complete();
  }
  if (typeof video.requestVideoFrameCallback === 'function') {
    frameRequest = video.requestVideoFrameCallback(complete);
  } else {
    video.addEventListener('loadeddata', check);
    video.addEventListener('playing', check);
    check();
  }
  return () => { cancelled = true; cleanup(); };
}

export function attachPlayerControls(root, video, doc = document) {
  const fullscreenButton = root.querySelector('#fullscreen-btn');
  const fullscreenLabel = root.querySelector('#fullscreen-label');
  const muteButton = root.querySelector('#mute-btn');
  const volume = root.querySelector('#vol-slider');
  const volumeControl = root.querySelector('.volume-control');
  const volumeValue = root.querySelector('#volume-value');
  const pipButton = root.querySelector('#pip-btn');
  const pipDescription = root.querySelector('#pip-description');
  const unmuteButton = root.querySelector('#unmute-toast');
  const waiting = root.querySelector('#player-waiting');
  const waitingTitle = root.querySelector('#player-waiting-title');
  const waitingDescription = root.querySelector('#player-waiting-description');
  const notice = root.querySelector('#player-notice');
  const controls = root.querySelector('#player-controls');
  const chromeToggle = root.querySelector('#player-chrome-toggle');
  const isPreview = root.dataset.preview === 'true';
  let expanded = false;
  let nativeFullscreen = false;
  let pending = false;
  let transitionTimer;
  let previousVolume = 1;
  let wasFullscreen = false;
  let cancelFrame;
  let waitingForFrame = false;
  const view = doc.defaultView;
  const fullscreenNavigation = attachFullscreenNavigation(view, {
    exit: () => { if (ownsFullscreen() || expanded) toggleFullscreen(); },
    onSettled: sync
  });
  const reducedMotion = view?.matchMedia('(prefers-reduced-motion: reduce)');
  const readoutDuration = Number.parseFloat(view?.getComputedStyle(volumeValue)
    .getPropertyValue('--duration-volume-number')) || 90;
  let readoutFrame = null;
  let readoutValue = null;
  let readoutFrom = 0;
  let readoutTarget = 0;
  let readoutStarted = 0;

  // Only the decorative number eases. Gain, native value, accessible text and
  // handle remain immediate. One pending frame is retargeted during a fast drag.
  function drawVolumeReadout(now) {
    readoutFrame = null;
    const progress = reducedMotion?.matches ? 1 : Math.min(1, Math.max(0, (now - readoutStarted) / readoutDuration));
    readoutValue = readoutFrom + (readoutTarget - readoutFrom) * (1 - (1 - progress) ** 3);
    const text = `${Math.round(readoutValue)}%`;
    if (volumeValue.textContent !== text) volumeValue.textContent = text;
    if (progress < 1) readoutFrame = view.requestAnimationFrame(drawVolumeReadout);
  }

  function updateVolumeReadout(percent) {
    if (readoutValue === null || reducedMotion?.matches || !view?.requestAnimationFrame) {
      if (readoutFrame !== null) view?.cancelAnimationFrame(readoutFrame);
      readoutFrame = null;
      readoutValue = readoutTarget = percent;
      volumeValue.textContent = `${percent}%`;
      return;
    }
    if (readoutTarget === percent) return;
    readoutFrom = readoutValue;
    readoutTarget = percent;
    readoutStarted = view.performance.now();
    if (readoutFrame === null) readoutFrame = view.requestAnimationFrame(drawVolumeReadout);
  }

  function resetPicture() {
    cancelFrame?.();
    cancelFrame = undefined;
    waitingForFrame = false;
    root.classList.remove('is-picture-ready');
  }

  function syncPicture() {
    const connected = root.dataset.state === 'connected';
    if (!connected) resetPicture();
    else if (isPreview) root.classList.add('is-picture-ready');
    else if (!root.classList.contains('is-picture-ready') && !waitingForFrame) {
      waitingForFrame = true;
      cancelFrame = waitForPlayerFrame(video, () => {
        waitingForFrame = false;
        cancelFrame = undefined;
        if (root.dataset.state !== 'connected') return;
        root.classList.add('is-picture-ready');
        sync();
      });
    }
    const ready = root.classList.contains('is-picture-ready');
    root.dataset.frame = ready ? 'ready' : 'pending';
    waiting.hidden = false;
    waiting.setAttribute('aria-hidden', String(ready));
    waiting.inert = ready;
    const title = connected ? 'Preparando a imagem' : 'Reconectando à transmissão';
    const description = connected ? 'A transmissão aparece assim que o primeiro quadro estiver disponível.' :
      'Você pode permanecer aqui. A imagem volta quando a conexão for restabelecida.';
    // Avoid rewriting the live region on unrelated fullscreen or audio events.
    if (waitingTitle.textContent !== title) waitingTitle.textContent = title;
    if (waitingDescription.textContent !== description) waitingDescription.textContent = description;
  }

  function announce(message) {
    notice.textContent = message;
    notice.hidden = !message;
    if (message) setControlsHidden(false);
  }

  function setControlsHidden(hidden) {
    const hide = hidden && (ownsFullscreen() || expanded) &&
      root.classList.contains('is-picture-ready');
    root.classList.toggle('is-controls-hidden', hide);
    controls.hidden = hide;
    if (hide) {
      notice.hidden = true;
      notice.textContent = '';
    }
    chromeToggle.setAttribute('aria-expanded', String(!hide));
    chromeToggle.setAttribute('aria-label', hide ? 'Mostrar controles da transmissão' : 'Ocultar controles da transmissão');
    chromeToggle.title = hide ? 'Toque para mostrar os controles' : 'Toque para ocultar os controles';
  }

  function fullscreenElement() {
    return doc.fullscreenElement || doc.webkitFullscreenElement;
  }

  function ownsFullscreen() {
    const element = fullscreenElement();
    return Boolean(element && (element === root || root.contains(element))) || nativeFullscreen;
  }

  function canFullscreenElement() {
    return (typeof root.requestFullscreen === 'function' && doc.fullscreenEnabled !== false) ||
      (typeof root.webkitRequestFullscreen === 'function' && doc.webkitFullscreenEnabled !== false);
  }

  function hasVideo() {
    return video.readyState >= 2 && video.videoWidth > 0 && root.dataset.state === 'connected';
  }

  function syncAudio() {
    const silent = video.muted || video.volume === 0;
    muteButton.setAttribute('aria-pressed', String(silent));
    muteButton.setAttribute('aria-label', silent ? 'Ativar som' : 'Silenciar');
    muteButton.title = silent ? 'Ativar som' : 'Silenciar';
    muteButton.classList.toggle('is-muted', silent);
    muteButton.dataset.audioLevel = silent ? 'muted' : video.volume <= 0.45 ? 'low' : 'high';
    volume.value = String(video.volume);
    const percent = Math.round(video.volume * 100);
    volume.setAttribute('aria-valuetext', `${percent}%${video.muted ? ', som silenciado' : ''}`);
    volumeControl.style.setProperty('--volume-ratio', String(video.volume));
    volumeControl.classList.toggle('is-silent', silent);
    updateVolumeReadout(percent);
    if (video.volume > 0) previousVolume = video.volume;
    if (!silent) unmuteButton.hidden = true;
  }

  function sync() {
    const active = ownsFullscreen() || expanded;
    fullscreenNavigation.update(active);
    root.classList.toggle('is-fullscreen', active);
    root.classList.toggle('is-expanded', expanded);
    doc.body.classList.toggle('player-expanded', expanded);
    fullscreenButton.setAttribute('aria-pressed', String(active));
    fullscreenButton.setAttribute('aria-busy', String(pending || fullscreenNavigation.settling));
    fullscreenButton.disabled = pending || fullscreenNavigation.settling;
    fullscreenLabel.textContent = canFullscreenElement() ||
      (typeof video.webkitEnterFullscreen === 'function' && !isPreview) ? 'Tela cheia' : 'Ampliar';
    for (const label of fullscreenButton.querySelectorAll('.fullscreen-ink .player-label-default')) {
      label.textContent = fullscreenLabel.textContent;
    }
    fullscreenButton.setAttribute('aria-label', active ? 'Sair da tela cheia ou visualização ampliada' :
      fullscreenLabel.textContent === 'Ampliar' ? 'Ampliar player nesta página' : 'Entrar em tela cheia');
    syncPicture();
    const toggleHadFocus = doc.activeElement === chromeToggle;
    chromeToggle.hidden = !active || nativeFullscreen || !root.classList.contains('is-picture-ready');
    if (!active || !root.classList.contains('is-picture-ready')) setControlsHidden(false);
    if (active && chromeToggle.hidden && toggleHadFocus) fullscreenButton.focus({ preventScroll: true });
    if (root.dataset.state !== 'connected') unmuteButton.hidden = true;
    pipButton.hidden = !doc.pictureInPictureEnabled || typeof video.requestPictureInPicture !== 'function';
    const inPip = doc.pictureInPictureElement === video;
    const pipUnavailable = !hasVideo() && !inPip;
    // aria-disabled keeps the explanation reachable by keyboard and touch.
    pipButton.setAttribute('aria-disabled', String(pipUnavailable));
    pipButton.setAttribute('aria-pressed', String(inPip));
    pipButton.classList.toggle('is-pip', inPip);
    const pipHelp = pipUnavailable ? (isPreview ? 'Miniatura disponível durante uma transmissão real.' :
      'Aguarde a imagem para abrir a miniatura.') : (inPip ? 'Fechar miniatura' : 'Abrir vídeo em uma janela flutuante');
    pipButton.title = pipHelp;
    pipButton.setAttribute('aria-label', inPip ? 'Fechar miniatura' : 'Abrir miniatura');
    pipDescription.textContent = pipHelp;
    if (wasFullscreen && !active && fullscreenButton.isConnected) {
      fullscreenButton.focus({ preventScroll: true });
    }
    wasFullscreen = active;
    syncAudio();
  }

  function finishTransition() {
    clearTimeout(transitionTimer);
    transitionTimer = undefined;
    pending = false;
    sync();
  }

  async function toggleFullscreen() {
    if (pending || fullscreenNavigation.settling) return;
    pending = true;
    announce('');
    sync();
    try {
      if (expanded) {
        expanded = false;
      } else if (ownsFullscreen()) {
        if (nativeFullscreen && typeof video.webkitExitFullscreen === 'function') {
          video.webkitExitFullscreen();
        } else if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } else {
        const mode = await requestPlayerFullscreen(root, video, doc);
        if (mode === 'expanded') {
          expanded = true;
          announce('Player ampliado nesta página. As barras do navegador continuam visíveis.');
        } else if (mode === 'native-video' && !nativeFullscreen) {
          // Older iPhone APIs return void before their fullscreen event fires.
          transitionTimer = setTimeout(finishTransition, 1500);
          return;
        }
      }
    } catch {
      if (!ownsFullscreen()) {
        expanded = true;
        announce('O navegador não abriu a tela cheia. O player foi ampliado nesta página.');
      } else {
        announce('Use o comando Voltar ou Esc do navegador para sair da tela cheia.');
      }
    } finally {
      if (!transitionTimer) finishTransition();
      else sync();
    }
  }

  fullscreenButton.addEventListener('click', toggleFullscreen);
  chromeToggle.addEventListener('click', () => setControlsHidden(!controls.hidden));
  view?.addEventListener('keydown', event => {
    // Reveal before the browser chooses the next focus target. Hidden controls
    // have no tab stops and cannot receive accidental touches over the image.
    if (event.key === 'Tab' && (ownsFullscreen() || expanded)) setControlsHidden(false);
  });
  // The functional listener runs first, so visual feedback cannot defer the
  // activation-dependent native request or block entry/exit behind an animation.
  attachFullscreenFeedback(fullscreenButton, doc);
  attachPipFeedback(pipButton, doc);
  muteButton.addEventListener('click', () => {
    announce('');
    if (video.muted || video.volume === 0) {
      if (video.volume === 0) video.volume = previousVolume || 1;
      video.muted = false;
    } else {
      previousVolume = video.volume;
      video.muted = true;
    }
    syncAudio();
  });
  volume.addEventListener('input', () => {
    announce('');
    const previous = video.volume;
    video.volume = Number(volume.value);
    video.muted = video.volume === 0;
    if (video.volume > 0) previousVolume = video.volume;
    if (volumeControl.classList.contains('is-adjusting')) {
      const tilt = Math.max(-12, Math.min(12, (video.volume - previous) * 160));
      volumeControl.style.setProperty('--volume-tilt', `${tilt}deg`);
    }
    syncAudio();
  });
  // Native range owns value selection/capture. The skin only reacts to it;
  // moving its visual handle must never move or resize the input's hit target.
  function endVolumeAdjustment() {
    volumeControl.classList.remove('is-adjusting');
    volumeControl.style.setProperty('--volume-tilt', '0deg');
  }
  volume.addEventListener('pointerdown', () => volumeControl.classList.add('is-adjusting'));
  volume.addEventListener('lostpointercapture', endVolumeAdjustment);
  volume.addEventListener('blur', endVolumeAdjustment);
  doc.addEventListener('pointerup', endVolumeAdjustment);
  doc.addEventListener('pointercancel', endVolumeAdjustment);
  doc.defaultView?.addEventListener('blur', endVolumeAdjustment);
  unmuteButton.addEventListener('click', async () => {
    if (video.volume === 0) video.volume = previousVolume || 1;
    video.muted = false;
    try {
      await video.play();
      unmuteButton.hidden = true;
    } catch {
      video.muted = true;
      unmuteButton.hidden = false;
      announce('Toque novamente em Ativar som para iniciar a reprodução.');
    }
    syncAudio();
  });
  pipButton.addEventListener('click', async () => {
    if (!hasVideo() && doc.pictureInPictureElement !== video) {
      announce(pipDescription.textContent);
      return;
    }
    announce('');
    try {
      if (doc.pictureInPictureElement) await doc.exitPictureInPicture();
      else if (hasVideo()) await video.requestPictureInPicture();
    } catch {
      announce('Não foi possível abrir a miniatura. O vídeo continua neste player.');
    }
  });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && expanded) {
      expanded = false;
      announce('');
      sync();
    }
  });
  doc.addEventListener('fullscreenchange', finishTransition);
  doc.addEventListener('webkitfullscreenchange', finishTransition);
  video.addEventListener('webkitbeginfullscreen', () => {
    nativeFullscreen = true;
    finishTransition();
  });
  video.addEventListener('webkitendfullscreen', () => {
    nativeFullscreen = false;
    finishTransition();
  });
  for (const event of ['loadedmetadata', 'loadeddata', 'emptied', 'enterpictureinpicture', 'leavepictureinpicture']) {
    video.addEventListener(event, sync);
  }
  video.addEventListener('volumechange', syncAudio);
  root.addEventListener('playerstatechange', sync);
  root.addEventListener('playerstreamchange', () => { resetPicture(); sync(); });
  sync();
  return { sync };
}
