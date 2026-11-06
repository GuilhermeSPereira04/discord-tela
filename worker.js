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
// Depois que o link vence ninguém novo entra, mas o host ainda pode atualizar
// ou apagar a mensagem de uma transmissão longa por mais este tempo.
const STATUS_GRACE_SECONDS = 12 * 60 * 60;
const DISCORD_API = 'https://discord.com/api/v10';
const hmacKeys = new Map();

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(secret, payload) {
  let key = hmacKeys.get(secret);
  if (!key) {
    key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    hmacKeys.set(secret, key);
  }
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return base64url(new Uint8Array(mac).slice(0, 16));
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// O que cada link assina. O do host também carrega a mensagem do Discord que ele
// pode atualizar ou apagar, então canal, mensagem e autor entram na assinatura.
function linkPayload(params) {
  const room = params.get('room') || '';
  const exp = params.get('exp') || '';
  if (params.get('mode') !== 'host') return `${room}.${exp}.view`;
  return `${room}.${exp}.host.${params.get('ch') || ''}.${params.get('msg') || ''}.${params.get('uid') || ''}`;
}

async function signedUrl(origin, secret, fields) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) if (v) params.set(k, v);
  params.set('sig', await sign(secret, linkPayload(params)));
  return `${origin}/?${params}`;
}

function viewUrlFor(origin, secret, room, title, exp) {
  return signedUrl(origin, secret, { room, title, exp: String(exp), mode: 'view' });
}

async function verifyRoomLink(secret, params, graceSeconds = 0) {
  const exp = Number(params.get('exp'));
  if (!Number.isInteger(exp) || exp + graceSeconds < Date.now() / 1000) return false;
  return safeEqual(params.get('sig'), await sign(secret, linkPayload(params)));
}

function invalidLinkPage() {
  return new Response(
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Link expirado</title><style>${appStyles}</style></head>
    <body class="expired-page"><canvas id="expired-walkers" class="expired-walkers" aria-hidden="true"></canvas>
    <main class="expired-message"><h1>Link expirado ou inválido</h1><p>Use <strong>/tela</strong> no Discord para criar uma nova sala.</p></main>
    <script type="module">import { attachExpiredWalkers } from '/expired-walkers.mjs'; attachExpiredWalkers(document.getElementById('expired-walkers'),document.querySelector('.expired-message'));</script>
    </body></html>`,
    { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

function linkButton(label, url, emoji) {
  return { type: 2, style: 5, label, url, emoji: { name: emoji } };
}

function roomEmbed(title, userId, line, color) {
  return {
    title: `🖥️  ${title}`,
    description: `Iniciada por <@${userId}> • **1080p 60fps**${line ? `\n${line}` : ''}`,
    color
  };
}

async function discord(path, init) {
  const res = await fetch(`${DISCORD_API}${path}`, init);
  if (!res.ok) console.error(`Discord ${init?.method || 'GET'} ${path.split('/').slice(0, 3).join('/')}:`, res.status, await res.text());
  return res;
}

// O bot publica a mensagem pública no canal: assim ela é dele, e ele pode editá-la
// e apagá-la depois. Respostas de comando são mensagens de webhook, que o bot não edita.
async function createRoom(interaction, origin, secret, env, room) {
  const viewUrl = await viewUrlFor(origin, secret, room.id, room.title, room.exp);
  const publicMessage = {
    embeds: [roomEmbed(room.title, room.userId, 'Aguardando quem vai transmitir.', 0x2b2d31)],
    components: [{ type: 1, components: [linkButton('Assistir', viewUrl, '👀')] }],
    allowed_mentions: { parse: [] }
  };
  const channelId = interaction.channel_id || interaction.channel?.id;
  let posted = null;
  if (!env?.DISCORD_TOKEN) console.error('DISCORD_TOKEN não configurado: a mensagem da sala vai pelo modo reserva.');
  else if (!interaction.guild_id) console.log('/tela fora de servidor (DM ou app de usuário): modo reserva.');
  else if (channelId) {
    const res = await discord(`/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bot ${env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(publicMessage)
    });
    if (res.ok) posted = await res.json();
  }

  const hostUrl = await signedUrl(origin, secret, {
    room: room.id,
    title: room.title,
    exp: String(room.exp),
    mode: 'host',
    ch: posted ? channelId : '',
    msg: posted?.id,
    uid: room.userId
  });

  // Primeiro preenche a resposta adiada (só quem usou o comando vê). A ordem importa:
  // enquanto ela está "pensando", o Discord transforma a próxima mensagem numa edição dela.
  const webhook = `/webhooks/${interaction.application_id}/${interaction.token}`;
  await discord(`${webhook}/messages/@original`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: posted
        ? 'Sala criada. Este é o seu link para transmitir: só você vê esta mensagem, não compartilhe.'
        : 'Sala criada. Este é o seu link para transmitir: só você vê esta mensagem, não compartilhe.\n-# Não consegui publicar a sala neste canal como bot, então a mensagem abaixo não será atualizada nem apagada. Confira se o bot pode ver o canal, enviar mensagens e inserir links.',
      components: [{ type: 1, components: [linkButton('Transmitir', hostUrl, '📡')] }]
    })
  });

  // Modo reserva: sem o bot no canal, a sala é anunciada como mensagem do comando.
  if (!posted) {
    await discord(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(publicMessage) });
  }
}

async function handleTelaCommand(interaction, origin, secret, env, ctx) {
  const rawName = interaction.data.options?.find((o) => o.name === 'nome')?.value;
  const room = {
    id: randomHex(6),
    title: (typeof rawName === 'string' && rawName.trim().slice(0, MAX_ROOM_NAME)) || 'Sala de Tela',
    exp: Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS,
    userId: interaction.member?.user?.id ?? interaction.user?.id
  };
  // Resposta adiada e efêmera: o Discord espera até 15 min pela edição com o link do host.
  ctx.waitUntil(createRoom(interaction, origin, secret, env, room));
  return Response.json({ type: 5, data: { flags: 64 } });
}

// Avisos da página do host: ao vivo (com nº de espectadores), aba fechada ou encerrada.
async function handleHostStatus(request, env, origin) {
  const secret = env?.HOST_LINK_SECRET;
  const botToken = env?.DISCORD_TOKEN;
  let body;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return new Response('JSON inválido', { status: 400 });
  }
  const params = new URLSearchParams(typeof body?.query === 'string' ? body.query : '');
  if (!secret || params.get('mode') !== 'host' || !(await verifyRoomLink(secret, params, STATUS_GRACE_SECONDS))) {
    return new Response('Link inválido', { status: 403 });
  }
  const ch = params.get('ch');
  const msg = params.get('msg');
  if (!botToken) {
    console.error('DISCORD_TOKEN não configurado: a mensagem da sala não é atualizada.');
    return new Response(null, { status: 204 });
  }
  if (!/^\d+$/.test(ch || '') || !/^\d+$/.test(msg || '')) return new Response(null, { status: 204 });

  const messageUrl = `${DISCORD_API}/channels/${ch}/messages/${msg}`;
  const headers = { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' };
  const title = (params.get('title') || 'Sala de Tela').slice(0, MAX_ROOM_NAME);
  const uid = params.get('uid');
  let res;

  if (body.state === 'ended') {
    res = await fetch(messageUrl, { method: 'DELETE', headers });
  } else if (body.state === 'closed') {
    res = await fetch(messageUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ embeds: [roomEmbed(title, uid, '⚫ Transmissão encerrada', 0x2b2d31)], components: [] })
    });
  } else if (body.state === 'live') {
    const viewers = Math.max(0, Math.min(99, Number(body.viewers) || 0));
    const audience = viewers === 0 ? 'ninguém assistindo ainda' : viewers === 1 ? '1 assistindo' : `${viewers} assistindo`;
    const viewUrl = await viewUrlFor(origin, secret, params.get('room'), title, params.get('exp'));
    res = await fetch(messageUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        embeds: [roomEmbed(title, uid, `🔴 **Ao vivo** · ${audience}`, 0xed4245)],
        components: [{ type: 1, components: [linkButton('Assistir', viewUrl, '👀')] }]
      })
    });
  } else {
    return new Response('Estado inválido', { status: 400 });
  }

  if (res.ok) console.log(`Mensagem ${msg}: ${body.state} aplicado (${res.status}).`);
  else console.error(`Falha ao aplicar ${body.state} na mensagem ${msg}:`, res.status, await res.text());
  return new Response(null, { status: 204, headers: { 'X-Discord-Status': String(res.status) } });
}

function renderModernApp(room, mode, title, preview, localPreviewEnabled = false, inviteHref = '', hostStatus = false) {
  const safeRoom = (room || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
  const safeMode = mode === 'host' ? 'host' : 'view';
  const safeTitle = (title || 'Sala de Tela').replace(/[<>"]/g, '');
  // Prévia visual determinística: permite revisar os estados sem capturar ou receber mídia.
  const isPreview = localPreviewEnabled && safeMode === 'view' && ['waiting', 'connected'].includes(preview);
  const hasNicknameEntry = safeMode === 'view' && !isPreview;
  const isNicknamePreview = localPreviewEnabled && safeMode === 'view' && preview === 'nickname';
  const showPreviewNav = safeMode === 'view' && (localPreviewEnabled || isPreview);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${safeTitle} • Colegas de Call</title>
  <link rel="preload" href="/fonts/instrument-sans-latin-v4.woff2" as="font" type="font/woff2" crossorigin>
  ${safeMode === 'host' ? '<link rel="license" href="/diorama/credits.txt" title="Diorama: autoria e licenças">' : ''}
  ${safeMode === 'host' ? '<script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>' : ''}
  <style>${appStyles}</style>
</head>
<body class="${safeMode === 'view' ? 'viewer' : 'host'} ${isPreview ? 'viewer-preview' : ''} ${hasNicknameEntry ? 'nickname-entry-active' : ''}">
  ${safeMode === 'host' ? '<div class="host-workspace">' : ''}
  <main id="app-main" ${hasNicknameEntry ? 'hidden' : ''}>
    <!-- Card Inicial -->
    <div id="state-card" class="state-card">
      <div class="state-icon" id="card-icon" aria-hidden="true">${safeMode === 'host' ? '<div id="host-diorama" class="host-diorama" data-state="loading"><img data-src="/diorama/poster.jpg" width="224" height="224" alt="" decoding="async"></div>' : CONNECTION_SYMBOL}</div>
      <h1 id="card-title">Carregando...</h1>
      <p id="card-desc">Preparando conexão P2P direta.</p>
      ${safeMode === 'host' ? `<div id="quality-prepare-slot" class="quality-prepare-slot">
        <fieldset id="host-quality" class="host-quality" aria-describedby="quality-detail">
          <legend>Prioridade da imagem</legend>
          <div class="quality-options">
            <label class="quality-option"><input type="radio" name="quality" value="sharp" checked><span><strong>Nítida</strong><small>Texto, código e apresentações</small></span></label>
            <label class="quality-option"><input type="radio" name="quality" value="fluid"><span><strong>Fluida</strong><small>Jogos e vídeos</small></span></label>
            <label class="quality-option"><input type="radio" name="quality" value="light"><span><strong>Leve</strong><small>Menor uso de upload</small></span></label>
          </div>
          <p id="quality-detail" class="quality-detail">Prioriza a definição de textos quando a conexão fica limitada.</p>
          <p id="quality-feedback" class="quality-feedback" role="status" aria-atomic="true"></p>
        </fieldset>
      </div>` : ''}
      <button id="card-btn" class="btn full player-control motion-button" data-button-motion data-click-particles="true" data-fill-state="idle" type="button" style="display:none"><span class="player-control-content">Selecionar tela</span></button>
      ${safeMode === 'host' ? '<p id="host-feedback" class="host-feedback" role="status" hidden></p>' : ''}
      ${safeMode === 'view' && !isPreview ? '<button id="edit-waiting-nickname" class="nickname-edit" type="button" hidden>Alterar apelido</button>' : ''}
    </div>

    ${safeMode === 'host' ? `<div id="host-actions" class="host-capture-panel" hidden>
      <h1 id="host-live-title" tabindex="-1">Sua transmissão.</h1>
      <div class="host-capture-bar">
        <div class="host-capture-status">
          <div class="host-live-status">
            <span id="status-text" role="status"></span>
            <button class="host-live-emblem" type="button" aria-label="Mangekyō Eterno do Sasuke" aria-pressed="false">
            <span class="host-live-eye-art" aria-hidden="true">
            <svg class="host-live-eye" viewBox="0 0 28 20">
              <defs>
                <path id="host-eye-shape" d="M1.5 10C8 1.5 20 1.5 26.5 10C20 18.5 8 18.5 1.5 10Z"/>
                <clipPath id="host-eye-aperture"><use href="#host-eye-shape"/></clipPath>
                <path id="host-eye-tomoe" d="M13.4 4.4C15.2 4.1 16.2 5.5 15.54 6.55C15.14 7.19 14.28 7.31 13.74 6.86C13.2 6.41 13.31 5.65 13.84 5.35C13.75 4.97 13.59 4.7 13.4 4.4Z"/>
              </defs>
              <use href="#host-eye-shape" fill="#321b21"/>
              <g clip-path="url(#host-eye-aperture)">
                <g class="host-live-iris">
                  <circle cx="14" cy="10" r="6.55" fill="currentColor"/>
                  <circle cx="14" cy="10" r="4.45" fill="none" stroke="#401018" stroke-width=".55"/>
                  <g class="host-eye-tomoe" fill="#19090d">
                    <circle cx="14" cy="10" r="1.65"/>
                    <use href="#host-eye-tomoe"/>
                    <use href="#host-eye-tomoe" transform="rotate(120 14 10)"/>
                    <use href="#host-eye-tomoe" transform="rotate(240 14 10)"/>
                  </g>
                  <g class="host-eye-mangekyo">
                    <circle cx="14" cy="10" r="6.55" fill="#19090d"/>
                    <path id="host-eye-mangekyo-triangle" d="M14 4Q16.75 6.6 19.2 13Q14 14.2 8.8 13Q11.25 6.6 14 4Z" fill="#ff525f" stroke="#321019" stroke-width=".35"/>
                    <use href="#host-eye-mangekyo-triangle" transform="rotate(180 14 10)"/>
                    <path id="host-eye-eternal-blade" d="M12.75 10Q12.9 13.25 14 14.9Q15.1 13.25 15.25 10Z" fill="#19090d"/>
                    <use href="#host-eye-eternal-blade" transform="rotate(120 14 10)"/>
                    <use href="#host-eye-eternal-blade" transform="rotate(240 14 10)"/>
                    <circle cx="14" cy="10" r=".92" fill="#ff525f"/>
                  </g>
                </g>
              </g>
              <use href="#host-eye-shape" fill="none" stroke="currentColor" stroke-width="1.15"/>
            </svg>
            </span>
            </button>
          </div>
          <p id="host-audio-status" role="status">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4Z"/>
              <path class="host-audio-wave" d="M15 9a4 4 0 0 1 0 6"/>
              <path class="host-audio-wave host-audio-wave--far" d="M18 6a8 8 0 0 1 0 12"/>
              <path class="host-audio-off" d="m15 9 6 6m0-6-6 6"/>
            </svg>
            <span id="host-audio-label"></span>
          </p>
        </div>
        <div class="host-capture-buttons" role="group" aria-label="Controles do compartilhamento">
          <button id="change-screen-btn" class="btn motion-button" data-button-motion type="button" onclick="startHostStream()">
            <span class="button-motion-content"><svg class="host-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h15m-4-4 4 4-4 4"/><path d="M20 16H5m4-4-4 4 4 4"/></svg>Trocar fonte</span>
          </button>
          <button id="stop-stream-btn" class="btn motion-button host-stop-sharing" data-button-motion type="button" onclick="stopHostStream()">
            <span class="button-motion-content"><svg class="host-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>Parar compartilhamento</span>
          </button>
        </div>
        <p id="host-live-feedback" class="host-live-feedback" role="status"></p>
      </div>
    </div>` : ''}
    <!-- Player de Vídeo -->
    <div id="video-wrapper" data-preview="${isPreview}" data-state="waiting" role="region" aria-label="${safeMode === 'host' ? 'Prévia da tela compartilhada' : 'Player da transmissão'}">
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
          <button id="volume-toggle" class="player-control volume-toggle" type="button" aria-label="Ajustar volume" aria-expanded="false" aria-controls="volume-panel">
            <span class="player-control-content"><svg class="audio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="audio-speaker" d="M10 5 5 9H2v6h3l5 4V5Z"/><path class="audio-wave audio-wave--near" pathLength="1" d="M14 8a6 6 0 0 1 0 8"/><path class="audio-wave audio-wave--far" pathLength="1" d="M18 5a10 10 0 0 1 0 14"/><path class="audio-slash" pathLength="1" d="m15 9 6 6m0-6-6 6"/></svg></span>
          </button>
          <div id="volume-panel" class="volume-panel" role="group" aria-label="Volume da transmissão">
          <button id="mute-btn" class="player-control" aria-label="Silenciar" aria-pressed="false" title="Silenciar">
            <span class="player-control-content"><svg class="audio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="audio-speaker" d="M10 5 5 9H2v6h3l5 4V5Z"/><path class="audio-wave audio-wave--near" pathLength="1" d="M14 8a6 6 0 0 1 0 8"/><path class="audio-wave audio-wave--far" pathLength="1" d="M18 5a10 10 0 0 1 0 14"/><path class="audio-slash" pathLength="1" d="m15 9 6 6m0-6-6 6"/></svg></span>
          </button>
          <div class="volume-control"><input id="vol-slider" aria-label="Volume" type="range" min="0" max="1" step="0.01" value="1" /><span class="volume-rail" aria-hidden="true"><span class="volume-fill"></span></span><span class="volume-handle" aria-hidden="true"></span><output id="volume-value" for="vol-slider" aria-hidden="true">100%</output></div>
          </div>
        </div>
        <div class="player-actions">
          ${safeMode === 'view' && !isPreview ? '<button id="edit-player-nickname" class="player-control" type="button" aria-label="Alterar apelido" title="Alterar apelido"><span class="player-control-content"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 6Z"/></svg></span></button>' : ''}
          <button id="pip-btn" class="player-control" data-fill-state="idle" aria-label="Abrir miniatura" aria-pressed="false" aria-describedby="pip-description"><span class="pip-border" aria-hidden="true"></span><span class="player-control-content"><svg class="pip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 11h6v6h-6z"/></svg><span class="player-control-label">Miniatura</span></span></button>
          <span id="pip-description" class="visually-hidden">Abre o vídeo em uma janela flutuante.</span>
          <button id="fullscreen-btn" class="player-control player-control--primary motion-button" data-fill-state="idle" aria-label="Entrar em tela cheia" aria-pressed="false">
            <span class="player-control-content"><svg class="fullscreen-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g class="fullscreen-corner corner-tl"><path d="M8 3H3v5"/></g><g class="fullscreen-corner corner-tr"><path d="M16 3h5v5"/></g><g class="fullscreen-corner corner-bl"><path d="M3 16v5h5"/></g><g class="fullscreen-corner corner-br"><path d="M21 16v5h-5"/></g></svg>
            <span class="player-label-stack" aria-hidden="true"><span id="fullscreen-label" class="player-label-default">Tela cheia</span><span class="player-label-active">Voltar</span></span></span>
          </button>
        </div>
      </div>
      <p id="player-notice" class="player-notice" role="status" aria-live="polite" hidden></p>
    </div>
    ${safeMode === 'host' ? '<div id="quality-live-slot" class="quality-live-slot"></div>' : ''}
  </main>
  ${safeMode === 'host' ? `<aside class="host-audience" aria-labelledby="audience-title">
    <div class="audience-heading"><h2 id="audience-title">Quem está na sala</h2><span id="viewer-count" class="audience-count" role="status" aria-live="polite" aria-label="0 espectadores na sala">0</span></div>
    <div id="audience-empty" class="audience-empty"><p>Ninguém conectado ainda.</p><span>Envie o link para quem vai assistir.</span></div>
    <ul id="audience-list" class="audience-list" aria-label="Espectadores conectados"></ul>
    <p id="audience-identity" class="audience-caption" hidden>Apelidos escolhidos por quem assiste.</p>
    <div class="host-invite"><button id="copy-view-link" class="host-copy-link motion-button" data-button-motion type="button"><span class="button-motion-content"><svg class="host-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2"/></svg>Copiar link de convite</span></button><p id="copy-feedback" class="audience-caption" role="status" hidden></p><input id="view-link-fallback" class="view-link-fallback" aria-label="Link para assistir" readonly hidden></div>
  </aside></div>` : ''}
  ${showPreviewNav ? `<nav class="preview-nav" aria-label="Prévia dos estados do espectador">
    <span>Prévia da interface${isPreview ? ' · sem transmissão real' : ''}</span>
    <button class="btn secondary motion-link" aria-pressed="${preview === 'waiting'}" onclick="openViewerPreview('waiting')"><span class="motion-label"><span class="motion-track"><span>Conectando</span><span aria-hidden="true">Conectando</span></span></span></button>
    <button class="btn secondary motion-link" aria-pressed="${preview === 'connected'}" onclick="openViewerPreview('connected')"><span class="motion-label"><span class="motion-track"><span>Conectado</span><span aria-hidden="true">Conectado</span></span></span></button>
    ${isPreview ? '<a id="exit-preview" class="motion-link" href="#"><span class="motion-label"><span class="motion-track"><span>Sair da prévia</span><span aria-hidden="true">Sair da prévia</span></span></span></a>' : ''}
  </nav>` : ''}

  ${hasNicknameEntry ? `<main id="nickname-screen" class="nickname-screen">
    <canvas id="nickname-crowd" class="nickname-crowd" aria-hidden="true"></canvas>
    <form id="nickname-form" class="nickname-form" aria-labelledby="nickname-title" aria-describedby="nickname-description">
      <h1 id="nickname-title">Como quer aparecer?</h1>
      <p id="nickname-description">Escolha um apelido para quem transmite reconhecer você. É opcional.</p>
      <label for="viewer-nickname">Seu apelido <span>(opcional)</span></label>
      <input id="viewer-nickname" name="nickname" type="text" maxlength="24" autocomplete="nickname" spellcheck="false" aria-describedby="nickname-hint" autofocus>
      <p id="nickname-hint" class="nickname-hint">Até 24 caracteres. Deixe em branco para continuar sem apelido.</p>
      <div class="nickname-actions">
        <button id="nickname-submit" class="btn player-control motion-button" data-button-motion type="submit"><span class="player-control-content">Assistir transmissão</span></button>
        <button id="nickname-cancel" class="nickname-edit" type="button">Continuar sem apelido</button>
      </div>
    </form>
  </main>
  <dialog id="nickname-dialog" class="nickname-dialog" aria-labelledby="nickname-title" aria-describedby="nickname-description"></dialog>` : ''}

  <script>
    const ROOM_ID = "canja_v2_" + ${JSON.stringify(safeRoom)};
    const MODE = ${JSON.stringify(safeMode)};
    const INVITE_HREF = ${JSON.stringify(inviteHref)};
    const HOST_STATUS = ${JSON.stringify(hostStatus)};
    const PREVIEW = ${JSON.stringify(isPreview ? preview : null)};
    const NICKNAME_PREVIEW = ${JSON.stringify(isNicknamePreview)};

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
    const unmuteToast = document.getElementById('unmute-toast');
    const hostActions = document.getElementById('host-actions');
    const audienceList = document.getElementById('audience-list');
    const audienceEmpty = document.getElementById('audience-empty');
    const audienceIdentity = document.getElementById('audience-identity');
    const hostFeedback = document.getElementById('host-feedback');
    const hostLiveFeedback = document.getElementById('host-live-feedback');
    const hostAudioStatus = document.getElementById('host-audio-status');
    const hostAudioLabel = document.getElementById('host-audio-label');

    let peer = null;
    let localStream = null;
    let activeCalls = new Map();
    const hostConnections = new Map();
    const viewerNumbers = new Map();
    const viewerNicknames = new Map();
    let viewerNickname = '';
    let viewerJoined = false;
    let viewerScriptLoading = false;
    let viewerSequence = 0;
    let captureGeneration = 0;
    let retryTimer = null;
    let viewerConnected = false;
    let viewerMediaCall = null;
    let viewerDataConnection = null;
    let viewerAttemptStartedAt = 0;
    // Entre redes diferentes a negociação pode levar vários segundos: uma tentativa
    // nova só substitui a anterior depois deste prazo, senão uma derruba a outra.
    const VIEWER_ATTEMPT_TIMEOUT_MS = 15000;
    // Só vira true quando o transmissor está na sala e a conexão direta falha:
    // é o sinal de que a rede (de um dos lados) está bloqueando.
    let networkBlocked = false;

    function showNetworkHint() {
      if (networkBlocked || viewerConnected) return;
      networkBlocked = true;
      setWaitingMessage(
        'Não foi possível conectar',
        'A transmissão está no ar, mas sua rede ou a de quem transmite pode estar bloqueando a conexão direta. Tente outra rede, como o 4G/5G do celular. Seguimos tentando automaticamente.'
      );
      setLiveStatus(false, 'Rede bloqueando');
    }

    function watchForBlockedNetwork(peerConnection) {
      peerConnection?.addEventListener?.('connectionstatechange', () => {
        if (peerConnection.connectionState === 'failed') showNetworkHint();
      });
    }

    function showPlayer(state = 'connected') {
      const enteringHost = MODE === 'host' && stateCard.style.display !== 'none';
      videoWrapper.dataset.state = state;
      videoWrapper.classList.add('active');
      document.body.classList.add('player-active');
      stateCard.style.display = 'none';
      if (MODE === 'host') document.getElementById('quality-live-slot').append(document.getElementById('host-quality'));
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
      if (MODE === 'host') {
        document.getElementById('quality-prepare-slot').append(document.getElementById('host-quality'));
        document.getElementById('quality-feedback').textContent = '';
      }
      videoWrapper.dispatchEvent(new Event('playerstatechange'));
    }

    function setLiveStatus(isLive, text) {
      if (!statusText) return;
      statusText.textContent = text;
      statusText.classList.toggle('live', isLive);
      statusText.dispatchEvent(new Event('hostlivestatuschange'));
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
      if (localStream) {
        applyBitrateToAll();
        scheduleLiveStatus();
      }
      if (!viewerCountEl) return;
      const count = activeCalls.size;
      viewerCountEl.textContent = String(count);
      viewerCountEl.setAttribute('aria-label', count + (count === 1 ? ' espectador na sala' : ' espectadores na sala'));
      audienceEmpty.hidden = count > 0;
      audienceIdentity.hidden = !Array.from(activeCalls.keys()).some(id => viewerNicknames.get(id));
      audienceList.replaceChildren(...Array.from(activeCalls, ([id, call]) => {
        if (!viewerNumbers.has(id)) viewerNumbers.set(id, ++viewerSequence);
        const row = document.createElement('li');
        const number = String(viewerNumbers.get(id)).padStart(2, '0');
        const marker = document.createElement('span');
        marker.className = 'audience-marker';
        marker.textContent = number;
        marker.setAttribute('aria-hidden', 'true');
        const nickname = viewerNicknames.get(id);
        marker.hidden = Boolean(nickname);
        row.dataset.named = String(Boolean(nickname));
        const name = document.createElement('span');
        name.className = 'audience-name';
        name.textContent = nickname || 'Espectador ' + number;
        name.dir = 'auto';
        const state = document.createElement('span');
        state.className = 'audience-state';
        const connectionState = call.peerConnection?.connectionState;
        state.textContent = connectionState === 'connected' ? 'Conectado' :
          connectionState === 'disconnected' ? 'Reconectando' : 'Conectando';
        row.append(marker, name, state);
        return row;
      }));
    }

    // Bound untrusted text at both ends; render it only through textContent.
    function normalizeNickname(value) {
      if (typeof value !== 'string') return '';
      const cleaned = value.slice(0, 256).normalize('NFC')
        .replace(/\\s+/gu, ' ')
        .replace(/[\\u0000-\\u001f\\u007f-\\u009f\\u061c\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]/g, '')
        .trim();
      return Array.from(cleaned).slice(0, 24).join('');
    }

    function sendViewerProfile() {
      if (!viewerDataConnection?.open) return;
      try { viewerDataConnection.send({ type: 'VIEWER_PROFILE', nickname: viewerNickname }); }
      catch { /* Reconnection sends the current profile again on open. */ }
    }

    function setupViewerNickname() {
      const dialog = document.getElementById('nickname-dialog');
      const screen = document.getElementById('nickname-screen');
      const form = document.getElementById('nickname-form');
      const appMain = document.getElementById('app-main');
      const input = document.getElementById('viewer-nickname');
      const submit = document.getElementById('nickname-submit');
      const cancel = document.getElementById('nickname-cancel');
      const waitingEdit = document.getElementById('edit-waiting-nickname');
      const storageKey = 'viewer-nickname:' + ROOM_ID;
      let remembered = null;
      try { remembered = window.sessionStorage.getItem(storageKey); } catch {}

      function saveNickname(value) {
        viewerNickname = normalizeNickname(value);
        input.value = viewerNickname;
        try { window.sessionStorage.setItem(storageKey, viewerNickname); } catch {}
        const joining = !viewerJoined;
        viewerJoined = true;
        dialog.close();
        waitingEdit.hidden = false;
        if (joining) {
          screen.hidden = true;
          appMain.hidden = false;
          document.body.classList.remove('nickname-entry-active');
          setWaitingMessage('Conectando à transmissão', 'A imagem aparece aqui assim que a transmissão começar.');
          document.dispatchEvent(new Event('viewerjoined'));
          initViewer();
          waitingEdit.focus?.({ preventScroll: true });
        } else sendViewerProfile();
      }

      function editNickname() {
        input.value = viewerNickname;
        submit.querySelectorAll('.player-control-content').forEach(label => {
          label.textContent = viewerJoined ? 'Salvar apelido' : 'Assistir transmissão';
        });
        cancel.textContent = viewerJoined ? 'Cancelar' : 'Continuar sem apelido';
        if (!viewerJoined) {
          screen.hidden = false;
          appMain.hidden = true;
          document.body.classList.add('nickname-entry-active');
          document.body.classList.remove('is-connecting');
          return;
        }
        // Keep the editor inside the fullscreen root when invoked from the player.
        dialog.append(form);
        (videoWrapper.classList.contains('active') ? videoWrapper : document.body).append(dialog);
        dialog.showModal();
      }

      form.addEventListener('submit', event => {
        event.preventDefault(); saveNickname(input.value);
      });
      cancel.addEventListener('click', () => viewerJoined ? dialog.close() : saveNickname(''));
      dialog.addEventListener('cancel', event => {
        if (!viewerJoined) { event.preventDefault(); saveNickname(''); }
      });
      form.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        if (!viewerJoined) { event.preventDefault(); saveNickname(''); }
      });
      waitingEdit.addEventListener('click', editNickname);
      document.getElementById('edit-player-nickname').addEventListener('click', editNickname);

      if (remembered !== null && !NICKNAME_PREVIEW) saveNickname(remembered);
      else editNickname();
    }

    function showHostFeedback(message) {
      const feedback = localStream ? hostLiveFeedback : hostFeedback;
      feedback.textContent = message;
      if (feedback === hostFeedback) feedback.hidden = !message;
    }

    // Aumenta o bitrate do WebRTC para 1080p 60fps nítido
    // Escolhida por quem transmite; vale para a captura e para cada espectador.
    const QUALITY_PROFILES = {
      sharp: { hint: 'detail', degradation: 'maintain-resolution', width: 1920, height: 1080, fps: 60, cap: 8500000 },
      fluid: { hint: 'motion', degradation: 'maintain-framerate', width: 1920, height: 1080, fps: 60, cap: 8500000 },
      light: { hint: 'motion', degradation: 'balanced', width: 1280, height: 720, fps: 30, cap: 2500000 }
    };
    let qualityKey = 'sharp';
    try {
      const saved = localStorage.getItem('tela-quality');
      if (QUALITY_PROFILES[saved]) qualityKey = saved;
    } catch (e) {}
    function qualityProfile() { return QUALITY_PROFILES[qualityKey]; }

    // O upload de quem transmite é dividido entre os espectadores: com mais gente,
    // cada um recebe menos, em vez de travar para todos.
    function bitrateForViewers(count) {
      if (count <= 1) return 8500000;
      if (count === 2) return 6000000;
      if (count === 3) return 4500000;
      return 3500000;
    }

    async function boostSenderBitrate(peerConnection) {
      if (!peerConnection || !peerConnection.getSenders) return false;
      const profile = qualityProfile();
      const maxBitrate = Math.min(bitrateForViewers(activeCalls.size), profile.cap);
      const results = await Promise.all(peerConnection.getSenders().map(async (sender) => {
        if (!sender.track) return true;
        try {
          const params = sender.getParameters();
          if (!params.encodings || !params.encodings.length) params.encodings = [{}];
          if (sender.track.kind === 'video') {
            params.encodings[0].maxBitrate = maxBitrate;
            params.encodings[0].maxFramerate = profile.fps;
            params.degradationPreference = profile.degradation;
          } else if (sender.track.kind === 'audio') {
            params.encodings[0].maxBitrate = 192000;
          }
          params.encodings[0].priority = 'high';
          params.encodings[0].networkPriority = 'high';
          await sender.setParameters(params);
          return true;
        } catch (e) { return sender.track?.kind !== 'video'; }
      }));
      return results.every(Boolean);
    }

    function startViewerCall(peerId) {
      if (!peer || peer.destroyed || !localStream) return;
      const existing = activeCalls.get(peerId);
      if (existing) {
        const state = existing.peerConnection?.connectionState;
        if (!['disconnected', 'failed', 'closed'].includes(state)) return;
        activeCalls.delete(peerId);
        existing.close();
      }
      const call = peer.call(peerId, localStream, { sdpTransform: raiseStartBitrate });
      if (!call) return;
      activeCalls.set(peerId, call);
      updateViewerCount();
      setTimeout(() => boostSenderBitrate(call.peerConnection), 1000);
      const updateState = () => {
        if (activeCalls.get(peerId) !== call) return;
        if (['failed', 'closed'].includes(call.peerConnection?.connectionState)) call.close();
        else updateViewerCount();
      };
      call.peerConnection?.addEventListener('connectionstatechange', updateState);
      const removeCall = () => {
        call.peerConnection?.removeEventListener('connectionstatechange', updateState);
        if (activeCalls.get(peerId) !== call) return;
        activeCalls.delete(peerId);
        updateViewerCount();
      };
      call.on('close', removeCall);
      call.on('error', () => { removeCall(); call.close(); });
    }

    async function updateViewerStream(peerId, call, stream) {
      const senders = call.peerConnection?.getSenders?.();
      if (!senders) return;
      const tracks = stream.getTracks();
      let needsRecall = tracks.some(track => !senders.some(sender => sender.track?.kind === track.kind));
      try {
        if (!needsRecall) {
          await Promise.all(senders.map(sender => {
            if (!sender.track) return;
            const replacement = tracks.find(track => track.kind === sender.track.kind) || null;
            return sender.replaceTrack(replacement);
          }));
        }
      } catch {
        needsRecall = true;
      }
      if (needsRecall) {
        // A newer capture or connection may have replaced this one while awaiting.
        if (localStream !== stream || activeCalls.get(peerId) !== call) return;
        activeCalls.delete(peerId);
        call.close();
        startViewerCall(peerId);
        return;
      }
      if (localStream === stream && activeCalls.get(peerId) === call) boostSenderBitrate(call.peerConnection);
    }

    let appliedViewerCount = -1;
    function applyBitrateToAll() {
      if (appliedViewerCount === activeCalls.size) return;
      appliedViewerCount = activeCalls.size;
      activeCalls.forEach((call) => boostSenderBitrate(call.peerConnection));
    }

    // Começa a transmissão já com bitrate alto, sem passar os primeiros segundos em 540p.
    function raiseStartBitrate(sdp) {
      const video = sdp.match(/^m=video [^\\r\\n]*/m);
      if (!video) return sdp;
      const types = video[0].split(' ').slice(3);
      const codecs = types.filter((pt) => {
        const map = sdp.match(new RegExp('^a=rtpmap:' + pt + ' ([^/\\r\\n]+)', 'm'));
        return map && !/^(rtx|red|ulpfec|flexfec)/i.test(map[1]);
      });
      const extra = 'x-google-start-bitrate=4000;x-google-min-bitrate=800';
      codecs.forEach((pt) => {
        const fmtp = new RegExp('^(a=fmtp:' + pt + ' [^\\r\\n]*)', 'm');
        if (fmtp.test(sdp)) sdp = sdp.replace(fmtp, (line) => line.includes('x-google-start-bitrate') ? line : line + ';' + extra);
        else sdp = sdp.replace(new RegExp('^(a=rtpmap:' + pt + ' [^\\r\\n]*)', 'm'), '$1\\r\\na=fmtp:' + pt + ' ' + extra);
      });
      return sdp;
    }

    const qualityControl = document.getElementById('host-quality');
    const qualityDetail = document.getElementById('quality-detail');
    const qualityFeedback = document.getElementById('quality-feedback');
    const qualityDescriptions = {
      sharp: 'Prioriza a definição de textos quando a conexão fica limitada.',
      fluid: 'Prioriza o movimento quando a conexão fica limitada.',
      light: 'Busca 720p, com limite de 30 fps e menor uso de upload.'
    };
    // One native radio group moves between the preparation and live slots.
    // Keep the requested preference separate from successful browser updates.
    let qualityPending = false;
    function syncQualityControl() {
      if (!qualityControl) return;
      qualityControl.disabled = qualityPending || document.body.dataset.capturePending === 'true';
      qualityControl.setAttribute('aria-busy', String(qualityPending));
      qualityDetail.textContent = qualityDescriptions[qualityKey];
      (document.querySelectorAll?.('input[name="quality"]') || []).forEach(input => {
        input.checked = input.value === qualityKey;
      });
    }
    async function setQuality(key) {
      if (!QUALITY_PROFILES[key] || key === qualityKey || qualityControl?.disabled) return;
      qualityKey = key;
      try { localStorage.setItem('tela-quality', key); } catch (e) {}
      const track = localStream?.getVideoTracks()[0];
      qualityFeedback.textContent = '';
      syncQualityControl();
      if (!track) return;
      const stream = localStream;
      const profile = qualityProfile();
      const focusedRadio = document.activeElement;
      qualityPending = true;
      syncQualityControl();
      qualityFeedback.textContent = 'Aplicando preferência…';
      let accepted = true;
      try {
        if ('contentHint' in track) track.contentHint = profile.hint;
        await track.applyConstraints({
          width: { ideal: profile.width },
          height: { ideal: profile.height },
          frameRate: { ideal: profile.fps, max: profile.fps }
        });
      } catch (e) { accepted = false; }
      try {
        if (localStream !== stream) return;
        const results = await Promise.all(Array.from(activeCalls.values(), call => boostSenderBitrate(call.peerConnection)));
        accepted = accepted && results.every(Boolean);
        if (localStream !== stream) return;
        qualityFeedback.textContent = accepted
          ? 'Preferência enviada ao navegador. A qualidade depende da conexão.'
          : 'Preferência salva. O navegador não aceitou todos os ajustes nesta transmissão.';
      } catch (e) {
        if (localStream === stream) qualityFeedback.textContent = 'Preferência salva. Não foi possível atualizar todos os ajustes nesta transmissão.';
      } finally {
        qualityPending = false;
        syncQualityControl();
        // Disabling a native radio temporarily drops its focus. Restore only
        // when the user has not moved to another control or stopped sharing.
        if (localStream === stream && focusedRadio?.name === 'quality' && document.activeElement === document.body) {
          focusedRadio.focus({ preventScroll: true });
        }
      }
    }

    (document.querySelectorAll?.('input[name="quality"]') || []).forEach((input) => {
      input.checked = input.value === qualityKey;
      input.addEventListener('change', () => { if (input.checked) setQuality(input.value); });
    });
    syncQualityControl();

    // ================= MENSAGEM NO DISCORD =================
    // A página avisa o Worker só quando algo muda, no máximo a cada 5 s.
    let statusTimer = null;
    let lastStatusKey = '';
    let lastStatusAt = 0;

    function sendHostStatus(state, beacon = false) {
      if (!HOST_STATUS) return;
      const body = JSON.stringify({ query: window.location.search, state, viewers: activeCalls.size });
      try {
        if (beacon && navigator.sendBeacon) {
          navigator.sendBeacon('/api/status', new Blob([body], { type: 'application/json' }));
          return;
        }
        fetch('/api/status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
      } catch (e) {}
    }

    function scheduleLiveStatus() {
      if (!HOST_STATUS || statusTimer) return;
      statusTimer = setTimeout(() => {
        statusTimer = null;
        if (!localStream) return;
        const key = 'live:' + activeCalls.size;
        if (key === lastStatusKey) return;
        lastStatusKey = key;
        lastStatusAt = Date.now();
        sendHostStatus('live');
      }, Math.max(0, 5000 - (Date.now() - lastStatusAt)));
    }

    if (HOST_STATUS) {
      window.addEventListener('pagehide', () => {
        if (localStream) sendHostStatus('closed', true);
      });
    }

    // ================= MODO TRANSMISSOR (HOST) =================
    if (MODE === 'host') {
      cardTitle.replaceChildren(document.createTextNode('Compartilhe'), document.createElement('br'), document.createTextNode('sua tela.'));
      cardDesc.textContent = 'Escolha uma tela, janela ou aba. Para transmitir som, ative o áudio na seleção.';
      cardBtn.style.display = 'inline-flex';
      cardBtn.onclick = startHostStream;
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
      syncQualityControl();
      document.body.dispatchEvent(new Event('hostcapturechange'));
      const captureId = ++captureGeneration;
      showHostFeedback('');
      try {
        const profile = qualityProfile();
        const newStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: profile.width, max: profile.width === 1920 ? 2560 : profile.width },
            height: { ideal: profile.height, max: profile.height === 1080 ? 1440 : profile.height },
            frameRate: { ideal: profile.fps, max: profile.fps },
            displaySurface: 'window'
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            suppressLocalAudioPlayback: false
          },
          selfBrowserSurface: 'exclude',
          surfaceSwitching: 'include',
          systemAudio: 'include',
          windowAudio: 'window'
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
          videoTrack.contentHint = profile.hint;
        }

        videoEl.srcObject = localStream;
        videoWrapper.dispatchEvent(new Event('playerstreamchange'));
        hostActions.hidden = false;
        showPlayer();
        const hasSharedAudio = localStream.getAudioTracks().length > 0;
        hostAudioStatus.dataset.audio = hasSharedAudio ? 'on' : 'off';
        hostAudioLabel.textContent = hasSharedAudio ? 'Áudio compartilhado' : 'Sem áudio compartilhado';
        setLiveStatus(Boolean(peer?.open), peer?.open ? 'Ao vivo' : 'Preparando a sala');
        scheduleLiveStatus();

        videoTrack.onended = () => stopHostStream();

        if (!peer || peer.destroyed) {
          peer = new Peer(ROOM_ID, {
            config: {
              iceServers: [
                { urls: 'stun:stun.cloudflare.com:3478' },
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
            showHostFeedback('A sala não pôde conectar. Pare o compartilhamento e tente novamente.');
          });
          hostPeer.on('disconnected', () => {
            if (peer !== hostPeer || hostPeer.destroyed) return;
            setLiveStatus(false, 'Sala desconectada');
            hostPeer.reconnect?.();
          });

          peer.on('connection', (conn) => {
            const previous = hostConnections.get(conn.peer);
            hostConnections.set(conn.peer, conn);
            if (previous && previous !== conn) previous.close();
            conn.on('data', (msg) => {
              if (hostConnections.get(conn.peer) !== conn) return;
              if (msg && msg.type === 'VIEWER_PROFILE' && typeof msg.nickname === 'string') {
                viewerNicknames.set(conn.peer, normalizeNickname(msg.nickname));
                updateViewerCount();
                return;
              }
              if (msg === 'REQUEST_STREAM' && localStream) {
                startViewerCall(conn.peer);
              }
            });
            conn.on('close', () => {
              if (hostConnections.get(conn.peer) !== conn) return;
              hostConnections.delete(conn.peer);
              viewerNicknames.delete(conn.peer);
              activeCalls.get(conn.peer)?.close();
            });
          });
        }
        // Snapshot the map because adding audio may replace a call during this pass.
        await Promise.all(Array.from(activeCalls, ([peerId, call]) => updateViewerStream(peerId, call, newStream)));
      } catch (err) {
        if (captureId !== captureGeneration) return;
        showHostFeedback(err.name === 'NotAllowedError' ? 'Seleção cancelada. Você pode tentar novamente.' :
          'Não foi possível compartilhar a tela. Verifique a permissão e o suporte do navegador.');
      } finally {
        delete document.body.dataset.capturePending;
        syncQualityControl();
        document.body.dispatchEvent(new Event('hostcapturechange'));
        cardBtn.disabled = false;
        changeScreenBtn.disabled = false;
      }
    }

    function stopHostStream() {
      captureGeneration++;
      // Encerrar apaga a mensagem do /tela para não poluir o chat.
      if (localStream && HOST_STATUS) {
        clearTimeout(statusTimer);
        statusTimer = null;
        lastStatusKey = 'ended';
        sendHostStatus('ended');
      }
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
      }
      activeCalls.forEach(c => c.close());
      activeCalls.clear();
      hostConnections.clear();
      viewerNumbers.clear();
      viewerNicknames.clear();
      viewerSequence = 0;
      updateViewerCount();
      if (peer) {
        peer.destroy();
        peer = null;
      }
      setLiveStatus(false, '');
      hidePlayer();
      hostActions.hidden = true;
      delete hostAudioStatus.dataset.audio;
      hostAudioLabel.textContent = '';
      hostLiveFeedback.textContent = '';
      videoEl.srcObject = null;
      showHostFeedback('Compartilhamento encerrado. Você pode selecionar uma tela novamente.');
      cardBtn.focus?.({ preventScroll: true });
      window.scrollTo?.({ top: 0, behavior: 'instant' });
    }

    // ================= MODO ESPECTADOR (VIEW) =================
    if (MODE === 'view') {
      if (PREVIEW) {
        setWaitingMessage('Conectando à transmissão', 'A imagem aparece aqui assim que a transmissão começar.');
        // Testa somente a composição dos estados; não cria Peer, chamadas ou tentativas de conexão.
        const connected = PREVIEW === 'connected';
        document.body.classList.toggle('is-connecting', !connected);
        if (connected) showPlayer();
        else hidePlayer();
      } else {
        setupViewerNickname();
      }
    }

    function initViewer() {
      // Entry owns the page until confirmed. Download and evaluate PeerJS only
      // after joining, alongside the player controls that will actually use it.
      if (typeof Peer !== 'function') {
        if (viewerScriptLoading) return;
        viewerScriptLoading = true;
        cardBtn.disabled = true;
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
        function loadingFailed() {
          script.remove();
          viewerScriptLoading = false;
          cardBtn.disabled = false;
          setWaitingMessage('Não foi possível iniciar', 'Não conseguimos carregar a conexão. Confira sua internet e tente novamente.');
          document.body.classList.remove('is-connecting');
          cardBtn.querySelector('.player-control-content').textContent = 'Tentar novamente';
          cardBtn.style.display = 'inline-flex';
          cardBtn.onclick = initViewer;
        }
        script.addEventListener('load', () => {
          if (typeof Peer !== 'function') { loadingFailed(); return; }
          viewerScriptLoading = false;
          cardBtn.disabled = false;
          cardBtn.style.display = 'none';
          initViewer();
        }, { once: true });
        script.addEventListener('error', loadingFailed, { once: true });
        document.head.append(script);
        return;
      }
      peer = new Peer({
        config: {
          iceServers: [
            { urls: 'stun:stun.cloudflare.com:3478' },
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      const viewerPeer = peer;
      peer.on('open', () => {
        connectToHost();
      });

      viewerPeer.on('disconnected', () => {
        if (peer === viewerPeer && !viewerPeer.destroyed) viewerPeer.reconnect?.();
      });

      peer.on('call', (call) => {
        const previous = viewerMediaCall;
        viewerMediaCall = call;
        if (previous && previous !== call) previous.close();
        call.answer(undefined, { sdpTransform: raiseStartBitrate });
        watchForBlockedNetwork(call.peerConnection);
        call.on('stream', (remoteStream) => {
          if (viewerMediaCall !== call) return;
          if (retryTimer) {
            clearInterval(retryTimer);
            retryTimer = null;
          }
          videoEl.srcObject = remoteStream;
          videoWrapper.dispatchEvent(new Event('playerstreamchange'));
          viewerConnected = true;
          networkBlocked = false;
          document.body.classList.remove('is-connecting');
          showPlayer();

          videoEl.play().catch(() => {
            videoEl.muted = true;
            videoEl.play().catch(() => {});
            unmuteToast.hidden = false;
          });
        });

        const updateState = () => {
          if (viewerMediaCall !== call) return;
          if (['failed', 'closed'].includes(call.peerConnection?.connectionState)) handleHostDisconnect();
        };
        call.peerConnection?.addEventListener('connectionstatechange', updateState);
        call.on('close', () => {
          call.peerConnection?.removeEventListener('connectionstatechange', updateState);
          if (viewerMediaCall === call) handleHostDisconnect();
        });
        call.on('error', () => {
          if (viewerMediaCall === call) handleHostDisconnect();
        });
      });

      peer.on('error', (err) => {
        // Host ainda não entrou: a tentativa falhou de vez, então a próxima pode sair já.
        if (err?.type === 'peer-unavailable') {
          viewerDataConnection = null;
          if (networkBlocked) {
            networkBlocked = false;
            handleHostDisconnect();
          }
        }
        // Tenta reconectar a cada 2.5s automaticamente
        if (!retryTimer) {
          retryTimer = setInterval(connectToHost, 2500);
        }
      });
    }

    function connectToHost() {
      if (!peer || peer.destroyed || viewerConnected) return;
      if (peer.disconnected) {
        peer.reconnect?.();
        return;
      }
      const pending = viewerDataConnection;
      if (pending && Date.now() - viewerAttemptStartedAt < VIEWER_ATTEMPT_TIMEOUT_MS) return;
      if (pending) {
        if (!pending.open) showNetworkHint();
        viewerDataConnection = null;
        pending.close();
      }
      viewerAttemptStartedAt = Date.now();
      const conn = peer.connect(ROOM_ID, { reliable: true });
      const previous = viewerDataConnection;
      viewerDataConnection = conn;
      if (previous && previous !== conn) previous.close();
      watchForBlockedNetwork(conn.peerConnection);
      conn.on('open', () => {
        if (viewerDataConnection !== conn) return;
        sendViewerProfile();
        conn.send('REQUEST_STREAM');
      });
      conn.on('close', () => {
        if (viewerDataConnection !== conn) return;
        viewerDataConnection = null;
        handleHostDisconnect();
      });
      conn.on('error', () => {
        if (viewerDataConnection !== conn) return;
        viewerDataConnection = null;
        conn.close();
      });
    }

    function handleHostDisconnect() {
      viewerConnected = false;
      if (videoWrapper.classList.contains('active')) {
        // Preserve the fullscreen root, the video element and the exit control.
        // Presentation remains open while retries depend on actual connection state.
        showPlayer('waiting');
      } else if (!networkBlocked) {
        setWaitingMessage('Aguardando transmissão', 'A transmissão foi pausada ou ainda não começou. Reconectando automaticamente...');
      }
      if (!networkBlocked) setLiveStatus(false, 'Aguardando');
      if (!retryTimer) {
        retryTimer = setInterval(connectToHost, 2500);
      }
    }

  </script>
  <script type="module">
    ${hasNicknameEntry ? `// The decorative entry scene is independent of deferred player/PeerJS setup.
    if (document.body.classList.contains('nickname-entry-active')) {
      Promise.all([import('/nickname-crowd.mjs'), import('/button-motion.mjs')]).then(([{ attachNicknameCrowd }, { attachButtonMotion }]) => {
        const screen = document.getElementById('nickname-screen');
        if (!screen.hidden && document.body.classList.contains('nickname-entry-active')) {
          attachNicknameCrowd(document.getElementById('nickname-crowd'), screen, document.getElementById('nickname-form'));
          screen.querySelectorAll('[data-button-motion]').forEach(button => attachButtonMotion(button));
        }
      }).catch(() => {});
      await new Promise(resolve => document.addEventListener('viewerjoined', resolve, { once: true }));
    }` : ''}
    const [{ attachPlayerControls }, { attachButtonMotion }] = await Promise.all([
      import('/player-controls.mjs'), import('/button-motion.mjs')
    ]);
    attachPlayerControls(document.getElementById('video-wrapper'), document.getElementById('screen-video'));
    document.querySelectorAll('.nickname-form [data-button-motion]').forEach(button => attachButtonMotion(button));
  </script>
  ${safeMode === 'host' ? `<script type="module">
    import { attachHostDiorama } from '/host-diorama.mjs';
    import { attachHostLiveEye } from '/host-live-eye.mjs';
    import { attachAudienceEyes } from '/audience-eyes.mjs';
    import { attachQualityFlow } from '/quality-flow.mjs';
    import { attachButtonMotion } from '/button-motion.mjs';
    document.querySelectorAll('[data-button-motion]').forEach(button => {
      attachButtonMotion(button, document, { particles: button.dataset.clickParticles === 'true' });
    });
    attachHostDiorama(document.getElementById('host-diorama'), document.getElementById('video-wrapper'));
    attachHostLiveEye(document.querySelector('.host-live-emblem'), document.getElementById('status-text'));
    attachAudienceEyes(document.getElementById('audience-list'));
    attachQualityFlow(document.querySelector('.quality-options'));
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

      const isHost = p.get('mode') === 'host';
      let inviteHref = '';
      if (isHost && secret && p.get('exp')) {
        inviteHref = await viewUrlFor(url.origin, secret, room, p.get('title'), p.get('exp'));
      }
      const hostStatus = isHost && !isLocal && Boolean(p.get('msg'));

      const html = renderModernApp(room, p.get('mode'), p.get('title'), p.get('preview'), isLocal, inviteHref, hostStatus);
      return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD, POST' } });
    }

    if (url.pathname === '/api/status') return handleHostStatus(request, env, url.origin);

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
      return handleTelaCommand(interaction, url.origin, secret, env, ctx);
    }
    return new Response('Comando não reconhecido', { status: 400 });
  }
};
