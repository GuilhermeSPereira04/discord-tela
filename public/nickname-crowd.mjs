// Complement to the under-glass feet: small standing figures on a bright plaza.
// Bounded instanced quads, analytic soft focus and HTML controls in front.
export const crowdVertexSource = `#version 300 es
uniform vec2 viewportSize;
uniform vec4 placements[35];
uniform vec4 movements[35];
uniform vec4 looks[35];
uniform vec4 signals[35];
out vec2 point;
out vec2 world;
flat out vec4 movement;
flat out vec4 look;
flat out vec4 signal;
void main() {
  const vec2 vertices[6]=vec2[6](vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));
  vec4 placement=placements[gl_InstanceID];
  movement=movements[gl_InstanceID];look=looks[gl_InstanceID];
  signal=signals[gl_InstanceID];
  point=vertices[gl_VertexID]*vec2(.92,1.30)+vec2(0,-.90);
  world=placement.xy+point*placement.z;
  gl_Position=vec4(world/viewportSize*vec2(2,-2)+vec2(-1,1),0,1);
}`;

export const crowdFragmentSource = `#version 300 es
precision highp float;
in vec2 point;
in vec2 world;
flat in vec4 movement;
flat in vec4 look;
flat in vec4 signal;
uniform vec4 formRect;
out vec4 color;
float segment(vec2 p,vec2 a,vec2 b,float radius) {
  vec2 v=b-a;float t=clamp(dot(p-a,v)/max(dot(v,v),.001),0.0,1.0);
  return length(p-a-v*t)-radius;
}
float oval(vec2 p,vec2 size) {return (length(p/size)-1.0)*min(size.x,size.y);}
float cover(float d,float blur) {return 1.0-smoothstep(-blur,blur,d);}
vec2 footAt(float clock,float stride,float dir) {
  float phase=fract(clock),stance=.62;
  float swing=max(0.0,(phase-stance)/(1.0-stance));
  float eased=swing*swing*(3.0-2.0*swing)-((1.0-stance)/stance)*swing*(1.0-swing)*(1.0-2.0*swing);
  float forward=phase<stance ? stride*(.5-phase/stance) : stride*(-.5+eased);
  return vec2(dir*forward,-sin(swing*3.14159265)*.13);
}
void main() {
  float phase=movement.x,dir=movement.y,depth=movement.z;
  // Test a brief spatial interruption, without flashing the whole silhouette.
  vec2 p=point;
  float slice=cover(abs(p.y+1.20)-.045,.018)-cover(abs(p.y+.66)-.032,.018);
  p.x+=slice*signal.y*.065;
  float walking=1.0-signal.z;
  float gait=sin(phase)*walking,counter=-gait;
  float bob=cos(phase*2.0)*.028*walking;
  float lean=dir*.055;
  vec2 hip=vec2(0,-.84+bob),shoulder=vec2(lean,-1.38+bob);
  vec2 head=vec2(lean+dir*.025,-1.70+bob);
  float focus=.040+pow(abs(depth-.44),1.25)*.25;
  float blur=max(focus,fwidth(point.y)*.7);

  vec2 footA=footAt(phase/6.2831853,movement.w,dir);
  vec2 footB=footAt(phase/6.2831853+.5,movement.w,dir)+vec2(0,.055);
  footA=mix(vec2(-.105,0),footA,walking);
  footB=mix(vec2(.105,.055),footB,walking);
  vec2 kneeA=mix(hip,footA,.55)+vec2(dir*.05,-max(gait,0.0)*.12);
  vec2 kneeB=mix(hip,footB,.55)+vec2(-dir*.04,-max(counter,0.0)*.12);
  vec2 armA=vec2(-.15+gait*.16,-.91+bob);
  vec2 armB=vec2(.15+counter*.16,-.91+bob);

  // Back limbs, jacket, head and front limbs receive separate soft coverage.
  float backLeg=min(segment(p,hip+vec2(.065,0),kneeB,.072),segment(p,kneeB,footB,.058));
  float frontLeg=min(segment(p,hip-vec2(.065,0),kneeA,.076),segment(p,kneeA,footA,.060));
  float arms=min(segment(p,shoulder+vec2(.14,.035),armB,.059),segment(p,shoulder-vec2(.14,0),armA,.063));
  float jacket=min(segment(p,hip+vec2(0,look.z),shoulder,look.x),
    segment(p,shoulder-vec2(.10,0),shoulder+vec2(.10,0),.095));
  float neck=segment(p,shoulder,head,.062);
  float skull=oval(p-head,vec2(.115,.145));
  float shoes=min(oval(p-footA-vec2(dir*.025,.028),vec2(.11,.047)),oval(p-footB-vec2(dir*.025,.028),vec2(.105,.045)));
  float headMask=cover(skull,blur*.80),body=cover(jacket,blur);
  float legs=max(cover(backLeg,blur),cover(frontLeg,blur));
  float limbs=max(cover(arms,blur),cover(neck,blur));
  float shoeMask=cover(shoes,blur);
  float silhouette=max(max(body,headMask),max(legs,max(limbs,shoeMask)));

  // Pearl fabric keeps shaded edges against the white plaza. Pigment follows
  // the same folds and lighting, rather than filling a flat colored cutout.
  vec3 cloth=look.y<.5 ? vec3(.66,.70,.70) : look.y<1.5 ? vec3(.73,.74,.70) : vec3(.70,.74,.77);
  vec3 pigment=signal.w<.5 ? vec3(.16,.38,.54) : signal.w<1.5 ? vec3(.48,.24,.28) : vec3(.20,.43,.35);
  vec3 pigmentLight=signal.w<.5 ? vec3(.57,.78,.84) : signal.w<1.5 ? vec3(.85,.65,.62) : vec3(.61,.81,.67);
  float sheen=clamp(.50-p.y*.15-p.x*.65,0.0,1.0);
  vec3 tint=mix(pigment,pigmentLight,sheen);
  cloth=mix(cloth,tint,signal.x);
  float shoulderLight=(1.0-smoothstep(0.0,.22,abs(p.x+dir*.07)))*.075;
  float fold=sin(p.y*19.0+p.x*8.0+phase*.12)*.018*(1.0-depth*.55);
  vec3 rgb=cloth+shoulderLight+fold;
  rgb=mix(rgb,mix(vec3(.49,.54,.54),tint*.75,signal.x*.7),legs*.60);
  rgb=mix(rgb,vec3(.66,.64,.59),headMask);
  float hair=cover(oval(p-head-vec2(-dir*.02,-.06),vec2(.116,.10)),blur);
  rgb=mix(rgb,vec3(.40,.45,.43),hair*.85);
  rgb=mix(rgb,vec3(.42,.47,.46),shoeMask);

  // Low oblique contact shadows and depth haze keep the crowd on one plane.
  float shadow=exp(-pow((point.x-dir*.12)/.40,2.0)-pow((point.y-.08)/.11,2.0))*.12;
  float alpha=max(silhouette*mix(.38,.72,1.0-abs(depth-.44)),shadow);
  float edge=min(.92-abs(point.x),min(point.y+2.2,.40-point.y));
  alpha*=smoothstep(0.0,.12,edge)*look.w;
  vec2 center=formRect.xy+formRect.zw*.5;
  vec2 outside=abs(world-center)-formRect.zw*.5;
  float distanceToForm=length(max(outside,0.0))+min(max(outside.x,outside.y),0.0);
  alpha*=smoothstep(-4.0,72.0,distanceToForm);
  if(alpha<.002)discard;
  color=vec4(rgb,alpha);
}`;

export const maxNicknamePeople=35;
const fraction=value=>value-Math.floor(value);
const noise=seed=>fraction(Math.sin(seed*127.1+31.7)*43758.5453);
const clamp=value=>Math.max(0,Math.min(1,value));
const ease=value=>{const t=clamp(value);return t*t*(3-2*t);};

// A local clock decelerates, rests, then rejoins the lane. Its maximum lag is
// capped at a tenth of one reserved cell, so stopping cannot cause overtaking.
function receptionAt(seconds,actor,slot) {
  const tempo=Math.min(1,actor.span/actor.columns*.10/(actor.speed*1.95));
  const q=(seconds-(2+slot*9))/tempo;
  let lag=0,rate=1;
  if(q>=0&&q<.6){const u=q/.6;lag=.6*(u**3-.5*u**4);rate=1-ease(u);}
  else if(q>=.6&&q<2){lag=.3+q-.6;rate=0;}
  else if(q>=2&&q<2.5){const u=(q-2)/.5;lag=1.7+.5*(u-u**3+.5*u**4);rate=ease(u);}
  else if(q>=2.5&&q<6.5){const u=(q-2.5)/4;lag=1.95*(1-ease(u));rate=1+1.95*(6*u-6*u*u)/4;}
  const amount=ease((q-.3)/.7)*(1-ease((q-2.4)/2));
  const pulse=(start,duration)=>{const u=(q-start)/duration;return u>0&&u<1?Math.sin(u*Math.PI):0;};
  return {lag:lag*tempo,amount,glitch:pulse(.84,.18)+pulse(1.75,.14),stop:1-clamp(rate),palette:slot%3};
}

// Parallel depth lanes with fixed per-person spacing avoid people walking
// through each other. Phase/height/clothing differ without identifying users.
export function sampleNicknameCrowd(seconds,width,height,enableSignals=true) {
  const compact=width<600,rows=compact?4:5,columns=compact?5:7;
  const placements=[],movements=[],looks=[],signals=[],actors=[];
  const base=Math.max(13,Math.min(22,height*.018));
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const id=row*columns+column,seed=id+row*13;
    const depth=(row+.22+noise(seed+3)*.35)/rows;
    const scale=(base+depth*Math.min(27,height*.024))*(.87+noise(seed+7)*.22);
    const direction=row%2 ? -1 : 1;
    const rowDepth=(row+.4)/rows;
    const overscan=(base+rowDepth*Math.min(27,height*.024))*2.8;
    const span=width+overscan*2;
    const speed=(7+rowDepth*10)*(compact ? .75 : 1);
    const spacing=(column+row*.37+(noise(seed)-.5)*.24)/columns;
    const fieldHeight=Math.min(300,height*.34);
    const y=fieldHeight*(.25+depth*.76)+(noise(seed+11)-.5)*fieldHeight*.08;
    const cadence=2.3+noise(seed+5)*1.2;
    actors.push({id,seed,depth,scale,direction,span,speed,spacing,overscan,y,cadence,columns});
  }
  const slot=Math.floor((seconds-2)/9),start=2+slot*9;
  let target=-1,best=Infinity;
  // Select once per slot from figures already onscreen, not from their moving
  // positions each frame: the reception must stay attached to the same person.
  if(enableSignals&&slot>=0)for(const actor of actors){
    const x=fraction(actor.spacing+start*actor.speed/actor.span*actor.direction)*actor.span-actor.overscan;
    const rank=noise(actor.seed+slot*43+71);
    if(x>width*.18&&x<width*.82&&actor.depth<.65&&rank<best){target=actor.id;best=rank;}
  }
  for(const actor of actors){
    const {id,seed,depth,scale,direction,span,speed,spacing,overscan,y,cadence}=actor;
    const reception=id===target?receptionAt(seconds,actor,slot):null;
    const localTime=seconds-(reception?.lag||0);
    const progress=fraction(spacing+localTime*speed/span*direction);
    const x=progress*span-overscan;
    const phase=localTime*cadence+noise(seed+19)*Math.PI*2;
    const fade=Math.min(1,progress/.045,(1-progress)/.045);
    placements.push(x,y,scale,depth);
    movements.push(phase,direction,depth,speed*(Math.PI*2/cadence)*.62/scale);
    looks.push(.155+noise(seed+1)*.035,Math.floor(noise(seed+2)*3),noise(seed+23)>.7 ? .12 : 0,Math.max(0,fade));
    signals.push(reception?.amount||0,reception?.glitch||0,reception?.stop||0,reception?.palette||0);
  }
  const count=rows*columns;
  for(const data of [placements,movements,looks,signals])while(data.length<maxNicknamePeople*4)data.push(0);
  return {placements,movements,looks,signals,count};
}

function createCrowdRenderer(canvas) {
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,
    premultipliedAlpha:true,powerPreference:'low-power',failIfMajorPerformanceCaveat:true});
  if(!gl)return null;
  const program=gl.createProgram();
  for(const [type,source] of [[gl.VERTEX_SHADER,crowdVertexSource],[gl.FRAGMENT_SHADER,crowdFragmentSource]]){
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    gl.attachShader(program,shader);gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);return null;}
  gl.useProgram(program);gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  const uniform=Object.fromEntries(['viewportSize','placements[0]','movements[0]','looks[0]','signals[0]','formRect'].map(name=>[name,gl.getUniformLocation(program,name)]));
  gl.clearColor(0,0,0,0);
  return {
    draw(seconds,layout,enableSignals){
      const {width,height,dpr,rect}=layout,w=Math.round(width*dpr),h=Math.round(height*dpr);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
      const sample=sampleNicknameCrowd(seconds,width,height,enableSignals);
      gl.uniform2f(uniform.viewportSize,width,height);
      for(const name of ['placements','movements','looks','signals'])gl.uniform4fv(uniform[name+'[0]'],sample[name]);
      gl.uniform4f(uniform.formRect,...rect);gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArraysInstanced(gl.TRIANGLES,0,6,sample.count);
    },
    dispose(){gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}
  };
}

export function attachNicknameCrowd(canvas,screen,form,doc=document) {
  const view=doc.defaultView,motion=view.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer,frame,layout,disposed=false,failed=false,visible=true,elapsed=0,lastTime;
  const listeners=[];
  function on(target,event,fn){target.addEventListener(event,fn);listeners.push(()=>target.removeEventListener(event,fn));}
  function pause(){view.cancelAnimationFrame(frame);frame=undefined;lastTime=undefined;}
  function measure(){
    const bounds=canvas.getBoundingClientRect(),text=form.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return;
    layout={width:bounds.width,height:bounds.height,dpr:Math.min(view.devicePixelRatio||1,1.5,Math.sqrt(1200000/(bounds.width*bounds.height))),
      rect:[text.left-bounds.left-12,text.top-bounds.top-12,text.width+24,text.height+24]};
  }
  function queue(){if(!disposed&&!failed&&!doc.hidden&&visible&&!screen.hidden&&frame===undefined)frame=view.requestAnimationFrame(paint);}
  function paint(now){
    frame=undefined;if(disposed||failed||doc.hidden||!visible||screen.hidden)return;
    if(!layout)measure();if(!layout)return;
    if(!renderer){try{renderer=createCrowdRenderer(canvas);}catch{renderer=null;}if(!renderer){failed=true;canvas.hidden=true;return;}}
    if(lastTime!==undefined&&!motion.matches)elapsed+=Math.min(.05,(now-lastTime)/1000);
    lastTime=now;renderer.draw(elapsed,layout,!motion.matches);canvas.dataset.renderer='webgl2';
    if(!motion.matches)queue();else lastTime=undefined;
  }
  const resize=new view.ResizeObserver(()=>{measure();queue();});resize.observe(screen);resize.observe(form);
  const intersection=view.IntersectionObserver?new view.IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;if(!visible)pause();else queue();
  }):null;intersection?.observe(screen);
  function dispose(){
    if(disposed)return;disposed=true;pause();listeners.forEach(remove=>remove());resize.disconnect();intersection?.disconnect();
    renderer?.dispose();renderer=null;delete canvas.dataset.renderer;canvas.hidden=true;
  }
  on(doc,'viewerjoined',dispose);
  on(doc,'visibilitychange',()=>doc.hidden?pause():queue());
  on(view,'scroll',()=>{if(!screen.hidden){measure();queue();}});
  on(motion,'change',()=>{pause();queue();});
  on(canvas,'webglcontextlost',event=>{event.preventDefault();pause();failed=true;delete canvas.dataset.renderer;});
  on(canvas,'webglcontextrestored',()=>{failed=false;renderer=null;queue();});
  on(view,'pagehide',event=>event.persisted?pause():dispose());on(view,'pageshow',queue);
  if(screen.hidden)dispose();else queue();
  return dispose;
}
