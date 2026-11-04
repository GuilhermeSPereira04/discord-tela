import test, {before} from 'node:test';
import assert from 'node:assert/strict';
import {bakeHeightfield,bakePlacementSeeds} from '../effects/diorama/world.mjs';
import {encodeSceneData,decodeSceneData} from '../effects/diorama/scene-data.mjs';
let fields,placements,encoded;
before(()=>{fields=bakeHeightfield();placements=bakePlacementSeeds();encoded=encodeSceneData(fields,placements);});

test('build-time fields and accepted random states survive compact encoding exactly',()=>{
  const decoded=decodeSceneData(encoded.buffer);
  for(const name of ['fD','fY','fH'])assert.deepEqual(decoded[name],fields[name]);
  assert.deepEqual(decoded.grassSeeds,placements.grassSeeds);
  assert.deepEqual(decoded.flowerSeeds,placements.flowerSeeds);
  assert.equal(decoded.grassEndSeed,placements.grassEndSeed);
  assert.equal(decoded.flowerEndSeed,placements.flowerEndSeed);
});
test('truncated or incompatible generated data is rejected rather than drawn',()=>{
  assert.throws(()=>decodeSceneData(encoded.buffer.slice(0,12)),/truncated/);
  assert.throws(()=>decodeSceneData(encoded.buffer.slice(0,-4)),/size mismatch/);
  const wrong=encoded.slice();new Uint32Array(wrong.buffer)[1]=999;
  assert.throws(()=>decodeSceneData(wrong.buffer),/version mismatch/);
});
test('a corrupt placement stream cannot replay an unbounded number of random draws',()=>{
  const wrong=encoded.slice();
  const header=new Uint32Array(wrong.buffer,0,9);
  new Uint16Array(wrong.buffer,36+3*header[2]*header[3]*4,header[4]).fill(65535);
  assert.throws(()=>decodeSceneData(wrong.buffer),/replay limit/);
});
