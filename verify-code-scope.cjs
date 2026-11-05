'use strict';
const fs=require('fs');
const {patches}=require('./patch-native-header-colors.cjs');
const [originalPath,candidatePath,metaPath]=process.argv.slice(2);
const original=fs.readFileSync(originalPath),candidate=fs.readFileSync(candidatePath),meta=JSON.parse(fs.readFileSync(metaPath,'utf8'));
function sections(b){const pe=b.readUInt32LE(60),op=pe+24,so=op+b.readUInt16LE(pe+20);return Array.from({length:b.readUInt16LE(pe+6)},(_,i)=>{const p=so+i*40;return {name:b.toString('ascii',p,p+8).replace(/\0/g,''),rva:b.readUInt32LE(p+12),raw:b.readUInt32LE(p+20),size:b.readUInt32LE(p+16)};});}
const src=sections(original),dst=sections(candidate),code=src.find(s=>s.name==='CODE'),after=dst.find(s=>s.name==='CODE');
if(!code||!after||code.size!==after.size||code.rva!==after.rva)throw Error('CODE section layout changed');
const allowed=new Set();
for(const [va,opcode] of patches)for(const i of opcode==='rgb'?[1,3,5]:[1,2,3,4])allowed.add(va-0x400000+i);
allowed.add(0x5661df); // Verified accessibility root traversal conditional displacement.
allowed.add(0x49da16); // FMShadowWnd only: clear WS_BORDER at its guarded CreateWindow style.
for(const p of require('./patch-native-groupbox-borders.cjs').patches)allowed.add(p.va-0x400000);
const grad=meta.nativeGradient || meta.gradientBridge || meta.gradient;
if(grad){for(let i=0;i<6;i++)allowed.add(0x4b62d4+i);}
if(meta.nativePopup)for(let i=0;i<6;i++)allowed.add(meta.nativePopup.originalRva+i);
if(meta.nativeInitialErase)for(const site of meta.nativeInitialErase.sites)for(let i=0;i<6;i++)allowed.add(site.originalRva+i);
if(meta.nativePaintPhase)for(const p of meta.nativePaintPhase.patches||meta.nativePaintPhase.sites.map(s=>({...s,originalRva:s.callRva,patchType:'call'}))){
 const kind=p.patchType||p.type,length=kind==='call'?5:kind==='prologue6'?6:0;
 if(!length)throw Error('Unsupported paint probe patch type');
 const sourceAt=code.raw+p.originalRva-code.rva,candidateAt=after.raw+p.originalRva-after.rva;
 const expected=Buffer.from(p.expectedHex,'hex');
 if(expected.length!==length||!original.subarray(sourceAt,sourceAt+length).equals(expected)||candidate[candidateAt]!== (kind==='call'?0xe8:0xe9))throw Error('Paint probe signature mismatch');
 if(kind==='call'&&original[sourceAt]!==0xe8)throw Error('Original paint site is not a CALL');
 if(kind==='prologue6'&&candidate[candidateAt+5]!==0x90)throw Error('Paint entry padding mismatch');
 if(p.originalRva+5+candidate.readInt32LE(candidateAt+1)!==p.entryRva)throw Error('Paint probe target mismatch');
 for(let i=0;i<length;i++)allowed.add(p.originalRva+i);
}
for(const range of require('./patch-editor-canvas-background.cjs').allowedRvaRanges)for(let i=0;i<range.length;i++)allowed.add(range.rva+i);
let count=0;
for(let i=0;i<code.size;i++)if(original[code.raw+i]!==candidate[after.raw+i]){const rva=code.rva+i;if(!allowed.has(rva))throw Error('Unexpected CODE change at RVA '+rva.toString(16));count++;}
const readRva=rva=>candidate[after.raw+rva-after.rva];
if(readRva(0x5661df)!==0x49)throw Error('Missing accessibility correction');
if(readRva(0x49da16)!==0x08)throw Error('Missing shadow-window border correction');
for(const patch of require('./patch-editor-canvas-background.cjs').patches){const expected=Buffer.from(patch.after,'hex');for(let i=0;i<expected.length;i++)if(readRva(patch.rva+i)!==expected[i])throw Error('Editor canvas initialization mismatch');}
console.log('PASS: '+count+' changed CODE bytes are confined to verified palette, accessibility, gradient, control erase entries and shadow-window style.');
