const DEFAULT_PUBLIC_KEY = '8e45068f3cd1e86f40002cbe8de74a94cb44af4bd120ed79112df02f0dbd2e42';

async function verifyDiscordSignature(request, bodyText, publicKeyHex) {
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  if (!signature || !timestamp || !publicKeyHex) return false;

  try {
    const hexToBytes = (hex) => new Uint8Array(hex.match(/.{1,2}/g).map((b) => parseInt(b, 16)));
    const key = await crypto.subtle.importKey(
      'raw',
      hexToBytes(publicKeyHex),
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false,
      ['verify']
    );
    const message = new TextEncoder().encode(timestamp + bodyText);
    return await crypto.subtle.verify('Ed25519', key, hexToBytes(signature), message);
  } catch {
    return false;
  }
}

function randomHex(bytesLength) {
  const arr = new Uint8Array(bytesLength);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function renderModernApp(room, mode, title) {
  const safeRoom = (room || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeMode = mode === 'host' ? 'host' : 'view';
  const safeTitle = (title || 'Sala de Tela').replace(/[<>"]/g, '');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle} • Colegas de Call</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #090a0f;
      --card: rgba(20, 22, 30, 0.85);
      --border: rgba(255, 255, 255, 0.08);
      --accent: #5865F2;
      --accent-hover: #4752C4;
      --danger: #ED4245;
      --success: #23A55A;
      --text: #F2F3F5;
      --muted: #949BA4;
    }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: radial-gradient(circle at 50% 0%, #16192b 0%, var(--bg) 65%);
      color: var(--text);
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      user-select: none;
    }

    /* Top Header Minimalista */
    header {
      height: 56px;
      padding: 0 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(9, 10, 15, 0.75);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      z-index: 20;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 600;
      font-size: 15px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.06);
      color: var(--muted);
      border: 1px solid var(--border);
    }
    .badge.live {
      background: rgba(237, 66, 69, 0.15);
      color: #ff6b6e;
      border-color: rgba(237, 66, 69, 0.35);
    }
    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: currentColor;
    }
    .live .dot {
      animation: pulse 1.6s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* Área Principal */
    main {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    /* Card Central Objetivo */
    .state-card {
      background: var(--card);
      backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 36px 32px;
      max-width: 420px;
      width: 90%;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      z-index: 10;
    }
    .state-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: rgba(88, 101, 242, 0.15);
      border: 1px solid rgba(88, 101, 242, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 18px;
      font-size: 26px;
    }
    .state-card h2 {
      font-size: 19px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .state-card p {
      font-size: 13.5px;
      color: var(--muted);
      line-height: 1.5;
      margin-bottom: 24px;
    }

    /* Botões */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      padding: 12px 22px;
      border-radius: 10px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s ease;
      color: #fff;
      background: var(--accent);
    }
    .btn:hover { background: var(--accent-hover); transform: translateY(-1px); }
    .btn.secondary {
      background: rgba(255,255,255,0.06);
      border-color: var(--border);
      color: var(--text);
      padding: 8px 14px;
      font-size: 13px;
    }
    .btn.secondary:hover { background: rgba(255,255,255,0.11); }
    .btn.danger {
      background: rgba(237, 66, 69, 0.15);
      border-color: rgba(237, 66, 69, 0.35);
      color: #ff7b7d;
      padding: 8px 14px;
      font-size: 13px;
    }
    .btn.danger:hover { background: var(--danger); color: #fff; }
    .btn.full { width: 100%; }

    /* Player de Vídeo */
    #video-wrapper {
      position: absolute;
      inset: 0;
      background: #000;
      display: none;
      align-items: center;
      justify-content: center;
    }
    #video-wrapper.active {
      display: flex;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }

    /* Barra de Controles Flutuante */
    .controls-bar {
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 14px;
      border-radius: 12px;
      background: rgba(15, 17, 23, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      box-shadow: 0 8px 30px rgba(0,0,0,0.6);
      opacity: 0;
      transition: opacity 0.25s ease;
    }
    #video-wrapper:hover .controls-bar,
    .controls-bar:hover {
      opacity: 1;
    }
    input[type="range"] {
      accent-color: var(--accent);
      width: 90px;
      cursor: pointer;
    }
    .unmute-toast {
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 30;
      display: none;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <span>🖥️ ${safeTitle}</span>
      <span id="status-badge" class="badge">
        <span class="dot"></span>
        <span id="status-text">Aguardando</span>
      </span>
    </div>
    <div class="header-right">
      <span class="badge" id="viewer-count" title="Pessoas assistindo">👀 0</span>
      <button id="change-screen-btn" class="btn secondary" style="display:none" onclick="startHostStream()">Trocar Tela</button>
      <button id="stop-stream-btn" class="btn danger" style="display:none" onclick="stopHostStream()">Encerrar</button>
    </div>
  </header>

  <main>
    <!-- Card Inicial -->
    <div id="state-card" class="state-card">
      <div class="state-icon" id="card-icon">📡</div>
      <h2 id="card-title">Carregando...</h2>
      <p id="card-desc">Preparando conexão P2P direta.</p>
      <button id="card-btn" class="btn full" style="display:none">Transmitir Agora</button>
    </div>

    <!-- Player de Vídeo -->
    <div id="video-wrapper">
      <button id="unmute-toast" class="btn unmute-toast" onclick="forceUnmute()">🔊 Clique para ativar o som</button>
      <video id="screen-video" autoplay playsinline></video>

      <div class="controls-bar">
        <button id="mute-btn" class="btn secondary" onclick="toggleMute()">🔊 Som</button>
        <input id="vol-slider" type="range" min="0" max="1" step="0.05" value="1" oninput="changeVolume(this.value)" />
        <button class="btn secondary" onclick="togglePiP()" title="Miniatura">🖼️ PiP</button>
        <button class="btn secondary" onclick="toggleFullscreen()" title="Tela Cheia">⛶ Tela Cheia</button>
      </div>
    </div>
  </main>

  <script>
    const ROOM_ID = "canja_v2_" + ${JSON.stringify(safeRoom)};
    const MODE = ${JSON.stringify(safeMode)};

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
    const muteBtn = document.getElementById('mute-btn');
    const unmuteToast = document.getElementById('unmute-toast');

    let peer = null;
    let localStream = null;
    let activeCalls = new Map();
    let retryTimer = null;

    function setLiveStatus(isLive, text) {
      statusText.textContent = text;
      if (isLive) {
        statusBadge.classList.add('live');
      } else {
        statusBadge.classList.remove('live');
      }
    }

    function updateViewerCount() {
      viewerCountEl.textContent = '👀 ' + activeCalls.size;
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
      cardIcon.textContent = '🖥️';
      cardTitle.textContent = 'Transmitir sua Tela';
      cardDesc.textContent = 'Qualidade 1080p a 60fps direto para quem estiver na sala. Lembre-se de marcar "Compartilhar áudio do sistema".';
      cardBtn.textContent = 'Selecionar Tela ou Jogo';
      cardBtn.style.display = 'inline-flex';
      cardBtn.onclick = startHostStream;
      videoEl.muted = true; // Host não ouve o próprio eco
      document.querySelector('.controls-bar').style.display = 'none';
    }

    async function startHostStream() {
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

        if (localStream) {
          localStream.getTracks().forEach(t => t.stop());
        }
        localStream = newStream;
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack && 'contentHint' in videoTrack) {
          videoTrack.contentHint = 'motion';
        }

        videoEl.srcObject = localStream;
        stateCard.style.display = 'none';
        videoWrapper.classList.add('active');
        changeScreenBtn.style.display = 'inline-flex';
        stopStreamBtn.style.display = 'inline-flex';
        setLiveStatus(true, 'AO VIVO • 1080p 60fps');

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

          peer.on('connection', (conn) => {
            conn.on('data', (msg) => {
              if (msg === 'REQUEST_STREAM' && localStream) {
                const call = peer.call(conn.peer, localStream);
                activeCalls.set(conn.peer, call);
                updateViewerCount();
                setTimeout(() => boostSenderBitrate(call.peerConnection), 1000);

                call.on('close', () => {
                  activeCalls.delete(conn.peer);
                  updateViewerCount();
                });
              }
            });
            conn.on('close', () => {
              activeCalls.delete(conn.peer);
              updateViewerCount();
            });
          });
        }
      } catch (err) {
        console.warn('Captura cancelada:', err);
      }
    }

    function stopHostStream() {
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
      }
      activeCalls.forEach(c => c.close());
      activeCalls.clear();
      updateViewerCount();
      if (peer) {
        peer.destroy();
        peer = null;
      }
      videoWrapper.classList.remove('active');
      changeScreenBtn.style.display = 'none';
      stopStreamBtn.style.display = 'none';
      stateCard.style.display = 'block';
      setLiveStatus(false, 'Encerrado');
    }

    // ================= MODO ESPECTADOR (VIEW) =================
    if (MODE === 'view') {
      viewerCountEl.style.display = 'none';
      cardIcon.textContent = '👀';
      cardTitle.textContent = 'Conectando à transmissão...';
      cardDesc.textContent = 'Assim que seu amigo iniciar a tela, o vídeo abrirá automaticamente aqui.';
      initViewer();
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
        call.answer();
        call.on('stream', (remoteStream) => {
          if (retryTimer) {
            clearInterval(retryTimer);
            retryTimer = null;
          }
          videoEl.srcObject = remoteStream;
          stateCard.style.display = 'none';
          videoWrapper.classList.add('active');
          setLiveStatus(true, 'AO VIVO • 1080p 60fps');

          videoEl.play().catch(() => {
            videoEl.muted = true;
            videoEl.play();
            unmuteToast.style.display = 'inline-flex';
          });
        });

        call.on('close', () => {
          handleHostDisconnect();
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
      if (!peer || peer.destroyed || videoWrapper.classList.contains('active')) return;
      const conn = peer.connect(ROOM_ID, { reliable: true });
      conn.on('open', () => {
        conn.send('REQUEST_STREAM');
      });
      conn.on('close', () => {
        handleHostDisconnect();
      });
    }

    function handleHostDisconnect() {
      videoWrapper.classList.remove('active');
      stateCard.style.display = 'block';
      cardTitle.textContent = 'Aguardando transmissão...';
      cardDesc.textContent = 'A transmissão foi pausada ou ainda não começou. Reconectando automaticamente...';
      setLiveStatus(false, 'Aguardando');
      if (!retryTimer) {
        retryTimer = setInterval(connectToHost, 2500);
      }
    }

    // Controles do Player
    function forceUnmute() {
      videoEl.muted = false;
      unmuteToast.style.display = 'none';
      muteBtn.textContent = '🔊 Som';
    }
    function toggleMute() {
      videoEl.muted = !videoEl.muted;
      muteBtn.textContent = videoEl.muted ? '🔇 Mudo' : '🔊 Som';
      if (!videoEl.muted) unmuteToast.style.display = 'none';
    }
    function changeVolume(val) {
      videoEl.volume = parseFloat(val);
      videoEl.muted = val == 0;
      muteBtn.textContent = videoEl.muted ? '🔇 Mudo' : '🔊 Som';
    }
    function toggleFullscreen() {
      if (!document.fullscreenElement) {
        videoWrapper.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
    function togglePiP() {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      } else if (videoEl.requestPictureInPicture) {
        videoEl.requestPictureInPicture().catch(() => {});
      }
    }
  </script>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Quando alguém clica nos botões de Transmitir ou Assistir (GET), abre nossa interface limpa e moderna!
    if (request.method === 'GET') {
      const room = url.searchParams.get('room');
      const mode = url.searchParams.get('mode');
      const title = url.searchParams.get('title');

      if (room) {
        return new Response(renderModernApp(room, mode, title), {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
      return new Response('Bot de Tela (tnc canja) ativo na Cloudflare Workers!', { status: 200 });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // 2. Interações do Discord (POST)
    const bodyText = await request.text();
    const publicKey = env?.DISCORD_PUBLIC_KEY || DEFAULT_PUBLIC_KEY;
    const isValid = await verifyDiscordSignature(request, bodyText, publicKey);
    if (!isValid) {
      return new Response('Assinatura inválida', { status: 401 });
    }

    const interaction = JSON.parse(bodyText);

    if (interaction.type === 1) {
      return Response.json({ type: 1 });
    }

    if (interaction.type === 2 && interaction.data.name === 'tela') {
      const optionNome = interaction.data.options?.find((o) => o.name === 'nome')?.value;
      const customName = optionNome || 'Sala de Tela';
      const roomId = randomHex(6);
      const baseUrl = `${url.protocol}//${url.host}`;

      const hostUrl = `${baseUrl}/?room=${roomId}&mode=host&title=${encodeURIComponent(customName)}`;
      const viewUrl = `${baseUrl}/?room=${roomId}&mode=view&title=${encodeURIComponent(customName)}`;
      const userId = interaction.member?.user?.id || interaction.user?.id;

      return Response.json({
        type: 4,
        data: {
          embeds: [
            {
              title: `🖥️  ${customName}`,
              description: `Iniciada por <@${userId}> • **1080p 60fps**`,
              color: 0x2b2d31
            }
          ],
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 5,
                  label: 'Transmitir',
                  url: hostUrl,
                  emoji: { name: '📡' }
                },
                {
                  type: 2,
                  style: 5,
                  label: 'Assistir',
                  url: viewUrl,
                  emoji: { name: '👀' }
                }
              ]
            }
          ]
        }
      });
    }

    return new Response('Comando não reconhecido', { status: 400 });
  }
};
