// Experiment: a shared overhead ocean, sampled once per ASCII cell rather than
// once per screen pixel. Material/edge glyph selection follows the MIT diorama
// study (JDhruv14/ascii-diorama); this scene and its swimming silhouettes are new.
// Water is an analytic current field, not a fluid/refraction simulation.
/*
MIT License — adapted ASCII atlas and material/gradient classification
Copyright (c) 2026 JDhruv14

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
const GLYPHS = " .'`,:;-~=+*oOsS$%&8#@/\\|_^v—";
const glyph = character => Number([...GLYPHS].indexOf(character)).toFixed(1);
// Test species through geometry and pigment, keeping one shared draw.
// kind: 0 white, 1 hammerhead, 2 tiger, 3 slender reef silhouette.
export const OCEAN_SHARKS = Object.freeze([
  { species: 'white', kind: 0, scale: 1.27, depth: 1, period: 40, start: .28, cadence: 2.3 },
  { species: 'hammerhead', kind: 1, scale: .94, depth: .94, period: 43, start: .50, cadence: 2.85 },
  { species: 'tiger', kind: 2, scale: 1.09, depth: .98, period: 51, start: .28, cadence: 2.55 },
  { species: 'reef', kind: 3, scale: .66, depth: .63, period: 34, start: .95, cadence: 3.4 },
  { species: 'white', kind: 0, scale: 1.03, depth: .76, period: 57, start: .055, cadence: 2.15 }
].map(profile => Object.freeze(profile)));
const vertex = `#version 300 es
out vec2 uv;
void main(){
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  uv=p; gl_Position=vec4(p*2.-1.,0.,1.);
}`;

export function oceanResolution(width, height, dpr = 1) {
  if (!(width > 0 && height > 0)) return { width: 1, height: 1, ratio: 1 };
  const ratio = Math.min(Math.max(dpr || 1, .5), 2, Math.sqrt(360000 / (width * height)), 2048 / width, 2048 / height);
  return { width: Math.max(1, Math.floor(width * ratio)), height: Math.max(1, Math.floor(height * ratio)), ratio };
}

export function oceanGrid(width, height) {
  const columns = Math.max(1, Math.ceil(width / 5)), rows = Math.max(1, Math.ceil(height / 8));
  const scale = Math.max(1, Math.sqrt(columns * rows / 16000), columns / 512, rows / 512);
  return { columns: Math.max(1, Math.floor(columns / scale)), rows: Math.max(1, Math.floor(rows / scale)) };
}

// Test the crossing in one world: card boundaries never reset a path or a tail.
// Wrap happens only after the entire animal has left the outside of that world.
export function oceanPath(seconds, index, width, height) {
  const profile = OCEAN_SHARKS[index];
  const vertical = height > width * .75;
  const length = vertical ? Math.min(145, width * .40) : Math.min(156, Math.max(108, width * .255));
  const extent = vertical ? height : width;
  const progress = ((seconds / profile.period + profile.start) % 1 + 1) % 1;
  const reverse = index === 1 || index === 2 || index === 3;
  const travel = (reverse ? 1 - progress : progress) * (extent + length * 2.4) - length * 1.2;
  const phase = progress * Math.PI * 2 + index * 1.9;
  const cross = vertical ? width * (.51 + .17 * Math.sin(phase)) : height * (.27 + .13 * Math.sin(phase));
  const speed = (extent + length * 2.4) / profile.period * (reverse ? -1 : 1);
  const crossSpeed = (vertical ? width * .17 : height * .13) * Math.cos(phase) * Math.PI * 2 / profile.period;
  return { x: vertical ? cross : travel, y: vertical ? travel : cross,
    angle: Math.atan2(vertical ? speed : crossSpeed, vertical ? crossSpeed : speed),
    length: length * profile.scale, depth: profile.depth, phase: index * 2.1,
    kind: profile.kind, cadence: profile.cadence };
}

const sceneFragment = `#version 300 es
precision highp float;
in vec2 uv; out vec4 color;
uniform vec2 world;
uniform float time;
uniform vec4 sharks[${OCEAN_SHARKS.length}]; // x, y, length, heading
uniform vec4 swimming[${OCEAN_SHARKS.length}]; // phase, visibility, cadence, species
uniform vec3 pointer;
uniform vec3 ripple; // x, y, age
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float triangle(vec2 p,vec2 a,vec2 b,vec2 c){
  vec2 e0=b-a,e1=c-b,e2=a-c,v0=p-a,v1=p-b,v2=p-c;
  vec2 q0=v0-e0*clamp(dot(v0,e0)/dot(e0,e0),0.,1.);
  vec2 q1=v1-e1*clamp(dot(v1,e1)/dot(e1,e1),0.,1.);
  vec2 q2=v2-e2*clamp(dot(v2,e2)/dot(e2,e2),0.,1.);
  float s=sign(e0.x*e2.y-e0.y*e2.x);
  vec2 d=min(min(vec2(dot(q0,q0),s*(v0.x*e0.y-v0.y*e0.x)),
                 vec2(dot(q1,q1),s*(v1.x*e1.y-v1.y*e1.x))),
                 vec2(dot(q2,q2),s*(v2.x*e2.y-v2.y*e2.x)));
  return -sqrt(d.x)*sign(d.y);
}
float segment(vec2 p,vec2 a,vec2 b,float r){
  vec2 pa=p-a,ba=b-a; return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.))-r;
}
float sharkShape(vec2 p,float kind){
  bool white=kind<.5, hammer=kind>.5&&kind<1.5, tiger=kind>1.5&&kind<2.5;
  float girth=white?.143:hammer?.082:tiger?.133:.097;
  float torso=hammer?.39:.44;
  float d=(length((p-vec2(.025,0))/vec2(torso,girth))-1.)*girth;
  if(hammer){
    // A transverse cephalofoil joined to the narrow torso, not extra fins.
    vec2 h=abs(p-vec2(.395,0))-vec2(.036,.245);
    d=min(d,length(max(h,0.))+min(max(h.x,h.y),0.)-.025);
  }else if(tiger){
    d=min(d,(length((p-vec2(.275,0))/vec2(.195,.103))-1.)*.103);
  }
  vec2 mirror=vec2(p.x,abs(p.y));
  float span=white?.325:hammer?.267:tiger?.283:.255;
  d=min(d,triangle(mirror,vec2(.16,.045),vec2(-.22,span),vec2(-.11,.055)));
  d=min(d,triangle(mirror,vec2(-.21,.045),vec2(-.38,.135),vec2(-.31,.023)));
  d=min(d,segment(p,vec2(-.30,0),vec2(-.55,0),.025));
  d=min(d,triangle(p,vec2(-.52,0),vec2(-.69,-.205),vec2(-.64,-.012)));
  d=min(d,triangle(p,vec2(-.52,0),vec2(-.68,white?.205:.15),vec2(-.625,.009)));
  return d;
}
void main(){
  vec2 p=vec2(uv.x,1.-uv.y)*world;
  vec2 q=p/145.;
  float n=noise(q*1.7+vec2(time*.024,-time*.017));
  float waves=sin(q.x*8.+q.y*6.+n*3.-time*.38);
  float crossing=sin(q.x*-5.+q.y*9.+n*2.+time*.24);
  float crest=pow(.5+.5*waves,15.)*.7+pow(.5+.5*crossing,19.)*.45;
  float slow=noise(q*.85+vec2(-time*.018,0.));
  vec3 sea=mix(vec3(.018,.052,.080),vec3(.055,.17,.205),slow);
  sea+=vec3(.10,.26,.29)*crest;
  // Interference lines suggest sunlit ripples without a caustics render pass.
  float lace=pow(1.-abs(sin(q.x*5.+q.y*3.+n*4.+time*.16)*sin(q.x*-3.+q.y*6.-n*3.-time*.12)),24.);
  sea+=vec3(.055,.12,.12)*lace;
  float pointerDistance=length(p-pointer.xy);
  sea+=vec3(.025,.08,.09)*sin(pointerDistance*.10-time*2.)*exp(-pointerDistance/90.)*pointer.z;
  float age=ripple.z;
  float ring=exp(-pow((length(p-ripple.xy)-age*82.)/12.,2.))*exp(-age*1.6)*step(0.,age);
  sea+=vec3(.12,.25,.25)*ring;
  float cls=9.;
  for(int i=0;i<${OCEAN_SHARKS.length};i++){
    vec4 animal=sharks[i];
    vec2 delta=(p-animal.xy)/animal.z;
    float ca=cos(animal.w),sa=sin(animal.w);
    vec2 local=vec2(dot(delta,vec2(ca,sa)),dot(delta,vec2(-sa,ca)));
    // A travelling lateral wave grows toward the tail; the nose stays steady.
    float tail=clamp((.40-local.x)/1.05,0.,1.);
    local.y-=sin(time*swimming[i].z+local.x*7.+swimming[i].x)*(.002+.046*tail*tail);
    float kind=swimming[i].w;
    float d=sharkShape(local,kind);
    float depth=swimming[i].y;
    float shadow=exp(-max(d,0.)*46.)*(1.-smoothstep(.008,.065,d));
    sea*=1.-shadow*.40*depth;
    float coverage=1.-smoothstep(-.008,.006,d);
    float spine=exp(-pow(local.y/(kind<.5?.087:.060),2.));
    vec3 skin=mix(vec3(.19,.34,.36),vec3(.53,.69,.67),spine*.72+.12);
    if(kind<.5){
      skin=mix(vec3(.27,.36,.40),vec3(.68,.76,.77),spine*.70+.14);
    }else if(kind<1.5){
      float head=1.-smoothstep(.025,.065,abs(local.x-.395));
      skin=mix(skin,vec3(.50,.66,.64),head*.65);
      float eyes=exp(-pow((local.x-.411)/.014,2.)-pow((abs(local.y)-.242)/.02,2.));
      skin*=1.-eyes*.75;
    }else if(kind<2.5){
      skin=mix(vec3(.25,.34,.30),vec3(.66,.71,.56),spine*.66+.21);
      // Broad irregular flank bars survive the cell grid and bend with the body.
      float bands=sin((local.x+.027*sin(local.y*26.))*45.+sin(local.x*17.)*.4);
      float bars=(1.-smoothstep(-.40,.10,bands))*smoothstep(.021,.065,abs(local.y))
        *(1.-smoothstep(.105,.14,abs(local.y)))*smoothstep(-.34,-.25,local.x)
        *(1.-smoothstep(.25,.34,local.x));
      skin*=1.-bars*.78;
    }
    skin*=mix(.67,1.03,smoothstep(-.28,.32,local.x));
    float gills=(1.-smoothstep(.008,.02,abs(fract((local.x-.15)*33.)-.5)/33.))
      *step(.13,local.x)*step(local.x,.24)*smoothstep(.032,.06,abs(local.y));
    skin*=1.-gills*.30;
    // The dorsal ridge is a narrow shaded crease when viewed from above.
    skin-=vec3(.075)*exp(-pow(local.y/.012,2.))*smoothstep(-.16,-.05,local.x)*(1.-smoothstep(.04,.13,local.x));
    sea=mix(sea,skin,coverage*depth);
    if(coverage>.42) cls=11.;
    float behind=max(-local.x-.58,0.);
    float wake=exp(-pow((abs(local.y)-behind*.25)/.022,2.))*exp(-behind*3.)
      *step(local.x,-.58)*(.5+.5*sin(behind*55.-time*3.));
    sea+=vec3(.045,.12,.13)*wake*depth;
  }
  if(cls<10. && crest>1.0) cls=10.;
  color=vec4(sea,cls/16.);
}`;

const asciiFragment = `#version 300 es
precision highp float;
in vec2 uv; out vec4 color;
uniform sampler2D scene,atlas;
uniform vec2 world,grid;
uniform vec4 cards[3];
uniform float selected;
float lum(vec3 c){return dot(c,vec3(.25,.60,.15));}
void main(){
  vec2 p=vec2(uv.x,1.-uv.y)*world;
  float mask=0.,shade=1.; vec3 tint=vec3(1.);
  for(int i=0;i<3;i++){
    vec4 card=cards[i]; vec2 local=p-card.xy;
    vec2 edge=abs(local-card.zw*.5)-card.zw*.5+9.;
    float d=length(max(edge,0.))+min(max(edge.x,edge.y),0.)-9.;
    float inside=1.-smoothstep(-.65,.65,d);
    if(inside>0.){
      mask=inside;
      tint=i==0?vec3(.12,.64,.90):i==1?vec3(.06,.86,.48):vec3(1.,.085,.17);
      // Quiet the lower label area while preserving the ocean above it.
      shade=mix(1.,.13,smoothstep(.48,.90,local.y/card.w));
      if(abs(selected-float(i))<.1) tint*=1.14;
    }
  }
  if(mask<=0.){color=vec4(0.);return;}
  vec2 g=uv*grid,cell=floor(g),cuv=(cell+.5)/grid;
  vec3 col=texture(scene,cuv).rgb; float L=lum(col);
  float cls=floor(texture(scene,cuv).a*16.+.5);
  vec2 e=1./grid;
  vec2 grad=vec2(lum(texture(scene,cuv+vec2(e.x,0)).rgb)-lum(texture(scene,cuv-vec2(e.x,0)).rgb),
    (lum(texture(scene,cuv+vec2(0,e.y)).rgb)-lum(texture(scene,cuv-vec2(0,e.y)).rgb))*.6);
  float a=mod(atan(grad.y,grad.x)+.3927,3.14159)/.7854;
  float edgeGlyph=a<1.?${glyph('|')}:a<2.?${glyph('\\')}:a<3.?${glyph('—')}:${glyph('/')};
  float ch=L<.07?${glyph('.')}:L<.11?${glyph(':')}:L<.18?${glyph('-')}:L<.26?${glyph('~')}:${glyph('=')};
  if(cls>10.5){
    ch=L<.19?${glyph(':')}:L<.28?${glyph('+')}:L<.39?${glyph('o')}:L<.49?${glyph('%')}:${glyph('#')};
    if(length(grad)>.12 && L<.32) ch=edgeGlyph;
  }else if(cls>9.5){ch=${glyph('*')};}
  vec2 f=fract(g),dx=dFdx(g),dy=dFdy(g);
  float ink=smoothstep(.13,.76,textureGrad(atlas,vec2((ch+f.x)/${[...GLYPHS].length}.0,1.-f.y),
    vec2(dx.x/${[...GLYPHS].length}.0,dx.y),vec2(dy.x/${[...GLYPHS].length}.0,dy.y)).r);
  // Grade after glyph selection so the shared palette cannot erase species
  // details, edge directions or the tiger's luminance-based stripes.
  vec3 pigment=mix(tint,vec3(1.),cls>10.5?.15:0.);
  vec3 light=L*pigment*(.14+ink*1.72);
  color=vec4(vec3(.004)+tint*.015+light*shade,mask);
}`;

function makeProgram(gl, fragment) {
  const program = gl.createProgram();
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      const valid = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
      if (valid) gl.attachShader(program, shader);
      gl.deleteShader(shader);
      if (!valid) throw new Error('Ocean shader compilation failed.');
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Ocean shader link failed.');
    return program;
  } catch (error) { gl.deleteProgram(program); throw error; }
}

export function createOceanRenderer(canvas, doc) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true });
  if (!gl) return null;
  const programs = [], textures = [], framebuffers = [];
  const dispose = () => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (const value of programs) gl.deleteProgram(value);
    for (const value of textures) gl.deleteTexture(value);
    for (const value of framebuffers) gl.deleteFramebuffer(value);
  };
  try {
    const sceneProgram = makeProgram(gl, sceneFragment); programs.push(sceneProgram);
    const asciiProgram = makeProgram(gl, asciiFragment); programs.push(asciiProgram);
    const uniforms = (program, names) => Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
    const su = uniforms(sceneProgram, ['world', 'time', 'sharks[0]', 'swimming[0]', 'pointer', 'ripple']);
    const au = uniforms(asciiProgram, ['world', 'grid', 'cards[0]', 'selected', 'scene', 'atlas']);
    const texture = () => {
      const value = gl.createTexture(); textures.push(value); gl.bindTexture(gl.TEXTURE_2D, value);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return value;
    };
    const atlas = texture(), sheet = doc.createElement('canvas'), context = sheet.getContext('2d');
    sheet.width = [...GLYPHS].length * 32; sheet.height = 56;
    context.fillStyle = '#000'; context.fillRect(0, 0, sheet.width, sheet.height);
    context.fillStyle = '#fff'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.font = 'bold 48px Menlo, Monaco, monospace';
    [...GLYPHS].forEach((ch, i) => {
      if (ch === '—') context.fillRect(i * 32 + 2, 25, 28, 5);
      else context.fillText(ch, (i + .5) * 32, 28);
    });
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sheet);
    const scene = texture();
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const target = gl.createFramebuffer(); framebuffers.push(target);
    const sharks = new Float32Array(OCEAN_SHARKS.length * 4), swimming = new Float32Array(OCEAN_SHARKS.length * 4), rectangles = new Float32Array(12);
    let gridWidth = 0, gridHeight = 0;
    return { dispose,
      draw(entries, elapsed, state) {
        const { width, height, pointer, ripple } = state;
        const { columns, rows } = oceanGrid(width, height);
        gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene);
        if (columns !== gridWidth || rows !== gridHeight) {
          gridWidth = columns; gridHeight = rows;
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, columns, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, scene, 0);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Ocean target unavailable.');
        }
        const time = elapsed * .001;
        for (let i = 0; i < OCEAN_SHARKS.length; i++) {
          const pose = oceanPath(time, i, width, height);
          // Soft local avoidance changes a curve without snapping the heading.
          const dx = pose.x - pointer[0], dy = pose.y - pointer[1], distance = Math.hypot(dx, dy);
          const influence = Math.exp(-distance * distance / 7500) * pointer[2];
          const side = i === 1 ? -1 : 1;
          sharks.set([pose.x - Math.sin(pose.angle) * influence * 19 * side,
            pose.y + Math.cos(pose.angle) * influence * 19 * side, pose.length, pose.angle + influence * .22 * side], i * 4);
          swimming.set([pose.phase, pose.depth, pose.cadence, pose.kind], i * 4);
        }
        for (let i = 0; i < 3; i++) {
          const entry = entries[i]; rectangles.set([entry.cssLeft, entry.cssTop, entry.cssWidth, entry.cssHeight], i * 4);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, target); gl.viewport(0, 0, columns, rows);
        gl.useProgram(sceneProgram); gl.uniform2f(su.world, width, height); gl.uniform1f(su.time, time);
        gl.uniform4fv(su['sharks[0]'], sharks); gl.uniform4fv(su['swimming[0]'], swimming);
        gl.uniform3fv(su.pointer, pointer); gl.uniform3fv(su.ripple, [ripple[0], ripple[1], time - ripple[2]]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(asciiProgram); gl.uniform2f(au.world, width, height); gl.uniform2f(au.grid, columns, rows);
        gl.uniform4fv(au['cards[0]'], rectangles); gl.uniform1f(au.selected, entries.findIndex(entry => entry.input.checked));
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene); gl.uniform1i(au.scene, 0);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, atlas); gl.uniform1i(au.atlas, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.activeTexture(gl.TEXTURE0);
      }
    };
  } catch { dispose(); return null; }
}
