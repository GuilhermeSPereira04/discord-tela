import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleNicknameCrowd,maxNicknamePeople,attachNicknameCrowd} from '../public/nickname-crowd.mjs';

test('crowd is deterministic, responsive and keeps neighboring figures separated in each moving lane',()=>{
  for(const [width,height] of [[320,568],[390,844],[1440,900]]){
    const columns=width<600?5:7;
    for(let t=0;t<240;t+=.37){
      const sample=sampleNicknameCrowd(t,width,height);
      assert.equal(sample.count,width<600?20:35);
      for(const key of ['placements','movements','looks','signals']){
        assert.equal(sample[key].length,maxNicknamePeople*4);assert.ok(sample[key].every(Number.isFinite));
      }
      for(let first=0;first<sample.count;first++)for(let second=first+1;second<sample.count;second++){
        if(Math.floor(first/columns)!==Math.floor(second/columns))continue;
        const a=sample.placements.slice(first*4,first*4+4),b=sample.placements.slice(second*4,second*4+4);
        assert.ok(Math.abs(a[0]-b[0])>(a[2]+b[2])*.92+2,'reserved gap must also cover the tiny glitch displacement');
      }
    }
  }
  assert.deepEqual(sampleNicknameCrowd(1,390,844),sampleNicknameCrowd(1,390,844));
});

test('receptions are occasional, attached to one person, stop their gait and return to the original lane',()=>{
  for(const [width,height] of [[320,568],[390,844],[1440,900]]){
    const palettes=new Set(),targets=new Map();let restingTime;
    for(let t=0;t<29;t+=.025){
      const sample=sampleNicknameCrowd(t,width,height),active=[];
      for(let i=0;i<sample.count;i++){
        const [amount,glitch,stop,palette]=sample.signals.slice(i*4,i*4+4);
        assert.ok([amount,glitch,stop].every(value=>value>=0&&value<=1));
        if(amount>0||glitch>0||stop>0)active.push(i);
        if(amount>.99)palettes.add(palette);
        if(stop===1&&restingTime===undefined)restingTime=t;
      }
      assert.ok(active.length<=1,'only one figure receives a signal at a time');
      if(active.length){
        const slot=Math.floor((t-2)/9);
        if(targets.has(slot))assert.equal(active[0],targets.get(slot),'a signal must stay on the same person');
        else targets.set(slot,active[0]);
        const id=active[0],base=sampleNicknameCrowd(t,width,height,false);
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
    for(const t of [0,8.9,17.9,26.9]){
      const sample=sampleNicknameCrowd(t,width,height),base=sampleNicknameCrowd(t,width,height,false);
      assert.deepEqual(sample.placements,base.placements);assert.deepEqual(sample.movements,base.movements);
      assert.ok(sample.signals.every((value,i)=>i%4===3||value===0),'color and glitch finish before the next event');
    }
    assert.ok(sampleNicknameCrowd(restingTime,width,height,false).signals.every(value=>value===0));
  }
});

function fixture({supported=true,reduced=false,hidden=false}={}){
  const doc=new EventTarget(),view=new EventTarget(),motion=new EventTarget(),frames=new Map(),observers=[];
  let now=0,id=0,draws=0,deleted=0,contexts=0,reads=0;
  const instances=[],uniforms={};
  const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,LINK_STATUS:3,TRIANGLES:4,BLEND:5,COLOR_BUFFER_BIT:6,
    createProgram:()=>({}),createShader:()=>({}),shaderSource(){},compileShader(){},attachShader(){},deleteShader(){},linkProgram(){},
    getProgramParameter:()=>true,useProgram(){},enable(){},blendFuncSeparate(){},getUniformLocation:(_,name)=>name,
    uniform2f(){},uniform4f(){},uniform4fv(name,values){uniforms[name]=[...values];},viewport(){},clearColor(){},clear(){},
    drawArraysInstanced(...args){draws++;instances.push(args);},deleteProgram(){deleted++;},getExtension:()=>null};
  const canvas=new EventTarget();canvas.dataset={};canvas.hidden=false;
  canvas.getContext=()=>{contexts++;return supported?gl:null;};
  canvas.getBoundingClientRect=()=>{reads++;return{width:1440,height:900,left:0,top:0};};
  const screen={hidden,getBoundingClientRect:()=>({width:1440,height:900,left:0,top:0})};
  const form={getBoundingClientRect:()=>({left:448,top:243,width:544,height:520})};
  class Observer{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
  motion.matches=reduced;
  Object.assign(view,{devicePixelRatio:3,matchMedia:()=>motion,ResizeObserver:Observer,IntersectionObserver:Observer,
    requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
  Object.assign(doc,{defaultView:view,hidden:false});
  const dispose=attachNicknameCrowd(canvas,screen,form,doc);
  const emit=(target,event,props={})=>target.dispatchEvent(Object.assign(new Event(event,{cancelable:true}),props));
  const flush=()=>{now+=16;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(now));};
  return{doc,view,motion,frames,canvas,screen,form,observers,instances,uniforms,emit,flush,dispose,
    get draws(){return draws;},get deleted(){return deleted;},get contexts(){return contexts;},get reads(){return reads;}};
}

test('one bounded instanced draw has no per-frame layout reads and joins release all background work',()=>{
  const f=fixture();f.flush();assert.deepEqual(f.instances[0],[4,0,6,35]);
  assert.ok(f.canvas.width*f.canvas.height<1203000);
  const reads=f.reads;f.flush();assert.equal(f.reads,reads);
  f.screen.hidden=true;f.emit(f.doc,'viewerjoined');
  assert.equal(f.frames.size,0);assert.equal(f.deleted,1);assert.equal(f.canvas.hidden,true);
  assert.ok(f.observers.every(o=>o.disconnected));
  f.emit(f.view,'pageshow');f.emit(f.doc,'visibilitychange');assert.equal(f.frames.size,0);
  f.dispose();assert.equal(f.deleted,1);
});

test('reduced motion paints once and skipped entry or unavailable WebGL leave the form usable',()=>{
  const f=fixture({reduced:true});f.flush();assert.equal(f.draws,1);assert.equal(f.frames.size,0);f.dispose();
  assert.ok(f.uniforms['signals[0]'].every(value=>value===0));
  const live=fixture();for(let i=0;i<200;i++)live.flush();
  assert.ok(live.uniforms['signals[0]'].some((value,i)=>i%4===0&&value>0));
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
