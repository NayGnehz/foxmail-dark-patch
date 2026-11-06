'use strict';
// Import-only port of the existing screen DrawEdge wrapper. No 563 code RVAs.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const paths=require('../foxmail-paths.cjs'),stage=paths.output('version587-next');
const previous=JSON.parse(fs.readFileSync(path.join(paths.output('version587-reveal'),'validation.json'),'utf8'));
const b=fs.readFileSync(previous.dest),sha=x=>crypto.createHash('sha256').update(x).digest('hex');assert.equal(sha(b),previous.candidateSHA256);
const pe=b.readUInt32LE(60),op=pe+24,ns=b.readUInt16LE(pe+6),so=op+b.readUInt16LE(pe+20);
const ss=Array.from({length:ns},(_,i)=>{const q=so+40*i;return {r:b.readUInt32LE(q+12),p:b.readUInt32LE(q+20),n:b.readUInt32LE(q+16),v:b.readUInt32LE(q+8)};});
const off=r=>{const s=ss.find(s=>r>=s.r&&r<s.r+s.n);assert(s);return s.p+r-s.r;};
const z=p=>b.toString('ascii',p,b.indexOf(0,p)),imports=[];
for(let d=off(b.readUInt32LE(op+104));b.readUInt32LE(d+12);d+=20){const dll=z(off(b.readUInt32LE(d+12))),iat=b.readUInt32LE(d+16),tab=off(b.readUInt32LE(d)||iat);for(let i=0;b.readUInt32LE(tab+4*i);i++){const n=b.readUInt32LE(tab+4*i);if(n<0x80000000)imports.push({dll,name:z(off(n)+2),iat:iat+4*i});}}
const api=n=>{const hit=imports.filter(x=>x.name===n);assert(hit.length,n);if(hit.length>1)assert(hit.every(x=>x.dll.toLowerCase()==='kernel32.dll'),'Ambiguous API DLL '+n);return hit[0].iat;};
const align=(x,a)=>Math.ceil(x/a)*a,rva=align(Math.max(...ss.map(s=>s.r+Math.max(s.n,s.v))),b.readUInt32LE(op+32)),raw=align(b.length,b.readUInt32LE(op+36));
assert(so+(ns+1)*40<=Math.min(...ss.filter(s=>s.p).map(s=>s.p)));
const code=[],patches=[],refs=[],labels={},byte=(...x)=>code.push(...x),u32=n=>{const q=Buffer.alloc(4);q.writeUInt32LE(n>>>0);byte(...q);};
const ref=n=>{refs.push({at:code.length,n});u32(0);};
const jumps=[],jump=n=>{byte(0x0f,0x84);jumps.push({at:code.length,n});u32(0);};
labels.wrapper=code.length;byte(0x52,0xe8,0,0,0,0,0x5a,0x81,0xea);u32(rva+6);
for(const n of ['GetROP2','GetGraphicsMode','GetLayout','brush6','brush15']){byte(0x83,0xba);ref(n);byte(0);jump('fallback');}
byte(0x8b,0x4c,0x24,8,0x52,0x6a,2,0x51,0xff,0x92);u32(api('GetDeviceCaps'));byte(0x5a,0x83,0xf8,1,0x0f,0x85);jumps.push({at:code.length,n:'fallback'});u32(0);
const dynamic=require('../add-native-edge.cjs').emit({byte,u32,code,patches,imports},0);
labels.fallback=code.length;byte(0x8b,0x82);ref('original');byte(0x5a,0xff,0xe0);
labels.entry=code.length;byte(0x9c,0x60,0xe8,0,0,0,0);const epNext=code.length;byte(0x5b,0x81,0xeb);u32(rva+epNext);
byte(0xff,0x93);u32(api('GetLastError'));byte(0x50);
byte(0x8b,0x83);u32(api('DrawEdge'));byte(0x89,0x83);ref('original');
byte(0x8d,0x83);ref('gdiName');byte(0x50,0xff,0x93);u32(api('GetModuleHandleA'));byte(0x89,0xc6);
for(const name of ['GetROP2','GetGraphicsMode','GetLayout','CreateSolidBrush']){
 byte(0x8d,0x83);ref(name+'Name');byte(0x50,0x56,0xff,0x93);u32(api('GetProcAddress'));byte(0x89,0x83);ref(name);
}
byte(0x83,0xbb);ref('CreateSolidBrush');byte(0);jump('install');
for(const [name,color]of [['brush6',0x3d3d3d],['brush15',0x282828]]){byte(0x68);u32(color);byte(0xff,0x93);ref('CreateSolidBrush');byte(0x89,0x83);ref(name);}
labels.install=code.length;byte(0x8d,0x83);ref('wrapper');byte(0x89,0x83);u32(api('DrawEdge'));
byte(0xff,0x93);u32(api('SetLastError'));byte(0x61,0x9d,0xe9);u32(b.readUInt32LE(op+16)-(rva+code.length+4));
while(code.length%4)byte(0);
for(const n of ['original','GetROP2','GetGraphicsMode','GetLayout','CreateSolidBrush','brush6','brush15']){labels[n]=code.length;u32(0);}
labels.gdiName=code.length;byte(...Buffer.from('gdi32.dll\0'));
for(const n of ['GetROP2','GetGraphicsMode','GetLayout','CreateSolidBrush']){labels[n+'Name']=code.length;byte(...Buffer.from(n+'\0'));}
for(const x of [...refs,...dynamic.map(x=>({at:x.at,n:x.name})),...patches.map(x=>({at:x.at,n:x.brush===undefined?'original':'brush'+x.brush}))]){const v=rva+labels[x.n];assert(Number.isInteger(v));for(let k=0;k<4;k++)code[x.at+k]=(v>>>(8*k))&255;}
for(const x of jumps){const v=labels[x.n]-x.at-4;assert(Number.isInteger(v));for(let k=0;k<4;k++)code[x.at+k]=(v>>>(8*k))&255;}
const out=Buffer.alloc(raw+align(code.length,b.readUInt32LE(op+36)));b.copy(out);Buffer.from(code).copy(out,raw);
const sh=so+ns*40;out.fill(0,sh,sh+40);out.write('.fxedge',sh);out.writeUInt32LE(code.length,sh+8);out.writeUInt32LE(rva,sh+12);out.writeUInt32LE(out.length-raw,sh+16);out.writeUInt32LE(raw,sh+20);out.writeUInt32LE(0xe0000020,sh+36);
out.writeUInt16LE(ns+1,pe+6);out.writeUInt32LE(rva+labels.entry,op+16);out.writeUInt32LE(align(rva+code.length,b.readUInt32LE(op+32)),op+56);out.writeUInt32LE(0,op+64);
const allowed=[[pe+6,pe+8],[op+16,op+20],[op+56,op+60],[op+64,op+68],[sh,sh+40]];let changed=0;
for(let i=0;i<b.length;i++)if(b[i]!==out[i]){assert(allowed.some(([a,z])=>i>=a&&i<z));changed++;}
const dest=path.join(stage,'Foxmail深色-edge.exe');fs.writeFileSync(dest,out);
fs.writeFileSync(path.join(stage,'edge-hook-spec.txt'),[`${labels.original},${labels.entry},${b.readUInt32LE(op+16)},${api('GetDeviceCaps')},0,0`,`user32.dll,DrawEdge,${labels.wrapper},${api('DrawEdge')}`].join('\n'));
fs.writeFileSync(path.join(stage,'edge-validation.json'),JSON.stringify({passed:true,inputSHA256:sha(b),candidateSHA256:sha(out),dest,rva,raw,codeBytes:code.length,labels,originalHeaderChangedBytes:changed,scope:'Optional import DrawEdge wrapper only: screen compatible MM_TEXT full rectangular edges, exact original return/clipping/BF_ADJUST retained. All other flags/capabilities forward to original. Existing native/reveal code unchanged.',visualAccepted:false},null,2));console.log(JSON.stringify({dest,sha:sha(out),codeBytes:code.length}));
