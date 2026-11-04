import appStyles from './styles/generated/app.css';

const CONNECTION_ORBS = '<span class="connection-orb connection-orb--light"></span><span class="connection-orb connection-orb--violet"></span>';
const CONNECTION_SYMBOL = '<div class="connection-glass" aria-hidden="true"><div class="connection-field connection-field--diffuse">' + CONNECTION_ORBS + '</div><div class="connection-field connection-field--sharp">' + CONNECTION_ORBS + '</div></div>';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const MAX_ROOM_NAME = 100;
const HEX_PATTERN = /^(?:[0-9a-f]{2})+$/i;

function hexToBytes(hex) {
  if (typeof hex !== 'string' || !HEX_PATTERN.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

// A chave pública não muda entre requisições: importa uma vez por isolate.
let cachedKey = null;
async function getVerifyKey(publicKeyHex) {
  if (cachedKey?.hex !== publicKeyHex) {
    const raw = hexToBytes(publicKeyHex);
    if (!raw || raw.length !== 32) throw new Error('DISCORD_PUBLIC_KEY inválida');
    const key = await crypto.subtle.importKey('raw', raw, { name: 'Ed25519' }, false, ['verify']);
    cachedKey = { hex: publicKeyHex, key };
  }
  return cachedKey.key;
}

async function verifyDiscordSignature(request, bodyText, publicKeyHex) {
  const signature = hexToBytes(request.headers.get('X-Signature-Ed25519'));
  const timestamp = request.headers.get('X-Signature-Timestamp');
  if (!signature || signature.length !== 64 || !timestamp) return false;
  try {
    const key = await getVerifyKey(publicKeyHex);
    return await crypto.subtle.verify('Ed25519', key, signature, new TextEncoder().encode(timestamp + bodyText));
  } catch {
    return false;
  }
}

function randomHex(bytesLength) {
  const arr = crypto.getRandomValues(new Uint8Array(bytesLength));
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

const LINK_TTL_SECONDS = 24 * 60 * 60;
const hmacKeys = new Map();

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signLink(secret, room, exp, role) {
  let key = hmacKeys.get(secret);
  if (!key) {
    key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    hmacKeys.set(secret, key);
  }
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${room}.${exp}.${role}`));
  return base64url(new Uint8Array(mac).slice(0, 16));
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Links assinados: só quem recebeu o link de transmitir consegue abrir o modo host,
// e ambos deixam de abrir depois de LINK_TTL_SECONDS.
async function buildRoomLinks(origin, secret, room, title) {
  const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
  const base = `${origin}/?room=${room}&title=${encodeURIComponent(title)}&exp=${exp}`;
  const [hostSig, viewSig] = await Promise.all([signLink(secret, room, exp, 'host'), signLink(secret, room, exp, 'view')]);
  return {
    hostUrl: `${base}&mode=host&sig=${hostSig}`,
    viewUrl: `${base}&mode=view&sig=${viewSig}`
  };
}

async function verifyRoomLink(secret, params) {
  const room = params.get('room');
  const role = params.get('mode') === 'host' ? 'host' : 'view';
  const exp = Number(params.get('exp'));
  if (!Number.isInteger(exp) || exp < Date.now() / 1000) return false;
  return safeEqual(params.get('sig'), await signLink(secret, room, exp, role));
}

function viewUrlFromHost(url) {
  const view = new URL(url);
  view.searchParams.set('mode', 'view');
  view.searchParams.delete('preview');
  return view;
}

function invalidLinkPage() {
  return new Response(
    '<!DOCTYPE html><html lang="pt-BR"><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Link expirado</title>' +
    '<body style="font-family:system-ui,sans-serif;background:#0b0b0f;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:16px">' +
    '<div><h1 style="font-weight:500">Link expirado ou inválido</h1><p>Use <strong>/tela</strong> no Discord para criar uma nova sala.</p></div></body></html>',
    { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

async function sendHostLinkFollowup(interaction, hostUrl) {
  const res = await fetch(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flags: 64, // efêmera: só quem usou o comando vê
      content: 'Seu link para transmitir. Só você vê esta mensagem; não compartilhe.',
      components: [{ type: 1, components: [linkButton('Transmitir', hostUrl, '📡')] }]
    })
  });
  if (!res.ok) console.error('Falha ao enviar link do host:', res.status, await res.text());
}

function linkButton(label, url, emoji) {
  return { type: 2, style: 5, label, url, emoji: { name: emoji } };
}

async function handleTelaCommand(interaction, origin, secret, ctx) {
  const rawName = interaction.data.options?.find((o) => o.name === 'nome')?.value;
  const customName = (typeof rawName === 'string' && rawName.trim().slice(0, MAX_ROOM_NAME)) || 'Sala de Tela';
  const { hostUrl, viewUrl } = await buildRoomLinks(origin, secret, randomHex(6), customName);
  const userId = interaction.member?.user?.id ?? interaction.user?.id;

  // A resposta pública leva só o Assistir; o Transmitir vai em seguida, em mensagem efêmera.
  ctx.waitUntil(sendHostLinkFollowup(interaction, hostUrl));

  return Response.json({
    type: 4,
    data: {
      embeds: [{
        title: `🖥️  ${customName}`,
        description: `Iniciada por <@${userId}> • **1080p 60fps**\nO link para transmitir foi enviado só para quem criou a sala.`,
        color: 0x2b2d31
      }],
      components: [{ type: 1, components: [linkButton('Assistir', viewUrl, '👀')] }]
    }
  });
}

function renderModernApp(room, mode, title, preview, localPreviewEnabled = false, inviteHref = '') {
  const safeRoom = (room || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeMode = mode === 'host' ? 'host' : 'view';
  const safeTitle = (title || 'Sala de Tela').replace(/[<>"]/g, '');
  // Prévia visual determinística: permite revisar os estados sem capturar ou receber mídia.
  const isPreview = safeMode === 'view' && ['waiting', 'connected'].includes(preview);
  const showPreviewNav = safeMode === 'view' && (localPreviewEnabled || isPreview);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${safeTitle} • Colegas de Call</title>
  <link rel="preload" href="/fonts/instrument-sans-latin-v4.woff2" as="font" type="font/woff2" crossorigin>
  ${safeMode === 'host' ? '<link rel="license" href="/diorama/credits.txt" title="Diorama: autoria e licenças">' : ''}
  ${isPreview ? '' : '<script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>'}
  <style>${appStyles}</style>
</head>
<body class="${safeMode === 'view' ? 'viewer' : 'host'} ${isPreview ? 'viewer-preview' : ''}">
  <header>
    <div class="brand">
      <span class="room-title">${safeTitle}</span>
      <span id="status-badge" class="badge">
        <span id="status-text" role="status" aria-live="polite" aria-atomic="true">Aguardando</span>
      </span>
    </div>
    <div class="header-right" id="host-actions" hidden>
      <button id="change-screen-btn" class="btn motion-button" data-button-motion style="display:none" onclick="startHostStream()"><span class="button-motion-content">Trocar Tela</span></button>
      <button id="stop-stream-btn" class="btn motion-button motion-button--danger" data-button-motion style="display:none" onclick="stopHostStream()"><span class="button-motion-content">Encerrar</span></button>
    </div>
  </header>

  ${showPreviewNav ? `<nav class="preview-nav" aria-label="Prévia dos estados do espectador">
    <span>Prévia da interface${isPreview ? ' · sem transmissão real' : ''}</span>
    <button class="btn secondary motion-link" aria-pressed="${preview === 'waiting'}" onclick="openViewerPreview('waiting')"><span class="motion-label"><span class="motion-track"><span>Conectando</span><span aria-hidden="true">Conectando</span></span></span></button>
    <button class="btn secondary motion-link" aria-pressed="${preview === 'connected'}" onclick="openViewerPreview('connected')"><span class="motion-label"><span class="motion-track"><span>Conectado</span><span aria-hidden="true">Conectado</span></span></span></button>
    ${isPreview ? '<a id="exit-preview" class="motion-link" href="#"><span class="motion-label"><span class="motion-track"><span>Sair da prévia</span><span aria-hidden="true">Sair da prévia</span></span></span></a>' : ''}
  </nav>` : ''}

  ${safeMode === 'host' ? '<div class="host-workspace">' : ''}
  <main>
    ${safeMode === 'host' ? '<div class="host-live-heading"><h1 id="host-live-title" tabindex="-1">Sua transmissão.</h1><span>Prévia da tela</span></div>' : ''}
    <!-- Card Inicial -->
    <div id="state-card" class="state-card">
      <div class="state-icon" id="card-icon" aria-hidden="true">${safeMode === 'host' ? '<div id="host-diorama" class="host-diorama" data-state="loading"><img data-src="/diorama/poster.jpg" width="224" height="224" alt="" decoding="async"></div>' : CONNECTION_SYMBOL}</div>
      <h2 id="card-title">Carregando...</h2>
      <p id="card-desc">Preparando conexão P2P direta.</p>
      <button id="card-btn" class="btn full player-control motion-button" data-button-motion data-click-particles="true" data-fill-state="idle" style="display:none"><span class="player-control-content"><span id="host-start-label">Selecionar tela</span></span></button>
      ${safeMode === 'host' ? '<p id="host-feedback" class="host-feedback" role="status" hidden></p>' : ''}
    </div>

    <!-- Player de Vídeo -->
    <div id="video-wrapper" data-preview="${isPreview}" data-state="waiting" role="region" aria-label="Player da transmissão">
      <div class="player-stage">
        <button id="unmute-toast" class="btn unmute-toast" hidden>Ativar o som</button>
        <video id="screen-video" aria-label="Vídeo da transmissão" autoplay playsinline ${isPreview ? 'hidden aria-hidden="true"' : ''}></video>
        <button id="player-chrome-toggle" class="player-chrome-toggle" aria-label="Ocultar controles da transmissão" aria-controls="player-controls" aria-expanded="true" hidden></button>
        ${isPreview ? `<div id="preview-screen">
          <div class="preview-frame">
            <strong>Prévia da transmissão</strong>
            <p>Conectado simulado. Sem vídeo ou áudio reais.</p>
          </div>
        </div>` : ''}
        <div id="player-waiting" class="player-waiting" role="status" hidden>
          <div class="player-waiting-copy"><span class="player-eyebrow">Conexão</span><h2 id="player-waiting-title">Preparando a imagem</h2><p id="player-waiting-description">A transmissão aparece assim que o primeiro quadro estiver disponível.</p></div>
        </div>
      </div>
      <div id="player-controls" class="controls-bar" role="group" aria-label="Controles da transmissão">
        <div class="player-audio">
          <button id="mute-btn" class="player-control" aria-label="Silenciar" aria-pressed="false" title="Silenciar">
            <span class="player-control-content"><svg class="audio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="audio-speaker" d="M10 5 5 9H2v6h3l5 4V5Z"/><path class="audio-wave audio-wave--near" pathLength="1" d="M14 8a6 6 0 0 1 0 8"/><path class="audio-wave audio-wave--far" pathLength="1" d="M18 5a10 10 0 0 1 0 14"/><path class="audio-slash" pathLength="1" d="m15 9 6 6m0-6-6 6"/></svg></span>
          </button>
          <div class="volume-control"><input id="vol-slider" aria-label="Volume" type="range" min="0" max="1" step="0.01" value="1" /><span class="volume-rail" aria-hidden="true"><span class="volume-fill"></span></span><span class="volume-handle" aria-hidden="true"></span><output id="volume-value" for="vol-slider" aria-hidden="true">100%</output></div>
        </div>
        <div class="player-actions">
          <button id="pip-btn" class="player-control" data-fill-state="idle" aria-pressed="false" aria-describedby="pip-description"><span class="pip-border" aria-hidden="true"></span><span class="player-control-content">Miniatura</span></button>
          <span id="pip-description" class="visually-hidden">Abre o vídeo em uma janela flutuante.</span>
          <button id="fullscreen-btn" class="player-control player-control--primary motion-button" data-fill-state="idle" aria-label="Entrar em tela cheia" aria-pressed="false">
            <span class="player-control-content"><svg class="fullscreen-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g class="fullscreen-corner corner-tl"><path d="M8 3H3v5"/></g><g class="fullscreen-corner corner-tr"><path d="M16 3h5v5"/></g><g class="fullscreen-corner corner-bl"><path d="M3 16v5h5"/></g><g class="fullscreen-corner corner-br"><path d="M21 16v5h-5"/></g></svg>
            <span class="player-label-stack" aria-hidden="true"><span id="fullscreen-label" class="player-label-default">Tela cheia</span><span class="player-label-active">Voltar</span></span></span>
          </button>
        </div>
      </div>
      <p id="player-notice" class="player-notice" role="status" aria-live="polite" hidden></p>
    </div>
  </main>
  ${safeMode === 'host' ? `<aside class="host-audience" aria-labelledby="audience-title">
    <div class="audience-heading"><h2 id="audience-title">Quem está na sala</h2><span id="viewer-count" class="audience-count" role="status" aria-live="polite" aria-label="0 espectadores na sala">0</span></div>
    <div id="audience-empty" class="audience-empty"><p>Ninguém conectado ainda.</p><span>Envie o link para quem vai assistir.</span></div>
    <ul id="audience-list" class="audience-list" aria-label="Espectadores conectados"></ul>
    <p id="audience-identity" class="audience-caption" hidden>Os nomes não são informados pelo link de acesso.</p>
    <div class="host-invite"><button id="copy-view-link" class="host-copy-link motion-button" data-button-motion type="button"><span class="button-motion-content">Copiar link para assistir <span aria-hidden="true">↗</span></span></button><p id="copy-feedback" class="audience-caption" role="status" hidden></p><input id="view-link-fallback" class="view-link-fallback" aria-label="Link para assistir" readonly hidden></div>
    <p id="host-audio-status" class="host-audio-status" hidden></p>
  </aside></div>` : ''}

  <script>
    const ROOM_ID = "canja_v2_" + ${JSON.stringify(safeRoom)};
    const MODE = ${JSON.stringify(safeMode)};
    const INVITE_HREF = ${JSON.stringify(inviteHref)};
    const PREVIEW = ${JSON.stringify(isPreview ? preview : null)};

    function openViewerPreview(state) {
      const url = new URL(window.location.href);
      url.searchParams.set('preview', state);
      window.location.href = url.href;
    }

    if (PREVIEW) {
      const realUrl = new URL(window.location.href);
      realUrl.searchParams.delete('preview');
      document.getElementById('exit-preview').href = realUrl.href;
    }

    const statusBadge = document.getElementById('status-badge');
    const statusText = document.getElementById('status-text');
    const viewerCountEl = document.getElementById('viewer-count');
    const stateCard = document.getElementById('state-card');
    const cardIcon = document.getElementById('card-icon');
    const cardTitle = document.getElementById('card-title');
    const cardDesc = document.getElementById('card-desc');
    const cardBtn = document.getElementById('card-btn');
    const videoWrapper = document.getElementById('video-wrapper');
    const videoEl = document.getElementById('screen-video');
    const changeScreenBtn = document.getElementById('change-screen-btn');
    const stopStreamBtn = document.getElementById('stop-stream-btn');
    const unmuteToast = document.getElementById('unmute-toast');
    const hostActions = document.getElementById('host-actions');
    const audienceList = document.getElementById('audience-list');
    const audienceEmpty = document.getElementById('audience-empty');
    const audienceIdentity = document.getElementById('audience-identity');
    const hostFeedback = document.getElementById('host-feedback');
    const hostAudioStatus = document.getElementById('host-audio-status');

    let peer = null;
    let localStream = null;
    let activeCalls = new Map();
    const hostConnections = new Map();
    const viewerNumbers = new Map();
    let viewerSequence = 0;
    let captureGeneration = 0;
    let retryTimer = null;
    let viewerConnected = false;
    let viewerMediaCall = null;
    let viewerDataConnection = null;

    function showPlayer(state = 'connected') {
      const enteringHost = MODE === 'host' && stateCard.style.display !== 'none';
      videoWrapper.dataset.state = state;
      videoWrapper.classList.add('active');
      document.body.classList.add('player-active');
      stateCard.style.display = 'none';
      videoWrapper.dispatchEvent(new Event('playerstatechange'));
      if (enteringHost) {
        document.getElementById('host-live-title')?.focus?.({ preventScroll: true });
        window.scrollTo?.({ top: 0, behavior: 'instant' });
      }
    }

    function hidePlayer() {
      videoWrapper.classList.remove('active');
      document.body.classList.remove('player-active');
      videoWrapper.dataset.state = 'waiting';
      stateCard.style.display = '';
      videoWrapper.dispatchEvent(new Event('playerstatechange'));
    }

    function setLiveStatus(isLive, text) {
      statusText.textContent = text;
      if (isLive) {
        statusBadge.classList.add('live');
      } else {
        statusBadge.classList.remove('live');
      }
    }

    function setWaitingMessage(title, description) {
      // A line break is compositional. Only the symbol animates during the wait.
      const [firstWord, ...remainingWords] = title.split(' ');
      cardTitle.replaceChildren(
        document.createTextNode(firstWord + ' '),
        document.createElement('br'),
        document.createTextNode(remainingWords.join(' '))
      );
      cardDesc.textContent = description;
      document.body.classList.add('is-connecting');
    }

    function syncMotionVisibility() {
      document.body.classList.toggle('page-hidden', document.hidden);
    }
    document.addEventListener('visibilitychange', syncMotionVisibility);
    syncMotionVisibility();

    function updateViewerCount() {
      if (!viewerCountEl) return;
      const count = activeCalls.size;
      viewerCountEl.textContent = String(count);
      viewerCountEl.setAttribute('aria-label', count + (count === 1 ? ' espectador na sala' : ' espectadores na sala'));
      audienceEmpty.hidden = count > 0;
      audienceIdentity.hidden = count === 0;
      audienceList.replaceChildren(...Array.from(activeCalls, ([id, call]) => {
        if (!viewerNumbers.has(id)) viewerNumbers.set(id, ++viewerSequence);
        const row = document.createElement('li');
        const number = String(viewerNumbers.get(id)).padStart(2, '0');
        const marker = document.createElement('span');
        marker.className = 'audience-marker';
        marker.textContent = number;
        marker.setAttribute('aria-hidden', 'true');
        const name = document.createElement('span');
        name.className = 'audience-name';
        name.textContent = 'Espectador ' + number;
        const state = document.createElement('span');
        state.className = 'audience-state';
        const connectionState = call.peerConnection?.connectionState;
        state.textContent = connectionState === 'connected' ? 'Conectado' :
          connectionState === 'disconnected' ? 'Reconectando' : 'Conectando';
        row.append(marker, name, state);
        return row;
      }));
    }

    function showHostFeedback(message) {
      hostFeedback.textContent = message;
      hostFeedback.hidden = !message;
    }

    // Aumenta o bitrate do WebRTC para 1080p 60fps nítido
    function boostSenderBitrate(peerConnection) {
      if (!peerConnection || !peerConnection.getSenders) return;
      peerConnection.getSenders().forEach(async (sender) => {
        if (sender.track && sender.track.kind === 'video') {
          try {
            const params = sender.getParameters();
            if (!params.encodings) params.encodings = [{}];
            params.encodings[0].maxBitrate = 8500000; // 8.5 Mbps
            params.encodings[0].maxFramerate = 60;
            await sender.setParameters(params);
          } catch (e) {}
        }
      });
    }

    // ================= MODO TRANSMISSOR (HOST) =================
    if (MODE === 'host') {
      cardTitle.replaceChildren(document.createTextNode('Compartilhe'), document.createElement('br'), document.createTextNode('sua tela.'));
      cardDesc.textContent = 'Escolha uma tela, janela ou aba. Para transmitir som, ative o áudio na seleção.';
      document.getElementById('host-start-label').textContent = 'Selecionar tela';
      cardBtn.style.display = 'inline-flex';
      cardBtn.onclick = startHostStream;
      setLiveStatus(false, 'Pronto para transmitir');
      videoEl.muted = true; // Host não ouve o próprio eco
      document.querySelector('.controls-bar').style.display = 'none';
      const inviteUrl = new URL(INVITE_HREF || window.location.href);
      inviteUrl.searchParams.set('mode', 'view');
      inviteUrl.searchParams.delete('preview');
      document.getElementById('copy-view-link').addEventListener('click', async () => {
        const feedback = document.getElementById('copy-feedback');
        const fallback = document.getElementById('view-link-fallback');
        try {
          await navigator.clipboard.writeText(inviteUrl.href);
          feedback.textContent = 'Link copiado. Envie para quem vai assistir.';
          fallback.hidden = true;
        } catch {
          feedback.textContent = 'Copie o link abaixo para convidar alguém.';
          fallback.value = inviteUrl.href;
          fallback.hidden = false;
          fallback.focus();
          fallback.select();
        }
        feedback.hidden = false;
      });
    }

    async function startHostStream() {
      if (cardBtn.disabled || changeScreenBtn.disabled) return;
      cardBtn.disabled = true;
      changeScreenBtn.disabled = true;
      document.body.dataset.capturePending = 'true';
      document.body.dispatchEvent(new Event('hostcapturechange'));
      const captureId = ++captureGeneration;
      showHostFeedback('');
      try {
        const newStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920, max: 2560 },
            height: { ideal: 1080, max: 1440 },
            frameRate: { ideal: 60, max: 60 }
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });

        if (captureId !== captureGeneration) {
          newStream.getTracks().forEach(track => track.stop());
          return;
        }
        if (localStream) {
          localStream.getTracks().forEach(t => t.stop());
        }
        localStream = newStream;
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack && 'contentHint' in videoTrack) {
          videoTrack.contentHint = 'motion';
        }

        videoEl.srcObject = localStream;
        videoWrapper.dispatchEvent(new Event('playerstreamchange'));
        showPlayer();
        changeScreenBtn.style.display = 'inline-flex';
        stopStreamBtn.style.display = 'inline-flex';
        hostActions.hidden = false;
        hostAudioStatus.hidden = false;
        hostAudioStatus.textContent = localStream.getAudioTracks().length ? 'Áudio compartilhado' : 'Sem áudio compartilhado';
        setLiveStatus(Boolean(peer?.open), peer?.open ? 'Ao vivo' : 'Preparando a sala');

        videoTrack.onended = () => stopHostStream();

        // Se já havia espectadores conectados, atualiza a tela para eles
        activeCalls.forEach((call) => {
          if (call.peerConnection) {
            const senders = call.peerConnection.getSenders();
            localStream.getTracks().forEach((track) => {
              const sender = senders.find(s => s.track && s.track.kind === track.kind);
              if (sender) sender.replaceTrack(track);
            });
          }
        });

        if (!peer || peer.destroyed) {
          peer = new Peer(ROOM_ID, {
            config: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
              ]
            }
          });

          const hostPeer = peer;
          hostPeer.on('open', () => {
            if (peer === hostPeer && localStream) setLiveStatus(true, 'Ao vivo');
          });
          hostPeer.on('error', () => {
            if (peer !== hostPeer) return;
            setLiveStatus(false, 'Falha na conexão');
            hostAudioStatus.textContent = 'A sala não pôde conectar. Encerre e tente novamente.';
          });
          hostPeer.on('disconnected', () => {
            if (peer === hostPeer) setLiveStatus(false, 'Sala desconectada');
          });

          peer.on('connection', (conn) => {
            const previous = hostConnections.get(conn.peer);
            hostConnections.set(conn.peer, conn);
            if (previous && previous !== conn) previous.close();
            conn.on('data', (msg) => {
              if (hostConnections.get(conn.peer) !== conn) return;
              if (msg === 'REQUEST_STREAM' && localStream) {
                if (activeCalls.has(conn.peer)) return;
                const call = peer.call(conn.peer, localStream);
                if (!call) return;
                activeCalls.set(conn.peer, call);
                updateViewerCount();
                setTimeout(() => boostSenderBitrate(call.peerConnection), 1000);
                const updateState = () => {
                  if (activeCalls.get(conn.peer) !== call) return;
                  if (['failed', 'closed'].includes(call.peerConnection?.connectionState)) call.close();
                  else updateViewerCount();
                };
                call.peerConnection?.addEventListener('connectionstatechange', updateState);
                const removeCall = () => {
                  call.peerConnection?.removeEventListener('connectionstatechange', updateState);
                  if (activeCalls.get(conn.peer) !== call) return;
                  activeCalls.delete(conn.peer);
                  updateViewerCount();
                };
                call.on('close', removeCall);
                call.on('error', () => { removeCall(); call.close(); });
              }
            });
            conn.on('close', () => {
              if (hostConnections.get(conn.peer) !== conn) return;
              hostConnections.delete(conn.peer);
              activeCalls.get(conn.peer)?.close();
            });
          });
        }
      } catch (err) {
        showHostFeedback(err.name === 'NotAllowedError' ? 'Seleção cancelada. Você pode tentar novamente.' :
          'Não foi possível compartilhar a tela. Verifique a permissão e o suporte do navegador.');
      } finally {
        delete document.body.dataset.capturePending;
        document.body.dispatchEvent(new Event('hostcapturechange'));
        cardBtn.disabled = false;
        changeScreenBtn.disabled = false;
      }
    }

    function stopHostStream() {
      captureGeneration++;
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
      }
      activeCalls.forEach(c => c.close());
      activeCalls.clear();
      hostConnections.clear();
      viewerNumbers.clear();
      viewerSequence = 0;
      updateViewerCount();
      if (peer) {
        peer.destroy();
        peer = null;
      }
      hidePlayer();
      changeScreenBtn.style.display = 'none';
      stopStreamBtn.style.display = 'none';
      hostActions.hidden = true;
      hostAudioStatus.hidden = true;
      videoEl.srcObject = null;
      showHostFeedback('Você pode selecionar uma tela para transmitir novamente.');
      stateCard.style.display = '';
      setLiveStatus(false, 'Encerrado');
      cardBtn.focus?.({ preventScroll: true });
      window.scrollTo?.({ top: 0, behavior: 'instant' });
    }

    // ================= MODO ESPECTADOR (VIEW) =================
    if (MODE === 'view') {
      setWaitingMessage('Conectando à transmissão', 'A imagem aparece aqui assim que a transmissão começar.');
      if (PREVIEW) {
        // Testa somente a composição dos estados; não cria Peer, chamadas ou tentativas de conexão.
        const connected = PREVIEW === 'connected';
        document.body.classList.toggle('is-connecting', !connected);
        if (connected) showPlayer();
        else hidePlayer();
        setLiveStatus(false, connected ? 'Conectado · prévia' : 'Conectando · prévia');
      } else {
        initViewer();
      }
    }

    function initViewer() {
      peer = new Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      peer.on('open', () => {
        connectToHost();
      });

      peer.on('call', (call) => {
        viewerMediaCall = call;
        call.answer();
        call.on('stream', (remoteStream) => {
          if (viewerMediaCall !== call) return;
          if (retryTimer) {
            clearInterval(retryTimer);
            retryTimer = null;
          }
          videoEl.srcObject = remoteStream;
          videoWrapper.dispatchEvent(new Event('playerstreamchange'));
          viewerConnected = true;
          document.body.classList.remove('is-connecting');
          showPlayer();
          setLiveStatus(true, 'Ao vivo');

          videoEl.play().catch(() => {
            videoEl.muted = true;
            videoEl.play().catch(() => {});
            unmuteToast.hidden = false;
          });
        });

        call.on('close', () => {
          if (viewerMediaCall === call) handleHostDisconnect();
        });
      });

      peer.on('error', () => {
        // Host ainda não entrou; tenta reconectar a cada 2.5s automaticamente
        if (!retryTimer) {
          retryTimer = setInterval(connectToHost, 2500);
        }
      });
    }

    function connectToHost() {
      if (!peer || peer.destroyed || viewerConnected) return;
      const conn = peer.connect(ROOM_ID, { reliable: true });
      viewerDataConnection = conn;
      conn.on('open', () => {
        conn.send('REQUEST_STREAM');
      });
      conn.on('close', () => {
        if (viewerDataConnection === conn) handleHostDisconnect();
      });
    }

    function handleHostDisconnect() {
      viewerConnected = false;
      if (videoWrapper.classList.contains('active')) {
        // Preserve the fullscreen root, the video element and the exit control.
        // Presentation remains open while retries depend on actual connection state.
        showPlayer('waiting');
      } else {
        setWaitingMessage('Aguardando transmissão', 'A transmissão foi pausada ou ainda não começou. Reconectando automaticamente...');
      }
      setLiveStatus(false, 'Aguardando');
      if (!retryTimer) {
        retryTimer = setInterval(connectToHost, 2500);
      }
    }

  </script>
  <script type="module">
    import { attachPlayerControls } from '/player-controls.mjs';
    attachPlayerControls(document.getElementById('video-wrapper'), document.getElementById('screen-video'));
  </script>
  ${safeMode === 'host' ? `<script type="module">
    import { attachHostDiorama } from '/host-diorama.mjs';
    import { attachButtonMotion } from '/button-motion.mjs';
    document.querySelectorAll('[data-button-motion]').forEach(button => {
      attachButtonMotion(button, document, { particles: button.dataset.clickParticles === 'true' });
    });
    attachHostDiorama(document.getElementById('host-diorama'), document.getElementById('video-wrapper'));
  </script>` : ''}
</body>
</html>`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const secret = env?.HOST_LINK_SECRET;
    const isLocal = LOCAL_HOSTS.has(url.hostname);

    // Botões Transmitir/Assistir: serve a interface.
    if (request.method === 'GET' || request.method === 'HEAD') {
      const p = url.searchParams;
      const room = p.get('room');
      if (!room) return new Response('Bot de Tela ativo.', { status: 200 });

      // No 127.0.0.1 os links de teste do README continuam abrindo sem assinatura.
      if (!isLocal) {
        if (!secret) return new Response('Servidor não configurado', { status: 500 });
        if (!(await verifyRoomLink(secret, p))) return invalidLinkPage();
      }

      let inviteHref = '';
      if (p.get('mode') === 'host') {
        const view = viewUrlFromHost(url);
        if (secret && p.get('exp')) view.searchParams.set('sig', await signLink(secret, room, Number(p.get('exp')), 'view'));
        inviteHref = view.href;
      }

      const html = renderModernApp(room, p.get('mode'), p.get('title'), p.get('preview'), isLocal, inviteHref);
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD, POST' } });
    }

    // Interações do Discord.
    const publicKey = env?.DISCORD_PUBLIC_KEY;
    if (!publicKey || !secret) {
      console.error('Configure DISCORD_PUBLIC_KEY e HOST_LINK_SECRET.');
      return new Response('Servidor não configurado', { status: 500 });
    }

    const bodyText = await request.text();
    if (!(await verifyDiscordSignature(request, bodyText, publicKey))) {
      return new Response('Assinatura inválida', { status: 401 });
    }

    let interaction;
    try {
      interaction = JSON.parse(bodyText);
    } catch {
      return new Response('JSON inválido', { status: 400 });
    }

    if (interaction.type === 1) return Response.json({ type: 1 });
    if (interaction.type === 2 && interaction.data?.name === 'tela') {
      return handleTelaCommand(interaction, url.origin, secret, ctx);
    }
    return new Response('Comando não reconhecido', { status: 400 });
  }
};
