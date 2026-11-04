// Adapted from JDhruv14/ascii-diorama (MIT), see credits.txt.
// Deterministic landscape shared by build-time baking and live animation.
import * as THREE from 'three';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const hash2 = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g);
  return (hash2(i, j) * (1 - u) + hash2(i + 1, j) * u) * (1 - v) + (hash2(i, j + 1) * (1 - u) + hash2(i + 1, j + 1) * u) * v;
}
const fbm = (x, y) => vnoise(x, y) * .5 + vnoise(x * 2.1 + 3, y * 2.1) * .28 + vnoise(x * 4.3, y * 4.3 + 5) * .15 + vnoise(x * 8.7, y * 8.7) * .07;
let seed = 23;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const coastZ = (x) => 10.6 + .24 * x + (fbm(x * .1 + 2, 1.3) - .5) * 9;
const ROCKS = [];
for (let i = 0; i < 46; i++) {
  const x = -30 + rnd() * 60, off = -2 + rnd() * rnd() * 12, r = .35 + rnd() * rnd() * 1.5;
  ROCKS.push([x, coastZ(x) + off, r]);
}
ROCKS.push([3, coastZ(3) + 6.5, 1.9], [5.1, coastZ(5) + 6.2, 1.2], [-8, coastZ(-8) + 5, 1.6]);
function rawH(x, z) {
  const d = coastZ(x) - z;
  let y = d < 0 ? d * .42 : 4.2 * (1 - Math.exp(-d * .42)) + d * .34;
  y += sstep(0, 5, d) * ((fbm(x * .09, z * .09) - .5) * 4.2 + (fbm(x * .4, z * .4) - .5) * .8);
  for (const [rx, rz, r] of ROCKS) { const q = ((x - rx) ** 2 + (z - rz) ** 2) / (r * r); if (q < 4) y = Math.max(y, y + Math.exp(-q * 1.4) * r * 1.2); }
  return y;
}
const PATH = [[8.5, -17], [6.4, -12.5], [3.4, -8.5], [1.4, -4.5], [.6, -.5], [-.6, 3], [-2.6, 6.2], [-4.4, 9], [-5.6, 11.8]];
const pathCurve = new THREE.CatmullRomCurve3(PATH.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', .5);
const pathLen = pathCurve.getLength();
const pathS = [];
for (let i = 0; i <= 500; i++) { const p = pathCurve.getPointAt(i / 500); pathS.push({ x: p.x, z: p.z, y: rawH(p.x, p.z) }); }
for (let pass = 0; pass < 7; pass++) {
  const c = pathS.map(s => s.y);
  for (let i = 0; i < c.length; i++) { let a = 0, n = 0; for (let k = -9; k <= 9; k++) { const v = c[i + k]; if (v !== undefined) { a += v; n++; } } pathS[i].y = a / n; }
}
pathS.forEach(s => { s.y = Math.max(s.y, .12); });
const X0 = -45, X1 = 45, Z0 = -52, Z1 = 42, FW = 240, FH = 250;
let fD, fY, fH;
function installHeightfield(fields) { ({fD, fY, fH} = fields); }
function bakeHeightfield() {
const fD = new Float32Array(FW * FH), fY = new Float32Array(FW * FH), fH = new Float32Array(FW * FH);
for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) {
  const x = X0 + (X1 - X0) * i / (FW - 1), z = Z0 + (Z1 - Z0) * j / (FH - 1);
  let best = 1e9, by = 0;
  for (let k = 0; k < pathS.length; k += 3) { const s = pathS[k], d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < best) { best = d; by = s.y; } }
  const D = Math.sqrt(best), k = sstep(3, 1.4, D);
  fD[j * FW + i] = D; fY[j * FW + i] = by;
  fH[j * FW + i] = rawH(x, z) * (1 - k) + (by - .03) * k;
}
  const fields = {fD, fY, fH}; installHeightfield(fields); return fields;
}
function samp(f, x, z) {
  const u = clamp((x - X0) / (X1 - X0)) * (FW - 1), v = clamp((z - Z0) / (Z1 - Z0)) * (FH - 1);
  const i = Math.min(FW - 2, u | 0), j = Math.min(FH - 2, v | 0), a = u - i, b = v - j;
  return (f[j * FW + i] * (1 - a) + f[j * FW + i + 1] * a) * (1 - b) + (f[(j + 1) * FW + i] * (1 - a) + f[(j + 1) * FW + i + 1] * a) * b;
}
const H = (x, z) => samp(fH, x, z);
const pathD = (x, z) => samp(fD, x, z);
const flowerField = (x, z) => fbm(x * .085 + 11, z * .1 - 4);

const placementSeed = seed;
const getSeed = () => seed;
const setSeed = value => { seed = value; };
function bakeTerrainPixels([grass, sand, rock, slate]) {
  const CLS = {grass:1, stair:5, sand:8, rock:13};
  const TW = 768, TH = 802, col = new Uint8Array(TW * TH * 4), cls = new Uint8Array(TW * TH * 4);
  const pick = (t, x, z, m) => { const o = (((fract(z / m) * t.h) | 0) * t.w + ((fract(x / m) * t.w) | 0)) * 4; return [t.d[o], t.d[o + 1], t.d[o + 2]]; };
  for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
    const x = X0 + (X1 - X0) * i / (TW - 1), z = Z0 + (Z1 - Z0) * j / (TH - 1), y = H(x, z), d = coastZ(x) - z, pd = pathD(x, z);
    const n = fbm(x * .3, z * .3);
    let c, k;
    const nearSea = y < 1.3 + n * 1.4 && d < 7;
    if (pd < 1.45) { c = pick(slate, x, z, 3); c = [c[0] * .9, c[1] * .9, c[2] * .9]; k = CLS.stair; }
    else if (nearSea) {
      if (y < .55 + n * .5 && d > -2.5 && n > .36) { c = pick(sand, x, z, 3.2); c = [c[0] * 1.22, c[1] * 1.12, c[2] * .9]; k = CLS.sand; }
      else { c = pick(rock, x, z, 7); c = [c[0] * .68, c[1] * .72, c[2] * .78]; k = CLS.rock; }
    } else {
      c = pick(grass, x, z, 2.6); const v = .62 + .95 * fbm(x * .16 + 5, z * .16);
      c = [c[0] * .78 * v, c[1] * 1.1 * v, c[2] * .42 * v]; k = CLS.grass;
      if (flowerField(x, z) > .575) { c = [c[0] * .85 + 40, c[1] * .85 + 40, c[2] * .85 + 42]; }
    }
    const o = (j * TW + i) * 4;
    col[o] = Math.min(255, c[0]); col[o + 1] = Math.min(255, c[1]); col[o + 2] = Math.min(255, c[2]); col[o + 3] = 255; cls[o] = k * 16;
  }
  return {col, cls, width:TW, height:TH};
}
function bakePlacementSeeds() {
  // Store the accepted PRNG states, not 240k matrices. Runtime replays each
  // accepted sample exactly, skipping the original rejection/noise searches.
  seed = placementSeed;
  const grassSeeds = [], flowerSeeds = [], grassSkips = [], flowerSkips = [];
  let guard = 0, skipped = 0;
  while (grassSeeds.length < 170000 && guard++ < 5e6) {
    const before = seed, x = -24 + rnd()*48, z = -34 + rnd()*58, y = H(x,z);
    if (y < 1.4 + fbm(x*.3,z*.3)*1.4 || pathD(x,z)<1.5 || coastZ(x)-z<2) { skipped++; continue; }
    grassSeeds.push(before);
    grassSkips.push(skipped); skipped=0;
    rnd(); rnd(); rnd(); // rotation, scale, color in buildGrass
  }
  const grassEndSeed = seed;
  guard = 0; skipped=0;
  while (flowerSeeds.length < 70000 && guard++ < 6e6) {
    const before = seed, x = -24 + rnd()*48, z = -30 + rnd()*54, y = H(x,z);
    if (flowerField(x,z) < .565 + rnd()*.05 || y<1.8 || pathD(x,z)<2 || coastZ(x)-z<2.4) { skipped++; continue; }
    if (fbm(x*.9,z*.9)<.47) { skipped++; continue; }
    flowerSeeds.push(before);
    flowerSkips.push(skipped); skipped=0;
    rnd(); rnd(); rnd(); rnd(); // height jitter, rotation, scale, color
  }
  if(grassSkips.some(n=>n>65535) || flowerSkips.some(n=>n>65535)) throw new Error('Placement skip overflow');
  return {grassSeeds:new Uint32Array(grassSeeds), flowerSeeds:new Uint32Array(flowerSeeds), grassSkips:new Uint16Array(grassSkips), flowerSkips:new Uint16Array(flowerSkips), placementSeed, grassEndSeed, flowerEndSeed:seed};
}
export {clamp,sstep,fract,fbm,rnd,getSeed,setSeed,ROCKS,pathCurve,pathLen,X0,X1,Z0,Z1,FW,FH,fD,fY,fH,H,pathD,flowerField,coastZ,samp,installHeightfield,bakeHeightfield,bakeTerrainPixels,bakePlacementSeeds};
