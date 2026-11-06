'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),vm=require('vm'),crypto=require('crypto');
const paths=require('../foxmail-paths.cjs'),root=paths.project,stage=paths.output(process.env.FOXMAIL_587_PORTED_NATIVE==='1'?'version587-native':'version587');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const plan=JSON.parse(fs.readFileSync(path.join(stage,'validation.json'),'utf8'));
const input=fs.readFileSync(plan.dest),map=JSON.parse(fs.readFileSync(path.join(paths.output('version587'),'native-map.json'),'utf8'));
assert.equal(sha(input),plan.candidateSHA256);
const addresses=new Map();
for(const x of map.code){addresses.set(x.oldVA,x.newVA);for(const [a,b]of x.instructionMap){if(addresses.has(a))assert.equal(addresses.get(a),b,'Overlapping instruction mapping disagrees');addresses.set(a,b);}}
const mapped=a=>{assert(addresses.has(a),'No independently verified instruction mapping '+a.toString(16));return addresses.get(a);};
const pe=input.readUInt32LE(60),op=pe+24,so=op+input.readUInt16LE(pe+20),sections=[];
for(let i=0;i<input.readUInt16LE(pe+6);i++){const q=so+i*40;sections.push({r:input.readUInt32LE(q+12),p:input.readUInt32LE(q+20),n:input.readUInt32LE(q+16)});}
function off(va){const s=sections.find(s=>va-0x400000>=s.r&&va-0x400000<s.r+s.n);assert(s);return s.p+va-0x400000-s.r;}
let out=Buffer.from(input);const changes=[];
for(const [oldVA,opcode,before,after,label]of require('../patch-native-header-colors.cjs').patches){const va=mapped(oldVA),p=off(va);
 if(opcode==='rgb'){assert.equal(out[p],0xb1);assert.equal(out[p+2],0xb2);assert.equal(out[p+4],0xb0);for(const d of [1,3,5]){assert.equal(out[p+d],before);out[p+d]=after;}changes.push({label,oldVA,newVA:va,offset:p,size:6});}
 else{assert.equal(out[p],opcode);assert.equal(out.readUInt32LE(p+1),before,label);out.writeUInt32LE(after,p+1);changes.push({label,oldVA,newVA:va,offset:p+1,size:4});}
}
// Reuse the original per-property/type/field/ABI guards with verified 587 VAs.
const ids=[0xb274a2,0xb42afe,0xb715a9,0xc230ff,0xc23171,0xc231f6,0xc23268,0xc23313,0xb433e8,0xb27970];
let source=fs.readFileSync(path.join(root,'cosmetic-1.3/patch-edit-family-underpaint.cjs'),'utf8');
// The initial 587 port did not include the earlier four proxy-field changes.
// Verify those exact extra clNone properties before admitting145 instead of141.
const {readResources}=require('../pe-resource-utils.cjs'),{parseDFM}=require('../inspect-dfm-palette.cjs');
const coverage=JSON.parse(fs.readFileSync(path.join(root,'cosmetic-1.3/audit-edit-family-underpaint.json'),'utf8')).coverage.controls;
const known=new Set(coverage.filter(x=>x.propertyValue==='clNone').map(x=>x.resource+'|'+x.path));const extra=[];
for(const r of readResources(out).resources){if(r.type!==10||out.toString('ascii',r.offset,r.offset+4)!=='TPF0')continue;
 const walk=(o,p)=>{p+='.'+o.name;const property=o.properties.find(x=>x.name==='transparentColor');if(['TFMEdit','TFMNumberEdit','TFMZRichEdit','TFMComboBox'].includes(o.className)&&property?.value==='clNone'&&!known.has(r.name+'|'+p))extra.push(r.name+'|'+p+'|'+o.className);o.children.forEach(c=>walk(c,p));};walk(parseDFM(out.subarray(r.offset,r.offset+r.size)),'');}
assert.deepEqual(extra.sort(),['edtEmailProxyServer|TFMEdit','edtEmailProxyUserID|TFMEdit','edtEmailProxyPort|TFMNumberEdit','edtEmailProxyPassword|TFMEdit'].map(x=>'TNETWORKOPTIONFRAME|.NetworkOptionFrame.grpLine.gbEmailProxy.'+x).sort());
assert(source.includes('propertiesChanged!==141'));source=source.replace('propertiesChanged!==141','propertiesChanged!==145');
for(const id of ids)source=source.replace(new RegExp('0x'+id.toString(16)+'\\b','g'),'0x'+mapped(id).toString(16));
const mod={exports:{}};const req=require('module').createRequire(path.join(root,'cosmetic-1.3/patch-edit-family-underpaint.cjs'));
vm.runInNewContext(source,{require:req,module:mod,Buffer,console,process},{filename:'587-edit-family-guarded.cjs'});
const family=mod.exports.patchBuffer(out);out=family.buffer;
const prefix=Buffer.from('8b45fcc74004010000008b45fcc74008050000008b45fc83c014','hex');
const matches=[];let at=-1;while((at=out.indexOf(prefix,at+1))>=0)matches.push(at);assert.equal(matches.length,1,'type3 initializer must be unique');
const at0=matches[0];assert.equal(out[at0+26],0xba);assert.equal(out[at0+31],0xe8);
const charset=out.readUInt32LE(at0+27);assert(out.subarray(off(charset-4),off(charset-4)+16).equals(Buffer.from('0a0000007500740066002d0038000000','hex')));
const site=sections.find(s=>at0>=s.p&&at0<s.p+s.n);const va=0x400000+site.r+at0-site.p;
assert.equal(va+36+out.readInt32LE(at0+32),0x4058c4,'BSTR assignment routine changed');
const patch=Buffer.from('8b45fc6a015a895004c7400805000000c74018202020ff83c014ba00000000e800000000','hex');
assert.equal(patch.length,36);out.copy(patch,27,at0+27,at0+31);out.copy(patch,32,at0+32,at0+36);patch.copy(out,at0);
changes.push(...family.changes,{label:'587 type3 initial opaque Chromium background',newVA:va,offset:at0,size:36,backgroundARGB:'FF202020',originalCharsetAndAssignmentCallPreserved:true});
const ranges=changes.map(x=>[x.offset,x.offset+x.size]).sort((a,b)=>a[0]-b[0]);let range=0,changedBytes=0;
for(let i=0;i<input.length;i++)if(input[i]!==out[i]){while(range<ranges.length&&ranges[range][1]<=i)range++;assert(range<ranges.length&&ranges[range][0]<=i,'Unlisted native-layer change '+i);changedBytes++;}
fs.writeFileSync(path.join(stage,'Foxmail深色-native-colors.exe'),out);
fs.writeFileSync(path.join(stage,'native-colors-validation.json'),JSON.stringify({version:'7.2.25.587',inputSHA256:sha(input),candidateSHA256:sha(out),dest:path.join(stage,'Foxmail深色-native-colors.exe'),changes,changedBytes,familyCoverage:family.coverage,headers:require('../patch-native-header-colors.cjs').patches.length,scope:'Named/mapped header color immediates, exact edit-family defaults/runtime properties and145 serialized clNone props, unique guarded36-byte type3 initialization. No new branches/calls in this layer except verified type3 instruction-equivalent rewrite; original BSTR call and charset preserved.',notYetPorted:process.env.FOXMAIL_587_PORTED_NATIVE==='1'?['main/settings/compose reveal gates','native gradient optimization']:['native initial-erase prefills','main/settings/compose reveal gates','native gradient optimization'],installed:false},null,2));
console.log(JSON.stringify({headers:require('../patch-native-header-colors.cjs').patches.length,dfmProperties:family.coverage.propertiesChanged,type3VA:va.toString(16),sha:sha(out)}));
