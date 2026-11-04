// Five procedural eye pairs; no bitmap plates, textures or bloom render targets.
export const eyeVariants = Object.freeze([
  { id: 'ice', label: 'Azul-claro · astral', color: [0.16, 0.78, 1.0], hex: '#48d5ff', pattern: 0 },
  { id: 'red', label: 'Vermelho · sigilo', color: [1.0, 0.045, 0.13], hex: '#ff305c', pattern: 1 },
  { id: 'gold', label: 'Amarelo · fenda vertical', color: [1.0, 0.73, 0.035], hex: '#ffd238', pattern: 2 },
  { id: 'green', label: 'Verde · fenda horizontal', color: [0.07, 1.0, 0.34], hex: '#37ff89', pattern: 3 },
  { id: 'violet', label: 'Roxo · estrela', color: [0.66, 0.18, 1.0], hex: '#b760ff', pattern: 4 },
]);

export function createEyeAssignments(random = Math.random) {
  const assigned = new Map();
  return {
    get(key) {
      key = String(key);
      if (assigned.has(key)) return assigned.get(key);
      // Prefer styles not in use; above five connections, balance repetitions.
      const counts = eyeVariants.map(variant => Array.from(assigned.values()).filter(value => value === variant).length);
      const leastUsed = Math.min(...counts);
      const choices = eyeVariants.filter((_, index) => counts[index] === leastUsed);
      const variant = choices[Math.floor(random() * choices.length)];
      assigned.set(key, variant);
      return variant;
    },
    retain(keys) {
      const current = new Set(Array.from(keys, String));
      for (const key of assigned.keys()) if (!current.has(key)) assigned.delete(key);
    },
  };
}

export const eyesVertexSource = `#version 300 es
out vec2 position;
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  position = corner * 2.0 - 1.0;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

export const eyesFragmentSource = `#version 300 es
precision highp float;
in vec2 position;
uniform float gaze;
uniform int pattern;
uniform vec3 tint;
out vec4 color;

float coverage(float distanceToEdge) {
  float pixel = max(fwidth(distanceToEdge), 0.003) * 0.7;
  return 1.0 - smoothstep(-pixel, pixel, distanceToEdge);
}

void main() {
  // Each half of the icon contains a whole globe, not a second canvas.
  float side = position.x < 0.0 ? -1.0 : 1.0;
  vec2 p = vec2(position.x * 2.20 - side * 1.10, position.y * 0.92);
  float lidTilt = pattern == 0 ? 0.035 : (pattern == 1 ? 0.10 : 0.065);
  float opening = pattern == 0 ? 0.58 : (pattern == 1 ? 0.46 : 0.53);
  float lidY = p.y + lidTilt * p.x * side;
  float lidHeight = opening * pow(max(1.0 - pow(abs(p.x) / 0.99, 1.7), 0.0), 0.85);
  float lidDistance = max(abs(lidY) - lidHeight, abs(p.x) - 0.99);
  float lid = coverage(lidDistance);
  float halo = 0.25 * exp(-max(lidDistance, 0.0) * 19.0) * (1.0 - lid);
  if (lid + halo < 0.002) { color = vec4(0.0); return; }

  vec3 globe = normalize(vec3(p, sqrt(max(1.04 - dot(p, p), 0.0001))));
  float turn = gaze * 0.34;
  float irisSize = pattern == 0 ? 0.54 : (pattern == 1 ? 0.60 : 0.58);
  vec2 iris = vec2(cos(turn) * globe.x - sin(turn) * globe.z, globe.y) / irisSize;
  float radius = length(iris);
  float angle = atan(iris.y, iris.x + 0.00001);
  float detail = clamp(1.0 - fwidth(angle) * 3.0, 0.0, 1.0);
  float fibers = sin(angle * 17.0 + radius * 8.0) * sin(angle * 29.0 - radius * 6.0) * detail;
  float pupilDistance = radius - 0.25;
  float material = 0.76 + 0.13 * fibers;
  float ornament = 0.0;
  float paleMark = 0.0;

  if (pattern == 0) {
    // Astral blue: a small pupil, dark depth bands and broken luminous orbits.
    // Broad marks survive icon scale; microscopic pseudo-lettering would not.
    pupilDistance = radius - 0.17;
    float clouds = sin(angle * 3.0 + radius * 5.0) + 0.45 * sin(angle * 7.0 - radius * 6.0);
    material = 0.58 + 0.25 * smoothstep(-1.1, 1.1, clouds) + 0.08 * fibers;
    material *= 1.0 - 0.42 * coverage(abs(radius - 0.56) - 0.09);
    float innerOrbit = coverage(abs(radius - 0.35) - 0.030);
    float outerOrbit = coverage(abs(radius - 0.75) - 0.035) * smoothstep(-0.05, 0.35, cos(angle * 4.0 + 0.35));
    float runes = coverage(abs(radius - 0.91) - 0.033) * smoothstep(0.65, 0.95, cos(angle * 12.0));
    paleMark = max(innerOrbit * 0.90, max(outerOrbit * 0.80, runes * 0.65));
  } else if (pattern == 1) {
    // Crimson sigil: three broad curved blades merge with a round black core.
    // This replaces the former six-sector gem and diamond pupil completely.
    const float sector = 2.0943951;
    float arc = mod(angle - 0.95 * (1.0 - radius) + sector * 0.5, sector) - sector * 0.5;
    float bladeWidth = mix(0.18, 0.075, smoothstep(0.22, 0.95, radius));
    float bladeDistance = max(abs(arc) * max(radius, 0.18) - bladeWidth, radius - 0.94);
    pupilDistance = min(radius - 0.24, bladeDistance);
    material = 0.88 + 0.075 * fibers;
  } else if (pattern == 2) {
    // Gold: a tall tapered pupil; the surrounding fibers stay radial.
    pupilDistance = (length(iris / vec2(0.13, 0.62)) - 1.0) * 0.13;
    material = 0.74 + 0.18 * sin(angle * 11.0 + radius * 3.0) * detail;
  } else if (pattern == 3) {
    // Emerald: a horizontal aperture with curved fibers and two collarette bands.
    pupilDistance = (length(iris / vec2(0.56, 0.13)) - 1.0) * 0.13;
    material = 0.69 + 0.20 * sin(angle * 12.0 + radius * 9.0) * detail;
    ornament = max(coverage(abs(radius - 0.49) - 0.025), coverage(abs(radius - 0.72) - 0.025)) * 0.35;
  } else {
    // Violet: a four-lobed dark pupil and three curved spiral arms.
    pupilDistance = radius - (0.24 + 0.10 * cos(angle * 4.0));
    float spiral = 0.5 + 0.5 * cos(angle * 3.0 + radius * 11.0);
    material = 0.52 + 0.38 * smoothstep(0.25, 0.70, spiral) + 0.07 * fibers;
    ornament = coverage(abs(radius - 0.78) - 0.025) * 0.30;
  }

  float pupil = coverage(pupilDistance);
  float irisMask = coverage(radius - 1.0);
  float ring = coverage(abs(radius - 0.94) - 0.032);
  vec3 irisColor = tint * material * mix(0.48, 1.0, smoothstep(0.22, 0.48, radius));
  irisColor *= 1.0 - 0.43 * smoothstep(0.80, 1.02, radius);
  irisColor += tint * (ring * 0.42 + ornament * 0.20);
  if (pattern == 0) irisColor = mix(irisColor, vec3(0.63, 0.94, 1.0), paleMark * 0.85);
  irisColor = mix(irisColor, vec3(0.003, 0.005, 0.008), pupil);

  vec3 light = normalize(vec3(-0.42, 0.68, 0.9));
  float lambert = max(dot(globe, light), 0.0);
  float irisGlow = exp(-max(radius - 1.0, 0.0) * 5.5) * 0.12;
  vec3 sclera = mix(vec3(0.025, 0.032, 0.045), vec3(0.22, 0.24, 0.27), lambert) + tint * irisGlow;
  if (pattern == 0) sclera = mix(vec3(0.065, 0.085, 0.12), vec3(0.40, 0.47, 0.54), lambert) + tint * irisGlow * 0.55;
  if (pattern == 1) sclera = mix(vec3(0.004, 0.005, 0.009), vec3(0.035, 0.024, 0.035), lambert) + tint * irisGlow * 0.20;
  vec3 eye = mix(sclera, irisColor * (0.87 + 0.13 * lambert), irisMask);
  vec3 cornea = normalize(globe + vec3(iris * (0.11 * irisMask), 0.0));
  float specular = pow(max(dot(cornea, normalize(light + vec3(0.0, 0.0, 1.0))), 0.0), 90.0);
  // A tiny reflection must not erase a whole pupil at the delivered icon size.
  eye += specular * vec3(0.42, 0.46, 0.50) * mix(1.0, 0.12, pupil);
  eye *= mix(0.50, 1.0, smoothstep(0.0, 0.25, lidHeight - lidY));
  eye += tint * coverage(abs(lidDistance) - 0.012) * 0.10;
  float alpha = lid + halo;
  color = vec4((eye * lid + tint * halo * 0.65) / max(alpha, 0.0001), alpha);
}`;

const phases = [
  { to: -0.78, hold: 2300 }, { to: 0.74, hold: 3100 },
  { to: 0, hold: 2200 }, { to: 0.36, hold: 2850 },
];
const travel = 180;
export const gazePeriod = phases.reduce((sum, phase) => sum + travel + phase.hold, 0);
export function gazeAt(elapsed, offset = 0) {
  let clock = ((elapsed + offset) % gazePeriod + gazePeriod) % gazePeriod;
  let from = phases.at(-1).to;
  for (const phase of phases) {
    if (clock < travel) {
      const t = clock / travel, ease = t * t * (3 - 2 * t);
      return { gaze: from + (phase.to - from) * ease, moving: true, remaining: travel - clock };
    }
    if (clock < travel + phase.hold) return { gaze: phase.to, moving: false, remaining: travel + phase.hold - clock };
    clock -= travel + phase.hold; from = phase.to;
  }
}

let fallbackSequence = 0;
function staticEyes(doc, variant) {
  const prefix = 'audience-eyes-' + ++fallbackSequence;
  const holder = doc.createElement('span'); holder.className = 'audience-eyes-static';
  const pupils = [
    '<circle cx="33" cy="32" r="2.9"/>',
    '<g transform="translate(33 32)"><circle r="4.4"/><path d="M-1-4C3-13 12-14 15-10C6-12 5-3 2-1Z"/><path d="M-1-4C3-13 12-14 15-10C6-12 5-3 2-1Z" transform="rotate(120)"/><path d="M-1-4C3-13 12-14 15-10C6-12 5-3 2-1Z" transform="rotate(240)"/></g>',
    '<ellipse cx="33" cy="32" rx="2.4" ry="10"/>',
    '<ellipse cx="33" cy="32" rx="9.4" ry="2.4"/>',
    '<path d="m33 24 2.8 5.2L41 32l-5.2 2.8L33 40l-2.8-5.2L25 32l5.2-2.8Z"/>',
  ];
  const opening = variant.pattern === 0 ? 'M4 32Q15 9 34 13Q49 16 62 32Q49 49 34 51Q15 54 4 32Z' :
    variant.pattern === 1 ? 'M4 30Q17 19 34 21Q49 23 62 34Q47 44 34 44Q16 44 4 30Z' : 'M4 32Q15 13 34 17Q49 19 62 32Q49 45 34 47Q15 50 4 32Z';
  const sclera = variant.pattern === 0 ? '#61788a' : variant.pattern === 1 ? '#09070d' : '#25303b';
  const markings = variant.pattern === 0 ? '<g fill="none" stroke="#b6f3ff"><circle cx="33" cy="32" r="6" stroke-width="1.2"/><circle cx="33" cy="32" r="12.5" stroke-width="1.3" stroke-dasharray="14 6"/><circle cx="33" cy="32" r="15.5" stroke-width="1.1" stroke-dasharray="2 6"/></g>' : '';
  // Constant artwork only; no nickname enters this markup.
  holder.innerHTML = `<svg viewBox="0 0 136 64" aria-hidden="true"><defs>
    <clipPath id="${prefix}-clip"><path d="${opening}"/></clipPath>
    <radialGradient id="${prefix}-iris"><stop offset="0.18" stop-color="#090c14"/><stop offset="0.40" stop-color="${variant.hex}" stop-opacity=".75"/><stop offset=".76" stop-color="${variant.hex}"/><stop offset="1" stop-color="#07101b"/></radialGradient>
    </defs>${[0,70].map(x => `<g transform="translate(${x} 0)"><g clip-path="url(#${prefix}-clip)"><path d="M0 0h66v64H0Z" fill="${sclera}"/><circle cx="33" cy="32" r="17" fill="url(#${prefix}-iris)"/><circle cx="33" cy="32" r="15.5" fill="none" stroke="${variant.hex}" stroke-width="1"/>${markings}<g fill="#03060b">${pupils[variant.pattern]}</g><circle cx="28" cy="27" r="1.3" fill="#cfe9ff" opacity=".6"/></g></g>`).join('')}</svg>`;
  return holder;
}

function createRenderer(canvas, onLost) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false,
    stencil: false, premultipliedAlpha: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true });
  if (!gl) return null;
  const program = gl.createProgram();
  const dispose = () => { canvas.removeEventListener('webglcontextlost', onLost); gl.deleteProgram(program); };
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, eyesVertexSource], [gl.FRAGMENT_SHADER, eyesFragmentSource]]) {
      const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
      const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
      const message = compiled ? '' : gl.getShaderInfoLog(shader);
      if (compiled) gl.attachShader(program, shader); gl.deleteShader(shader);
      if (!compiled) throw new Error(message);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const locations = Object.fromEntries(['gaze','pattern','tint'].map(name => [name, gl.getUniformLocation(program, name)]));
    canvas.addEventListener('webglcontextlost', onLost);
    return {
      draw(entries, elapsed, dpr) {
        gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
        let moving = false, remaining = Infinity;
        for (const entry of entries) {
          const sample = gazeAt(elapsed, entry.offset);
          moving ||= sample.moving; remaining = Math.min(remaining, sample.remaining);
          gl.viewport(0, canvas.height - Math.round((entry.y + entry.height) * dpr), canvas.width, Math.round(entry.height * dpr));
          gl.uniform1f(locations.gaze, sample.gaze);
          gl.uniform1i(locations.pattern, entry.variant.pattern);
          gl.uniform3fv(locations.tint, entry.variant.color);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        return { moving, remaining };
      }, dispose,
    };
  } catch (error) { dispose(); console.warn('Audience eyes: static fallback retained.', error.message); return null; }
}

export function attachAudienceEyes(root, doc = root?.ownerDocument, { random = Math.random } = {}) {
  if (!root || root.dataset.eyesAttached) return () => {};
  root.dataset.eyesAttached = 'true'; root.classList.add('has-audience-eyes');
  const view = doc.defaultView, motion = view.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = doc.createElement('canvas'); canvas.className = 'audience-eyes-layer';
  canvas.setAttribute('aria-hidden','true'); root.before(canvas);
  const born = view.performance.now();
  const assignments = createEyeAssignments(random);
  let entries = [], visible = [], renderer, failed = false, disposed = false, frame, timer, dpr = 1;
  function pause() { view.cancelAnimationFrame(frame); view.clearTimeout(timer); frame = timer = undefined; }
  function release() { pause(); renderer?.dispose(); renderer = undefined; delete root.dataset.eyesRenderer; canvas.hidden = true; }
  function onLost(event) { event.preventDefault(); failed = true; release(); }
  function paint(now) {
    frame = undefined;
    if (disposed || doc.hidden || !visible.length || !renderer) return;
    const result = renderer.draw(visible, now - born, dpr);
    if (result.moving) frame = view.requestAnimationFrame(paint);
    else timer = view.setTimeout(() => { timer = undefined; frame = view.requestAnimationFrame(paint); }, Math.ceil(result.remaining));
  }
  function layout() {
    pause(); if (disposed || doc.hidden) return;
    const parent = root.parentElement.getBoundingClientRect(), bounds = root.getBoundingClientRect();
    const top = Math.max(0,bounds.top), bottom = Math.min(view.innerHeight,bounds.bottom), height = Math.max(0,bottom-top);
    visible = entries.map(entry => ({ ...entry, box: entry.marker.getBoundingClientRect() }))
      .filter(entry => entry.box.bottom > top && entry.box.top < bottom)
      .map(entry => ({ ...entry, y: entry.box.top-top, height: entry.box.height }));
    if (!height || !visible.length || failed || motion.matches) { release(); return; }
    const first = visible[0].box;
    dpr = Math.min(view.devicePixelRatio || 1,2,2048/height);
    Object.assign(canvas.style, { left: (first.left-parent.left)+'px', top: (top-parent.top)+'px', width: first.width+'px', height: height+'px' });
    canvas.width = Math.max(1,Math.round(first.width*dpr)); canvas.height = Math.max(1,Math.round(height*dpr));
    if (!renderer) renderer = createRenderer(canvas,onLost);
    if (!renderer) { failed = true; release(); return; }
    canvas.hidden = false; root.dataset.eyesRenderer = 'webgl2'; paint(view.performance.now());
  }
  function queueLayout() { pause(); if (!disposed && !doc.hidden) frame = view.requestAnimationFrame(layout); }
  function collect() {
    const current = Array.from(root.children,row => {
      const marker = row.querySelector('.audience-marker'); if (!marker) return null;
      return { marker, key: marker.dataset.eyesKey || marker.textContent };
    }).filter(Boolean);
    assignments.retain(current.map(entry => entry.key));
    entries = current.map(({marker,key}) => {
      const variant = assignments.get(key);
      marker.dataset.eyesKey = key; marker.dataset.eyeStyle = variant.id; marker.title = variant.label; marker.hidden = false;
      marker.replaceChildren(staticEyes(doc,variant));
      const number = Number(key); const offset = (Number.isFinite(number) ? number : variant.pattern+1)*751;
      return { marker, key, variant, offset };
    });
    queueLayout();
  }
  const mutations = new view.MutationObserver(collect); mutations.observe(root,{ childList: true });
  const resize = view.ResizeObserver ? new view.ResizeObserver(queueLayout) : null; resize?.observe(root);
  doc.addEventListener('visibilitychange',queueLayout); motion.addEventListener('change',queueLayout);
  view.addEventListener('resize',queueLayout); view.addEventListener('scroll',queueLayout,{ passive: true, capture: true });
  view.addEventListener('pagehide',release); view.addEventListener('pageshow',queueLayout); collect();
  return () => {
    disposed = true; release(); mutations.disconnect(); resize?.disconnect();
    assignments.retain([]);
    doc.removeEventListener('visibilitychange',queueLayout); motion.removeEventListener('change',queueLayout);
    view.removeEventListener('resize',queueLayout); view.removeEventListener('scroll',queueLayout,true);
    view.removeEventListener('pagehide',release); view.removeEventListener('pageshow',queueLayout);
    for (const entry of entries) { entry.marker.textContent = entry.key; entry.marker.hidden = entry.marker.closest('li').dataset.named === 'true'; delete entry.marker.dataset.eyesKey; delete entry.marker.dataset.eyeStyle; entry.marker.removeAttribute('title'); }
    canvas.remove(); root.classList.remove('has-audience-eyes'); delete root.dataset.eyesAttached;
  };
}
