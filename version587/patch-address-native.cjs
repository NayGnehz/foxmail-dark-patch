'use strict';
// 587 exact address-member callbacks. This layer changes color operands only.
// Resource/HTML layers may compose around it without weakening code guards.
const crypto=require('crypto'),assert=require('assert');
const {readResources}=require('../pe-resource-utils.cjs'),{parseDFM}=require('../inspect-dfm-palette.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const guards=[
 [0xbdd100,544,'a3a1114c959b839723fdef35cad56b2e65309db556e58d705ab9b1fd48d9828d','member header'],
 [0xbdbc7c,1280,'44496d3fdabe0786087f817550ae8b1695c708af85254714c77d0480edfd77bd','loader callback bindings'],
 [0xbebeb0,288,'d18678a1e6b1b80b19e31bb2ed8952494bed34786877ada2e6742012667848a3','chooser panel header'],
 [0xbdd318,132,'397a92de3c71862354328dd046954e54a53a860f140aade808dea3d3943c8d8d','row-bottom pen routine'],
 [0xbdd39c,744,'a47038cf11f32cdf4380b6fefc26d1fb029bb0dc4673e816171f4039fcb99098','member row draw routes'],
];
const patches=[
 [0xbdd19d,0x68,0xfcfaf8,0x282828,'member header normal gradient start'],
 [0xbdd1a2,0x68,0xf6f3ef,0x202020,'member header normal gradient end'],
 [0xbdd1c6,0xba,0xd2cbc8,0x3d3d3d,'member header bottom pen'],
 [0xbdd236,0xba,0xc9c4bf,0x3d3d3d,'member header column divider'],
 [0xbdd2d3,0x68,0xeae4db,0x333333,'member header hot gradient start'],
 [0xbdd2d8,0x68,0xf1ede6,0x282828,'member header hot gradient end'],
 [0xbdd2f1,0x68,0xb2a499,0x3d3d3d,'member header vertical edge start'],
 [0xbdd2f6,0x68,0xeae5df,0x3d3d3d,'member header vertical edge end'],
 [0xbdd366,0xba,0xdadada,0x3d3d3d,'unselected address member row bottom pen'],
 [0xbebf3e,0xba,0xd0c7be,0x3d3d3d,'chooser panel header bottom pen'],
];
function patchBuffer(input){
 const out=Buffer.from(input),pe=out.readUInt32LE(60),op=pe+24,so=op+out.readUInt16LE(pe+20),base=out.readUInt32LE(op+28);
 assert.equal(base,0x400000);assert.equal(out.readUInt16LE(pe+4),0x14c);assert.equal(out.readUInt16LE(op),0x10b);
 const sections=Array.from({length:out.readUInt16LE(pe+6)},(_,i)=>{const p=so+40*i;return{name:out.toString('ascii',p,p+8).replace(/\0/g,''),r:out.readUInt32LE(p+12),n:out.readUInt32LE(p+16),p:out.readUInt32LE(p+20)};});
 const off=(va,size=5)=>{const s=sections.find(s=>va-base>=s.r&&va-base+size<=s.r+s.n);assert(s&&s.name==='CODE','Only existing native CODE may change');return s.p+va-base-s.r;};
 for(const[va,size,hash,label]of guards)assert.equal(sha(out.subarray(off(va,size),off(va,size)+size)),hash,'Exact 587 paint guard '+label);
 const changes=patches.map(([va,opcode,before,after,label])=>{const p=off(va);assert.equal(out[p],opcode,label);assert.equal(out.readUInt32LE(p+1),before,label);return{kind:'native-color',va,opcode,before,after,label,offset:p+1,size:4};});
 const resources=readResources(out).resources.filter(r=>r.type===10&&r.name==='TDLG_SELADDR');assert.equal(resources.length,1);
 const r=resources[0],tree=parseDFM(out.subarray(r.offset,r.offset+r.size));assert.equal(tree.className,'TDlg_SelAddr');assert.equal(tree.name,'Dlg_SelAddr');
 const color=tree.properties.filter(p=>p.name==='Color');assert.equal(color.length,1);assert.equal(color[0].type,4);assert.equal(color[0].value,0xfefaf9);
 changes.push({kind:'DFM-color',resource:r.name,label:'address chooser inherited root background',property:'.Dlg_SelAddr.Color',before:0xfefaf9,after:0x202020,offset:r.offset+color[0].offset+1,size:4});
 const mergeResources=readResources(out).resources.filter(r=>r.type===10&&r.name==='TMERGECONTACTSFORM');assert.equal(mergeResources.length,1);
 const mr=mergeResources[0],mergeTree=parseDFM(out.subarray(mr.offset,mr.offset+mr.size));assert.equal(mergeTree.className,'TMergeContactsForm');
 const targets=new Map([
  ['.MergeContactsForm.xpl',[0xfaf7f3,0x202020]],
  ['.MergeContactsForm.xpl.contentTopPnl',[0xfaf7f3,0x202020]],
  ['.MergeContactsForm.topPanel',[0xf7f4f0,0x282828]],
  ['.MergeContactsForm.pnlNoMergeContact',[0xfaf7f3,0x202020]],
 ]);let found=0;
 function walk(o,p=''){p+='.'+o.name;if(targets.has(p)){assert.equal(o.className,'TXPanel');const q=o.properties.filter(x=>x.name==='Color'),[before,after]=targets.get(p);assert.equal(q.length,1);assert.equal(q[0].type,4);assert.equal(q[0].value,before);changes.push({kind:'DFM-color',resource:mr.name,label:'contact merge panel background',property:p+'.Color',before,after,offset:mr.offset+q[0].offset+1,size:4});found++;}for(const c of o.children)walk(c,p);}
 walk(mergeTree);assert.equal(found,4);
 for(const c of changes)out.writeUInt32LE(c.after,c.offset);
 let changedBytes=0;for(let i=0;i<input.length;i++)if(out[i]!==input[i]){assert(changes.some(c=>i>=c.offset&&i<c.offset+4),'Unexpected native delta');changedBytes++;}
 assert.equal(changedBytes,45);const reversed=Buffer.from(out);for(const c of changes)reversed.writeUInt32LE(c.before,c.offset);assert(reversed.equals(input),'Color reversal must restore exact input');
 const afterTree=parseDFM(out.subarray(r.offset,r.offset+r.size));assert.equal(afterTree.properties.find(p=>p.name==='Color').value,0x202020);
 assert.equal(parseDFM(out.subarray(mr.offset,mr.offset+mr.size)).className,'TMergeContactsForm');
 return{buffer:out,changes,changedBytes,guards:guards.map(([va,size,hash,label])=>({va,size,hash,label})),onlyNumericColors:true};
}
module.exports={patchBuffer,patches,guards};
if(require.main===module){
 const fs=require('fs'),path=require('path'),paths=require('../foxmail-paths.cjs');
 const input='D:/Users/Public/Downloads/Foxmail/Foxmail深色.exe',b=fs.readFileSync(input),baselineSHA256='233e7bdfb5f0d3e688a46b7e9eccbed3572795b5312e7d5c810ad4a8b1b387c6';
 assert.equal(sha(b),baselineSHA256);const result=patchBuffer(b),stage=paths.output('version587-address-native'),dest=path.join(stage,'Foxmail深色.exe');fs.writeFileSync(dest,result.buffer);
 const report={input,dest,baselineSHA256,candidateSHA256:sha(result.buffer),generatorSHA256:sha(fs.readFileSync(__filename)),changes:result.changes,changedBytes:result.changedBytes,guardedFunctions:result.guards,onlyNumericColors:true,nativeColorOperands:10,dfmNumericProperties:5,originalLengthUnchanged:true,allOtherBytesUnchanged:true,instructionOpcodesAndBoundariesUnchanged:true,reverseRestoresExactInput:true,installed:false,scope:'Address loader header normal/hot gradients and border pens, unselected row-bottom pen, chooser panel-header pen, exact chooser DFM root Color DWORD and four named contact-merge TXPanel Color DWORDs. No new calls, hooks, branches, resource allocations, manifests, DPI, fonts, selected-row colors or HTML changes. Existing chooser DFM borders already 3D3D3D are retained.'};
 fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({candidateSHA256:report.candidateSHA256,patches:result.changes.length,changedBytes:result.changedBytes,dest}));
}
