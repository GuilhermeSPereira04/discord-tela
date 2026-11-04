// Audit-only instrumentation of the untouched scene: actual renderer counts,
// warm frame cadence, CPU submission and optional asynchronous GPU timer.
// It does not change geometry, shaders, resolution, lighting or animation.
import fs from 'node:fs/promises';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const reference = new URL('../reference/', import.meta.url);
let code = await fs.readFile(new URL('main.js', reference), 'utf8');
const diagnostic = `
const audit = { start: performance.now(), frames: 0, cpu: [], gpu: [], cadence: [], last: 0, firstFrame: null, longTasks: [] };
let auditGl, auditExt, auditQuery;
if (globalThis.PerformanceObserver?.supportedEntryTypes.includes('longtask')) new PerformanceObserver(list => {
  for (const e of list.getEntries()) audit.longTasks.push({start:e.startTime,duration:e.duration});
}).observe({type:'longtask',buffered:true});
const auditPercentile = (values,p) => {const s=[...values].sort((a,b)=>a-b); return s.length?Math.round(s[Math.min(s.length-1,Math.floor(s.length*p))]*100)/100:null;};
function auditBegin(renderer) {
  auditGl ||= renderer.getContext();
  auditExt ??= auditGl.getExtension('EXT_disjoint_timer_query_webgl2') || false;
  if (auditQuery && auditGl.getQueryParameter(auditQuery, auditGl.QUERY_RESULT_AVAILABLE)) {
    if (!auditGl.getParameter(auditExt.GPU_DISJOINT_EXT) && audit.frames>30) audit.gpu.push(auditGl.getQueryParameter(auditQuery,auditGl.QUERY_RESULT)/1e6);
    auditGl.deleteQuery(auditQuery); auditQuery=null;
  }
  const query = auditExt && !auditQuery ? auditGl.createQuery() : null;
  if (query) auditGl.beginQuery(auditExt.TIME_ELAPSED_EXT,query);
  renderer.info.reset();
  return {start:performance.now(),query};
}
function auditEnd(renderer, sample) {
  if(sample.query) { auditGl.endQuery(auditExt.TIME_ELAPSED_EXT); auditQuery=sample.query; }
  const now=performance.now(); audit.frames++;
  if(audit.firstFrame===null) audit.firstFrame=now-audit.start;
  if(audit.frames>30 && !document.hidden) { audit.cpu.push(now-sample.start); if(audit.last) audit.cadence.push(now-audit.last); }
  audit.last=now;
  if(audit.frames%30) return;
  let panel=document.getElementById('diorama-diagnostics');
  if(!panel) { panel=document.createElement('pre'); panel.id='diorama-diagnostics'; panel.style.cssText='position:fixed;left:8px;top:8px;max-height:95vh;overflow:auto;background:#000d;color:#fff;padding:10px;font:11px monospace;z-index:99;white-space:pre-wrap;max-width:420px'; document.body.append(panel); }
  const debug=auditGl.getExtension('WEBGL_debug_renderer_info');
  panel.textContent=JSON.stringify({
    scope:'Instrumented upstream, original 1440x1440; desktop only',
    visibility:document.visibilityState,firstFrameMs:Math.round(audit.firstFrame),frames:audit.frames,warmSamples:audit.cpu.length,
    frameCadenceMs:{median:auditPercentile(audit.cadence,.5),p95:auditPercentile(audit.cadence,.95)},
    cpuSubmissionMs:{median:auditPercentile(audit.cpu,.5),p95:auditPercentile(audit.cpu,.95)},
    gpuMs:{supported:!!auditExt,samples:audit.gpu.length,median:auditPercentile(audit.gpu,.5),p95:auditPercentile(audit.gpu,.95)},
    render:{...renderer.info.render},memoryCounts:{...renderer.info.memory},
    longTasks:audit.longTasks,renderer:debug?auditGl.getParameter(debug.UNMASKED_RENDERER_WEBGL):auditGl.getParameter(auditGl.RENDERER),
    webgl:auditGl.getParameter(auditGl.VERSION),floatColorBuffer:!!auditGl.getExtension('EXT_color_buffer_float')
  },null,2);
}
`;
function replaceOnce(before, after) {
  if(code.split(before).length!==2) throw new Error('Diagnostic marker changed: '+before.slice(0,60));
  code=code.replace(before,after);
}
replaceOnce('const W = 1440,',diagnostic+'\nconst W = 1440,');
replaceOnce('renderer.shadowMap.enabled = true;', 'renderer.info.autoReset = false;\n  renderer.shadowMap.enabled = true;');
replaceOnce('function drawFrame(t) {','function drawFrame(t) {\n    const auditSample=auditBegin(renderer);');
replaceOnce('quad.material = tilt; renderer.setRenderTarget(null); renderer.render(post, postCam);',
  'quad.material = tilt; renderer.setRenderTarget(null); renderer.render(post, postCam);\n    auditEnd(renderer,auditSample);');
await fs.writeFile(new URL('diagnostic.js',reference),code);
await build({entryPoints:[fileURLToPath(new URL('diagnostic.js',reference))],bundle:true,format:'esm',outfile:fileURLToPath(new URL('build/diagnostic.js',reference)),logLevel:'warning'});
await fs.writeFile(new URL('diagnostic.html',reference),'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ASCII diorama - diagnostic</title><style>html,body{margin:0;background:#000}canvas{display:block}</style><script type="module" src="./build/diagnostic.js"></script>');
console.log('Diagnostic only: http://127.0.0.1:5174/diagnostic.html');
