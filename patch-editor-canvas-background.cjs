'use strict';
// Static, type-3-only browser canvas initialization; never changes HTML/CSS.
const patches=[{
  va:0xb7b626,rva:0x77b626,length:36,
  before:'8b45fcc74004010000008b45fcc74008050000008b45fc83c014ba5cb6b700e87aa288ff',
  after:'8b45fc6a015a895004c7400805000000c74018202020ff83c014ba5cb6b700e87aa288ff',
  name:'HTML editor pool type 3: opaque #202020 Chromium canvas background'
}];
const allowedRvaRanges=patches.map(p=>({rva:p.rva,length:p.length}));
function patchOriginal(out,off){
  const guard=(va,hex)=>{const b=Buffer.from(hex,'hex'),p=off(va-0x400000);if(!out.subarray(p,p+b.length).equals(b))throw Error('Editor canvas guard mismatch at '+va.toString(16));};
  guard(0xb7b60c,'558bec51b003e859ffffff8945fc8b45fce81601000084c0752c');
  guard(0xb7b64a,'8b45fce802010000595dc3');
  guard(0xb7b658,'0a0000007500740066002d0038000000');
  guard(0xb7aa4c,'8b45f48b008b406c8b55f0895034');
  guard(0xb5e6ae,'8b45fc8b406c8b40348b55f889829c000000');
  for(const p of patches)guard(p.va,p.before);
  for(const p of patches)Buffer.from(p.after,'hex').copy(out,off(p.rva));
  return patches;
}
module.exports={patchOriginal,patches,allowedRvaRanges};
