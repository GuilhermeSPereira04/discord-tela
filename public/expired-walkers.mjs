// Prototype: soles close to frosted glass stay sharp while raised feet and
// lower legs dissolve with depth. One instanced draw; no model/video textures.
export const walkersVertexSource = `#version 300 es
uniform vec2 viewportSize;
uniform vec4 poses[16];
uniform vec4 steps[16];
uniform vec4 legs[16];
uniform vec4 outfits[16];
out vec2 local;
out vec2 world;
flat out vec4 stepData;
flat out vec4 legData;
flat out float person;
flat out vec4 outfit;
void main() {
  const vec2 corners[6] = vec2[6](vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));
  vec4 pose=poses[gl_InstanceID]; stepData=steps[gl_InstanceID];
  legData=legs[gl_InstanceID]; outfit=outfits[gl_InstanceID]; person=outfit.x;
  local=corners[gl_VertexID]*vec2(2.0,3.8)+vec2(0,1.8);
  float c=cos(pose.z),s=sin(pose.z);
  world=pose.xy+mat2(c,s,-s,c)*(local*pose.w);
  gl_Position=vec4(world/viewportSize*vec2(2,-2)+vec2(-1,1),0,1);
}`;

export const walkersFragmentSource = `#version 300 es
precision highp float;
in vec2 local;
in vec2 world;
flat in vec4 stepData;
flat in vec4 legData;
flat in float person;
flat in vec4 outfit;
uniform vec4 messageRect;
out vec4 color;

float ellipse(vec2 p,vec2 r) { return (length(p/r)-1.0)*min(r.x,r.y); }
float smin(float a,float b,float k) {
  float h=max(k-abs(a-b),0.0)/k; return min(a,b)-h*h*k*.25;
}
float segment(vec2 p,vec2 a,vec2 b,float radius) {
  vec2 pa=p-a,ba=b-a; return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0))-radius;
}
float sole(vec2 p,float side) {
  // Rounded forefoot, narrow heel, medial arch: an actual shoe silhouette,
  // rather than a pair of capsules used as footprint symbols.
  float toe=ellipse(p-vec2(-side*.035,-.42),vec2(.335,.57));
  float heel=ellipse(p-vec2(side*.025,.50),vec2(.225,.34));
  float bridge=segment(p,vec2(0,-.34),vec2(0,.45),.225);
  float foot=smin(smin(toe,bridge,.10),heel,.10);
  float arch=length(p-vec2(side*.48,.13))-.28;
  return max(foot,-arch);
}
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
vec3 legSegment(vec2 p,vec2 a,vec2 b,float startRadius,float endRadius) {
  vec2 axis=b-a;
  float t=clamp(dot(p-a,axis)/max(dot(axis,axis),.001),0.0,1.0);
  vec2 center=mix(a,b,t);
  float distanceToEdge=length(p-center)-mix(startRadius,endRadius,t);
  float across=dot(p-center,vec2(axis.y,-axis.x)/max(length(axis),.001));
  return vec3(distanceToEdge,t,across);
}
float weave(vec2 p,float frequency) {
  vec2 phase=vec2(p.x+p.y*.55,p.y-p.x*.25)*frequency;
  // Unresolved yarn averages out instead of shimmering on a moving shoe/leg.
  vec2 detail=1.0-smoothstep(vec2(.8),vec2(2.8),fwidth(phase));
  return dot(sin(phase)*detail,vec2(.5));
}
float treadHeight(vec2 p) {
  float h;
  if(person<.5) {
    // Sneaker: broad herringbone, flex grooves and a divided heel.
    float chevron=abs(fract(p.y*7.5+abs(p.x)*2.1)-.5);
    h=smoothstep(.12,.19,chevron);
    h*=smoothstep(.020,.045,abs(p.x));
  } else if(person<1.5) {
    // Walking shoe: separated rectangular rubber blocks.
    vec2 cell=abs(fract(p*vec2(7.0,6.4))-.5);
    h=(1.0-smoothstep(.32,.43,cell.x))*(1.0-smoothstep(.30,.42,cell.y));
  } else {
    // Trail sole: staggered chevrons, lateral lugs and a central channel.
    float chevron=abs(fract(p.y*5.8+abs(p.x)*3.0)-.5);
    h=smoothstep(.16,.24,chevron)*smoothstep(.035,.065,abs(p.x));
    h=max(h,smoothstep(.21,.27,abs(p.x))*(1.0-smoothstep(.20,.31,abs(fract(p.y*8.0)-.5))));
  }
  return h;
}
void main() {
  float lift=stepData.x,roll=stepData.y,side=stepData.z;
  vec2 p=local;
  // Toe-off foreshortens the sole and reveals a thin bevel at the heel.
  p.x/=1.0-lift*.12;
  p.y=(p.y+roll*.10)/(1.0-abs(roll)*.12-lift*.09);
  float d=sole(p,side);
  float pixel=max(fwidth(d),.007);
  float blur=.070+outfit.z+lift*.125;
  float shoe=1.0-smoothstep(-blur-pixel,blur+pixel,d);
  float contact=exp(-max(d,0.0)*17.0)*.14*(1.0-lift);

  // Joint positions are independent of the shoe. The knee bends and the hip
  // transfers weight; increasing defocus belongs to depth along each segment.
  float width=outfit.y<.5 ? .30 : outfit.y<1.5 ? .34 : .285;
  vec3 calf=legSegment(local,vec2(0,.64),legData.xy,width*.80,width);
  vec3 thigh=legSegment(local,legData.xy,legData.zw,width,width*1.38);
  float calfBlur=mix(.045,.23,calf.y)+lift*.035;
  float thighBlur=mix(.23,.49,thigh.y);
  float calfMask=1.0-smoothstep(-calfBlur,calfBlur,calf.x);
  float thighMask=1.0-smoothstep(-thighBlur,thighBlur,thigh.x);
  float legAlpha=max(calfMask*mix(.92,.62,calf.y),thighMask*mix(.62,.20,thigh.y));
  float atmosphere=exp(-max(min(calf.x,thigh.x),0.0)*max(min(calf.x,thigh.x),0.0)/.12)*.10;
  legAlpha=max(legAlpha,atmosphere);
  float along=calf.y*length(legData.xy-vec2(0,.64));
  vec2 clothUV=vec2(calf.z,along);
  float folds=sin(along*9.0+sin(along*5.0+person*4.2)*1.4+calf.z*12.0+side+roll*.8);
  folds*=exp(-along*.90)*.040;
  float denim=weave(clothUV,86.0)*.020*(1.0-calf.y)*(.5+.5*(1.0-lift));
  float seam=exp(-pow((calf.z-side*width*.7)*85.0,2.0))*.07;
  float cuff=exp(-pow((along-.17)*20.0,2.0))*.10;
  float roundness=1.0-smoothstep(0.0,width,abs(calf.z));
  vec3 cloth=outfit.y<.5 ? vec3(.055,.072,.095) : outfit.y<1.5 ? vec3(.075,.071,.066) : vec3(.063,.078,.065);
  cloth+=roundness*.07+denim+folds-seam-cuff;
  cloth=max(cloth,vec3(.025));

  // A height field makes tread catch light and casts local groove shading.
  // Fine rubber grain is filtered by footprint; raised soles lose contrast.
  float height=treadHeight(p);
  float e=.008;
  vec2 gradient=vec2(treadHeight(p+vec2(e,0))-treadHeight(p-vec2(e,0)),
                     treadHeight(p+vec2(0,e))-treadHeight(p-vec2(0,e)))/(2.0*e);
  vec3 normal=normalize(vec3(-gradient*.09,1.0));
  float lambert=max(dot(normal,normalize(vec3(-.5,-.65,1.0))),0.0);
  float edge=exp(-abs(d+.026)*95.0);
  float inner=1.0-smoothstep(-.09,-.035,d);
  float crisp=(1.0-lift*.90)*.48;
  float tread=(.018+height*.057+lambert*.047)*inner*crisp;
  float grain=weave(p,125.0)*.012*crisp;
  float wear=sin(p.y*20.0+p.x*9.0)*sin(p.x*19.0)*.008;
  vec3 rubber=vec3(.033,.036,.040)+tread+edge*.045+grain+wear;
  rubber+=exp(-abs(d+.06)*90.0)*abs(roll)*.09;
  vec3 rgb=mix(cloth,rubber,shoe);
  float alpha=max(legAlpha,max(contact,shoe*(1.0-lift*.10)));
  alpha*=1.0-smoothstep(1.55,1.98,abs(local.x));
  alpha*=1.0-smoothstep(4.9,5.55,local.y);

  // The peripheral routes already avoid the announcement. A soft, measured
  // exclusion protects its words at narrow sizes and during font reflow.
  vec2 center=messageRect.xy+messageRect.zw*.5;
  vec2 box=abs(world-center)-messageRect.zw*.5;
  float outside=length(max(box,0.0))+min(max(box.x,box.y),0.0);
  alpha*=smoothstep(-8.0,42.0,outside)*stepData.w;
  if(alpha<.002)discard;
  color=vec4(rgb,alpha);
}`;

const fract=value=>value-Math.floor(value);
const smooth=value=>value*value*(3-2*value);
const clamp=value=>Math.max(0,Math.min(1,value));

// Personal rhythm, support width, clearance and toe-out. Left/right retain
// complementary phases; differences belong to the whole body's walk.
export const walkerProfiles=Object.freeze([
  Object.freeze({cycle:1.72,stance:.60,stride:2.28,width:.62,clearance:.94,toeOut:.10,phase:0,knee:.24}),
  Object.freeze({cycle:1.96,stance:.66,stride:1.88,width:.78,clearance:.64,toeOut:.055,phase:.17,knee:.16}),
  Object.freeze({cycle:1.48,stance:.58,stride:2.10,width:.55,clearance:1.0,toeOut:.14,phase:.34,knee:.32}),
]);

export const maxWalkerFeet=16;
const childRun=Object.freeze({cycle:.88,stance:.36,stride:2.85,width:.56,clearance:1,toeOut:.07,phase:.13,knee:.52});
const childLightRun=Object.freeze({cycle:1.06,stance:.40,stride:2.70,width:.63,clearance:.96,toeOut:.12,phase:.38,knee:.44});
// A couple shares a root trajectory/speed. Its members retain their own scale,
// foot timing and materials; there are no labels or new UI in the scene.
export const crowdActors=Object.freeze([
  {id:'adult-brisk',kind:'adult',lane:0,offset:.22,scale:1,profile:walkerProfiles[0],shoe:0,cloth:0},
  {id:'adult-calm',kind:'adult',lane:1,offset:.45,scale:.96,profile:walkerProfiles[1],shoe:1,cloth:1},
  {id:'pair-a-left',kind:'couple',group:'a',member:-1,lane:2,offset:.48,scale:1.04,profile:walkerProfiles[0],shoe:2,cloth:2},
  {id:'pair-a-right',kind:'couple',group:'a',member:1,lane:2,offset:.48,scale:.88,profile:walkerProfiles[1],shoe:0,cloth:0},
  {id:'child-run',kind:'child',lane:3,offset:.26,scale:.62,profile:childRun,shoe:0,cloth:2},
  {id:'child-light-run',kind:'child',lane:4,offset:.48,scale:.71,profile:childLightRun,shoe:1,cloth:0},
  {id:'pair-b-left',kind:'couple',group:'b',member:-1,lane:5,offset:.64,scale:1.03,profile:walkerProfiles[1],shoe:1,cloth:2},
  {id:'pair-b-right',kind:'couple',group:'b',member:1,lane:5,offset:.64,scale:.92,profile:walkerProfiles[2],shoe:2,cloth:1},
].map(actor=>Object.freeze(actor)));

const trafficCache=new Map();
const coupleHalfSpacing=1.6;

// Continuous collision test between translating, oriented walking envelopes.
// Their shape encloses the complete stride, lower legs and frosted silhouette;
// scheduling before entry keeps planted shoes from being pushed sideways.
function trafficOverlap(a,startA,b,startB) {
  let enter=Math.max(startA+a.enter,startB+b.enter);
  let exit=Math.min(startA+a.exit,startB+b.exit);
  if(enter>=exit)return false;
  const dx=a.x-a.vx*startA-b.x+b.vx*startB;
  const dy=a.y-a.vy*startA-b.y+b.vy*startB;
  const vx=a.vx-b.vx,vy=a.vy-b.vy;
  for(const [x,y] of [[a.ux,a.uy],[-a.uy,a.ux],[b.ux,b.uy],[-b.uy,b.ux]]){
    const radius=a.along*Math.abs(x*a.ux+y*a.uy)+a.across*Math.abs(-x*a.uy+y*a.ux)+
      b.along*Math.abs(x*b.ux+y*b.uy)+b.across*Math.abs(-x*b.uy+y*b.ux);
    const position=dx*x+dy*y,velocity=vx*x+vy*y;
    if(Math.abs(velocity)<1e-8){if(Math.abs(position)>=radius)return false;}
    else {
      const t1=(-radius-position)/velocity,t2=(radius-position)/velocity;
      enter=Math.max(enter,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2));
      if(enter>=exit)return false;
    }
  }
  return true;
}

function visibleInterval(box,width,height,duration) {
  let enter=0,exit=duration;
  for(const [position,velocity,extent,limit] of [
    [box.x,box.vx,Math.abs(box.ux)*box.along+Math.abs(box.uy)*box.across,width],
    [box.y,box.vy,Math.abs(box.uy)*box.along+Math.abs(box.ux)*box.across,height],
  ]){
    if(Math.abs(velocity)<1e-8){if(position+extent<0||position-extent>limit)return [0,0];}
    else {
      const t1=(-extent-position)/velocity,t2=(limit+extent-position)/velocity;
      enter=Math.max(enter,Math.min(t1,t2));exit=Math.min(exit,Math.max(t1,t2));
    }
  }
  return [enter,Math.max(enter,exit)];
}

function crowdTraffic(width,height,baseSize,lanes,actors) {
  const key=`${width}:${height}`;
  if(trafficCache.has(key))return trafficCache.get(key);
  const groups=[];
  for(const actor of actors){
    const lane=lanes[actor.lane],p=actor.profile,size=baseSize*actor.scale;
    const dx=lane.end[0]-lane.start[0],dy=lane.end[1]-lane.start[1],length=Math.hypot(dx,dy);
    const ux=dx/length,uy=dy/length;
    const speed=actor.group ? baseSize*2.05/(1.82*.63) : size*p.stride/(p.cycle*p.stance);
    const stride=speed*p.cycle*p.stance;
    const ahead=stride*.55+size*1.16;
    const behind=Math.max(ahead,size*(actor.kind==='child'?2.85:3.45));
    const shift=(ahead-behind)*.5;
    const lateral=(actor.member||0)*baseSize*coupleHalfSpacing;
    const box={x:lane.start[0]+ux*shift-uy*lateral,y:lane.start[1]+uy*shift+ux*lateral,
      ux,uy,vx:ux*speed,vy:uy*speed,along:(ahead+behind)*.5,across:size*(p.width+.72)+8};
    const duration=length/speed;
    [box.enter,box.exit]=visibleInterval(box,width,height,duration);
    const id=actor.group||actor.id;
    let group=groups.find(item=>item.id===id);
    if(!group){group={id,duration,offset:actor.offset,boxes:[]};groups.push(group);}
    group.boxes.push(box);
  }
  // Larger groups reserve first. Remaining traffic waits beyond the viewport,
  // keeping the original velocities and gait instead of stopping mid-step.
  const order=[...groups].sort((a,b)=>b.boxes.length-a.boxes.length);
  function conflicts(group,depart,other,period){
    for(const shift of [-period,0,period])for(const a of group.boxes)for(const b of other.boxes)
      if(trafficOverlap(a,depart,b,other.depart+shift))return true;
    return false;
  }
  let period=Math.max(...groups.map(group=>group.duration+1)),placed;
  for(let attempt=0;attempt<20;attempt++,period+=2){
    placed=[];
    for(const group of order){
      const preferred=fract(1-group.duration*group.offset/period)*period;
      let chosen;
      for(let tick=0;tick<=Math.ceil(period*4);tick++){
        const delta=(tick%2?1:-1)*Math.ceil(tick/2)*.5;
        const depart=fract((preferred+delta)/period)*period;
        if(placed.every(other=>!conflicts(group,depart,other,period))){chosen=depart;break;}
      }
      if(chosen===undefined)break;
      placed.push({...group,depart:chosen});
    }
    if(placed.length===groups.length)break;
  }
  if(placed.length!==groups.length){
    // Guaranteed bounded fallback for exceptionally cramped/aspect-ratio cases.
    let depart=0;placed=order.map(group=>{const item={...group,depart};depart+=group.duration+1;return item;});
    period=depart+1;
  }
  // Reuse safe gaps for quicker walkers, so avoiding a crossing does not empty
  // the scene for the duration of the slowest route. Never duplicate a person
  // while their previous pass is still travelling.
  const firstPasses=[...placed];
  for(let repeat=0;repeat<2;repeat++)for(const group of firstPasses){
    if(period<group.duration*2+1)continue;
    let chosen,spacing=0;
    for(let tick=0;tick<Math.ceil(period*2);tick++){
      const depart=tick*.5;
      const same=placed.filter(other=>other.id===group.id);
      const gap=Math.min(...same.map(other=>Math.min(fract((depart-other.depart)/period)*period,fract((other.depart-depart)/period)*period)));
      if(gap<group.duration+.75||gap<=spacing)continue;
      if(placed.every(other=>!conflicts(group,depart,other,period))){chosen=depart;spacing=gap;}
    }
    if(chosen!==undefined)placed.push({...group,depart:chosen});
  }
  const schedules=new Map();
  for(const group of placed){
    if(!schedules.has(group.id))schedules.set(group.id,{...group,departures:[]});
    schedules.get(group.id).departures.push(group.depart);
  }
  const result={period,groups:schedules};
  if(trafficCache.size>=8)trafficCache.delete(trafficCache.keys().next().value);
  trafficCache.set(key,result);return result;
}

// Stance cancels the root's forward travel: planted shoes stay on the glass.
// Only the swing travels back to the next contact; left/right are half a cycle apart.
export function sampleExpiredWalkers(seconds,width,height) {
  const baseSize=Math.max(28,Math.min(58,Math.min(width,height)*.065));
  const lanes=[
    {start:[-.22*width,.12*height],end:[1.3*width,.29*height]},
    {start:[(width<600?1.01:.87)*width,1.30*height],end:[(width<600?1.01:.87)*width,-.32*height]},
    {start:[-.30*width,.82*height],end:[1.32*width,1.12*height]},
    {start:[1.30*width,.08*height],end:[-.30*width,.35*height]},
    {start:[-.25*width,1.18*height],end:[.20*width,-.30*height]},
    {start:[-.20*width,-.25*height],end:[.17*width,1.30*height]},
  ];
  const poses=[],steps=[],legs=[],outfits=[],bodies=[];
  const actors=width<600 ? crowdActors.slice(0,6) : crowdActors;
  const traffic=crowdTraffic(width,height,baseSize,lanes,actors);
  actors.forEach((actor,index)=>{
    const profile=actor.profile,lane=lanes[actor.lane],size=baseSize*actor.scale;
    const child=actor.kind==='child';
    const dx=lane.end[0]-lane.start[0],dy=lane.end[1]-lane.start[1];
    const distance=Math.hypot(dx,dy),vx=dx/distance,vy=dy/distance;
    const speed=actor.group ? baseSize*2.05/(1.82*.63) : size*profile.stride/(profile.cycle*profile.stance);
    const stride=speed*profile.cycle*profile.stance;
    const reservation=traffic.groups.get(actor.group||actor.id);
    const localTime=Math.min(...reservation.departures.map(depart=>fract((seconds-depart)/traffic.period)*traffic.period));
    const depart=fract((seconds-localTime)/traffic.period)*traffic.period;
    const travelling=localTime<=reservation.duration;
    const t=travelling ? localTime/reservation.duration : 0;
    const groupAcross=(actor.member||0)*baseSize*coupleHalfSpacing;
    const root=[lane.start[0]+dx*t-vy*groupAcross,lane.start[1]+dy*t+vx*groupAcross];
    bodies.push({id:actor.id,kind:actor.kind,group:actor.group,x:root[0],y:root[1],speed,size,active:travelling,
      depart,duration:reservation.duration});
    const clock=localTime/profile.cycle+profile.phase;
    const transfer=Math.sin(clock*Math.PI*2)*size*(child ? .07 : .10);
    const pelvisRise=(1-Math.cos(clock*Math.PI*4))*size*(child ? .15 : .055);
    for(let foot=0;foot<2;foot++){
      const side=foot?1:-1;
      const phase=fract(clock+foot*.5);
      const swing=Math.max(0,(phase-profile.stance)/(1-profile.stance));
      const tangent=(1-profile.stance)/profile.stance;
      const swingTravel=smooth(swing)-tangent*swing*(1-swing)*(1-2*swing);
      const advance=phase<profile.stance ? stride*(.5-phase/profile.stance) : stride*(-.5+swingTravel);
      const lift=Math.pow(Math.max(0,Math.sin(swing*Math.PI)),1.15)*profile.clearance;
      const roll=phase<profile.stance
        ? -.28*(1-smooth(clamp(phase/.10)))+.58*smooth(clamp((phase-profile.stance+.14)/.14))
        : .58-.86*smooth(swing);
      // A lateral arc only occurs in swing. The planted foot stays fixed.
      const opening=side*size*profile.width+side*size*.16*Math.sin(swing*Math.PI)**2;
      const x=root[0]+vx*advance-vy*opening,y=root[1]+vy*advance+vx*opening;
      const angle=Math.atan2(vx,-vy)+side*profile.toeOut+side*lift*.10;
      const scale=size*(1-lift*.045);
      poses.push(x,y,angle,scale);
      const fade=travelling ? smooth(Math.min(1,t/.06))*smooth(Math.min(1,(1-t)/.10)) : 0;
      steps.push(lift,roll,side,fade);
      outfits.push(actor.shoe,actor.cloth,child ? .018 : .008+(index%3)*.007,Number(child));

      // Hip anchors follow body weight, not each foot. Knee advances and opens
      // during passing; both joints are converted into that shoe's local frame.
      const hipAcross=side*size*profile.width*.72+transfer;
      const hipBack=size*(child ? 2.25 : 2.85)+pelvisRise;
      const kneeAcross=side*size*(profile.width*.86+profile.knee*lift)+transfer*.45;
      const kneeBack=size*((child ? 1.14 : 1.35)-lift*(child ? .98 : .90));
      const kneeX=root[0]-vx*kneeBack-vy*kneeAcross;
      const kneeY=root[1]-vy*kneeBack+vx*kneeAcross;
      const hipX=root[0]-vx*hipBack-vy*hipAcross;
      const hipY=root[1]-vy*hipBack+vx*hipAcross;
      const c=Math.cos(angle),s=Math.sin(angle);
      for(const [jointX,jointY] of [[kneeX,kneeY],[hipX,hipY]]){
        const jx=jointX-x,jy=jointY-y;
        legs.push((c*jx+s*jy)/scale,(-s*jx+c*jy)/scale);
      }
    }
  });
  const count=actors.length*2;
  // Fixed uniform capacity stays within WebGL 2's minimum vertex budget. Only
  // populated feet are drawn, including the smaller crowd on narrow screens.
  for(const data of [poses,steps,legs,outfits])while(data.length<maxWalkerFeet*4)data.push(0);
  return {poses,steps,legs,outfits,count,bodies,trafficPeriod:traffic.period};
}

function createWalkersRenderer(canvas) {
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,
    premultipliedAlpha:true,powerPreference:'low-power',failIfMajorPerformanceCaveat:true});
  if(!gl)return null;
  const program=gl.createProgram();
  for(const [type,source] of [[gl.VERTEX_SHADER,walkersVertexSource],[gl.FRAGMENT_SHADER,walkersFragmentSource]]){
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    gl.attachShader(program,shader);gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);return null;}
  gl.useProgram(program);gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  const viewport=gl.getUniformLocation(program,'viewportSize');
  const poses=gl.getUniformLocation(program,'poses[0]'),steps=gl.getUniformLocation(program,'steps[0]');
  const legs=gl.getUniformLocation(program,'legs[0]');
  const outfits=gl.getUniformLocation(program,'outfits[0]');
  const message=gl.getUniformLocation(program,'messageRect');
  gl.clearColor(0,0,0,0);
  return {
    draw(time,layout) {
      const {width,height,dpr,rect}=layout;
      const w=Math.round(width*dpr),h=Math.round(height*dpr);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
      const sample=sampleExpiredWalkers(time,width,height);
      gl.uniform2f(viewport,width,height);gl.uniform4fv(poses,sample.poses);gl.uniform4fv(steps,sample.steps);
      gl.uniform4fv(legs,sample.legs);
      gl.uniform4fv(outfits,sample.outfits);
      gl.uniform4f(message,...rect);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArraysInstanced(gl.TRIANGLES,0,6,sample.count);
    },
    dispose(){gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}
  };
}

export function attachExpiredWalkers(canvas,message,doc=document) {
  const view=doc.defaultView,motion=view.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer,frame,layout,disposed=false,lost=false,visible=true,elapsed=0,lastTime;
  const listeners=[];
  function on(target,event,fn){target.addEventListener(event,fn);listeners.push(()=>target.removeEventListener(event,fn));}
  function pause(){view.cancelAnimationFrame(frame);frame=undefined;lastTime=undefined;}
  function measure(){
    const bounds=canvas.getBoundingClientRect(),text=message.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return;
    const width=bounds.width,height=bounds.height;
    layout={width,height,dpr:Math.min(view.devicePixelRatio||1,1.5,Math.sqrt(1500000/(width*height))),
      rect:[text.left-bounds.left-12,text.top-bounds.top-12,text.width+24,text.height+24]};
  }
  function queue(){if(!disposed&&!lost&&!doc.hidden&&visible&&frame===undefined)frame=view.requestAnimationFrame(paint);}
  function paint(now){
    frame=undefined;if(disposed||lost||doc.hidden||!visible)return;
    if(!layout)measure();if(!layout)return;
    if(!renderer){try{renderer=createWalkersRenderer(canvas);}catch{renderer=null;}if(!renderer){lost=true;canvas.hidden=true;return;}}
    if(lastTime!==undefined&&!motion.matches)elapsed+=Math.min(.05,(now-lastTime)/1000);
    lastTime=now;renderer.draw(elapsed,layout);canvas.dataset.renderer='webgl2';
    if(!motion.matches)queue();else lastTime=undefined;
  }
  const resize=new view.ResizeObserver(()=>{measure();queue();});resize.observe(canvas);resize.observe(message);
  const intersection=view.IntersectionObserver?new view.IntersectionObserver(entries=>{
    visible=entries[0].isIntersecting;if(!visible)pause();else queue();
  }):null;intersection?.observe(canvas);
  on(doc,'visibilitychange',()=>doc.hidden?pause():queue());
  on(motion,'change',()=>{pause();queue();});
  on(canvas,'webglcontextlost',event=>{event.preventDefault();pause();lost=true;delete canvas.dataset.renderer;});
  on(canvas,'webglcontextrestored',()=>{lost=false;renderer=null;queue();});
  function dispose(){disposed=true;pause();listeners.forEach(remove=>remove());resize.disconnect();intersection?.disconnect();renderer?.dispose();delete canvas.dataset.renderer;}
  on(view,'pagehide',event=>event.persisted?pause():dispose());on(view,'pageshow',queue);
  queue();return dispose;
}
