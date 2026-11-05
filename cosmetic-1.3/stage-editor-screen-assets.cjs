'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const relative='7.2.25.563/Template/HtmlEditor/Common/Base.css';
const baselineSHA256='557a0959688ab71db3fff73ec77ebcb3c8dbb4fae98db641d736f0793b5fab17';
function generateExternalFiles(appRoot){
 const input=fs.readFileSync(path.join(appRoot,relative));if(sha(input)!==baselineSHA256)throw Error('Editor Base.css baseline guard');
 const addition=fs.readFileSync(path.join(__dirname,'editor-screen-scrollbars.css'),'utf8').replace(/^\ufeff/,'');
 // Existing Base.css is ASCII UTF-8 without BOM. Preserve every original byte.
 const data=Buffer.concat([input,Buffer.from('\r\n'+addition,'utf8')]);
 return [{relative,data,baselineSHA256,candidateSHA256:sha(data),bytes:data.length,encoding:'UTF-8 without BOM; original 143 bytes preserved as exact prefix'}];
}
module.exports={generateExternalFiles,relative,baselineSHA256};
if(require.main===module){const files=generateExternalFiles('D:/Users/Public/Downloads/Foxmail');for(const file of files){const target=path.join(__dirname,'editor-assets',file.relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,file.data);fs.writeFileSync(path.join(__dirname,'editor-Base.css.original'),file.data.subarray(0,143));}fs.writeFileSync(path.join(__dirname,'editor-external-manifest.json'),JSON.stringify(files.map(({data,...entry})=>entry),null,2));console.log(files.map(({data,...entry})=>entry));}
