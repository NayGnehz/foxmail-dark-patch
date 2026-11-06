'use strict';
// Program templates only. Never enumerate/read contact/account databases.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert'),paths=require('../foxmail-paths.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),stage=paths.output('version587-address-html');
const app='D:/Users/Public/Downloads/Foxmail',relative='7.2.25.587/Template/AddrNoteInfo/Frame.html';
const original=fs.readFileSync(path.join(app,relative));
assert.equal(sha(original),'ebcef379a55b031075ca82f70ad412c9361fe41295cfd7d5d9090a522dcd834a','Address-book program shell changed');
const encoding=original[0]===255&&original[1]===254?'utf16le':'utf8',text=original.toString(encoding);
assert(text.includes('{{ContentPanel}}')&&text.includes('{{random_nonce}}'));
assert.equal(text.split('</head>').length,2);assert(!text.includes('foxmail-address-dark'));
const css=fs.readFileSync(path.join(__dirname,'address-book-screen.css'));
const addition='\t<link id="foxmail-address-dark" rel="stylesheet" media="screen" href="data:text/css;base64,'+css.toString('base64')+'">\r\n';
const next=text.replace('</head>',addition+'</head>'),candidate=Buffer.from(next,encoding);
assert.equal(next.replace(addition,''),text);
assert.equal((next.match(/<script\b/gi)||[]).length,(text.match(/<script\b/gi)||[]).length);
assert.equal((next.match(/<style\b/gi)||[]).length,(text.match(/<style\b/gi)||[]).length);
const before=path.join(stage,'Frame.before.html'),source=path.join(stage,'Frame.html');fs.writeFileSync(before,original);fs.writeFileSync(source,candidate);
const report={relative,input:path.join(app,relative),before,source,beforeSHA256:sha(original),afterSHA256:sha(candidate),encoding,generatorSHA256:sha(fs.readFileSync(__filename)),cssSHA256:sha(css),
 scope:'One address-book shell adds one screen-only LINK. No shared CSS, contact fields, HTML fragments, scripts, data callbacks or transport logic changed.',scriptsAndContentUnchanged:true,screenOnly:true,visualAccepted:false};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
