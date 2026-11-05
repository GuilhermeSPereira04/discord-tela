import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleExpiredWalkers,attachExpiredWalkers,walkerProfiles,crowdActors,maxWalkerFeet } from '../public/expired-walkers.mjs';

test('responsive crowd retains finite joints, planted stance, bounded swing and opposite feet',()=>{
  for(const [w,h] of [[320,568],[390,844],[1440,900],[3840,2160]]){
    for(let t=0;t<60;t+=.037){
      const {poses,steps,legs,outfits,count}=sampleExpiredWalkers(t,w,h);
      for(const data of [poses,steps,legs,outfits])assert.equal(data.length,maxWalkerFeet*4);
      assert.equal(count,w<600?12:16);
      assert.ok([...poses,...steps,...legs,...outfits].every(Number.isFinite));
      for(let foot=0;foot<count;foot++){
        assert.ok(steps[foot*4]>=0&&steps[foot*4]<=1);
        assert.equal(steps[foot*4+2],foot%2?1:-1);
        assert.ok(steps[foot*4+3]>=0&&steps[foot*4+3]<=1);
      }
    }
    const depart=sampleExpiredWalkers(0,w,h).bodies[0].depart;
    const a=sampleExpiredWalkers(depart+.10,w,h),b=sampleExpiredWalkers(depart+.11,w,h);
    assert.ok(Math.hypot(a.poses[0]-b.poses[0],a.poses[1]-b.poses[1])<1e-8,'stance must cancel root travel');
  }
});

test('walkers have separate rhythms, clearances and support widths; knees move independently',()=>{
  for(const key of ['cycle','width','clearance','toeOut'])assert.equal(new Set(walkerProfiles.map(p=>p[key])).size,3);
  const a=sampleExpiredWalkers(.22,1440,900),b=sampleExpiredWalkers(.65,1440,900);
  assert.notDeepEqual(a.legs,b.legs);
  for(let t=0;t<4;t+=.01){
    const {poses,bodies}=sampleExpiredWalkers(t,1440,900);
    for(let person=0;person<bodies.length;person++){
      const first=person*8;
      assert.ok(Math.hypot(poses[first]-poses[first+4],poses[first+1]-poses[first+5])>poses[first+3]*.95,
        'left and right shoes must not collapse onto one path at passing');
    }
  }
});

test('couples retain shared speed and side-by-side spacing throughout their paths',()=>{
  for(const group of ['a','b']){
    let initial;
    for(let time=0;time<40;time+=.07){
      const pair=sampleExpiredWalkers(time,1440,900).bodies.filter(actor=>actor.group===group);
      assert.equal(pair.length,2);assert.equal(pair[0].speed,pair[1].speed);
      const separation=Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y);
      initial??=separation;assert.ok(Math.abs(initial-separation)<1e-7);
    }
  }
});

test('children are smaller, have independent running rhythms and include unsupported flight intervals',()=>{
  const children=crowdActors.map((actor,index)=>({actor,index})).filter(({actor})=>actor.kind==='child');
  assert.equal(children.length,2);
  for(const {actor,index} of children){
    assert.ok(actor.scale<.8);assert.ok(actor.profile.stance<.5);assert.ok(actor.profile.cycle<1.2);
    let flight=false;
    const depart=sampleExpiredWalkers(0,1440,900).bodies[index].depart;
    for(let time=0;time<actor.profile.cycle;time+=.01){
      const sample=sampleExpiredWalkers(depart+time,1440,900),first=index*8;
      if(sample.steps[first]>.05&&sample.steps[first+4]>.05)flight=true;
    }
    assert.ok(flight,'running needs a period with both feet elevated');
  }
  const phone=sampleExpiredWalkers(0,390,844);
  assert.equal(phone.bodies.filter(actor=>actor.kind==='child').length,2);
  assert.equal(phone.bodies.filter(actor=>actor.kind==='couple').length,2);
});

test('toe-off and next contact join planted stance with near-zero foot velocity',()=>{
  const p=walkerProfiles[0],eps=.00001;
  const depart=sampleExpiredWalkers(0,1440,900).bodies[0].depart;
  for(const time of [depart+p.cycle*p.stance,depart+p.cycle]){
    const a=sampleExpiredWalkers(time,1440,900),b=sampleExpiredWalkers(time+eps,1440,900);
    const speed=Math.hypot(b.poses[0]-a.poses[0],b.poses[1]-a.poses[1])/eps;
    assert.ok(speed<1,`contact velocity ${speed} should approach the planted stance`);
  }
});

function pointSegmentSquared(p,a,b){
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/Math.max(1e-12,dx*dx+dy*dy)));
  return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;
}
function segmentDistance(a,b,c,d){
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;
  return Math.sqrt(Math.min(pointSegmentSquared(a,c,d),pointSegmentSquared(b,c,d),pointSegmentSquared(c,a,b),pointSegmentSquared(d,a,b)));
}
function projectedCapsule(sample,foot,a,b,radius){
  const i=foot*4,[x,y,angle,scale]=sample.poses.slice(i,i+4),c=Math.cos(angle),s=Math.sin(angle);
  const project=p=>[x+(c*p[0]-s*p[1])*scale,y+(s*p[0]+c*p[1])*scale];
  return {a:project(a),b:project(b),r:radius*scale};
}
function visibleCapsule(c,w,h){
  return Math.max(c.a[0],c.b[0])+c.r>0&&Math.min(c.a[0],c.b[0])-c.r<w&&
    Math.max(c.a[1],c.b[1])+c.r>0&&Math.min(c.a[1],c.b[1])-c.r<h;
}

test('a complete repeating traffic cycle keeps soles away from other people and their lower legs',()=>{
  for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900],[3840,2160]]){
    const period=sampleExpiredWalkers(0,width,height).trafficPeriod;
    for(let time=0;time<period;time+=1/30){
      const sample=sampleExpiredWalkers(time,width,height),feet=[];
      for(let foot=0;foot<sample.count;foot++){
        if(sample.steps[foot*4+3]<.02)continue;
        const blur=.070+sample.outfits[foot*4+2]+sample.steps[foot*4]*.125;
        const sole=projectedCapsule(sample,foot,[0,-.62],[0,.50],.37+blur);
        if(!visibleCapsule(sole,width,height))continue;
        const knee=sample.legs.slice(foot*4,foot*4+2);
        feet.push({foot,sole,calf:projectedCapsule(sample,foot,[0,.64],knee,.60)});
      }
      for(let a=0;a<feet.length;a++)for(let b=a+1;b<feet.length;b++){
        const first=feet[a],second=feet[b];
        const samePerson=Math.floor(first.foot/2)===Math.floor(second.foot/2);
        const checks=samePerson ? [[first.sole,second.sole]] : [[first.sole,second.sole],[first.sole,second.calf],[second.sole,first.calf]];
        for(const [left,right] of checks){
          const distance=segmentDistance(left.a,left.b,right.a,right.b);
          assert.ok(distance>=left.r+right.r,
            `${width}x${height} at ${time.toFixed(3)}: feet ${first.foot}/${second.foot} need clear passage`);
        }
      }
    }
  }
});

function fixture({supported=true,reduced=false,width=1440,height=900}={}){
  const view=new EventTarget(),doc=new EventTarget(),motion=new EventTarget(),frames=new Map();
  let now=0,next=0,draws=0,contexts=0,deleted=0,measures=0;
  const instances=[],observers=[];
  const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,LINK_STATUS:3,TRIANGLES:4,BLEND:5,COLOR_BUFFER_BIT:6,
    createProgram:()=>({}),createShader:()=>({}),shaderSource(){},compileShader(){},attachShader(){},deleteShader(){},
    linkProgram(){},getProgramParameter:()=>true,useProgram(){},enable(){},blendFuncSeparate(){},
    getUniformLocation:(_,name)=>name,uniform2f(){},uniform4fv(){},uniform4f(){},viewport(){},clear(){},clearColor(){},
    drawArraysInstanced(...args){draws++;instances.push(args);},deleteProgram(){deleted++;},getExtension:()=>null};
  const canvas=new EventTarget();canvas.dataset={};canvas.hidden=false;
  canvas.getContext=()=>{contexts++;return supported?gl:null;};
  canvas.getBoundingClientRect=()=>{measures++;return {width,height,left:0,top:0};};
  const message={getBoundingClientRect:()=>({left:400,top:370,width:640,height:160})};
  class Observer{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
  motion.matches=reduced;
  Object.assign(view,{matchMedia:()=>motion,devicePixelRatio:3,ResizeObserver:Observer,IntersectionObserver:Observer,
    requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id)});
  Object.assign(doc,{defaultView:view,hidden:false});
  const dispose=attachExpiredWalkers(canvas,message,doc);
  const emit=(target,name,props={})=>target.dispatchEvent(Object.assign(new Event(name,{cancelable:true}),props));
  const flush=()=>{now+=16;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));};
  return {view,doc,motion,canvas,message,frames,observers,instances,dispose,emit,flush,
    get draws(){return draws;},get contexts(){return contexts;},get deleted(){return deleted;},get measures(){return measures;}};
}

test('one instanced draw animates the expanded crowd with bounded pixels and no layout reads per frame',()=>{
  const f=fixture();f.flush();assert.equal(f.contexts,1);assert.equal(f.draws,1);
  assert.deepEqual(f.instances[0],[4,0,6,16]);
  assert.ok(f.canvas.width*f.canvas.height<1503000);
  const measures=f.measures;f.flush();f.flush();assert.equal(f.measures,measures);
  f.dispose();assert.equal(f.frames.size,0);assert.equal(f.deleted,1);
});

test('reduced motion paints one static scene and unavailable WebGL leaves the message untouched',()=>{
  const f=fixture({reduced:true});f.flush();assert.equal(f.draws,1);assert.equal(f.frames.size,0);f.dispose();
  const missing=fixture({supported:false});missing.flush();assert.equal(missing.canvas.hidden,true);
  assert.equal(missing.frames.size,0);assert.equal(missing.message.getBoundingClientRect().width,640);missing.dispose();
});

test('phone renderer draws six people while keeping both children and the first couple',()=>{
  const f=fixture({width:390,height:844});f.flush();
  assert.deepEqual(f.instances[0],[4,0,6,12]);f.dispose();
});

test('hidden and offscreen pages stop work; context restoration and bfcache can resume',()=>{
  const f=fixture();f.flush();
  f.doc.hidden=true;f.emit(f.doc,'visibilitychange');assert.equal(f.frames.size,0);
  f.doc.hidden=false;f.emit(f.doc,'visibilitychange');f.flush();assert.equal(f.contexts,1);
  f.observers[1].fn([{isIntersecting:false}]);assert.equal(f.frames.size,0);
  f.observers[1].fn([{isIntersecting:true}]);f.flush();
  f.emit(f.canvas,'webglcontextlost');assert.equal(f.frames.size,0);
  f.emit(f.canvas,'webglcontextrestored');f.flush();assert.equal(f.contexts,2);
  f.emit(f.view,'pagehide',{persisted:true});assert.equal(f.frames.size,0);
  f.emit(f.view,'pageshow');f.flush();
  f.dispose();assert.ok(f.observers.every(o=>o.disconnected));
  f.emit(f.view,'pageshow');assert.equal(f.frames.size,0);
});
