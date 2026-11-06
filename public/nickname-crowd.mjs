// Complement to the under-glass feet: small standing figures on a bright plaza.
// Bounded instanced quads, analytic soft focus and HTML controls in front.
export const maxNicknamePeople=56;
export const nicknameBatchSize=28;
export const crowdVertexSource = `#version 300 es
uniform vec2 viewportSize;
uniform vec4 placements[28];
uniform vec4 movements[28];
uniform vec4 looks[28];
uniform vec4 signals[28];
uniform vec4 feet[28];
uniform vec4 knees[28];
uniform vec4 steps[28];
uniform vec4 anatomy[28];
uniform vec4 characters[28];
out vec2 point;
out vec2 world;
flat out vec4 movement;
flat out vec4 look;
flat out vec4 signal;
flat out vec4 footData;
flat out vec4 kneeData;
flat out vec4 stepData;
flat out vec4 build;
flat out vec4 character;
void main() {
  const vec2 vertices[6]=vec2[6](vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));
  vec4 placement=placements[gl_InstanceID];
  movement=movements[gl_InstanceID];look=looks[gl_InstanceID];
  signal=signals[gl_InstanceID];
  footData=feet[gl_InstanceID];kneeData=knees[gl_InstanceID];stepData=steps[gl_InstanceID];
  build=anatomy[gl_InstanceID];character=characters[gl_InstanceID];
  point=vertices[gl_VertexID]*vec2(.92,1.45)+vec2(0,-1.0);
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
flat in vec4 footData;
flat in vec4 kneeData;
flat in vec4 stepData;
flat in vec4 build;
flat in vec4 character;
uniform vec4 formRect;
out vec4 color;
float segment(vec2 p,vec2 a,vec2 b,float radius) {
  vec2 v=b-a;float t=clamp(dot(p-a,v)/max(dot(v,v),.001),0.0,1.0);
  return length(p-a-v*t)-radius;
}
float oval(vec2 p,vec2 size) {return (length(p/size)-1.0)*min(size.x,size.y);}
float cover(float d,float blur) {return 1.0-smoothstep(-blur,blur,d);}
float tapered(vec2 p,vec2 a,vec2 b,float ra,float rb) {
  vec2 axis=b-a;float t=clamp(dot(p-a,axis)/max(dot(axis,axis),.001),0.0,1.0);
  return length(p-mix(a,b,t))-mix(ra,rb,t);
}
float shoeAt(vec2 p,vec2 foot,float roll,float dir) {
  vec2 q=p-foot-vec2(dir*.045,.022);
  float angle=-dir*roll*.42,c=cos(angle),s=sin(angle);
  q=mat2(c,-s,s,c)*q;
  return oval(q,vec2(.125,.047));
}
void main() {
  float phase=movement.x,dir=movement.y,depth=movement.z;
  // Test a brief spatial interruption, without flashing the whole silhouette.
  vec2 p=point;
  float slice=cover(abs(p.y+1.32)-.09,.018)-cover(abs(p.y+.64)-.065,.018)
    +cover(abs(p.y+1.87)-.045,.014)*.65;
  p.x+=slice*signal.y*.24;
  float walking=1.0-signal.z;
  float bob=stepData.z;
  float child=step(2.5,build.w),torso=mix(1.0,.88,child);
  float lean=character.w;
  vec2 hip=vec2(character.z,-.99+bob),shoulder=hip+vec2(lean,-.52*torso);
  vec2 head=shoulder+vec2(dir*.035,-.33*build.z);
  // Keep the nearest figures articulated; depth still softens distant rows.
  float focus=.018+pow(abs(depth-.44),1.25)*.09;
  float blur=max(focus,fwidth(point.y)*.7);

  vec2 footA=footData.xy,footB=footData.zw;
  vec2 kneeA=kneeData.xy,kneeB=kneeData.zw;
  float armSwing=(-(footA.x-footB.x)*.32+sin(phase-.25)*.012)*walking*character.y;
  vec2 shoulderA=shoulder+vec2(-.17*build.x,.02),shoulderB=shoulder+vec2(.17*build.x,.02);
  vec2 elbowA=shoulderA+vec2(-.045+armSwing*.45,.23*torso);
  vec2 elbowB=shoulderB+vec2(.045-armSwing*.45,.23*torso);
  vec2 handA=shoulderA+vec2(-.035+armSwing,.46*torso);
  vec2 handB=shoulderB+vec2(.035-armSwing,.46*torso);

  // Back limbs, jacket, head and front limbs receive separate soft coverage.
  float backLeg=min(tapered(p,hip+vec2(.055*build.y,.035),kneeB,.069,.055),tapered(p,kneeB,footB-vec2(0,.04),.051,.034));
  float frontLeg=min(tapered(p,hip-vec2(.055*build.y,0),kneeA,.073,.058),tapered(p,kneeA,footA-vec2(0,.04),.054,.036));
  float backArm=min(tapered(p,shoulderB,elbowB,.058,.045),tapered(p,elbowB,handB,.045,.031));
  float frontArm=min(tapered(p,shoulderA,elbowA,.060,.047),tapered(p,elbowA,handA,.047,.033));
  float arms=min(backArm,frontArm);
  float jacket=min(tapered(p,hip+vec2(0,look.z*.5),shoulder,look.x*.66*build.y,look.x*build.x),
    segment(p,shoulder-vec2(.11*build.x,0),shoulder+vec2(.11*build.x,0),.082));
  jacket=min(jacket,oval(p-hip-vec2(0,.015),vec2(.14*build.y,.095)));
  if(build.w>.5&&build.w<2.5){
    float skirt=build.w>1.5?1.0:0.0;
    jacket=min(jacket,tapered(p,hip-vec2(0,.14),hip+vec2(dir*.025,.22+skirt*.09),.12*build.y,.16+skirt*.085));
  }
  float neck=segment(p,shoulder-vec2(0,.02),head+vec2(0,.11*build.z),.039);
  float skull=min(oval((p-head)/build.z,vec2(.103,.134)),oval((p-head)/build.z-vec2(dir*.099,.013),vec2(.030,.025)))*build.z;
  float hair=oval((p-head)/build.z-vec2(-dir*.015,-.073),vec2(.105,.075))*build.z;
  if(character.x>.5&&character.x<1.5){
    hair=min(hair,oval((p-head)/build.z-vec2(-dir*.045,-.01),vec2(.105,.145))*build.z);
    skull=min(skull,hair);
  } else if(character.x>1.5&&character.x<2.5){
    hair=min(hair,segment(p,head+vec2(-dir*.09,-.05),head+vec2(-dir*.20,.11+sin(phase-.3)*.015*walking),.052));
    skull=min(skull,hair);
  } else if(character.x>2.5){
    hair=min(hair,length(p-head-vec2(-dir*.045,-.15))-.056);
    skull=min(skull,hair);
  }
  float hands=min(length(p-handA)-.039,length(p-handB)-.037);
  float shoes=min(shoeAt(p,footA,stepData.x,dir),shoeAt(p,footB,stepData.y,dir));
  float headMask=cover(skull,blur*.80),body=cover(jacket,blur);
  float legs=max(cover(backLeg,blur),cover(frontLeg,blur));
  float limbs=max(max(cover(arms,blur),cover(neck,blur)),cover(hands,blur));
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
  rgb-=cover(backLeg,blur)*.025;
  rgb=mix(rgb,vec3(.66,.64,.59),headMask);
  rgb=mix(rgb,vec3(.36,.40,.38),cover(hair,blur)*.92);
  rgb=mix(rgb,vec3(.42,.47,.46),shoeMask);
  // Tint only the displaced strips: a stronger local interruption, not a flash
  // over the page or a second full-silhouette rendering pass.
  rgb=mix(rgb,mix(tint,vec3(.18,.55,.60),.25),abs(slice)*signal.y*.55);

  // Low oblique contact shadows and depth haze keep the crowd on one plane.
  float shadow=exp(-pow((point.x-dir*.12)/.40,2.0)-pow((point.y-.08)/.11,2.0))*.12;
  float alpha=max(silhouette*mix(.38,.72,1.0-abs(depth-.44)),shadow);
  float edge=min(.92-abs(point.x),min(point.y+2.45,.45-point.y));
  alpha*=smoothstep(0.0,.12,edge)*look.w;
  vec2 center=formRect.xy+formRect.zw*.5;
  vec2 outside=abs(world-center)-formRect.zw*.5;
  float distanceToForm=length(max(outside,0.0))+min(max(outside.x,outside.y),0.0);
  alpha*=smoothstep(-4.0,72.0,distanceToForm);
  if(alpha<.002)discard;
  color=vec4(rgb,alpha);
}`;

const fraction=value=>value-Math.floor(value);
const noise=seed=>fraction(Math.sin(seed*127.1+31.7)*43758.5453);
const clamp=value=>Math.max(0,Math.min(1,value));
const ease=value=>{const t=clamp(value);return t*t*(3-2*t);};

// Adapt the expired-link support/swing profiles to upright, small silhouettes.
// The upper body stays rigid; only the foot arc and hinged knee articulate.
export const nicknameWalkProfiles=Object.freeze([
  Object.freeze({cycle:1.72,stance:.60,clearance:.14}),
  Object.freeze({cycle:1.96,stance:.66,clearance:.10}),
  Object.freeze({cycle:1.48,stance:.58,clearance:.17}),
  Object.freeze({cycle:1.14,stance:.64,clearance:.12}),
  Object.freeze({cycle:.98,stance:.56,clearance:.19}),
]);
export const nicknameCharacterTypes=Object.freeze([
  {id:'jacket',presentation:'man',kind:'adult',size:1,shoulders:1,hips:1,head:1,style:0,hair:0,arms:.90,legScale:1,sway:.50},
  {id:'ponytail-coat',presentation:'woman',kind:'adult',size:.97,shoulders:.91,hips:1.04,head:1,style:1,hair:2,arms:.86,legScale:1,sway:.55},
  {id:'bob-skirt',presentation:'woman',kind:'adult',size:.95,shoulders:.90,hips:1.08,head:1.02,style:2,hair:1,arms:.82,legScale:.98,sway:.55},
  {id:'broad-jacket',presentation:'man',kind:'adult',size:1.04,shoulders:1.16,hips:1.10,head:1.02,style:0,hair:0,arms:.76,legScale:1.02,sway:.45},
  {id:'bun-trousers',presentation:'woman',kind:'adult',size:1,shoulders:.93,hips:1,head:.99,style:0,hair:3,arms:.94,legScale:1,sway:.50},
  {id:'child-jacket',presentation:'child',kind:'child',size:.66,shoulders:.88,hips:1.07,head:1.23,style:3,hair:0,arms:1.23,legScale:.84,sway:.85},
  {id:'child-bob',presentation:'child',kind:'child',size:.72,shoulders:.86,hips:1.05,head:1.19,style:3,hair:1,arms:1.14,legScale:.86,sway:.75},
].map(type=>Object.freeze(type)));

function kneeAt(hip,ankle,direction,legScale) {
  const thighLength=.54*legScale,calfLength=.51*legScale;
  const dx=ankle[0]-hip[0],dy=ankle[1]-hip[1],distance=Math.max(.001,Math.hypot(dx,dy));
  const reach=Math.min(distance,thighLength+calfLength-.0001);
  const along=(thighLength**2-calfLength**2+reach**2)/(2*reach);
  const bend=Math.sqrt(Math.max(0,thighLength**2-along**2));
  return [hip[0]+dx/distance*along+dy/distance*bend*direction,
    hip[1]+dy/distance*along-dx/distance*bend*direction];
}

export function sampleNicknamePose(phase,stride,direction,profileIndex=0,walking=1,build={}) {
  const profile=nicknameWalkProfiles[profileIndex];
  const legScale=build.legScale??1,hipWidth=build.hips??1;
  const hipX=walking&&build.sway?Math.sin(phase)*.025*walking*build.sway:0;
  const feet=[],knees=[],rolls=[];
  for(let side=0;side<2;side++){
    const step=fraction(phase/(Math.PI*2)+side*.5);
    const swing=Math.max(0,(step-profile.stance)/(1-profile.stance));
    const tangent=(1-profile.stance)/profile.stance;
    const travel=ease(swing)-tangent*swing*(1-swing)*(1-2*swing);
    const advance=step<profile.stance?stride*(.5-step/profile.stance):stride*(-.5+travel);
    const lift=Math.pow(Math.max(0,Math.sin(swing*Math.PI)),1.15)*profile.clearance*legScale;
    const roll=step<profile.stance
      ? -.18*(1-ease(step/.10))+.46*ease((step-profile.stance+.14)/.14)
      : .46-.64*ease(swing);
    const resting=(side?.105:-.105)*hipWidth;
    const foot=[resting+(direction*advance-resting)*walking,(side?.035:0)-lift*walking];
    feet.push(...foot);rolls.push(walking?roll*walking:0);
  }
  // Let the supporting leg extend almost fully instead of keeping every knee
  // permanently bent. Both reach constraints share one rigid pelvis height.
  const reach=1.05*legScale-.008;
  const hipY=Math.max(...[0,1].map(side=>{
    const dx=feet[side*2]-hipX-(side?.055:-.055)*hipWidth;
    return feet[side*2+1]-.04-(side?.035:0)-Math.sqrt(Math.max(.001,reach*reach-dx*dx));
  }))+.004*walking+(1-Math.cos(phase*2))*.009*walking*(build.sway??0);
  const bob=hipY+.99;
  for(let side=0;side<2;side++){
    const hip=[hipX+(side?.055:-.055)*hipWidth,hipY+(side?.035:0)],ankle=[feet[side*2],feet[side*2+1]-.04];
    knees.push(...kneeAt(hip,ankle,direction,legScale));
  }
  return {feet,knees,steps:[...rolls,bob,walking],hipX};
}

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
  return {lag:lag*tempo,amount,glitch:pulse(.78,.38)+pulse(1.42,.30)+pulse(2.02,.24),stop:1-clamp(rate),palette:slot%3};
}

// Reserve two cells for a couple. Its members share root travel, not the phase
// of their individual strides. Layout/wardrobe are cached between resizes.
let crowdLayout;
function nicknameActors(width,height) {
  if(crowdLayout?.width===width&&crowdLayout.height===height)return crowdLayout;
  const compact=width<600,rows=7,columns=compact?4:8;
  const actors=[];
  const base=Math.max(13,Math.min(22,height*.018))*1.25;
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    const id=row*columns+column,seed=id+row*13;
    const paired=row%3===1&&column%4<2,member=column%4;
    const pairStart=column-member;
    const anchor=paired?row*columns+pairStart+row*13:seed;
    const choices=[0,1,2,3,4,0,1,5,6,3];
    const type=nicknameCharacterTypes[paired?(row+pairStart+member*2)%5:choices[(column*3+row*7)%choices.length]];
    const group=paired?'pair-'+row+'-'+pairStart:null;
    const depth=(row+.22+noise(anchor+3)*.35)/rows;
    const scale=(base+depth*Math.min(27,height*.024)*1.25)*(.87+noise(seed+7)*.22)*type.size;
    const direction=row%2 ? -1 : 1;
    const rowDepth=(row+.4)/rows;
    const rowScale=base+rowDepth*Math.min(27,height*.024)*1.25;
    const overscan=rowScale*2.8;
    const span=width+overscan*2;
    const speed=(7+rowDepth*10)*(compact ? .75 : 1);
    const spacing=((paired?pairStart+.5:column)+row*.37+(noise(anchor)-.5)*.24)/columns;
    const xOffset=paired?(member-.5)*rowScale*2.36:0;
    const fieldHeight=Math.min(380,height*.44);
    const y=fieldHeight*(.25+depth*.76)+(noise(anchor+11)-.5)*fieldHeight*.08+(paired?(member-.5)*rowScale*.24:0);
    const profileIndex=type.kind==='child'?3+id%2:Math.floor(noise(seed+29)*3);
    const profile=nicknameWalkProfiles[profileIndex];
    // Small figures take quicker steps rather than stretching their leg bones
    // or sliding the planted foot to keep up with a lane's common speed.
    const cadence=Math.max(Math.PI*2/(profile.cycle*(.92+noise(seed+5)*.16)),speed*Math.PI*2*profile.stance/(scale*.70*type.legScale));
    actors.push({id,seed,depth,scale,direction,span,speed,spacing,overscan,y,cadence,columns,profileIndex,type,group,xOffset});
  }
  const people=actors.map(actor=>Object.freeze({id:actor.id,kind:actor.type.kind,presentation:actor.type.presentation,
    type:actor.type.id,group:actor.group,speed:actor.speed,cadence:actor.cadence,legScale:actor.type.legScale,hips:actor.type.hips}));
  crowdLayout={width,height,actors,people};return crowdLayout;
}

export function sampleNicknameCrowd(seconds,width,height,enableSignals=true) {
  const {actors,people}=nicknameActors(width,height);
  const placements=[],movements=[],looks=[],signals=[],feet=[],knees=[],steps=[],anatomy=[],characters=[];
  const slot=Math.floor((seconds-2)/9),start=2+slot*9;
  let target=-1,best=Infinity;
  // Select once per slot from figures already onscreen, not from their moving
  // positions each frame: the reception must stay attached to the same person.
  if(enableSignals&&slot>=0)for(const actor of actors){
    const x=fraction(actor.spacing+start*actor.speed/actor.span*actor.direction)*actor.span-actor.overscan+actor.xOffset;
    const rank=noise(actor.seed+slot*43+71);
    if(x>width*.18&&x<width*.82&&actor.depth<.65&&rank<best){target=actor.id;best=rank;}
  }
  const targetActor=actors[target],event=targetActor?receptionAt(seconds,targetActor,slot):null;
  for(const actor of actors){
    const {id,seed,depth,scale,direction,span,speed,spacing,overscan,y,cadence,profileIndex,type,group,xOffset}=actor;
    const reception=id===target||group&&group===targetActor?.group?event:null;
    const localTime=seconds-(reception?.lag||0);
    const progress=fraction(spacing+localTime*speed/span*direction);
    const x=progress*span-overscan+xOffset;
    const phase=localTime*cadence+noise(seed+19)*Math.PI*2;
    const fade=Math.min(1,progress/.045,(1-progress)/.045);
    placements.push(x,y,scale,depth);
    const stride=speed*(Math.PI*2/cadence)*nicknameWalkProfiles[profileIndex].stance/scale;
    movements.push(phase,direction,depth,stride);
    const walking=1-(reception?.stop||0);
    const pose=sampleNicknamePose(phase,stride,direction,profileIndex,walking,type);
    feet.push(...pose.feet);knees.push(...pose.knees);steps.push(...pose.steps);
    looks.push(.155+noise(seed+1)*.035,Math.floor(noise(seed+2)*3),noise(seed+23)>.7 ? .12 : 0,Math.max(0,fade));
    signals.push(id===target?event.amount:0,id===target?event.glitch:0,reception?.stop||0,event?.palette||0);
    anatomy.push(type.shoulders,type.hips,type.head,type.style);
    characters.push(type.hair,type.arms,pose.hipX,direction*.035+Math.sin(phase)*.014*walking*type.sway);
  }
  const count=actors.length;
  for(const data of [placements,movements,looks,signals,feet,knees,steps,anatomy,characters])while(data.length<maxNicknamePeople*4)data.push(0);
  return {placements,movements,looks,signals,feet,knees,steps,anatomy,characters,people,count};
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
  const uniform=Object.fromEntries(['viewportSize','placements[0]','movements[0]','looks[0]','signals[0]','feet[0]','knees[0]','steps[0]','anatomy[0]','characters[0]','formRect'].map(name=>[name,gl.getUniformLocation(program,name)]));
  gl.clearColor(0,0,0,0);
  return {
    draw(seconds,layout,enableSignals){
      const {width,height,dpr,rect}=layout,w=Math.round(width*dpr),h=Math.round(height*dpr);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
      const sample=sampleNicknameCrowd(seconds,width,height,enableSignals);
      gl.uniform2f(uniform.viewportSize,width,height);
      gl.uniform4f(uniform.formRect,...rect);gl.clear(gl.COLOR_BUFFER_BIT);
      // Keep each upload within WebGL2's minimum uniform capacity even as the
      // population grows. The second draw reuses the same context and program.
      for(let first=0;first<sample.count;first+=nicknameBatchSize){
        for(const name of ['placements','movements','looks','signals','feet','knees','steps','anatomy','characters']){
          gl.uniform4fv(uniform[name+'[0]'],sample[name].slice(first*4,(first+nicknameBatchSize)*4));
        }
        gl.drawArraysInstanced(gl.TRIANGLES,0,6,Math.min(nicknameBatchSize,sample.count-first));
      }
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
