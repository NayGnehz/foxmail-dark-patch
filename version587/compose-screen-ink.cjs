'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const paths=require('../foxmail-paths.cjs'),stage=paths.output('version587-compose-screen-ink');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const app='D:/Users/Public/Downloads/Foxmail';
const relative='7.2.25.587/Template/HtmlEditor/Common/HtmlEditor.html';
const original=fs.readFileSync(path.join(app,relative));
assert.equal(sha(original),'dd712386a5282d14c6a509598cdf47eb1b502bc966ca3f5eaab59b3620902501');
const encoding=original[0]===255&&original[1]===254?'utf16le':'utf8';
const text=original.toString(encoding),css=fs.readFileSync(path.join(__dirname,'editor-screen-ink.css'));
const js=fs.readFileSync(path.join(__dirname,'editor-screen-ink.js'));
assert(css.toString().includes('::highlight(foxmail-compose-screen-ink)'));
assert(!css.toString().includes('text-fill')&&!js.toString().includes('execCommand'));
const addition='\r\n\t<link id="foxmail-compose-screen-ink" rel="stylesheet" media="screen" href="data:text/css;base64,'+css.toString('base64')+'">'+
 '\r\n\t<script nonce="{{random_nonce}}" src="data:text/javascript;base64,'+js.toString('base64')+'"></script>';
const anchor='\t<script src="{{foxmail_template}}Common\\Javascript\\jquery-1.9.1.min.js"';
assert.equal(text.split(anchor).length,2);
// Place after CSP, before blocking application scripts. No STYLE is added:
// Foxmail's actual exporter includes the first STYLE in outgoing HTML.
const next=text.replace(anchor,addition+'\r\n'+anchor),candidate=Buffer.from(next,encoding);
assert.equal(next.replace(addition+'\r\n',''),text);
assert.equal((next.match(/<style\b/gi)||[]).length,(text.match(/<style\b/gi)||[]).length);
const before=path.join(stage,'HtmlEditor.before.html'),dest=path.join(stage,'HtmlEditor.html');
fs.writeFileSync(before,original);fs.writeFileSync(dest,candidate);
const report={relative,input:path.join(app,relative),before,source:dest,encoding,beforeSHA256:sha(original),afterSHA256:sha(candidate),
 generatorSHA256:sha(fs.readFileSync(__filename)),cssSHA256:sha(css),scriptSHA256:sha(js),
 api:'CSS Custom Highlight, Chromium >=105',foreground:'#d8d8d8',screenOnly:true,originalTemplatePreserved:true,
 editableDomWrites:false,computedElementColorChanges:false,clipboardAccess:false,exportFunctionChanges:false,
 firstStylePreserved:true,visualAccepted:false};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
