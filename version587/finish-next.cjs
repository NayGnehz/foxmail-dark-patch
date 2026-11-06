'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const paths=require('../foxmail-paths.cjs'),stage=paths.output('version587-next');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const edge=JSON.parse(fs.readFileSync(path.join(stage,'edge-validation.json'),'utf8'));
const input=fs.readFileSync(edge.dest);assert.equal(sha(input),edge.candidateSHA256);
const out=Buffer.from(input),pe=out.readUInt32LE(60),op=pe+24,so=op+out.readUInt16LE(pe+20),ss=[];
for(let i=0;i<out.readUInt16LE(pe+6);i++){const p=so+i*40;ss.push({r:out.readUInt32LE(p+12),p:out.readUInt32LE(p+20),n:out.readUInt32LE(p+16)});}
const off=va=>{const s=ss.find(s=>va-0x400000>=s.r&&va-0x400000<s.r+s.n);assert(s);return s.p+va-0x400000-s.r;};
const entry=0xb3a8e4,original=Buffer.from('558bec83c4f4884df78955f88945fc807df700741e687994ae0068667f96008b45fce845d4b1ff8b55f8b101e8b7bad7ffeb1c6892a6b800688ca0b3008b45fce827d4b1ff8b55f8b101e899bad7ff8be55dc3','hex');
assert(out.subarray(off(entry),off(entry)+original.length).equals(original),'Whole shared selection painter changed');
const palette=[{va:0xb3a8f9,before:0xae9479,after:0x6f5131,label:'Focused selection gradient end'},
 {va:0xb3a8fe,before:0x967f66,after:0x5f4428,label:'Focused selection gradient start'},
 {va:0xb3a917,before:0xb8a692,after:0x4f4333,label:'Unfocused selection gradient end'},
 {va:0xb3a91c,before:0xb3a08c,after:0x44392b,label:'Unfocused selection gradient start'}];
for(const p of palette){const at=off(p.va);assert.equal(out[at],0x68);assert.equal(out.readUInt32LE(at+1),p.before);out.writeUInt32LE(p.after,at+1);p.offset=at+1;}
for(let i=0;i<input.length;i++)if(input[i]!==out[i])assert(palette.some(p=>i>=p.offset&&i<p.offset+4),'Unexpected selection delta');
const app='D:/Users/Public/Downloads/Foxmail',relative='7.2.25.587/Template/HtmlEditor/Common/HtmlEditor.html';
const template=fs.readFileSync(path.join(app,relative)),encoding=template[0]===255&&template[1]===254?'utf16le':'utf8',text=template.toString(encoding);
assert.equal(template.length,1958,'Editor shell changed');assert.equal((text.match(/<head>/g)||[]).length,1);
// LINK is deliberate: Foxmail exports the first STYLE element to outgoing mail.
// It must precede parser-blocking scripts, and apply only to the root on screen.
const link='<link id="fox-dark-first-canvas" rel="stylesheet" media="screen" href="data:text/css,html%7Bbackground-color%3A%23202020%7D">';
const patched=Buffer.from(text.replace('<head>','<head>\r\n\t'+link),encoding);
assert(patched.toString(encoding).replace('\r\n\t'+link,'')===text);
const dest=path.join(stage,'Foxmail深色.exe'),templateDest=path.join(stage,'HtmlEditor.html');
fs.writeFileSync(dest,out);fs.writeFileSync(templateDest,patched);
const contrast=(bgr)=>{const c=[bgr&255,bgr>>>8&255,bgr>>>16&255].map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return 1.05/(.2126*c[0]+.7152*c[1]+.0722*c[2]+.05);};
for(const p of palette){p.whiteTextContrast=contrast(p.after);assert(p.whiteTextContrast>=4.5);}
const report={version:'7.2.25.587',dest,inputSHA256:sha(input),candidateSHA256:sha(out),palette,template:{relative,source:templateDest,beforeSHA256:sha(template),afterSHA256:sha(patched),link},helperUnchanged:true,visualAccepted:false,scope:'Import-only screen edge adapter, four guarded shared selection color operands and early screen-only editor root LINK. No text/font/events/transport/body/export/print rules changed. Async browser first frame remains pending visual acceptance.'};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({sha:sha(out),template:sha(patched),contrast:palette.map(x=>Number(x.whiteTextContrast.toFixed(2)))}));
