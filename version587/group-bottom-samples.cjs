'use strict';
// Numeric pixels from two user-provided screenshots; no text recognition or image output.
const fs=require('fs'),assert=require('assert'),path=require('path'),paths=require('../foxmail-paths.cjs'),{pngDecode}=require('../recolor-search-scrollbars.cjs');
const root='C:/Users/Public/AppData/Local/Temp';
const inputs=[{name:'darkCommon',file:'codex-clipboard-00000000-0000-0000-0000-000000000000.png',x:[50,740],y:[357,365]},{name:'originalAdvanced',file:'codex-clipboard-00000000-0000-0000-0000-000000000000.png',x:[50,740],y:[425,433]}];
const rows=inputs.map(t=>{const im=pngDecode(fs.readFileSync(path.join(root,t.file)));assert(im.width>t.x[1]&&im.height>t.y[1]);const rows=[];for(let y=t.y[0];y<=t.y[1];y++){const hist=new Map();for(let x=t.x[0];x<=t.x[1];x++){const p=(y*im.width+x)*4,key=[...im.rgba.subarray(p,p+4)].join(',');hist.set(key,(hist.get(key)||0)+1);}rows.push({y,colors:[...hist].map(([rgba,count])=>({rgba:rgba.split(',').map(Number),count})).sort((a,b)=>b.count-a.count).slice(0,8)});}return {name:t.name,xRange:t.x,rows};});
const dest=path.join(paths.output('version587-group-bottom'),'user-border-row-samples.json');fs.writeFileSync(dest,JSON.stringify(rows,null,2));console.log(JSON.stringify({dest,rows}));
