'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),paths=require('../foxmail-paths.cjs');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex'),stage=paths.output('version587-goal-paper');
const first=JSON.parse(fs.readFileSync(path.join(paths.output('version587-goal'),'firstrestore-validation.json'),'utf8'));
const input=fs.readFileSync(first.dest);assert.equal(sha(input),first.candidateSHA256);
const out=Buffer.from(input),pe=input.readUInt32LE(60),op=pe+24,so=op+input.readUInt16LE(pe+20);let at;
const va=0xb7b98a;
for(let i=0;i<input.readUInt16LE(pe+6);i++){const p=so+40*i,r=input.readUInt32LE(p+12),n=input.readUInt32LE(p+16);if(va-0x400000>=r&&va-0x400000<r+n)at=input.readUInt32LE(p+20)+va-0x400000-r;}
assert(Number.isInteger(at));const prefix=Buffer.from('8b45fc6a015a895004c7400805000000c74018','hex');assert(input.subarray(at,at+prefix.length).equals(prefix));assert.equal(input.readUInt32LE(at+19),0xff202020);
out.writeUInt32LE(0xffe8e8e8,at+19);let changed=0;for(let i=0;i<input.length;i++)if(input[i]!==out[i]){assert(i>=at+19&&i<at+23);changed++;}assert.equal(changed,3);
const relative='7.2.25.587/Template/HtmlEditor/Common/Base.css',original=fs.readFileSync(path.join('D:/Users/Public/Downloads/Foxmail',relative));
const plan=JSON.parse(fs.readFileSync(path.join(paths.output('version587'),'validation.json'),'utf8')),asset=plan.assets.find(x=>x.relative===relative);assert(asset);assert.equal(sha(original),asset.candidateSHA256,'Accepted linked UI stylesheet changed');
const addition=fs.readFileSync(path.join(paths.project,'version587/editor-paper-screen.css')),css=Buffer.concat([original,Buffer.from('\r\n'),addition]);
assert(!addition.includes(Buffer.from('<style')));assert(addition.toString().includes('@media screen'));assert(!addition.toString().includes('color: #')||addition.toString().includes('background-color: #'));
const dest=path.join(stage,'Foxmail深色.exe'),cssSource=path.join(stage,'Base.css');fs.writeFileSync(dest,out);fs.writeFileSync(cssSource,css);fs.writeFileSync(path.join(stage,'Base-before.css'),original);
// Test harness only: production HtmlEditor.html remains untouched.
const shellBytes=fs.readFileSync('D:/Users/Public/Downloads/Foxmail/7.2.25.587/Template/HtmlEditor/Common/HtmlEditor.html');let shell=shellBytes.toString(shellBytes[0]===255&&shellBytes[1]===254?'utf16le':'utf8');
const link='<link id="fox-dark-first-canvas" rel="stylesheet" media="screen" href="data:text/css;base64,'+addition.toString('base64')+'">';shell=shell.replace('<head>','<head>\r\n'+link);fs.writeFileSync(path.join(stage,'HtmlEditor.html'),shell);
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify({dest,candidateSHA256:sha(out),baselineExe:first.dest,baselineSHA256:sha(input),helper:first.helper,helperSHA256:first.helperSHA256,initializerVA:va,initializerBeforeHex:input.subarray(at,at+36).toString('hex'),initializerAfterHex:out.subarray(at,at+36).toString('hex'),beforeSigned:input.readInt32LE(at+19),afterSigned:out.readInt32LE(at+19),changedExeBytes:changed,css:{relative,source:cssSource,before:path.join(stage,'Base-before.css'),beforeSHA256:sha(original),afterSHA256:sha(css)},scope:'Accepted first-tray binary plus type3 initial background #E8E8E8 only; linked screen-only workspace CSS. No ink/font/layout/DPI/startup/HTML/export/print-rule changes. Buffer experiment removed. Outgoing data requires real-export check.',visualAccepted:false},null,2));
console.log(JSON.stringify({sha:sha(out),cssSHA256:sha(css),changedExeBytes:changed}));
