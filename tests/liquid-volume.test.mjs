import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceLiquidSpring, attachLiquidVolume } from '../public/liquid-volume.mjs';

function fixture({ supported=true, reduced=false }={}) {
  const frames=new Map(), media=new EventTarget(), view=new EventTarget(), doc=new EventTarget();
  let now=0,next=0,draws=0,contexts=0,deleted=0,reads=0;
  const uniforms={}; const resize=[],intersections=[];
  media.matches=reduced;
  const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,LINK_STATUS:3,TRIANGLES:4,
    createProgram:()=>({}),createShader:()=>({}),shaderSource(){},compileShader(){},attachShader(){},deleteShader(){},
    linkProgram(){},getProgramParameter:()=>true,useProgram(){},getUniformLocation:(_,name)=>name,
    uniform1f:(name,x)=>{uniforms[name]=x;},uniform2f(){},uniform4f(){},viewport(){},
    drawArrays(){draws++;},deleteProgram(){deleted++;},getExtension:()=>null};
  class Element extends EventTarget {
    constructor(rect) {super();this.rect=rect;this.dataset={};this.attrs={};this.hidden=false;
      const classes=new Set();this.classList={contains:name=>classes.has(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name)};}
    getBoundingClientRect(){reads++;return this.hidden?{width:0,height:0}:this.rect;}
    setAttribute(name,value){this.attrs[name]=value;}
    getAttribute(name){return this.attrs[name];}
    getContext(){contexts++;return supported?gl:null;}
    prepend(child){this.canvas=child;}
    remove(){this.removed=true;}
  }
  const panel=new Element({width:172,height:48,left:12,top:12});
  const range=new Element({width:112,height:48,left:60,top:12});
  const audio=new Element(); const input=new Element();input.value='1';input.attrs['aria-orientation']='horizontal';
  audio.querySelector=selector=>selector==='#volume-panel'?panel:range;
  Object.assign(view,{devicePixelRatio:3,matchMedia:()=>media,getComputedStyle:()=>({fontSize:'16px'}),
    requestAnimationFrame:callback=>{frames.set(++next,callback);return next;},cancelAnimationFrame:id=>frames.delete(id),
    ResizeObserver:class{constructor(fn){this.fn=fn;resize.push(this);}observe(){}disconnect(){this.disconnected=true;}},
    IntersectionObserver:class{constructor(fn){this.fn=fn;intersections.push(this);}observe(){}disconnect(){this.disconnected=true;}}
  });
  Object.assign(doc,{defaultView:view,hidden:false,documentElement:{},createElement:()=>new Element({width:196,height:72,left:0,top:0})});
  const skin=attachLiquidVolume(audio,input,doc);
  function emit(target,name,props={}){target.dispatchEvent(Object.assign(new Event(name,{cancelable:true}),props));}
  function flush(){now+=16;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(now));}
  function settle(){let count=0;while(frames.size && count++<200)flush();assert.equal(frames.size,0,'animation must settle without an idle loop');}
  function open(value=true){audio.classList.toggle('is-volume-open',value);emit(audio,'volumedisclosurechange');}
  return {skin,view,doc,media,panel,range,audio,input,frames,uniforms,resize,intersections,emit,flush,settle,open,
    get draws(){return draws;},get contexts(){return contexts;},get deleted(){return deleted;},get reads(){return reads;}};
}

test('liquid motion converges with bounded elapsed time and no frame-rate assumption',()=>{
  for(const dt of [1/120,1/60,1/30,2]){
    let state={value:0,velocity:0};
    for(let i=0;i<240;i++)state=advanceLiquidSpring(state.value,state.velocity,1,dt);
    assert.ok(Number.isFinite(state.value));assert.ok(Math.abs(state.value-1)<.0001);
  }
});

test('renderer is lazy, uses one context, settles and preserves immediate native value',()=>{
  const f=fixture();assert.equal(f.contexts,0);assert.equal(f.frames.size,0);
  f.open();f.flush();assert.equal(f.contexts,1);assert.equal(f.audio.dataset.volumeRenderer,'webgl2');
  assert.equal(f.panel.canvas.width,392,'render resolution is capped at DPR 2');
  const reads=f.reads;f.settle();assert.equal(f.reads,reads,'spring frames do not measure layout');
  f.input.value='.82';f.skin.update(.82,false);f.flush();
  assert.equal(f.uniforms.value,.82);assert.equal(f.input.value,'.82','renderer never writes gain/input');
  f.settle();f.open(false);f.settle();assert.equal(f.uniforms.reveal,0);
  f.open();f.settle();assert.equal(f.contexts,1);f.skin.dispose();
});

test('reduced motion and missing WebGL preserve the CSS skin and schedule no idle frames',()=>{
  for(const options of [{reduced:true},{supported:false}]){
    const f=fixture(options);f.open();f.flush();
    assert.equal(f.audio.dataset.volumeRenderer,undefined);assert.equal(f.panel.canvas.hidden,true);
    assert.equal(f.frames.size,0);f.skin.dispose();
  }
});

test('visibility, intersection and motion changes pause or resume without leaving a hidden canvas measured',()=>{
  const f=fixture();f.open();f.flush();
  f.doc.hidden=true;f.emit(f.doc,'visibilitychange');assert.equal(f.frames.size,0);
  f.doc.hidden=false;f.emit(f.doc,'visibilitychange');f.settle();
  f.media.matches=true;f.emit(f.media,'change');assert.equal(f.panel.canvas.hidden,true);
  f.media.matches=false;f.emit(f.media,'change');f.settle();assert.equal(f.panel.canvas.hidden,false);
  f.intersections[0].fn([{isIntersecting:false}]);f.skin.update(.4,false);assert.equal(f.frames.size,0);
  f.intersections[0].fn([{isIntersecting:true}]);f.settle();assert.equal(f.uniforms.value,.4);
  f.skin.dispose();
});

test('mode changes update shader orientation; context loss falls back and restoration recreates resources',()=>{
  const f=fixture();f.open();f.settle();
  f.input.attrs['aria-orientation']='vertical';f.open();f.settle();assert.equal(f.uniforms.vertical,1);
  f.emit(f.panel.canvas,'webglcontextlost');assert.equal(f.audio.dataset.volumeRenderer,undefined);
  assert.equal(f.frames.size,0);f.emit(f.panel.canvas,'webglcontextrestored');f.settle();assert.equal(f.contexts,2);
  f.skin.dispose();assert.equal(f.panel.canvas.removed,true);assert.equal(f.resize[0].disconnected,true);
  assert.equal(f.intersections[0].disconnected,true);assert.equal(f.deleted,1);
  f.open();assert.equal(f.frames.size,0);
});
