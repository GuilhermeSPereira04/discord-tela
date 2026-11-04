// Local QA only. Proxy the actual app and add two controls that call its real
// disconnect/reconnect presentation paths while the fullscreen root stays open.
// This file is outside public/ and is not included in a Worker deployment.
import { createServer } from 'node:http';

const qaControls = `<button class="player-control" id="qa-media" onclick="startQaMedia()">Mídia de teste</button><button class="player-control" id="qa-disconnect" onclick="handleHostDisconnect()">Simular queda</button><button class="player-control" id="qa-delayed-disconnect" onclick="setTimeout(handleHostDisconnect, 1500)">Queda em 1,5 s</button><button class="player-control" id="qa-reconnect" onclick="startQaMedia()">Restabelecer</button><button class="player-control" id="qa-native-exit" onclick="document.exitFullscreen?.()">Saída nativa</button>`;

// A synthetic canvas stream exercises actual video-frame/PiP APIs without screen
// capture or external media. It emits explicit frames; no persistent JS ticker.
const qaMedia = `<script>
  videoWrapper.dataset.preview = 'false';
  videoWrapper.dataset.state = 'waiting';
  videoEl.hidden = false;
  videoEl.removeAttribute('aria-hidden');
  document.getElementById('preview-screen').hidden = true;
  let qaStream;
  let qaGeneration = 0;
  async function startQaMedia() {
    qaStream?.getTracks().forEach(track => track.stop());
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#161616';
    ctx.fillRect(0, 0, 960, 540);
    ctx.fillStyle = '#f5f5f2';
    ctx.font = '36px sans-serif';
    ctx.fillText('Mídia sintética local', 64, 240);
    ctx.fillStyle = '#ababab';
    ctx.font = '20px sans-serif';
    ctx.fillText('Fonte ' + (++qaGeneration) + ' • sem captura de tela e sem áudio', 64, 286);
    qaStream = canvas.captureStream(0);
    videoEl.muted = true;
    videoEl.srcObject = qaStream;
    videoWrapper.dispatchEvent(new Event('playerstreamchange'));
    showPlayer('connected');
    requestAnimationFrame(() => qaStream.getVideoTracks()[0].requestFrame());
    await videoEl.play();
    qaStream.getVideoTracks()[0].requestFrame();
  }
</script>`;

const server = createServer(async (request, response) => {
  if (request.method !== 'GET') {
    response.writeHead(405).end();
    return;
  }
  try {
    const upstream = await fetch(new URL(request.url, 'http://127.0.0.1:8787'));
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    response.setHeader('Content-Type', contentType);
    response.setHeader('Cache-Control', 'no-store');
    response.statusCode = upstream.status;
    if (contentType.includes('text/html')) {
      const html = (await upstream.text()).replace('<div class="player-actions">', '<div class="player-actions">' + qaControls).replace('</body>', qaMedia + '</body>');
      response.end(html);
    } else {
      response.end(Buffer.from(await upstream.arrayBuffer()));
    }
  } catch {
    response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Inicie npm run dev na porta 8787.');
  }
});
server.listen(8788, '127.0.0.1', () => {
  console.log('QA: http://127.0.0.1:8788/?room=teste-local&mode=view&preview=connected');
});
