'use strict';
// One-pixel solid #DCDCDC outline only. No startup GDI calls or font/DPI work.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),stage=paths.output('version587-goal-paper');
const paper=JSON.parse(fs.readFileSync(path.join(stage,'validation.json'),'utf8')),b=fs.readFileSync(paper.dest);assert.equal(sha(b),paper.candidateSHA256);
const pe=b.readUInt32LE(60),op=pe+24,ns=b.readUInt16LE(pe+6),so=op+b.readUInt16LE(pe+20),ss=[];
for(let i=0;i<ns;i++){const p=so+40*i;ss.push({r:b.readUInt32LE(p+12),p:b.readUInt32LE(p+20),n:b.readUInt32LE(p+16),v:b.readUInt32LE(p+8)});}
const off=r=>{const s=ss.find(s=>r>=s.r&&r<s.r+s.n);assert(s);return s.p+r-s.r;},z=p=>b.toString('ascii',p,b.indexOf(0,p));const imports=[];
for(let d=off(b.readUInt32LE(op+104));b.readUInt32LE(d+12);d+=20){const dll=z(off(b.readUInt32LE(d+12))),iat=b.readUInt32LE(d+16),tab=off(b.readUInt32LE(d)||iat);for(let i=0;b.readUInt32LE(tab+4*i);i++){const q=b.readUInt32LE(tab+4*i);if(q<0x80000000)imports.push({dll,name:z(off(q)+2),iat:iat+4*i});}}
const pen=imports.filter(x=>x.name==='CreatePenIndirect');assert.equal(pen.length,1);const caps=imports.find(x=>x.name==='GetDeviceCaps');assert(caps);
const align=(x,a)=>Math.ceil(x/a)*a,rva=align(Math.max(...ss.map(s=>s.r+Math.max(s.n,s.v))),b.readUInt32LE(op+32)),raw=align(b.length,b.readUInt32LE(op+36));assert(so+(ns+1)*40<=Math.min(...ss.filter(s=>s.p).map(s=>s.p)));
const code=[],labels={},refs=[],jumps=[],byte=(...x)=>code.push(...x),u32=x=>{const q=Buffer.alloc(4);q.writeUInt32LE(x>>>0);byte(...q);},ref=n=>{refs.push({at:code.length,n});u32(0);},j=(op,n)=>{byte(0x0f,op);jumps.push({at:code.length,n});u32(0);};
labels.wrapper=code.length;byte(0x52,0xe8,0,0,0,0,0x5a,0x81,0xea);u32(rva+6);
byte(0x8b,0x4c,0x24,8,0x85,0xc9);j(0x84,'fallback');
byte(0x83,0x39,0);j(0x85,'fallback');byte(0x83,0x79,4,1);j(0x87,'fallback');byte(0x83,0x79,8,0);j(0x85,'fallback');byte(0x81,0x79,12);u32(0xdcdcdc);j(0x85,'fallback');
byte(0x83,0xec,16);for(const k of [0,4,8,12])byte(0x8b,0x41,k,0x89,0x44,0x24,k);byte(0xc7,0x44,0x24,12);u32(0x3d3d3d);byte(0x54,0xff,0x92);ref('original');byte(0x83,0xc4,16,0x5a,0xc2,4,0);
labels.fallback=code.length;byte(0x8b,0x82);ref('original');byte(0x5a,0xff,0xe0);
labels.entry=code.length;byte(0x9c,0x60,0xe8,0,0,0,0);const next=code.length;byte(0x5b,0x81,0xeb);u32(rva+next);byte(0x8b,0x83);u32(pen[0].iat);byte(0x89,0x83);ref('original');byte(0x8d,0x83);ref('wrapper');byte(0x89,0x83);u32(pen[0].iat);byte(0x61,0x9d,0xe9);u32(b.readUInt32LE(op+16)-(rva+code.length+4));while(code.length%4)byte(0);labels.original=code.length;u32(0);
for(const x of refs){const v=rva+labels[x.n];for(let k=0;k<4;k++)code[x.at+k]=(v>>>(8*k))&255;}for(const x of jumps){const v=labels[x.n]-x.at-4;for(let k=0;k<4;k++)code[x.at+k]=(v>>>(8*k))&255;}
const out=Buffer.alloc(raw+align(code.length,b.readUInt32LE(op+36)));b.copy(out);Buffer.from(code).copy(out,raw);const sh=so+ns*40;out.fill(0,sh,sh+40);out.write('.fxpen',sh);for(const [k,v]of [[8,code.length],[12,rva],[16,out.length-raw],[20,raw],[36,0xe0000020]])out.writeUInt32LE(v,sh+k);out.writeUInt16LE(ns+1,pe+6);out.writeUInt32LE(rva+labels.entry,op+16);out.writeUInt32LE(align(rva+code.length,b.readUInt32LE(op+32)),op+56);out.writeUInt32LE(0,op+64);
const allowed=[[pe+6,pe+8],[op+16,op+20],[op+56,op+60],[op+64,op+68],[sh,sh+40]];for(let i=0;i<b.length;i++)if(out[i]!==b[i])assert(allowed.some(([a,z])=>i>=a&&i<z));
const dest=path.join(stage,'Foxmail深色-paper-pen.exe');fs.writeFileSync(dest,out);fs.writeFileSync(path.join(stage,'pen-hook-spec.txt'),[`${labels.original},${labels.entry},${b.readUInt32LE(op+16)},${caps.iat},0,0`,`${pen[0].dll},CreatePenIndirect,${labels.wrapper},${pen[0].iat}`].join('\n'));
fs.writeFileSync(path.join(stage,'pen-validation.json'),JSON.stringify({dest,candidateSHA256:sha(out),paperSHA256:sha(b),rva,raw,labels,onlyAppendedHookAndPEHeaderChanged:true,startupWinApiCalls:0,scope:'LOGPEN local copy only when style=solid, widthX=0/1, widthY=0 and color=#DCDCDC. Other pens forward unchanged. First tray helper and paper/export fixes retained. Account line efficacy pending user acceptance.',visualAccepted:false},null,2));console.log(JSON.stringify({sha:sha(out),codeBytes:code.length,startupWinApiCalls:0}));
