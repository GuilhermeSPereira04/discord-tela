import './build-client.mjs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
await build({entryPoints:['worker.js'],outfile:'.wrangler/preview-worker.mjs',bundle:true,format:'esm',platform:'node',loader:{'.css':'text'}});
const {default:worker} = await import('../.wrangler/preview-worker.mjs?' + Date.now());
const port = Number(process.env.PREVIEW_PORT || 8793);
const assets = path.resolve('public');
const types = {'.mjs':'text/javascript','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.glb':'model/gltf-binary','.bin':'application/octet-stream','.txt':'text/plain'};
// Explicit test-only URL. Production HTML/functions are exercised with synthetic
// video and transport, never with the user's screen or invented real viewers.
const fixture = `<script>
class QaEmitter {
  constructor(){this.listeners={};}
  on(name,fn){(this.listeners[name] ||= []).push(fn);}
  emit(name,...args){for(const fn of this.listeners[name] || [])fn(...args);}
}
class Peer extends QaEmitter {
  constructor(){super();this.open=true;queueMicrotask(()=>this.emit('open'));}
  call(id){const call=new QaEmitter();call.peerConnection=new EventTarget();call.peerConnection.connectionState='connected';call.peerConnection.getSenders=()=>[];call.close=()=>call.emit('close');return call;}
  destroy(){this.destroyed=true;}
}
let qaCaptureCount=0;
navigator.mediaDevices.getDisplayMedia=async()=>{
  qaCaptureCount++;
  const c=document.createElement('canvas');c.width=1600;c.height=900;
  const x=c.getContext('2d');const stream=c.captureStream(15);const track=stream.getVideoTracks()[0];
  let audio;
  if(new URLSearchParams(location.search).get('audio')==='yes'){
    audio=new AudioContext();const destination=audio.createMediaStreamDestination();
    const oscillator=audio.createOscillator();const gain=audio.createGain();gain.gain.value=.02;
    oscillator.connect(gain).connect(destination);oscillator.start();
    stream.addTrack(destination.stream.getAudioTracks()[0]);
  }
  let phase=0;
  function draw(){
    if(track.readyState==='ended'){audio?.close();return;}
    x.fillStyle='#141414';x.fillRect(0,0,1600,900);
    x.strokeStyle='#343434';x.lineWidth=1;
    for(let i=0;i<34;i++){
      x.beginPath();for(let k=0;k<=1600;k+=12){const y=420+i*13+Math.sin(k/250+phase+i*.14)*80; k?x.lineTo(k,y):x.moveTo(k,y);}x.stroke();
    }
    x.fillStyle='#bcbcb7';x.font='18px sans-serif';x.fillText('IMAGEM GERADA PARA TESTE',90,105);
    x.fillStyle='#f5f5f2';x.font='64px sans-serif';x.fillText('Uma janela para compartilhar.',90,230);
    x.fillStyle='#ababab';x.font='24px sans-serif';x.fillText('Prévia '+qaCaptureCount+' · sem captura da sua tela',90,292);
    phase+=.025;setTimeout(draw,66);
  }
  draw();return stream;
};
</script>`;
const qaControls = urlSearch => `<div id="qa-controls" style="padding:16px;display:flex;gap:16px;flex-wrap:wrap">
<label><input type="checkbox" onchange="qaToggleAudio(this.checked)" ${new URLSearchParams(urlSearch).get('audio') === 'yes' ? 'checked' : ''}> Incluir áudio de teste</label>
<button onclick="qaAddViewer()">Adicionar espectador de teste</button>
<button onclick="qaAddViewer('Raposa')">Adicionar apelido de teste</button>
<button onclick="document.getElementById('qa-controls').hidden=true">Ocultar controles de teste</button></div>
<script>let qaSequence=0;
function qaToggleAudio(enabled){const url=new URL(window.location.href);enabled?url.searchParams.set('audio','yes'):url.searchParams.delete('audio');window.location.href=url.href;}
function qaAddViewer(nickname=''){if(!peer)return;const c=new QaEmitter();c.peer='qa-'+(++qaSequence);c.close=()=>c.emit('close');peer.emit('connection',c);c.emit('data',{type:'VIEWER_PROFILE',nickname});c.emit('data','REQUEST_STREAM');}
(async()=>{await startHostStream();['Raposa','Corvo','Lótus','Sombra','Lua'].forEach(name=>qaAddViewer(name));})();</script>`;
createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:' + port);
  if(url.pathname==='/telas'){
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}).end(await readFile(new URL('./preview.html', import.meta.url)));return;
  }
  if(url.pathname==='/link-invalido'){
    const response=await worker.fetch(new Request('https://preview.invalid/?room=example&mode=host'),{HOST_LINK_SECRET:'local-preview-only'});
    res.writeHead(response.status,Object.fromEntries(response.headers)).end(await response.text());return;
  }
  if(url.pathname==='/'){
    const response=await worker.fetch(new Request(url),{});let html=await response.text();
    if(url.searchParams.get('qa')==='live' && url.searchParams.get('mode')==='host')html=html.replace('<script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>',fixture).replace('</body>',qaControls(url.search)+'</body>');
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(html);return;
  }
  const target=path.resolve(assets,'.'+decodeURIComponent(url.pathname));
  if(!target.startsWith(assets+path.sep)){res.writeHead(403).end();return;}
  const bytes=await readFile(target);res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
 }catch(error){res.writeHead(404).end(error.message);}
}).listen(port,'127.0.0.1',()=>console.log('Revisar telas: http://127.0.0.1:' + port + '/telas'));
