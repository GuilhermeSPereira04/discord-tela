// Prototype: a single WebGL 2 draw tests whether curvature, depth and corneal
// highlights still read at the size of the host's live indicator.
const vertexSource = `#version 300 es
out vec2 position;

void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  position = corner * 2.0 - 1.0;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentSource = `#version 300 es
precision highp float;
in vec2 position;
uniform float gaze;
uniform float transformation;
out vec4 color;

float coverage(float distanceToEdge) {
  float pixel = max(fwidth(distanceToEdge), 0.001) * 0.65;
  return 1.0 - smoothstep(-pixel, pixel, distanceToEdge);
}

float curvedSide(vec2 point, vec2 normal) {
  float along = dot(point, vec2(-normal.y, normal.x));
  return dot(point, normal) - 0.48 + 0.10 * along * along;
}

float mangekyoTriangle(vec2 point) {
  float base = curvedSide(point, vec2(0.0, -1.0));
  float left = curvedSide(point, vec2(-0.8660254, 0.5));
  float right = curvedSide(point, vec2(0.8660254, 0.5));
  return max(base, max(left, right));
}

void main() {
  vec2 p = vec2(position.x, position.y * (5.0 / 7.0));
  float lidY = p.y - 0.055 * p.x;
  float lidHeight = 0.50 * pow(max(1.0 - pow(abs(p.x) / 0.95, 1.7), 0.0), 0.85);
  float lidDistance = max(abs(lidY) - lidHeight, abs(p.x) - 0.95);

  // Project the pupil and iris onto a curved globe oriented by the gaze.
  // The opening stays fixed and crops the iris as it turns under the eyelid.
  float z = sqrt(max(1.04 - dot(p, p), 0.0));
  vec3 globe = normalize(vec3(p, z));
  vec2 iris = vec2(cos(gaze) * globe.x - sin(gaze) * globe.z, globe.y) / 0.49;
  float radius = length(iris);
  float angle = atan(iris.y, iris.x + 0.00001);

  // Fold into three sectors so the same tapered comma forms each tomoe.
  const float sector = 2.0943951;
  // One full sector of rotation brings both end patterns back into alignment.
  float symbolAngle = angle - sector * transformation;
  float arc = mod(symbolAngle + sector * 0.5, sector) - sector * 0.5;
  vec2 sectorPoint = radius * vec2(cos(arc), sin(arc));
  float head = length(sectorPoint - vec2(0.59, -0.02)) - 0.15;
  float awakening = 4.0 * transformation * (1.0 - transformation);
  float tailLength = 0.57 + 0.30 * awakening;
  float taper = mix(0.105, 0.018, clamp(arc / tailLength, 0.0, 1.0));
  float tail = max(abs(radius - 0.61) - taper, max(-arc, arc - tailLength));
  float tomoe = coverage(min(head, tail));
  float ink = max(coverage(radius - 0.23), tomoe);

  float fibers = sin(angle * 19.0 + radius * 4.0) * sin(angle * 27.0 - radius * 8.0);
  float innerColor = smoothstep(0.25, 0.47, radius);
  vec3 irisColor = mix(vec3(0.46, 0.055, 0.09), vec3(0.94, 0.18, 0.26), innerColor);
  irisColor *= (0.94 + 0.08 * fibers) * (1.0 - 0.54 * smoothstep(0.76, 1.0, radius));
  irisColor *= 1.0 - 0.25 * coverage(abs(radius - 0.59) - 0.028);
  irisColor = mix(irisColor, vec3(0.065, 0.016, 0.026), ink);
  float reflectionMask = tomoe;
  if (transformation > 0.0) {
    // The Eternal pattern adds three tapered blades over the six-point rosette.
    vec2 rotatedIris = radius * vec2(cos(symbolAngle), sin(symbolAngle));
    float first = mangekyoTriangle(rotatedIris);
    float second = mangekyoTriangle(-rotatedIris);
    float flower = coverage(min(first, second));
    float seams = max(
      coverage(abs(first) - 0.033) * coverage(second),
      coverage(abs(second) - 0.033) * coverage(first)
    );
    float bladeArc = mod(symbolAngle + 1.5707963 + sector * 0.5, sector) - sector * 0.5;
    vec2 blade = radius * vec2(cos(bladeArc), sin(bladeArc));
    float bladeWidth = 0.19 * (1.0 - smoothstep(0.16, 0.75, blade.x));
    float blades = coverage(max(abs(blade.y) - bladeWidth, blade.x - 0.75));
    float petals = flower * (1.0 - 0.9 * seams) * (1.0 - blades);
    petals = max(petals, coverage(radius - 0.14));
    vec3 flowerColor = mix(vec3(0.049, 0.012, 0.022), vec3(0.95, 0.17, 0.25) * (0.95 + 0.05 * fibers), petals);

    // Reveal the new geometry from the pupil outward. The narrow red ridge
    // travels with the boundary and is gone at either end of the transition.
    float front = mix(-0.20, 1.30, transformation);
    float reveal = 1.0 - smoothstep(front - 0.16, front + 0.16, radius);
    float ridge = coverage(abs(radius - front) - 0.035) * awakening;
    irisColor = mix(irisColor, flowerColor, reveal) + vec3(0.17, 0.028, 0.04) * ridge;
    reflectionMask = mix(tomoe, 1.0 - petals, reveal);
  }

  vec3 light = normalize(vec3(-0.44, 0.64, 0.82));
  float lightOnGlobe = max(dot(globe, light), 0.0);
  float irisMask = coverage(radius - 1.0);
  vec3 sclera = mix(vec3(0.17, 0.093, 0.11), vec3(0.53, 0.40, 0.41), lightOnGlobe);
  vec3 eye = mix(sclera, irisColor * (0.83 + 0.17 * lightOnGlobe), irisMask);

  // A shallow bulge changes the highlight with gaze, above the painted iris.
  vec3 cornea = normalize(globe + vec3(iris * (0.18 * irisMask), 0.0));
  vec3 halfLight = normalize(light + vec3(0.0, 0.0, 1.0));
  float specular = pow(max(dot(cornea, halfLight), 0.0), 92.0);
  // The icon is small enough for the highlight to wash out an entire mark.
  // Leave a softer reflection on the dark pattern so its silhouette survives.
  specular *= mix(1.0, 0.18, reflectionMask);
  float upperShadow = mix(0.52, 1.0, smoothstep(0.0, 0.25, lidHeight - lidY));
  eye = (eye + specular * vec3(0.85, 0.74, 0.72)) * upperShadow;
  eye = mix(eye, vec3(0.25, 0.09, 0.12), coverage(-lidDistance - 0.033));
  color = vec4(eye, coverage(lidDistance));
}
`;

function createEyeRenderer(container, onLost) {
  const canvas = container.ownerDocument.createElement('canvas');
  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, powerPreference: 'low-power',
    failIfMajorPerformanceCaveat: true,
  });
  if (!gl) return null;

  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  const loseContext = gl.getExtension('WEBGL_lose_context');
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    loseContext?.loseContext();
    return null;
  }
  gl.useProgram(program);
  const gazeLocation = gl.getUniformLocation(program, 'gaze');
  const transformationLocation = gl.getUniformLocation(program, 'transformation');
  canvas.addEventListener('webglcontextlost', onLost);
  container.append(canvas);

  return {
    draw(gaze, transformation) {
      const dpr = Math.min(container.ownerDocument.defaultView.devicePixelRatio || 1, 2);
      const width = Math.round(container.clientWidth * dpr);
      const height = Math.round(container.clientHeight * dpr);
      if (!width || !height) return;
      if (width !== canvas.width || height !== canvas.height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
      gl.uniform1f(gazeLocation, gaze);
      gl.uniform1f(transformationLocation, transformation);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      canvas.removeEventListener('webglcontextlost', onLost);
      gl.deleteProgram(program);
      loseContext?.loseContext();
      canvas.remove();
    },
  };
}

const glances = [
  { angle: -0.34, hold: 1350 },
  { angle: 0.36, hold: 1600 },
  { angle: 0, hold: 900 },
  { angle: -0.22, hold: 1250 },
  { angle: 0, hold: 1250 },
];
const transformationDuration = 520;

export function attachHostLiveEye(button, status, doc = document) {
  const container = button.querySelector('.host-live-eye-art');
  const view = doc.defaultView;
  const motion = view.matchMedia('(prefers-reduced-motion: reduce)');
  let renderer, timer, frame;
  let angle = 0, nextGlance = 0;
  let visible = true, failed = false;
  let mangekyo = false;
  let transformation = 0;
  let glance, awakening;

  function pause() {
    view.clearTimeout(timer);
    view.cancelAnimationFrame(frame);
    timer = frame = undefined;
  }

  function release() {
    pause();
    renderer?.dispose();
    renderer = undefined;
    angle = nextGlance = 0;
    glance = awakening = undefined;
    transformation = Number(mangekyo);
    delete container.dataset.renderer;
  }

  function fallback() {
    failed = true;
    release();
  }

  function scheduleGlance(hold) {
    timer = view.setTimeout(() => {
      timer = undefined;
      const target = glances[nextGlance];
      nextGlance = (nextGlance + 1) % glances.length;
      glance = { from: angle, target, start: view.performance.now() };
      requestFrame();
    }, hold);
  }

  function requestFrame() {
    if (frame === undefined) frame = view.requestAnimationFrame(drawFrame);
  }

  function drawFrame(now) {
    frame = undefined;
    if (glance) {
      const progress = Math.max(0, Math.min(1, (now - glance.start) / 145));
      angle = glance.from + (glance.target.angle - glance.from) * (1 - (1 - progress) ** 3);
      if (progress === 1) {
        scheduleGlance(glance.target.hold);
        glance = undefined;
      }
    }
    if (awakening) {
      const progress = Math.max(0, Math.min(1, (now - awakening.start) / awakening.duration));
      const eased = progress * progress * (3 - 2 * progress);
      transformation = awakening.from + (awakening.target - awakening.from) * eased;
      if (progress === 1) awakening = undefined;
    }
    // Gaze and transformation share the canvas draw even when they overlap.
    renderer.draw(angle, transformation);
    if (glance || awakening) requestFrame();
  }

  function sync() {
    const live = status.classList.contains('live');
    if (!live) {
      mangekyo = false;
      button.setAttribute('aria-pressed', 'false');
    }
    if (!live || motion.matches || failed) {
      release();
      return;
    }
    if (doc.hidden || !visible) {
      pause();
      return;
    }
    if (!renderer) {
      try {
        renderer = createEyeRenderer(container, fallback);
        if (!renderer) { fallback(); return; }
        renderer.draw(angle, transformation);
        container.dataset.renderer = 'webgl2';
      } catch {
        fallback();
        return;
      }
    }
    if (glance || awakening) requestFrame();
    if (!glance && timer === undefined) scheduleGlance(950);
  }

  button.addEventListener('click', () => {
    mangekyo = !mangekyo;
    button.setAttribute('aria-pressed', String(mangekyo));
    const target = Number(mangekyo);
    if (!renderer) {
      transformation = target;
      return;
    }
    const duration = transformationDuration * Math.abs(target - transformation);
    awakening = duration > 0 ? { from: transformation, target, duration, start: view.performance.now() } : undefined;
    if (awakening && !doc.hidden && visible) requestFrame();
  });
  status.addEventListener('hostlivestatuschange', sync);
  doc.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  view.addEventListener('pagehide', release);
  view.addEventListener('pageshow', sync);
  if (view.IntersectionObserver) {
    new view.IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }).observe(container);
  }
  if (view.ResizeObserver) {
    new view.ResizeObserver(() => {
      if (!doc.hidden && visible && frame === undefined) renderer?.draw(angle, transformation);
    }).observe(container);
  }
  sync();
}
