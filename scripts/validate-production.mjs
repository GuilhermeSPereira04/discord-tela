import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { createTestHarness } from 'wrangler';

// Exercise the dry-run artifact in workerd with a remote hostname. No preview
// injection, real deployment secrets or outbound Discord calls are needed.
const secret='production-check-only';
const origin='https://production-check.invalid';
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const publicKeyHex=publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('hex');
const server=createTestHarness({workers:[{
  configPath:'./wrangler.toml',prebuiltWorkerDir:'./dist',
  vars:{DISCORD_PUBLIC_KEY:publicKeyHex},
  secrets:{HOST_LINK_SECRET:secret,DISCORD_TOKEN:''}
}]});
function roomUrl(mode,exp=Math.floor(Date.now()/1000)+600){
  const url=new URL(origin);
  const payload=`release-check.${exp}.${mode}`+(mode==='host'?'...':'');
  const sig=createHmac('sha256',secret).update(payload).digest().subarray(0,16).toString('base64url');
  url.search=new URLSearchParams({room:'release-check',mode,exp:String(exp),sig});
  return url;
}
const assets=new Map();
function collect(source,base){
  for(const match of source.matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+\.mjs)['"]/g)){
    const url=new URL(match[1],base);if(url.origin===origin)assets.set(url.pathname,'module');
  }
  for(const match of source.matchAll(/(?:src|data-src|href)=["'](\/[^"'\s]+)["']/g)){
    const url=new URL(match[1],origin);assets.set(url.pathname,assets.get(url.pathname)||'asset');
  }
  for(const match of source.matchAll(/url\(['"]?(\/[^)'"\s]+)['"]?\)/g))assets.set(match[1],'asset');
}
try{
  await server.listen();
  const host=roomUrl('host'),view=roomUrl('view');
  const cases=[['host',host,200],['viewer',view,200],['expired',roomUrl('view',1),403]];
  const unsigned=new URL('/?room=release-check&mode=host',origin);
  cases.push(['unsigned',unsigned,403]);
  const swapped=new URL(view);swapped.searchParams.set('mode','host');cases.push(['role swap',swapped,403]);
  const preview=new URL(view);preview.searchParams.set('preview','connected');cases.push(['remote preview disabled',preview,200]);
  for(const [name,url,status] of cases){
    const response=await server.fetch(url);assert.equal(response.status,status,name);
    assert.match(response.headers.get('Content-Type'),/text\/html/);
    const html=await response.text();collect(html,origin);
    assert.ok(!/QaEmitter|qaAddViewer|id="qa-controls"|class="preview-nav"/.test(html),name+' must not include QA controls');
    assert.ok(html.includes('.expired-page')&&html.includes('.nickname-screen'),'compiled CSS must be embedded');
    for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
      if(match[1].includes('type="module"'))await transform(match[2],{loader:'js',target:'es2022'});
      else new vm.Script(match[2]);
    }
    if(name==='viewer'||name==='remote preview disabled'){
      assert.ok(html.includes('<main id="nickname-screen"')&&html.includes('<main id="app-main" hidden>'));
      assert.ok(!/<script[^>]+src=/.test(html),'PeerJS must remain deferred until nickname confirmation');
      assert.ok(!/<body[^>]+class="[^"]*\bviewer-preview\b/.test(html));
    }
    if(name==='host'){
      assert.ok(html.includes('attachAudienceEyes')&&html.includes('attachHostLiveEye'));
      const invite=new URL(JSON.parse(html.match(/const INVITE_HREF = (.*);/)[1]));
      assert.equal((await server.fetch(invite)).status,200,'host invitation must be accepted');
    }
    console.log(`${status} ${name}`);
  }
  const timestamp=String(Math.floor(Date.now()/1000)),body=JSON.stringify({type:1});
  const signature=sign(null,Buffer.from(timestamp+body),privateKey).toString('hex');
  const ping=await server.fetch(origin,{method:'POST',body,headers:{'X-Signature-Ed25519':signature,'X-Signature-Timestamp':timestamp}});
  assert.equal(ping.status,200);assert.deepEqual(await ping.json(),{type:1});
  assert.equal((await server.fetch(origin,{method:'POST',body})).status,401);
  assert.equal((await server.fetch(origin+'/api/status',{method:'POST',body:'{}'})).status,403);
  const manifest=JSON.parse(await readFile('public/diorama/asset-manifest.json','utf8'));
  function manifestAssets(value){
    if(typeof value==='string')assets.set('/diorama/'+value,'asset');
    else for(const child of Object.values(value))manifestAssets(child);
  }
  manifestAssets(manifest);assets.set('/diorama/scene-worker.mjs','module');
  const checked=new Set();
  // Map iteration also visits imports discovered in modules, including the
  // liquid-volume dependency that a plain HTML asset scan would otherwise miss.
  for(const [pathname,kind] of assets){
    if(checked.has(pathname))continue;checked.add(pathname);
    const response=await server.fetch(origin+pathname);assert.equal(response.status,200,pathname);
    const contentType=response.headers.get('Content-Type')||'';
    const bytes=new Uint8Array(await response.arrayBuffer());assert.ok(bytes.length>0,pathname);
    assert.ok(!/text\/html/.test(contentType),'asset must not be an HTML fallback: '+pathname);
    if(kind==='module'){
      assert.match(contentType,/javascript/,pathname);
      const code=new TextDecoder().decode(bytes);await transform(code,{loader:'js',target:'es2022'});
      collect(code,origin+pathname);
    }
  }
  console.log(`Validated production artifact: ${cases.length} signed/invalid cases, Discord ping/auth and ${checked.size} static assets/imports.`);
}finally{await server.close();}
