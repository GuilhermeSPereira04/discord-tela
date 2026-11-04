// Download only the seven public assets named by the inspected upstream script.
// This does not install a skill or run content obtained from an asset URL.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const textures = ['leafy_grass', 'coast_sand_01', 'aerial_rocks_02', 'castle_wall_slates', 'weathered_planks', 'bark_brown_02'];
const assets = textures.map(name => ({
  path: `reference/assets/tex/${name}.jpg`,
  url: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${name}/${name}_diff_1k.jpg`,
  license: 'CC0-1.0', source: `https://polyhaven.com/a/${name}`
}));
assets.push({path:'reference/assets/models/Fox.glb',
  url:'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Fox/glTF-Binary/Fox.glb',
  license:'Model CC0-1.0; rig/animation/conversion CC-BY-4.0',
  source:'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox',
  credit:'PixelMannen (model); tomkranis (rig and animation); @AsoboStudio and @scurest (glTF conversion)'});
const results = await Promise.allSettled(assets.map(async entry => {
  const target = new URL(entry.path, root);
  await fs.mkdir(new URL('./', target), {recursive:true});
  let bytes;
  try { bytes = await fs.readFile(target); } catch {}
  if (!bytes?.length) {
    const response = await fetch(entry.url, {signal:AbortSignal.timeout(60000)});
    if (!response.ok) throw new Error(`${response.status}: ${entry.url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (entry.path.endsWith('.jpg') && (bytes[0] !== 255 || bytes[1] !== 216)) throw new Error('Not JPEG: '+entry.url);
    if (entry.path.endsWith('.glb') && bytes.toString('ascii',0,4) !== 'glTF') throw new Error('Not GLB: '+entry.url);
    await fs.writeFile(target, bytes);
  }
  return {...entry, bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}));
const manifest = {checkedAt:new Date().toISOString(),assets:results.map((result,i)=>result.status==='fulfilled'?result.value:{...assets[i],error:String(result.reason)})};
await fs.writeFile(new URL('asset-manifest.json',root),JSON.stringify(manifest,null,2)+'\n');
for (const entry of manifest.assets) console.log(entry.error || `${entry.path}: ${entry.bytes} bytes`);
if(results.some(result=>result.status==='rejected')) process.exitCode=1;
