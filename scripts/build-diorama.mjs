import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import sharp from 'sharp';
import { bakeHeightfield, bakeTerrainPixels, bakePlacementSeeds } from '../effects/diorama/world.mjs';
import { encodeSceneData } from '../effects/diorama/scene-data.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

export async function buildDiorama() {
  // This directory contains only generated assets. Verify its resolved target
  // before removing stale hashes and the former full-size texture copies.
  const workspace = await realpath('.');
  const publicRoot = await realpath('public');
  if(publicRoot!==path.join(workspace,'public'))throw new Error('Unexpected static asset root');
  const generated=path.join(publicRoot,'diorama');
  const resolved=await realpath(generated).catch(error=>{if(error.code==='ENOENT')return generated;throw error;});
  if(resolved!==generated)throw new Error('Unexpected diorama output target');
  await rm(generated,{recursive:true,force:true});
  await mkdir('public/diorama', { recursive: true });
  async function emit(name,extension,bytes) {
    const hash=createHash('sha256').update(bytes).digest('hex').slice(0,16);
    const filename=name+'-'+hash+'.'+extension;
    await writeFile('public/diorama/'+filename,bytes);return filename;
  }
  const names=['leafy_grass','coast_sand_01','aerial_rocks_02','castle_wall_slates'];
  const inputs=await Promise.all(names.map(async name=>({d:await sharp('effects/diorama/assets/tex/'+name+'.jpg').resize(512,512).ensureAlpha().raw().toBuffer(),w:512,h:512})));
  const fields=bakeHeightfield();
  const pixels=bakeTerrainPixels(inputs);
  const placements=bakePlacementSeeds();
  // Only RGB is needed for classes. Avoid transparent RGB being discarded by
  // browser image decoders; the original DataTexture read the red byte only.
  const classes=Uint8Array.from({length:pixels.width*pixels.height},(_,i)=>pixels.cls[i*4]);
  const files={textures:{}};
  [files.data,files.color,files.classes,files.fox]=await Promise.all([
    emit('scene-data','bin',gzipSync(encodeSceneData(fields,placements),{level:9})),
    sharp(pixels.col,{raw:{width:pixels.width,height:pixels.height,channels:4}}).removeAlpha().webp({lossless:true,effort:5}).toBuffer().then(bytes=>emit('terrain-color','webp',bytes)),
    sharp(classes,{raw:{width:pixels.width,height:pixels.height,channels:1}}).png({compressionLevel:9}).toBuffer().then(bytes=>emit('terrain-classes','png',bytes)),
    readFile('effects/diorama/assets/models/Fox.glb').then(bytes=>emit('fox','glb',bytes)),
  ]);
  for(const name of ['aerial_rocks_02','castle_wall_slates','weathered_planks','bark_brown_02']) {
    const bytes=await sharp('effects/diorama/assets/tex/'+name+'.jpg').resize(512,512).webp({quality:90,effort:5}).toBuffer();
    files.textures[name]=await emit(name,'webp',bytes);
  }
  await build({ entryPoints: ['effects/diorama/scene-worker.mjs'], outfile: 'public/diorama/scene-worker.mjs', bundle: true, format: 'esm', target: 'es2022', minify: true, legalComments: 'linked', define:{__DIORAMA_FILES__:JSON.stringify(files)} });
  await Promise.all(['poster.jpg', 'credits.txt'].map(file => cp('effects/diorama/' + file, 'public/diorama/' + file)));
  await writeFile('public/diorama/asset-manifest.json',JSON.stringify(files,null,2)+'\n');
  const require = createRequire(import.meta.url);
  await cp(path.resolve(path.dirname(require.resolve('three')), '../LICENSE'), 'public/diorama/THREE-LICENSE.txt');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await buildDiorama();
