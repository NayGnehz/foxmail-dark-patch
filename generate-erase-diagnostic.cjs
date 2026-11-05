'use strict';
// Reproducibly generate a separate instrumented variant. Production source is
// read-only. Every replacement is asserted exactly once to reject source drift.
const fs=require('fs');let s=fs.readFileSync('add-initial-erase.cjs','utf8');
function replace(a,b){if(s.split(a).length!==2)throw Error('Diagnostic source drift: '+a);s=s.replace(a,b);}
replace(' const dynamicFix=[],sites=[];',' const dynamicFix=[],sites=[];\n const trace=require(\'./erase-diagnostic-buffer.cjs\').create({byte,u32,rva,code},SITES.length);');
replace('  const start=code.length,labels={},jumps=[];','  const siteId=sites.length,start=code.length,labels={},jumps=[];');
replace('0x83,0xec,64,0x53','0x81,0xec,128,0,0,0,0x53');
replace("  byte(0x85,0xc0);j([0x0f,0x84],'restore');byte(0x85,0xd2);j([0x0f,0x84],'restore');", "  trace.init(siteId);byte(0x85,0xc0);trace.reason(1);j([0x0f,0x84],'restore');byte(0x8b,0x08,0x29,0xd9);trace.store(2,'ecx');byte(0x85,0xd2);trace.reason(2);j([0x0f,0x84],'restore');byte(0x8b,0x0a);trace.store(15,'ecx');");
replace("  byte(0x83,0x3a,0x14);j([0x0f,0x85],'restore');", "  byte(0x83,0x3a,0x14);trace.reason(3);j([0x0f,0x85],'restore');");
replace("}j([0xe9],'restore');", "}trace.reason(4);j([0xe9],'restore');");
replace("labels.matched=code.length;byte(0x8b,0x42,4,0x85,0xc0);j([0x0f,0x84],'restore');", "labels.matched=code.length;byte(0x8b,0x42,4);trace.store(14);byte(0x85,0xc0);trace.reason(5);j([0x0f,0x84],'restore');");
replace("direct('GetDeviceCaps');byte(0x83,0xf8,1);j", "direct('GetDeviceCaps');trace.store(5);trace.reason(6);byte(0x83,0xf8,1);j");
replace("byte(0);j([0x0f,0x84],'cleanup');", "byte(0);trace.reason(7);j([0x0f,0x84],'cleanup');");
replace("dynamic('GetObjectType');byte(0x83,0xf8,3);", "dynamic('GetObjectType');trace.store(6);trace.reason(8);byte(0x83,0xf8,3);");
replace("direct('GetCurrentObject');byte(0x85,0xc0);", "direct('GetCurrentObject');trace.reason(9);byte(0x85,0xc0);");
replace("direct('GetObjectA');byte(0x83,0xf8,24);", "direct('GetObjectA');trace.reason(10);byte(0x83,0xf8,24);");
replace("0x0f,0xaf,0xc2,0x83,0xf8,8);j", "0x0f,0xaf,0xc2);trace.store(7);trace.reason(11);byte(0x83,0xf8,8);j");
replace("direct('GetDeviceCaps');byte(0x83,0xf8,8);", "direct('GetDeviceCaps');trace.store(7);trace.reason(11);byte(0x83,0xf8,8);");
replace("direct('GetMapMode');byte(0x83,0xf8,1);", "direct('GetMapMode');trace.store(8);trace.reason(12);byte(0x83,0xf8,1);");
replace("dynamic(name);byte(0x83,0xf8,value);", "dynamic(name);trace.store({GetROP2:9,GetGraphicsMode:10,GetLayout:11}[name]);trace.reason({GetROP2:13,GetGraphicsMode:14,GetLayout:15}[name]);byte(0x83,0xf8,value);");
replace("direct('GetClipBox');byte(0x83,0xf8,2);", "direct('GetClipBox');trace.store(12);trace.reason(16);byte(0x83,0xf8,2);");
replace("  byte(0x8b,0x83);const brushAt", "  trace.reason(17);\n  byte(0x8b,0x83);const brushAt");
replace("direct('FillRect');", "direct('FillRect');trace.store(13);trace.reason(18);byte(0x85,0xc0);j([0x0f,0x84],'cleanup');trace.reason(19);");
replace("labels.restore=code.length;byte(", "labels.restore=code.length;trace.record(siteId);byte(");
replace(' return{sites,dynamicSlots,dynamicNames,gdiNameRva};',' const diagnostics=trace.finish();\n return{sites,dynamicSlots,dynamicNames,gdiNameRva,diagnostics};');
// Observe the main form through the existing entry, without adding a fill.
replace('trace.init(siteId);byte(0x85,0xc0);','trace.init(siteId);byte(0xc7,0x45,0xc0,0,0,0,0);byte(0x85,0xc0);');
replace("}trace.reason(4);j([0xe9],'restore');", "}\n  if(site.name==='optionForm'){byte(0x3d);u32(0xbdc9b0);j([0x0f,0x85],'unmatched');byte(0xc7,0x45,0xc0,1,0,0,0);j([0xe9],'matched');}\n  labels.unmatched=code.length;trace.reason(4);j([0xe9],'restore');");
replace('  trace.reason(17);',"  if(site.name==='optionForm'){byte(0x83,0x7d,0xc0,0);j([0x0f,0x84],'fill');trace.reason(20);j([0xe9],'cleanup');labels.fill=code.length;}\n  trace.reason(17);");
fs.writeFileSync('add-initial-erase-diagnostic.cjs',s);console.log('Generated separate diagnostic module; production source unchanged');
