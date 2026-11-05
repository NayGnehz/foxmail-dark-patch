'use strict';
const fs=require('fs'),m=require('./add-tray-restore.cjs'),code=[],rva=0x1000;
const byte=(...v)=>code.push(...v),u32=v=>{const x=Buffer.alloc(4);x.writeUInt32LE(v>>>0);byte(...x);};
const imports=['GetLastError','SetLastError','IsIconic','ShowWindow'].map((name,i)=>({name,iat:0x2000+i*4}));
byte(0x52,0xe8,0,0,0,0,0x5a,0x81,0xea);u32(rva+6);
const meta=m.emit({byte,u32,code,imports});byte(0x8b,0x82);u32(imports.find(x=>x.name==='ShowWindow').iat);byte(0x5a,0xff,0xe0);
fs.writeFileSync('tray-restore-test.bin',Buffer.from(code));fs.writeFileSync('tray-restore-test.json',JSON.stringify({rva,imports,...meta},null,2));console.log('Tray wrapper fixture '+code.length+' bytes');
