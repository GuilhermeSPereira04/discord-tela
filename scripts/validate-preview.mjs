import assert from 'node:assert/strict';
import vm from 'node:vm';
const origin='http://127.0.0.1:' + (process.env.PREVIEW_PORT || 8793);
const response=await fetch(origin+'/telas');
assert.equal(response.status,200);
const index=await response.text();
const links=[...index.matchAll(/<a target="tela"[^>]*href="([^"]+)"/g)].map(match=>match[1]);
assert.equal(links.length,6);
assert.ok(!/[?&](study|audience|state|mask)=/.test(index));
assert.equal((index.match(/>Transmitindo</g) || []).length, 1);
const assets=new Set();
for(const link of links){
  const page=await fetch(new URL(link,origin));
  assert.equal(page.status,link==='/link-invalido'?403:200,link);
  const html=await page.text();
  if(link.includes('mode=host')){
    assert.ok(html.includes('attachAudienceEyes'));
    assert.ok(html.includes('.audience-list.has-audience-eyes'));
    assets.add('/audience-eyes.mjs');
    assets.add('/quality-ocean.mjs');
  }
  if(link.includes('mode=view')&&!/[?&]preview=(waiting|connected)/.test(link)){
    assert.ok(html.includes('id="nickname-dialog"'));
    assert.ok(html.includes('<main id="nickname-screen" class="nickname-screen">'));
    assert.ok(html.includes('<main id="app-main" hidden>'));
    assert.ok(!/<script[^>]+src=/.test(html));
    assert.ok(html.includes('.nickname-dialog{'));
    assert.ok(html.includes('Continuar sem apelido'));
    assert.ok(html.includes('sendViewerProfile();'));
    assert.ok(html.includes('id="nickname-crowd"'));
    assets.add('/nickname-crowd.mjs');
  }
  for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){
    if(!match[1].includes('type="module"'))new vm.Script(match[2]);
  }
  for(const match of html.matchAll(/(?:src|data-src)="(\/[^"\s]+)"/g))assets.add(match[1]);
  for(const match of html.matchAll(/from\s+['"](\/[^'"\s]+\.mjs)['"]/g))assets.add(match[1]);
  if(link.includes('qa=live')){
    assert.ok(html.includes('class QaEmitter'));
    assert.ok(!html.includes('src="https://unpkg.com/peerjs'));
    assert.ok(html.includes("await startHostStream()"));
  }
  console.log(page.status,link);
}
for(const asset of assets){
  const page=await fetch(new URL(asset,origin));
  assert.equal(page.status,200,asset);await page.arrayBuffer();
}
console.log(`Validated ${links.length} screens, inline JavaScript and ${assets.size} local assets.`);
