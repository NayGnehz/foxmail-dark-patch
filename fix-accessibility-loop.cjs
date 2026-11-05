'use strict';
// Candidate correction for Foxmail 7.2.25.563's MSAA parent traversal.
// A node with an implausibly large index already takes a special branch. The
// original branch still reads Parent, walking beyond the virtual root into its
// owner object. Redirect only that branch to the existing normal loop exit.
// No COM entry/exit, exception cleanup, valid-node formatting or ABI changes.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const [, , source,dest]=process.argv;
if(!source||!dest||path.resolve(source)===path.resolve(dest))throw Error('Supply distinct input/output paths');
const input=fs.readFileSync(source),out=Buffer.from(input),pe=out.readUInt32LE(60),op=pe+24;
if(out.readUInt16LE(op)!==0x10b||out.readUInt16LE(pe+4)!==0x14c)throw Error('Expected x86 PE32');
const so=op+out.readUInt16LE(pe+20),sections=[];
for(let i=0;i<out.readUInt16LE(pe+6);i++){const p=so+i*40;sections.push({rva:out.readUInt32LE(p+12),size:out.readUInt32LE(p+16),raw:out.readUInt32LE(p+20)});}
const offset=rva=>{const s=sections.find(s=>rva>=s.rva&&rva<s.rva+s.size);if(!s)throw Error('RVA not mapped');return s.raw+rva-s.rva;};
function expect(rva,hex){const want=Buffer.from(hex,'hex');if(!out.subarray(offset(rva),offset(rva)+want.length).equals(want))throw Error('Version/byte precondition failed at RVA '+rva.toString(16));}
expect(0x566154,'558becb9050000006a006a004975f9');
expect(0x5661d5,'8b45f4813840420f00733a');
expect(0x56621a,'8b45f48b401a8945f4837df40075ac');
expect(0x566229,'8b451c8b4df8ba9c629600');
expect(0x566280,'8b45fc8be55dc21800');
const guardOffset=offset(0x5661df);out[guardOffset]=0x49;
// Validate actual extracted branch and parent-load instructions against synthetic
// node chains. String-building calls are represented only by an append callback;
// this is a control-flow regression test, not a full MSAA or application test.
function traverse(bytes,nodes,start){let node=start,pc=0x5661d5,eax=0,above=false,iterations=0;const accepted=[];
 const read=p=>{if(!nodes.has(p))throw Error('invalid synthetic node '+p.toString(16));return nodes.get(p);};
 while(true){if(++iterations>500)throw Error('test traversal did not terminate');if(pc===0x566229)return accepted;
  const p=offset(pc);
  if(pc===0x5661d5){if(bytes.subarray(p,p+3).toString('hex')!=='8b45f4')throw Error('mov precondition');eax=node;pc+=3;}
  else if(pc===0x5661d8){if(bytes[p]!==0x81||bytes[p+1]!==0x38)throw Error('cmp precondition');above=(read(eax).index>>>0)>=bytes.readUInt32LE(p+2);pc+=6;}
  else if(pc===0x5661de){if(bytes[p]!==0x73)throw Error('jae precondition');pc=above?pc+2+bytes.readInt8(p+1):pc+2;}
  else if(pc===0x5661e0){accepted.push(read(node).index);pc=0x56621a;}
  else if(pc===0x56621a){if(bytes.subarray(p,p+6).toString('hex')!=='8b45f48b401a')throw Error('parent precondition');node=read(node).parent;pc=node?0x5661d5:0x566229;}
  else throw Error('Unexpected control flow '+pc.toString(16));
 }
}
const simple=new Map([[0x1000,{index:3,parent:0x2000}],[0x2000,{index:0,parent:0}]]);
const sentinel=new Map([...simple,[0x3000,{index:0x964000,parent:0x458bff40}]]);sentinel.set(0x2000,{index:0,parent:0x3000});
if(JSON.stringify(traverse(input,simple,0x1000))!==JSON.stringify(traverse(out,simple,0x1000)))throw Error('Normal traversal changed');
let originalFault=false;try{traverse(input,sentinel,0x1000);}catch(e){originalFault=/invalid synthetic node/.test(e.message);}if(!originalFault)throw Error('Original did not reproduce sentinel fault');
if(JSON.stringify(traverse(out,sentinel,0x1000))!=='[3,0]')throw Error('Patched sentinel did not preserve preceding valid indexes');
if(traverse(out,new Map([[0x1000,{index:1000000,parent:0x458bff40}]]),0x1000).length!==0)throw Error('Threshold guard failed');
if(traverse(out,new Map([[0x1000,{index:999999,parent:0}]]),0x1000)[0]!==999999)throw Error('Normal threshold changed');
const changedRanges=[{offset:guardOffset,originalHex:'3a',newHex:'49'}];
for(const [p,n]of[[op+64,4],[op+128,8]])if(out.subarray(p,p+n).some(x=>x)){changedRanges.push({offset:p,originalHex:out.subarray(p,p+n).toString('hex'),newHex:'00'.repeat(n)});out.fill(0,p,p+n);}
const undo=Buffer.from(out);for(const r of changedRanges)Buffer.from(r.originalHex,'hex').copy(undo,r.offset);if(!undo.equals(input))throw Error('Reversibility check failed');
fs.writeFileSync(dest,out);
const report={source,dest,inputSHA256:sha(input),outputSHA256:sha(out),candidate:true,branchRVA:'0x5661de',changedByteRVA:'0x5661df',originalTargetRVA:'0x56621a',patchedTargetRVA:'0x566229',changedRanges,tests:['normal chain unchanged','original sentinel chain reproduces invalid-node fault','patched sentinel stops before invalid parent','index 1000000 stops','index 999999 still accepted','byte-for-byte undo verified'],limitation:'Heap parent chain was not present in crash dump; actual application validation is still required.',sourceEvidence:'https://github.com/JAM-Software/Virtual-TreeView/blob/master/Source/VirtualTrees.BaseTree.pas#L4091-L4096'};
fs.writeFileSync(dest+'.accessibility-fix.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
