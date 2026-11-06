import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleNicknameCrowd,maxNicknamePeople,nicknameBatchSize,attachNicknameCrowd,sampleNicknamePose,nicknameWalkProfiles,nicknameCharacterTypes} from '../public/nickname-crowd.mjs';

test('crowd is deterministic, responsive and keeps neighboring figures separated in each moving lane',()=>{
  for(const [width,height] of [[320,568],[390,844],[1440,900]]){
    const columns=width<600?4:8;
    for(let t=0;t<240;t+=.37){
      const sample=sampleNicknameCrowd(t,width,height);
      assert.equal(sample.count,width<600?28:56);
      for(const key of ['placements','movements','looks','signals','feet','knees','steps','anatomy','characters']){
        assert.equal(sample[key].length,maxNicknamePeople*4);assert.ok(sample[key].every(Number.isFinite));
      }
      for(let first=0;first<sample.count;first++)for(let second=first+1;second<sample.count;second++){
        if(Math.floor(first/columns)!==Math.floor(second/columns))continue;
        const a=sample.placements.slice(first*4,first*4+4),b=sample.placements.slice(second*4,second*4+4);
        assert.ok(Math.abs(a[0]-b[0])>(a[2]+b[2])*.92+2,'reserved gap must cover the larger figures and displaced glitch strips');
      }
    }
  }
  assert.deepEqual(sampleNicknameCrowd(1,390,844),sampleNicknameCrowd(1,390,844));
});

test('upright foot support cancels root travel and joins swing without a velocity jump',()=>{
  for(let index=0;index<nicknameWalkProfiles.length;index++)for(const direction of [-1,1]){
    const profile=nicknameWalkProfiles[index],stride=.65;
    const speed=direction*stride/(profile.cycle*profile.stance);
    const poseAt=t=>sampleNicknamePose(t/profile.cycle*Math.PI*2,stride,direction,index);
    const worldX=t=>speed*t+poseAt(t).feet[0];
    assert.ok(Math.abs(worldX(.08)-worldX(.09))<1e-10,'a supported foot stays on the floor');
    assert.equal(poseAt(.08).feet[1],0);
    const eps=1e-6;
    for(const contact of [profile.cycle*profile.stance,profile.cycle]){
      for(const offset of [-eps,0]){
        const velocity=(worldX(contact+offset+eps)-worldX(contact+offset))/eps;
        assert.ok(Math.abs(velocity)<.001,'toe-off and landing join the planted foot smoothly');
      }
    }
    const swing=poseAt(profile.cycle*(profile.stance+(1-profile.stance)*.5));
    assert.ok(swing.feet[1]<-.09);
    assert.equal(swing.feet[3],.035,'the opposite foot supports the body during swing');
    assert.notDeepEqual(poseAt(.1).knees,poseAt(.5).knees);
  }
});

test('adult women, children and wardrobe silhouettes survive the compact layout',()=>{
  for(const [width,height] of [[390,844],[1440,900]]){
    const sample=sampleNicknameCrowd(0,width,height,false);
    const women=sample.people.filter(person=>person.presentation==='woman');
    const children=sample.people.filter(person=>person.kind==='child');
    assert.ok(women.length>=4&&children.length>=2);
    assert.ok(new Set(women.map(person=>person.type)).size>=3);
    for(const child of children){
      const type=nicknameCharacterTypes.find(type=>type.id===child.type);
      assert.ok(type.size<.8&&type.head>1.1&&type.legScale<.9);
    }
    const average=people=>people.reduce((sum,person)=>sum+person.cadence,0)/people.length;
    assert.ok(average(children)>average(sample.people.filter(person=>person.kind==='adult')));
  }
});

test('couples retain shared speed and separation through wrapping and glitch pauses, with individual strides',()=>{
  for(const [width,height] of [[390,844],[1440,900]]){
    const sample=sampleNicknameCrowd(0,width,height),groups=new Map();
    sample.people.forEach((person,index)=>{if(person.group){if(!groups.has(person.group))groups.set(person.group,[]);groups.get(person.group).push(index);}});
    assert.ok(groups.size>=2);
    for(const [group,members] of groups){
      assert.equal(members.length,2);
      const [a,b]=members;
      assert.equal(sample.people[a].speed,sample.people[b].speed);
      assert.notEqual(sample.movements[a*4],sample.movements[b*4]);
      const dx=sample.placements[a*4]-sample.placements[b*4],dy=sample.placements[a*4+1]-sample.placements[b*4+1];
      for(let time=0;time<120;time+=.19){
        const next=sampleNicknameCrowd(time,width,height);
        assert.ok(Math.abs(next.placements[a*4]-next.placements[b*4]-dx)<1e-8,group+' must keep its horizontal spacing');
        assert.ok(Math.abs(next.placements[a*4+1]-next.placements[b*4+1]-dy)<1e-8);
        assert.equal(next.signals[a*4+2],next.signals[b*4+2],'a reception pause cannot split the couple');
      }
    }
  }
});

test('weight transfer and different body proportions do not displace a planted world-space foot',()=>{
  const checkedTypes=new Set();
  for(const [width,height] of [[390,844],[1440,900]])for(let time=0;time<2;time+=.071){
    const a=sampleNicknameCrowd(time,width,height,false),b=sampleNicknameCrowd(time+.00001,width,height,false);
    for(let person=0;person<a.count;person++)for(let side=0;side<2;side++){
      const p=person*4,f=p+side*2;
      if(a.feet[f+1]!==b.feet[f+1]||Math.abs(a.placements[p]-b.placements[p])>width*.1)continue;
      const worldA=a.placements[p]+a.feet[f]*a.placements[p+2];
      const worldB=b.placements[p]+b.feet[f]*b.placements[p+2];
      assert.ok(Math.abs(worldA-worldB)<1e-7,a.people[person].type+' must retain floor contact');
      checkedTypes.add(a.people[person].type);
    }
  }
  assert.equal(checkedTypes.size,nicknameCharacterTypes.length);
});

test('hip, knee and ankle retain their bone lengths across sizes, directions and reception pauses',()=>{
  for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900],[3840,2160]]){
    for(let time=0;time<12;time+=.13){
      const sample=sampleNicknameCrowd(time,width,height);
      for(let person=0;person<sample.count;person++)for(let side=0;side<2;side++){
        const i=person*4+side*2,[kx,ky]=sample.knees.slice(i,i+2),[fx,fy]=sample.feet.slice(i,i+2);
        const build=sample.people[person];
        const hx=sample.characters[person*4+2]+(side?.055:-.055)*build.hips,hy=-.99+sample.steps[person*4+2]+(side?.035:0);
        assert.ok(Math.abs(Math.hypot(kx-hx,ky-hy)-.54*build.legScale)<1e-9,'thigh must not telescope');
        assert.ok(Math.abs(Math.hypot(kx-fx,ky-fy+.04)-.51*build.legScale)<1e-9,'calf must not telescope');
        const hinge=(kx-hx)*(fy-.04-hy)-(ky-hy)*(fx-hx);
        assert.ok(hinge*sample.movements[person*4+1]>-1e-9,'knees hinge toward the walking direction');
      }
    }
  }
  for(let profile=0;profile<nicknameWalkProfiles.length;profile++){
    assert.deepEqual(sampleNicknamePose(.3,.65,1,profile,0),sampleNicknamePose(5,.65,1,profile,0));
  }
});

test('receptions are occasional, attached to one person, stop their gait and return to the original lane',()=>{
  for(const [width,height] of [[320,568],[390,844],[1440,900]]){
    const palettes=new Set(),targets=new Map();let restingTime;
    for(let t=0;t<29;t+=.025){
      const sample=sampleNicknameCrowd(t,width,height),active=[],receivers=[];
      for(let i=0;i<sample.count;i++){
        const [amount,glitch,stop,palette]=sample.signals.slice(i*4,i*4+4);
        assert.ok([amount,glitch,stop].every(value=>value>=0&&value<=1));
        if(amount>0||glitch>0||stop>0)active.push(i);
        if(amount>0||glitch>0)receivers.push(i);
        if(amount>.99)palettes.add(palette);
        if(stop===1&&restingTime===undefined)restingTime=t;
      }
      assert.ok(receivers.length<=1,'only one figure changes pigment or glitches');
      assert.ok(active.length<=2,'a paused partner may share the root clock');
      if(active.length===2)assert.ok(sample.people[active[0]].group&&sample.people[active[0]].group===sample.people[active[1]].group);
      if(receivers.length){
        const slot=Math.floor((t-2)/9);
        if(targets.has(slot))assert.equal(receivers[0],targets.get(slot),'a signal must stay on the same person');
        else targets.set(slot,receivers[0]);
        const id=receivers[0],base=sampleNicknameCrowd(t,width,height,false);
        assert.ok(Math.abs(sample.placements[id*4]-base.placements[id*4])<width*.05,'pause has a bounded spatial lag');
      }
    }
    assert.deepEqual([...palettes].sort(),[0,1,2]);assert.ok(restingTime>2);
    const stopped=sampleNicknameCrowd(restingTime,width,height);
    // Find the same actor through its idle channel, then verify actual root and
    // gait clocks are stopped, rather than only changing the animation's look.
    const actor=(stopped.signals.findIndex((value,i)=>i%4===2&&value===1)-2)/4;
    const next=sampleNicknameCrowd(restingTime+.002,width,height);
    assert.ok(Math.abs(next.placements[actor*4]-stopped.placements[actor*4])<1e-8);
    assert.ok(Math.abs(next.movements[actor*4]-stopped.movements[actor*4])<1e-8);
    for(const key of ['feet','knees','steps'])assert.deepEqual(next[key].slice(actor*4,actor*4+4),stopped[key].slice(actor*4,actor*4+4));
    for(const t of [0,8.9,17.9,26.9]){
      const sample=sampleNicknameCrowd(t,width,height),base=sampleNicknameCrowd(t,width,height,false);
      assert.deepEqual(sample.placements,base.placements);assert.deepEqual(sample.movements,base.movements);
      assert.ok(sample.signals.every((value,i)=>i%4===3||value===0),'color and glitch finish before the next event');
    }
    assert.ok(sampleNicknameCrowd(restingTime,width,height,false).signals.every(value=>value===0));
  }
});

test('each glitch has three distinct readable bursts, with no continuous distortion between them',()=>{
  for(const [width,height] of [[320,568],[390,844],[1440,900]]){
    const bursts=[];let active=false;
    for(let time=2;time<5;time+=.005){
      const sample=sampleNicknameCrowd(time,width,height);
      const strength=Math.max(...sample.signals.filter((value,i)=>i%4===1));
      if(strength>0&&!active)bursts.push({start:time,end:time,peak:0});
      if(strength>0){const burst=bursts.at(-1);burst.end=time;burst.peak=Math.max(burst.peak,strength);}
      active=strength>0;
    }
    assert.equal(bursts.length,3);
    for(const burst of bursts){assert.ok(burst.end-burst.start>.15);assert.ok(burst.peak>.99);}
    assert.ok(bursts[1].start-bursts[0].end>.1);
    assert.ok(bursts[2].start-bursts[1].end>.1);
  }
});

function fixture({supported=true,reduced=false,hidden=false,width=1440,height=900}={}){
  const doc=new EventTarget(),view=new EventTarget(),motion=new EventTarget(),frames=new Map(),observers=[];
  let now=0,id=0,draws=0,deleted=0,contexts=0,reads=0;
  const instances=[],uniforms={},uploadSizes=[];let frameSignals=[];
  const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,LINK_STATUS:3,TRIANGLES:4,BLEND:5,COLOR_BUFFER_BIT:6,
    createProgram:()=>({}),createShader:()=>({}),shaderSource(){},compileShader(){},attachShader(){},deleteShader(){},linkProgram(){},
    getProgramParameter:()=>true,useProgram(){},enable(){},blendFuncSeparate(){},getUniformLocation:(_,name)=>name,
    uniform2f(){},uniform4f(){},uniform4fv(name,values){uniforms[name]=[...values];uploadSizes.push(values.length);},viewport(){},clearColor(){},clear(){},
    drawArraysInstanced(...args){draws++;instances.push(args);frameSignals.push(...uniforms['signals[0]'].slice(0,args[3]*4));},deleteProgram(){deleted++;},getExtension:()=>null};
  const canvas=new EventTarget();canvas.dataset={};canvas.hidden=false;
  canvas.getContext=()=>{contexts++;return supported?gl:null;};
  canvas.getBoundingClientRect=()=>{reads++;return{width,height,left:0,top:0};};
  const screen={hidden,getBoundingClientRect:()=>({width:1440,height:900,left:0,top:0})};
  const form={getBoundingClientRect:()=>({left:448,top:243,width:544,height:520})};
  class Observer{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
  motion.matches=reduced;
  Object.assign(view,{devicePixelRatio:3,matchMedia:()=>motion,ResizeObserver:Observer,IntersectionObserver:Observer,
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
  Object.assign(doc,{defaultView:view,hidden:false});
  const dispose=attachNicknameCrowd(canvas,screen,form,doc);
  const emit=(target,event,props={})=>target.dispatchEvent(Object.assign(new Event(event,{cancelable:true}),props));
  const flush=()=>{now+=16;frameSignals=[];const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));};
  return{doc,view,motion,frames,canvas,screen,form,observers,instances,uniforms,uploadSizes,emit,flush,dispose,
    get frameSignals(){return frameSignals;},
    get draws(){return draws;},get deleted(){return deleted;},get contexts(){return contexts;},get reads(){return reads;}};
}

test('bounded batches share one context, avoid per-frame layout reads and release all background work on join',()=>{
  const f=fixture();f.flush();assert.deepEqual(f.instances,[[4,0,6,28],[4,0,6,28]]);
  assert.equal(f.contexts,1);assert.ok(f.uploadSizes.every(size=>size<=nicknameBatchSize*4));
  assert.equal(f.frameSignals.length,maxNicknamePeople*4);
  for(const name of ['feet[0]','knees[0]','steps[0]']){
    assert.equal(f.uniforms[name].length,(maxNicknamePeople-nicknameBatchSize)*4);
    assert.ok(f.uniforms[name].every(Number.isFinite));
  }
  assert.ok(f.canvas.width*f.canvas.height<1203000);
  const reads=f.reads;f.flush();assert.equal(f.reads,reads);
  f.screen.hidden=true;f.emit(f.doc,'viewerjoined');
  assert.equal(f.frames.size,0);assert.equal(f.deleted,1);assert.equal(f.canvas.hidden,true);
  assert.ok(f.observers.every(o=>o.disconnected));
  f.emit(f.view,'pageshow');f.emit(f.doc,'visibilitychange');assert.equal(f.frames.size,0);
  f.dispose();assert.equal(f.deleted,1);
});

test('the expanded compact crowd still fits one bounded draw and one context',()=>{
  const f=fixture({width:390,height:844});f.flush();
  assert.deepEqual(f.instances,[[4,0,6,28]]);assert.equal(f.contexts,1);
  assert.ok(f.uploadSizes.every(size=>size<=nicknameBatchSize*4));
  f.dispose();
});

test('reduced motion paints once and skipped entry or unavailable WebGL leave the form usable',()=>{
  const f=fixture({reduced:true});f.flush();assert.equal(f.draws,2);assert.equal(f.frames.size,0);f.dispose();
  assert.ok(f.uniforms['signals[0]'].every(value=>value===0));
  const live=fixture();for(let i=0;i<200;i++)live.flush();
  assert.ok(live.frameSignals.some((value,i)=>i%4===0&&value>0));
  live.motion.matches=true;live.emit(live.motion,'change');live.flush();
  assert.ok(live.uniforms['signals[0]'].every(value=>value===0));assert.equal(live.frames.size,0);live.dispose();
  const skipped=fixture({hidden:true});skipped.flush();assert.equal(skipped.contexts,0);assert.equal(skipped.frames.size,0);
  const missing=fixture({supported:false});missing.flush();assert.equal(missing.canvas.hidden,true);
  assert.equal(missing.frames.size,0);assert.equal(missing.screen.hidden,false);missing.dispose();
});

test('visibility, offscreen state, keyboard scrolling and context restoration preserve bounded lifetime',()=>{
  const f=fixture();f.flush();
  f.doc.hidden=true;f.emit(f.doc,'visibilitychange');assert.equal(f.frames.size,0);
  f.doc.hidden=false;f.emit(f.doc,'visibilitychange');f.flush();assert.equal(f.contexts,1);
  f.observers[1].fn([{isIntersecting:false}]);assert.equal(f.frames.size,0);
  f.observers[1].fn([{isIntersecting:true}]);f.flush();
  const reads=f.reads;f.emit(f.view,'scroll');f.flush();assert.ok(f.reads>reads);
  f.emit(f.canvas,'webglcontextlost');assert.equal(f.frames.size,0);
  f.emit(f.canvas,'webglcontextrestored');f.flush();assert.equal(f.contexts,2);
  f.dispose();
});
