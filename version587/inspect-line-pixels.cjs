'use strict';
const fs=require('fs');require('../foxmail-paths.cjs');
const {pngDecode}=require('../recolor-search-scrollbars.cjs');
if(!process.argv[2])throw Error('Provide the user-authorized settings screenshot path');
const im=pngDecode(fs.readFileSync(process.argv[2]));
for(const y of [150,200,400,600]){const row=[];for(const x of [243,244,245,762,763,764]){const p=(y*im.width+x)*4;row.push([x,Array.from(im.rgba.subarray(p,p+4))]);}console.log(JSON.stringify({y,row}));}
