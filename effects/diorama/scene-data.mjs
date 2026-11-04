import {FW,FH} from './world.mjs';

const MAGIC = 0x314f4944, VERSION = 2, HEADER = 36;
// Build and workers share this small binary contract. Fields retain Float32
// precision; accepted PRNG states retain every placement/color/scale decision.
export function encodeSceneData(fields, placements) {
  const arrays = [fields.fD,fields.fY,fields.fH,placements.grassSkips,placements.flowerSkips];
  const buffer = new ArrayBuffer(HEADER + arrays.reduce((sum,a)=>sum+a.byteLength,0));
  new Uint32Array(buffer,0,9).set([MAGIC,VERSION,FW,FH,placements.grassSkips.length,placements.flowerSkips.length,placements.grassEndSeed,placements.flowerEndSeed,placements.placementSeed]);
  const bytes = new Uint8Array(buffer);
  let offset = HEADER;
  for(const array of arrays){bytes.set(new Uint8Array(array.buffer,array.byteOffset,array.byteLength),offset);offset+=array.byteLength;}
  return bytes;
}
export function decodeSceneData(buffer) {
  if(buffer.byteLength<HEADER) throw new Error('Diorama data truncated');
  const header = new Uint32Array(buffer,0,9);
  if(header[0]!==MAGIC || header[1]!==VERSION || header[2]!==FW || header[3]!==FH) throw new Error('Diorama data version mismatch');
  if(header[4]!==170000 || header[5]!==70000) throw new Error('Diorama placement count mismatch');
  const expected = HEADER + 3*FW*FH*4 + (header[4]+header[5])*2;
  if(buffer.byteLength!==expected) throw new Error('Diorama data size mismatch');
  let offset=HEADER;
  function view(Type,count){const a=new Type(buffer,offset,count);offset+=count*Type.BYTES_PER_ELEMENT;return a;}
  const fields={fD:view(Float32Array,FW*FH),fY:view(Float32Array,FW*FH),fH:view(Float32Array,FW*FH)};
  let seed=header[8], draws=0;
  if(seed===0 || seed>=2147483647)throw new Error('Diorama invalid seed');
  function advance(n){
    draws+=n;
    if(draws>32000000)throw new Error('Diorama seed replay limit');
    while(n-->0)seed=(seed*16807)%2147483647;
  }
  function replay(skips,rejectedDraws,acceptedDraws){
    const states=new Uint32Array(skips.length);
    for(let i=0;i<skips.length;i++){advance(skips[i]*rejectedDraws);states[i]=seed;advance(acceptedDraws);}
    return states;
  }
  // Small skip counts compress far better than random 31-bit PRNG states.
  // Replaying integer draws avoids redoing noise/terrain rejection searches.
  const grassSeeds=replay(view(Uint16Array,header[4]),2,5);
  if(seed!==header[6])throw new Error('Diorama grass seed mismatch');
  const flowerSeeds=replay(view(Uint16Array,header[5]),3,7);
  if(seed!==header[7])throw new Error('Diorama flower seed mismatch');
  return {...fields,grassSeeds,flowerSeeds,grassEndSeed:header[6],flowerEndSeed:header[7]};
}
