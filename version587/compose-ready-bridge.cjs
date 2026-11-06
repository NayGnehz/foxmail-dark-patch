'use strict';
// Notify the compose-specific UI owner after the existing main, nonblank
// OnLoadEnd routine has fully returned. No UI work runs on the CEF callback.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const BASELINE='4ca3440e7da018de28d3b920f93ba38af3f8500d1a767a7c091430577b6853c3';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const stage=paths.output('version587-compose-ready'),input=path.join(paths.output('version587-compose-ncactivate'),'Foxmail深色.exe'),b=fs.readFileSync(input);assert.equal(sha(b),BASELINE);
const prior=JSON.parse(fs.readFileSync(path.join(path.dirname(input),'validation.json'),'utf8'));assert.equal(prior.candidateSHA256,BASELINE);assert.equal(prior.dest,input);
const pe=b.readUInt32LE(60),op=pe+24,ns=b.readUInt16LE(pe+6),so=op+b.readUInt16LE(pe+20),base=b.readUInt32LE(op+28);assert.equal(base,0x400000);assert.equal(b.readUInt16LE(pe+4),0x14c);
const ss=Array.from({length:ns},(_,i)=>{const p=so+i*40;return{h:p,r:b.readUInt32LE(p+12),p:b.readUInt32LE(p+20),n:b.readUInt32LE(p+16),v:b.readUInt32LE(p+8),name:b.toString('ascii',p,p+8).replace(/\0/g,'')};});
const off=r=>{const s=ss.find(s=>r>=s.r&&r<s.r+s.n);assert(s,'RVA mapped');return s.p+r-s.r;};
const str=p=>b.toString('ascii',p,b.indexOf(0,p)),imports={};for(let d=off(b.readUInt32LE(op+104));b.readUInt32LE(d+12);d+=20){const tab=off(b.readUInt32LE(d)||b.readUInt32LE(d+16)),iat=b.readUInt32LE(d+16);for(let i=0;b.readUInt32LE(tab+4*i);i++){const n=b.readUInt32LE(tab+4*i);if(n<0x80000000)imports[str(off(n)+2)]=iat+i*4;}}
const api={};for(const name of ['GetModuleHandleA','GetProcAddress','GetPropA','PostMessageW','GetLastError','SetLastError']){assert(Number.isInteger(imports[name]),'Existing import '+name);api[name]=imports[name];}
const site=0xb842fc-base,original=0xb8ad80-base,editor=0xb94a54-base,host=0xb6716c-base;
const oldCall='e87f6a0000';assert.equal(b.subarray(off(site),off(site)+5).toString('hex'),oldCall);
for(const[v,name,size]of [[editor,'TFoxHTMLEditor',976],[host,'TCEFWindowParent',548]]){assert.equal(b.readUInt32LE(off(v-76)),base+v);assert.equal(b.readUInt32LE(off(v-40)),size);const p=off(b.readUInt32LE(off(v-44))-base);assert.equal(b.toString('ascii',p+1,p+1+b[p]),name);}
// Exact original 587 guards include the main-frame and non-about:blank branches,
// the original load latch, derived dispatch, and the Align/PostMessage sequence.
const proofBytes=fs.readFileSync(path.join(paths.output('version587-goal'),'compose-ready-map.json')),proofs=JSON.parse(proofBytes);
for(const va of [0xb842b0,0xb8ad80,0xb8930c,0xb99d24]){const p=proofs.find(x=>x.newVA===va);assert(p&&p.bytes&&p.uniqueInRange);assert.equal(b.subarray(off(va-base),off(va-base)+p.bytes.length/2).toString('hex'),p.bytes);}
const align=(x,a)=>Math.ceil(x/a)*a,sa=b.readUInt32LE(op+32),fa=b.readUInt32LE(op+36),tail=ss[ss.length-1],raw=align(b.length,fa);assert.equal(tail.name,'.fxcnca');assert.equal(tail.p+tail.n,b.length);assert.equal(b.readUInt32LE(tail.h+36),0xe0000020);assert.equal(tail.r,Math.max(...ss.map(s=>s.r)));const rva=tail.r+raw-tail.p;
const code=[],labels={},refs=[],byte=(...x)=>code.push(...x),u32=x=>{const q=Buffer.alloc(4);q.writeUInt32LE(x>>>0);byte(...q);},mark=n=>labels[n]=code.length;
const ref=(ops,n,relative)=>{byte(...ops);refs.push({at:code.length,n,relative});u32(0);},branch=(op,n)=>ref([0x0f,op],n,true),data=(ops,n)=>ref(ops,n,false);
const call=r=>{byte(0xe8);u32(r-(rva+code.length+4));},apiCall=n=>{byte(0xff,0x93);u32(api[n]);};
const pic=()=>{byte(0xe8,0,0,0,0);const here=rva+code.length;byte(0x5b,0x81,0xeb);u32(here);};
// Capture a fixed host/root/owner/message tuple before the original callback.
// The callback may destroy and recreate a window with the same HWND; taking
// its new owner only after return would incorrectly bless the old completion.
// Input LastError, flags and every register are restored before the original.
byte(0x6a,0,0x6a,0,0x6a,0,0x6a,0,0x6a,0,0x9c,0x60,0x83,0xec,4);pic();
apiCall('GetLastError');byte(0x89,0x04,0x24);
byte(0x8b,0x74,0x24,32,0x85,0xf6);branch(0x84,'invoke');
byte(0x8d,0x83);u32(editor);byte(0x39,0x06);branch(0x85,'invoke');
byte(0x8b,0xb6);u32(0x300);byte(0x85,0xf6);branch(0x84,'invoke');
byte(0x8d,0x83);u32(host);byte(0x39,0x06);branch(0x85,'invoke');
byte(0x8b,0xbe);u32(0x180);byte(0x85,0xff);branch(0x84,'invoke');byte(0x89,0x7c,0x24,40);
// GetAncestor has no existing IAT entry. Resolve it from the already loaded
// user32 module without LoadLibrary, and retain the function for this call.
data([0x8d,0x83],'user32');byte(0x50);apiCall('GetModuleHandleA');byte(0x85,0xc0);branch(0x84,'invoke');
data([0x8d,0x93],'ancestor');byte(0x52,0x50);apiCall('GetProcAddress');byte(0x85,0xc0);branch(0x84,'invoke');byte(0x89,0x44,0x24,56);
byte(0x6a,2,0x57,0xff,0x54,0x24,64);byte(0x8b,0xf0,0x85,0xf6);branch(0x84,'invoke');byte(0x3b,0xf7);branch(0x84,'invoke');byte(0x89,0x74,0x24,44);
// These property names are ASCII, so the existing GetPropA sees the helper's
// identical property atoms installed through SetPropW.
data([0x8d,0x83],'owner');byte(0x50,0x56);apiCall('GetPropA');byte(0x85,0xc0);branch(0x84,'invoke');byte(0x89,0x44,0x24,48);
data([0x8d,0x83],'message');byte(0x50,0x56);apiCall('GetPropA');byte(0x3d);u32(0xc000);branch(0x82,'invoke');byte(0x3d);u32(0xffff);branch(0x87,'invoke');byte(0x89,0x44,0x24,52);
mark('invoke');byte(0xff,0x34,0x24);apiCall('SetLastError');byte(0x83,0xc4,4,0x61,0x9d);call(original);
// All original output registers and flags, including EAX/ECX/EDX, survive the
// optional notification. The original routine returns with ret, not ret N.
byte(0x9c,0x60,0x83,0xec,16);pic();byte(0x83,0x7c,0x24,64,0);branch(0x84,'restore');
apiCall('GetLastError');byte(0x89,0x04,0x24);
byte(0x8b,0x7c,0x24,52,0x8b,0x74,0x24,56);
byte(0x6a,2,0x57,0xff,0x54,0x24,76);byte(0x3b,0xc6);branch(0x85,'restoreError');
data([0x8d,0x83],'owner');byte(0x50,0x56);apiCall('GetPropA');byte(0x3b,0x44,0x24,60);branch(0x85,'restoreError');
data([0x8d,0x83],'message');byte(0x50,0x56);apiCall('GetPropA');byte(0x3b,0x44,0x24,64);branch(0x85,'restoreError');
// The receiving helper separately validates the fixed token and current tree.
byte(0x57,0xff,0x74,0x24,64,0xff,0x74,0x24,72,0x56);apiCall('PostMessageW'); // host, owner, msg, root
mark('restoreError');byte(0xff,0x34,0x24);apiCall('SetLastError');
mark('restore');byte(0x83,0xc4,16,0x61,0x9d,0x8d,0x64,0x24,20,0xc3); // LEA must not alter original flags
for(const[n,s]of [['owner','FxRevealGate.Owner.43E5CD38.v2'],['message','FxComposeReady.Message.43E5CD38.v1'],['user32','user32.dll'],['ancestor','GetAncestor']]){mark(n);byte(...Buffer.from(s+'\0','ascii'));}
for(const f of refs){assert(Number.isInteger(labels[f.n]));const v=f.relative?labels[f.n]-f.at-4:rva+labels[f.n];for(let i=0;i<4;i++)code[f.at+i]=(v>>>(8*i))&255;}
const stub=Buffer.from(code),out=Buffer.alloc(raw+align(stub.length,fa));b.copy(out);stub.copy(out,raw);out[off(site)]=0xe8;out.writeInt32LE(rva-site-5,off(site)+1);
const sh=tail.h;out.writeUInt32LE(rva-tail.r+stub.length,sh+8);out.writeUInt32LE(out.length-tail.p,sh+16);out.writeUInt32LE(align(rva+stub.length,sa),op+56);out.writeUInt32LE(0,op+64);
const allowed=[[op+56,op+60],[op+64,op+68],[sh+8,sh+12],[sh+16,sh+20],[off(site),off(site)+5]];let changed=0;for(let i=0;i<b.length;i++)if(b[i]!==out[i]){assert(allowed.some(([a,z])=>i>=a&&i<z));changed++;}
const dest=path.join(stage,'Foxmail深色.exe'),candidateSHA256=sha(out);
const report={generatorSHA256:sha(fs.readFileSync(__filename)),proofSHA256:sha(proofBytes),input,dest,baselineSHA256:BASELINE,candidateSHA256,sectionRva:rva,sectionRaw:raw,sectionSize:stub.length,extendedSection:tail.name,siteRva:site,siteRaw:off(site),originalCallHex:oldCall,originalRva:original,editorVmtRva:editor,hostVmtRva:host,imports:api,stubHex:stub.toString('hex'),labels,originalChangedBytes:changed,onlyOriginalCodeSite:[site,5],originalEntryUnchanged:out.readUInt32LE(op+16)===b.readUInt32LE(op+16),oldGatePayloadUnchanged:ss.filter(s=>s.name==='.fxgate').every(s=>out.subarray(s.p,s.p+s.n).equals(b.subarray(s.p,s.p+s.n))),oldNcaPayloadUnchanged:out.subarray(tail.p,tail.p+tail.n).equals(b.subarray(tail.p,tail.p+tail.n)),allOriginalPayloadsExceptCallUnchanged:ss.every(s=>{const x=Buffer.from(out.subarray(s.p,s.p+s.n));if(off(site)>=s.p&&off(site)<s.p+s.n)b.subarray(off(site),off(site)+5).copy(x,off(site)-s.p);return x.equals(b.subarray(s.p,s.p+s.n));}),cssSHA256:prior.cssSHA256,ownerProperty:'FxRevealGate.Owner.43E5CD38.v2',messageProperty:'FxComposeReady.Message.43E5CD38.v1',scope:'Fixed 4ca; one main-nonblank LoadEnd call wrapper. Exact TFoxHTMLEditor and TCEFWindowParent are captured before original. After complete original handler, fixed pre-callback host/root/owner/message tuple with post-callback revalidation; no object dereference after original, input/output LastError preserved. UI helper must validate token/root/host/current renderer tree. No presize, new loader or configuration read.',exceptionUnwindTested:false,visualAccepted:false};
fs.writeFileSync(dest,out);fs.writeFileSync(path.join(stage,'bridge-stub.bin'),stub);fs.writeFileSync(path.join(stage,'bridge-validation.json'),JSON.stringify(report,null,2));
const macros={SECTION_RVA:rva,SITE_RVA:site,ORIGINAL_RVA:original,EDITOR_VMT_RVA:editor,HOST_VMT_RVA:host,...Object.fromEntries(Object.entries(api).map(([k,v])=>[k+'_IAT',v]))};
fs.writeFileSync(path.join(stage,'compose-ready-bridge-stub.h'),Object.entries(macros).map(([k,v])=>`#define FX_READY_${k} ${v}u`).join('\n')+`\n#define FX_CANDIDATE_SHA "${candidateSHA256}"\nstatic const unsigned char ready_bridge_stub[] = {${[...stub].join(',')}};\n`);
console.log(JSON.stringify({candidateSHA256,sectionRva:rva,siteRva:site,sectionSize:stub.length,imports:api,originalChangedBytes:changed}));
