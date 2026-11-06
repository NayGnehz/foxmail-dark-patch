'use strict';
// Combine independently audited deltas from one exact accepted baseline.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const {readResources}=require('../pe-resource-utils.cjs'),{patchBuffer}=require('./patch-address-native.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p));
const stage=paths.output('version587-ui-followups'),baselineSHA256='233e7bdfb5f0d3e688a46b7e9eccbed3572795b5312e7d5c810ad4a8b1b387c6';
const input=path.join(paths.output('version587-group-border-rgba'),'Foxmail深色.exe'),base=read(input);assert.equal(sha(base),baselineSHA256);
const searchStage=paths.output('version587-search-style'),nativeStage=paths.output('version587-address-native'),htmlStage=paths.output('version587-address-html');
const s=json(path.join(searchStage,'validation.json')),p=json(path.join(searchStage,'pixel-validation.json')),n=json(path.join(nativeStage,'validation.json')),h=json(path.join(htmlStage,'validation.json')),t=json(path.join(htmlStage,'html-tests.json'));
assert.equal(s.baselineSHA256,baselineSHA256);assert.equal(n.baselineSHA256,baselineSHA256);
assert.equal(s.candidateSHA256,'85ea6622c8dae516fccf5e9a0d7121815a6c008f19029bef5fa27dffa38c2cd6');assert.equal(n.candidateSHA256,'61097d25ddd634b11a9e212145dbc0c926092d77155f81788f8edb05430cae28');
assert.equal(s.changes.length,8);assert(s.codeUnchanged&&s.otherResourcesUnchanged&&s.peHeadersUnchanged&&s.fileSizeUnchanged&&s.originalAtlasDimensionsAndStateOrderPreserved&&s.glyphsDerivedFromOriginal);
assert(p.passed&&p.checks===410&&p.candidateSHA256===s.candidateSHA256&&p.sourceSHA256===s.generatorSHA256);
assert(n.onlyNumericColors&&n.nativeColorOperands===10&&n.dfmNumericProperties===5&&n.allOtherBytesUnchanged&&n.instructionOpcodesAndBoundariesUnchanged&&n.reverseRestoresExactInput);
assert(h.scriptsAndContentUnchanged&&h.screenOnly&&t.passed&&t.cases.length===8&&t.fieldsAndCallbacksUnchanged&&t.geometryAndFontsUnchanged&&t.focusedTypingChecked&&t.screenOnly&&t.syntheticOnly&&t.noLiveDataOrBridge);
assert.equal(t.candidateSHA256,h.afterSHA256);assert.equal(sha(read(h.source)),h.afterSHA256);assert.equal(sha(read(h.before)),h.beforeSHA256);
const sourceBindings=[['search-style.cjs',s.generatorSHA256],['check-search-style.cjs',p.checkSHA256],['patch-address-native.cjs',n.generatorSHA256],['address-book-html.cjs',h.generatorSHA256],['address-book-screen.css',h.cssSHA256],['verify-address-book-html.cjs',t.verifierSHA256]];
for(const [file,hash]of sourceBindings)assert.equal(sha(read(path.join(__dirname,file))),hash,'Verified component source changed: '+file);
const search=read(s.dest),native=read(n.dest);assert.equal(sha(search),s.candidateSHA256);assert.equal(sha(native),n.candidateSHA256);assert.equal(search.length,base.length);assert.equal(native.length,base.length);
const out=Buffer.from(base),searchRanges=s.changes.flatMap(c=>[[c.offset,c.offset+Math.max(c.oldSize,c.newSize)],[c.dataEntry+4,c.dataEntry+8]]),nativeRanges=n.changes.map(c=>[c.offset,c.offset+4]);
let changedBytes=0,searchBytes=0,nativeBytes=0;
for(let i=0;i<base.length;i++){
 const a=search[i]!==base[i],b=native[i]!==base[i];
 if(a){assert(searchRanges.some(([x,y])=>x<=i&&i<y),'Unexpected search delta');searchBytes++;}
 if(b){assert(nativeRanges.some(([x,y])=>x<=i&&i<y),'Unexpected address delta');nativeBytes++;}
 if(a&&b)assert.equal(search[i],native[i],'Overlapping independent deltas conflict');
 if(a||b){out[i]=b?native[i]:search[i];changedBytes++;}
}
assert.equal(nativeBytes,45);assert.equal(searchBytes,s.changedBytes);assert.equal(changedBytes,searchBytes+nativeBytes,'Layers must be disjoint');
const chained=patchBuffer(search);assert(chained.buffer.equals(out),'Byte-union must equal guarded native patch applied to search candidate');
const pe=base.readUInt32LE(60),op=pe+24,so=op+base.readUInt16LE(pe+20);assert(out.subarray(0,base.readUInt32LE(op+60)).equals(base.subarray(0,base.readUInt32LE(op+60))));
const preservedExecutableSections=[];
for(let i=0;i<base.readUInt16LE(pe+6);i++){const at=so+40*i,name=base.toString('ascii',at,at+8).replace(/\0/g,''),offset=base.readUInt32LE(at+20),size=base.readUInt32LE(at+16);
 if(base.readUInt32LE(at+36)&0x20000000&&name!=='CODE'){assert(out.subarray(offset,offset+size).equals(base.subarray(offset,offset+size)));preservedExecutableSections.push(name);}}
const oldResources=readResources(base).resources,newResources=readResources(out).resources;assert.equal(oldResources.length,newResources.length);
const changedNames=new Set([...s.changes.map(c=>c.name),...n.changes.filter(c=>c.kind==='DFM-color').map(c=>c.resource)]);
for(let i=0;i<oldResources.length;i++){const a=oldResources[i],b=newResources[i];assert.equal(a.type,b.type);assert.equal(a.name,b.name);assert.equal(a.offset,b.offset);assert.equal(a.lang,b.lang);if(!changedNames.has(a.name)){assert.equal(a.size,b.size);assert(out.subarray(b.offset,b.offset+b.size).equals(base.subarray(a.offset,a.offset+a.size)));}}
const dest=path.join(stage,'Foxmail深色.exe');fs.writeFileSync(dest,out);
const report={input,dest,baselineSHA256,candidateSHA256:sha(out),generatorSHA256:sha(read(__filename)),sourceBindings:sourceBindings.map(([file,sha256])=>({file,sha256})),
 search:{candidateSHA256:s.candidateSHA256,changes:s.changes.length,changedBytes:searchBytes,pixelChecks:p.checks},address:{candidateSHA256:n.candidateSHA256,nativeColorOperands:10,dfmNumericProperties:5,changedBytes:nativeBytes},
 template:h,templateTests:{cases:8,sourceSHA256:t.verifierSHA256,candidateSHA256:t.candidateSHA256,passed:true},changedBytes,layersDisjoint:true,guardedChainedPatchMatches:true,otherResourcesUnchanged:true,peHeadersAndFileSizeUnchanged:true,preservedExecutableSections,
 helperSHA256:'0e471e40cb64e5acf13d22a129849110b0ad2d21d7d4c7110036892aaa135c70',composeTemplateSHA256:'c3a898dcbccbe41d882c0b32bd28654d32a680ab0320ec4ec2d9b9a97d4eada8',baseCssSHA256:'8e56648adcef1ed81621930e111c446b5075e4f28c27b370c792d7dc68eef5b8',
 scope:'Search PNG resources plus exact address-list/header color operands and five address DFM background DWORDs; one address-book HTML shell with screen-only CSS. Accepted native display helpers, compose/print templates, DPI, fonts, event routes and contact data untouched.',visualAccepted:false};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({candidateSHA256:report.candidateSHA256,changedBytes,searchBytes,nativeBytes,templateSHA256:h.afterSHA256,allChecksPassed:true}));
