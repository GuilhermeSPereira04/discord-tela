// Experiment: one procedural draw for the volume's surface, fill and deformable
// marker. DOM range, gain, focus, labels and pointer capture remain native.
export const liquidVolumeVertexSource = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const liquidVolumeFragmentSource = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform vec2 size;
uniform vec2 panelSize;
uniform vec2 panelOffset;
uniform vec4 track;
uniform float vertical;
uniform float value;
uniform float reveal;
uniform float pressure;
uniform float pull;
uniform float pointer;
uniform float silent;
out vec4 color;

float capsule(vec2 p, float end, float radius) {
  p.x -= clamp(p.x, 0.0, max(end, 0.0));
  return length(p) - radius;
}
float softUnion(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a,b) - h*h*k*.25;
}
float oval(vec2 p, vec2 radius) {
  return (length(p/radius)-1.0)*min(radius.x,radius.y);
}
float liquid(vec2 q) {
  float head = track.z * value;
  float speed = min(abs(pull),1.0);
  float stem = capsule(q, head, 1.65 + pressure*.65);
  vec2 radii = vec2(5.6 + pressure*1.8 + speed*4.0, 5.6 + pressure*1.6 - speed*1.4);
  float bead = oval(q - vec2(head,0.0), radii);
  float tail = oval(q - vec2(head-pull*9.0,0.0), vec2(4.4+speed*2.0,2.6+pressure));
  return softUnion(softUnion(stem,tail,4.5),bead,5.0);
}
float coverage(float d) { return 1.0-smoothstep(-.65,.65,d); }
void main() {
  vec2 p = vec2(gl_FragCoord.x, resolution.y-gl_FragCoord.y)*size/resolution;
  vec2 axis = mix(vec2(1,0),vec2(0,-1),vertical);
  vec2 across = vec2(-axis.y,axis.x);
  vec2 delta = p-track.xy;
  vec2 q = vec2(dot(delta,axis),dot(delta,across));
  float opening = clamp(reveal,0.0,1.0);

  // The desktop surface grows from the speaker, while its input box is fixed.
  vec2 box = mix(vec2(panelSize.y+(panelSize.x-panelSize.y)*opening,panelSize.y),panelSize,vertical);
  float radius = min(box.x,box.y)*.5;
  vec2 b = abs(p-panelOffset-box*.5)-(box*.5-radius);
  float surface = length(max(b,0.0))+min(max(b.x,b.y),0.0)-radius;
  float body = coverage(surface)*opening;
  float rim = exp(-abs(surface)*1.35)*.035;
  float light = exp(-pow((p.x/size.x-pointer)*2.2,2.0))*.016;
  vec3 base = vec3(.052,.056,.061)+light+rim;
  color = vec4(base,body*.98);

  float railDistance = capsule(q,track.z,1.25);
  float rail = coverage(railDistance)*opening;
  float d = liquid(q);
  float ink = coverage(d)*opening;
  vec3 metal = vec3(.80,.83,.86);
  if(d < 1.0) {
    // Local SDF gradient shapes an analytic highlight; no texture, blur or
    // sampled video refraction is needed for the small satin/glass surface.
    vec2 grad = vec2(liquid(q+vec2(.3,0))-liquid(q-vec2(.3,0)),
                     liquid(q+vec2(0,.3))-liquid(q-vec2(0,.3)))/.6;
    vec3 n = normalize(vec3(grad,sqrt(clamp(-d/6.0,0.0,1.0))+.15));
    float diffuse = max(dot(n,normalize(vec3(-.35,-.65,1.0))),0.0);
    float spec = pow(max(dot(n,normalize(vec3(-.25,-.45,1.0))),0.0),26.0);
    metal = vec3(.63,.67,.71)+diffuse*.24+spec*.24;
    metal += exp(-abs(d+.65)*3.0)*.10;
  }
  metal *= mix(1.0,.48,silent);
  // Composite unpremultiplied colors for a transparent WebGL canvas.
  float alpha = max(body,max(rail,ink));
  vec3 rgb = mix(base,vec3(.25,.27,.29),rail);
  rgb = mix(rgb,metal,ink);
  color = vec4(rgb,alpha);
}`;

// Stable damped motion, with elapsed time rather than a frame-count easing.
// Position of the actual marker is never filtered: only its shape has inertia.
export function advanceLiquidSpring(current, velocity, target, seconds) {
  const dt = Math.min(.05, Math.max(0,seconds));
  const decay = Math.exp(-22*dt);
  const offset = current-target;
  const travel = velocity+22*offset;
  return { value: target+(offset+travel*dt)*decay, velocity: (velocity-22*travel*dt)*decay };
}

function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2',{ alpha:true, antialias:false, depth:false,
    stencil:false, premultipliedAlpha:false, powerPreference:'low-power', failIfMajorPerformanceCaveat:true });
  if (!gl) return null;
  const program = gl.createProgram();
  for (const [type,source] of [[gl.VERTEX_SHADER,liquidVolumeVertexSource],[gl.FRAGMENT_SHADER,liquidVolumeFragmentSource]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader,source); gl.compileShader(shader);
    gl.attachShader(program,shader); gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) {
    gl.deleteProgram(program); gl.getExtension('WEBGL_lose_context')?.loseContext(); return null;
  }
  gl.useProgram(program);
  const uniforms = Object.fromEntries(['resolution','size','panelSize','panelOffset','track','vertical','value','reveal','pressure','pull','pointer','silent']
    .map(name => [name,gl.getUniformLocation(program,name)]));
  return {
    draw(geometry,state) {
      const { width,height,dpr,panelWidth,panelHeight,offsetX,offsetY,x,y,length,vertical } = geometry;
      const w = Math.round(width*dpr), h = Math.round(height*dpr);
      if (canvas.width!==w || canvas.height!==h) { canvas.width=w; canvas.height=h; gl.viewport(0,0,w,h); }
      gl.uniform2f(uniforms.resolution,w,h); gl.uniform2f(uniforms.size,width,height);
      gl.uniform2f(uniforms.panelSize,panelWidth,panelHeight);
      gl.uniform2f(uniforms.panelOffset,offsetX,offsetY);
      gl.uniform4f(uniforms.track,x,y,length,0);
      for (const [name,v] of Object.entries({...state,vertical:Number(vertical)})) gl.uniform1f(uniforms[name],v);
      gl.drawArrays(gl.TRIANGLES,0,3);
    },
    dispose() { gl.deleteProgram(program); gl.getExtension('WEBGL_lose_context')?.loseContext(); }
  };
}

export function attachLiquidVolume(audio, input, doc = document) {
  const view = doc.defaultView;
  const motion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const panel = audio.querySelector('#volume-panel');
  const range = audio.querySelector('.volume-control');
  const canvas = doc.createElement('canvas');
  canvas.className = 'volume-canvas'; canvas.setAttribute('aria-hidden','true'); canvas.hidden=true;
  panel.prepend(canvas);
  let renderer, geometry, frame, lastTime, failed=false, disposed=false, dirty=true, visible=true;
  let open=false, held=false, over=false;
  let target=Number(input.value)||0, muted=false, pointer=.65;
  const springs = { reveal:{value:0,velocity:0}, pressure:{value:0,velocity:0}, pull:{value:0,velocity:0} };
  const listeners=[];
  function on(element,event,handler) { element.addEventListener(event,handler); listeners.push(()=>element.removeEventListener(event,handler)); }
  function pause() { view.cancelAnimationFrame(frame); frame=undefined; lastTime=undefined; }
  function fallback() { delete audio.dataset.volumeRenderer; canvas.hidden=true; }
  function measure() {
    const bounds=canvas.getBoundingClientRect(), box=panel.getBoundingClientRect(), slider=range.getBoundingClientRect();
    if (!bounds.width || !bounds.height || !slider.width || !slider.height) return false;
    const vertical=input.getAttribute('aria-orientation')==='vertical';
    const half=Number.parseFloat(view.getComputedStyle(doc.documentElement).fontSize)*.1875;
    geometry={width:bounds.width,height:bounds.height,dpr:Math.min(view.devicePixelRatio||1,2),
      panelWidth:box.width,panelHeight:box.height,offsetX:box.left-bounds.left,offsetY:box.top-bounds.top,vertical,
      x:slider.left-bounds.left+(vertical ? slider.width*.5 : half),
      y:slider.top-bounds.top+(vertical ? slider.height-half : slider.height*.5),
      length:Math.max(1,(vertical ? slider.height : slider.width)-half*2)};
    return true;
  }
  function queue() {
    if (!disposed && !failed && !motion.matches && visible && !doc.hidden && frame===undefined &&
      (open || springs.reveal.value>0)) frame=view.requestAnimationFrame(paint);
  }
  function paint(now) {
    frame=undefined;
    if (disposed || failed || motion.matches || doc.hidden || !visible) return;
    if (!renderer) {
      canvas.hidden=false;
      try { renderer=createRenderer(canvas); } catch { renderer=null; }
      if (!renderer) { failed=true; fallback(); return; }
    }
    canvas.hidden=false;
    // A closed horizontal input has no width. Retain its last open geometry so
    // the visual can finish retracting without changing native hit areas.
    if (dirty && open) { dirty=!measure(); }
    if (!geometry) return;
    audio.dataset.volumeRenderer='webgl2'; canvas.hidden=false;
    const dt=lastTime===undefined ? 1/60 : (now-lastTime)/1000; lastTime=now;
    const goals={reveal:open ? 1 : 0,pressure:held ? 1 : over ? .35 : 0,pull:0};
    let moving=false;
    for (const key of Object.keys(springs)) {
      springs[key]=advanceLiquidSpring(springs[key].value,springs[key].velocity,goals[key],dt);
      const s=springs[key];
      if (Math.abs(s.value-goals[key])<.001 && Math.abs(s.velocity)<.01) springs[key]={value:goals[key],velocity:0};
      else moving=true;
    }
    renderer.draw(geometry,{value:target,silent:Number(muted),pointer,
      reveal:springs.reveal.value,pressure:springs.pressure.value,pull:springs.pull.value});
    if (moving) queue(); else lastTime=undefined;
  }
  function disclosure() {
    open=audio.classList.contains('is-volume-open'); dirty=true;
    if (!open) { held=over=false; }
    queue();
  }
  function release() { held=false; queue(); }
  on(audio,'volumedisclosurechange',disclosure);
  on(range,'pointerenter',()=>{over=true;queue();});
  on(range,'pointerleave',()=>{over=false;queue();});
  on(input,'pointerdown',()=>{held=true;queue();});
  on(input,'lostpointercapture',release); on(doc,'pointerup',release); on(doc,'pointercancel',release);
  on(input,'blur',release);
  on(range,'pointermove',event=>{
    if (!geometry) return;
    const rect=canvas.getBoundingClientRect();
    pointer=Math.max(0,Math.min(1,(event.clientX-rect.left)/geometry.width)); queue();
  });
  on(view,'blur',()=>{held=over=false;pause();});
  on(view,'resize',()=>{dirty=true;queue();});
  on(doc,'visibilitychange',()=>{if(doc.hidden)pause();else{dirty=true;queue();}});
  on(motion,'change',()=>{pause(); if(motion.matches)fallback(); else{dirty=true;queue();}});
  on(canvas,'webglcontextlost',event=>{event.preventDefault();pause();failed=true;fallback();});
  on(canvas,'webglcontextrestored',()=>{renderer=null;failed=false;dirty=true;queue();});
  const resize=new view.ResizeObserver(()=>{dirty=true;queue();}); resize.observe(panel);
  const intersection=view.IntersectionObserver ? new view.IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting; if(!visible)pause();else{dirty=true;queue();}
  }) : null;
  intersection?.observe(audio);
  function dispose() {
    disposed=true; pause(); listeners.forEach(remove=>remove()); resize.disconnect(); intersection?.disconnect();
    renderer?.dispose(); renderer=null; fallback(); canvas.remove();
  }
  on(view,'pagehide',event=>{if(event.persisted)pause();else dispose();});
  on(view,'pageshow',()=>{dirty=true;queue();});
  disclosure();
  return {
    update(value,silent) {
      const next=Math.max(0,Math.min(1,Number(value)||0));
      // The velocity impulse stretches the liquid, never the gain or its center.
      springs.pull.velocity+=Math.max(-22,Math.min(22,(next-target)*115));
      target=next; muted=silent; queue();
    }, dispose
  };
}
