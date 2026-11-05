'use strict';
// Diagnostics only. Nine verified CALLs plus three verified entry prologues; no global drawing hooks or DC mutations.
const FIELDS=['sequence','site','selfVmt','self','memoryHdc','hdcType','bitsPerPixel','bkMode','bkColor','textColor','brushHandle','brushStyle','brushColor','bitmapWidth','bitmapHeight','pixelTopLeft','pixelTopRight','pixelBottomLeft','pixelBottomRight','technology','mapMode','layout','messageId','printFlags','origin','messageResult','sampleCount','brightCount','whiteCount','sampleKind','sampleClipType','sampleStatus'];
const SITES=[
 ['checkboxAfterFill',0x692e51,'e83647bcff',0x25758c,0x692008,'afterFill'],
 ['checkboxAfterText',0x692e67,'e8e8040000',0x693354,0x692008,'afterText'],
 ['checkboxBeforeBitBlt',0x692f41,'e8225597ff',0x8468,0x692008,'beforeBitBlt'],
 ['radioAfterFill',0x691701,'e8865ebcff',0x25758c,0x690898,'afterFill'],
 ['radioAfterText',0x691711,'e892040000',0x691ba8,0x690898,'afterText'],
 ['radioBeforeBitBlt',0x6917fb,'e8686c97ff',0x8468,0x690898,'beforeBitBlt'],
 ['checkboxBeforeText',0x69345e,'e86987deff',0x47bbcc,0x692008,'beforeText'],
 ['radioBeforeText',0x691cbe,'e8099fdeff',0x47bbcc,0x690898,'beforeText']
].map(([name,callRva,expectedHex,originalTargetRva,vmtRva,phase])=>({name,callRva,expectedHex,originalTargetRva,vmtRva,phase}));
const DYNAMIC=['GetObjectType','GetBkMode','GetBkColor','GetTextColor','GetPixel','GetMapMode','GetLayout','GetWindowOrgEx','GetViewportOrgEx','PtVisible'];
function emit({byte,u32,rva,code,imports}){
 const api=name=>{const i=imports.find(i=>i.name===name);if(!i)throw Error('Missing paint diagnostic API '+name);return i.iat;};
 const refs=[],labels={},jumps=[];
 const ref=name=>{refs.push({at:code.length,name});u32(0);};
 const jump=(op,label)=>{byte(...op);jumps.push({at:code.length,label});u32(0);};
 const call=name=>{byte(0xff,0x93);DYNAMIC.includes(name)?ref(name):u32(api(name));};
 const rel=(op,target)=>{byte(op);u32(target-rva-code.length-4);};
 const sites=[];const sharedRefs=[];
 for(let id=0;id<SITES.length;id++){
  const s=SITES[id],start=code.length;
  if(!s.phase.startsWith('before'))rel(0xe8,s.originalTargetRva);
  // Save the complete original call result (or incoming BitBlt state).
  byte(0x9c,0x60);
  if(s.phase==='beforeText')byte(0xff,0x75,0xfc,0x52,0x8d,0x54,0x24,8);else byte(0x89,0xea);
  byte(0xb8);u32(id);byte(0xe8);sharedRefs.push(code.length);u32(0);
  if(s.phase==='beforeText')byte(0x83,0xc4,8);byte(0x61,0x9d);
  if(s.phase.startsWith('before'))rel(0xe9,s.originalTargetRva);else byte(0xc3);
  sites.push({...s,start,entryRva:rva+start,size:code.length-start});
 }

 const extraPatches=[];
 const sharedCall=()=>{byte(0xe8);sharedRefs.push(code.length);u32(0);};
 // Shared entry record: EAX=Self, EDX=Message. Private numeric frame only.
 const printStart=code.length;
 byte(0x9c,0x60,0x83,0xec,24,0x89,0x44,0x24,20);
 for(const off of [0,4,8,12,16]){byte(0xc7,0x44,0x24,off);u32(0xffffffff);}
 byte(0xc7,0x44,0x24,4);u32(1); // origin printClientEntry
 byte(0x85,0xd2,0x74,28);
 for(const [src,dst]of[[0,12],[4,16],[8,8],[12,0]])byte(0x8b,0x4a,src,0x89,0x4c,0x24,dst);
 byte(0x8d,0x54,0x24,24,0xb8);u32(8);sharedCall();
 byte(0x83,0xc4,24,0x61,0x9d,...Buffer.from('558bec83c4f8','hex'));rel(0xe9,0xd345de);
 sites.push({name:'printClientEntry',phase:'printClientEntry',patchType:'prologue6',originalRva:0xd345d8,expectedHex:'558bec83c4f8',entryRva:rva+printStart,start:printStart,size:code.length-printStart,vmtRvas:[0x692008,0x690898]});
 extraPatches.push(sites[8]);
 // NativePaintWindow has no stack args; retain its incoming flags before the
 // private frame and preserve every original result before the after sample.
 const nativeStart=code.length;
 byte(0x9c,0x55,0x8b,0xec,0x83,0xec,24,0x89,0x45,0xfc,0x89,0x55,0xf8);
 for(const [off,v]of[[-12,15],[-16,0],[-20,2],[-24,0xffffffff]]){byte(0xc7,0x45,off&255);u32(v);}
 byte(0x9c,0x60,0x89,0xea,0xb8);u32(9);sharedCall();byte(0x61,0x9d,0xff,0x75,4,0x9d,0xe8);const originalCallAt=code.length;u32(0);
 byte(0x89,0x45,0xe8,0x9c,0x60,0x89,0xea,0xb8);u32(10);sharedCall();byte(0x61,0x9d,0x8b,0xe5,0x5d,0x8d,0x64,0x24,4,0xc3);
 const trampoline=code.length;byte(...Buffer.from('558bec83c4e8','hex'));rel(0xe9,0xd300da);
 const delta=trampoline-originalCallAt-4;for(let i=0;i<4;i++)code[originalCallAt+i]=(delta>>>(8*i))&255;
 const nativeSite={name:'nativePaintBefore',phase:'nativePaintBefore',patchType:'prologue6',originalRva:0xd300d4,expectedHex:'558bec83c4e8',entryRva:rva+nativeStart,start:nativeStart,size:code.length-nativeStart,trampolineRva:rva+trampoline,vmtRvas:[0x692008,0x690898]};
 sites.push(nativeSite,{name:'nativePaintAfter',phase:'nativePaintAfter',virtualOnly:true,entryRva:rva+nativeStart,vmtRvas:[0x692008,0x690898]});extraPatches.push(nativeSite);
 const treeStart=code.length;
 byte(0x9c,0x60,0x83,0xec,24,0x89,0x44,0x24,20);
 for(const off of [0,4,8,12,16]){byte(0xc7,0x44,0x24,off);u32(0xffffffff);}
 byte(0xc7,0x44,0x24,4);u32(3); // origin printClientEntry
 byte(0x85,0xd2,0x74,28);
 for(const [src,dst]of[[0,12],[4,16],[8,8],[12,0]])byte(0x8b,0x4a,src,0x89,0x4c,0x24,dst);
 byte(0x8d,0x54,0x24,24,0xb8);u32(11);sharedCall();
 byte(0x83,0xc4,24,0x61,0x9d,...Buffer.from('558bec83c4dc','hex'));rel(0xe9,0x589632);
 sites.push({name:'treePrintClientEntry',phase:'treePrintClientEntry',patchType:'prologue6',originalRva:0x58962c,expectedHex:'558bec83c4dc',entryRva:rva+treeStart,start:treeStart,size:code.length-treeStart,vmtRvas:[0x56fa20,0x56d1fc]});
 extraPatches.push(sites[11]);


 // BeginPaint stdcall wrapper: copy two args while leaving the original return
 // and arg list intact; the original is called exactly once and owns its copy.
 const earlyStart=code.length;byte(0xff,0x74,0x24,8,0xff,0x74,0x24,8);rel(0xe8,0x8870);
 byte(0x9c,0x60,0x83,0xec,24,0x8b,0x4d,0xfc,0x89,0x4c,0x24,20,0x89,0x44,0x24,16);
 for(const [off,v]of[[0,0xffffffff],[4,4],[8,0],[12,15]]){byte(0xc7,0x44,0x24,off);u32(v);}
 byte(0x8d,0x54,0x24,24,0xb8);u32(12);sharedCall();byte(0x83,0xc4,24,0x61,0x9d,0xc2,8,0);
 const earlySite={name:'buttonsAfterBeginPaint',phase:'afterBeginPaintBeforeEndPaint',patchType:'call',originalRva:0x47baf8,expectedHex:'e873cdb8ff',originalTargetRva:0x8870,entryRva:rva+earlyStart,start:earlyStart,size:code.length-earlyStart,vmtRvas:[0x692008,0x690898]};sites.push(earlySite);extraPatches.push(earlySite);
 const shared=code.length;for(const at of sharedRefs){const v=shared-at-4;for(let i=0;i<4;i++)code[at+i]=(v>>>(8*i))&255;}
 // Private frame: event -128..-1, BITMAP -160..-137, LOGBRUSH -176..-165,
 // saved LastError -180; painter frame -184. Caller saved all regs+flags.
 byte(0x55,0x8b,0xec,0x81,0xec);u32(256);byte(0x89,0x95);u32(-184);
 byte(0x89,0xc6,0xe8,0,0,0,0);const after=code.length;byte(0x5b,0x81,0xeb);u32(rva+after);
 byte(0x64,0xa1,0x34,0,0,0,0x89,0x85);u32(-180);
 byte(0xfc,0x8d,0x7d,0x80,0xb9);u32(32);byte(0x83,0xc8,0xff,0xf3,0xab);
 const store=(n)=>{byte(0x89,0x45,(-128+n*4)&255);};
 byte(0x89,0xf0);store(1);
 byte(0x83,0xfe,8);jump([0x0f,0x82],'originalSiteFields');
 for(const [off,n]of[[-12,22],[-16,23],[-20,24],[-24,25]]){byte(0x8b,0x42,off&255);store(n);}
 labels.originalSiteFields=code.length;byte(0x8b,0x42,0xfc);store(3);byte(0x85,0xc0);jump([0x0f,0x84],'nullSelf');
 byte(0x8b,0x08,0x89,0xc8);store(2);
 byte(0x83,0xfe,8);jump([0x0f,0x82],'originalSiteClass');byte(0x29,0xd9,0x83,0xfe,11);jump([0x0f,0x84],'treeClass');byte(0x81,0xf9);u32(0x692008);jump([0x0f,0x84],'classMatched');byte(0x81,0xf9);u32(0x690898);jump([0x0f,0x85],'cleanup');jump([0xe9],'classMatched');
 labels.treeClass=code.length;byte(0x81,0xf9);u32(0x56fa20);jump([0x0f,0x84],'classMatched');byte(0x81,0xf9);u32(0x56d1fc);jump([0x0f,0x85],'cleanup');jump([0xe9],'classMatched');
 labels.originalSiteClass=code.length;byte(0x29,0xd9,0x83,0xfe,6);jump([0x0f,0x84],'checkbox');byte(0x83,0xfe,3);jump([0x0f,0x83],'radio');labels.checkbox=code.length;
 byte(0x81,0xf9);u32(0x692008);jump([0xe9],'check');labels.radio=code.length;byte(0x81,0xf9);u32(0x690898);labels.check=code.length;jump([0x0f,0x85],'record');
 labels.classMatched=code.length;byte(0x8b,0x42,0xf8);store(4);byte(0x83,0xfe,11);jump([0x0f,0x84],'record');byte(0x85,0xc0);jump([0x0f,0x84],'record');
 for(const name of DYNAMIC){byte(0x83,0xbb);ref(name);byte(0);jump([0x0f,0x84],'record');}
 const hdc=()=>byte(0xff,0x75,0x90);
 hdc();call('GetObjectType');store(5);byte(0x83,0xfe,12);jump([0x0f,0x84],'earlyType');byte(0x83,0xf8,10);jump([0x0f,0x85],'record');jump([0xe9],'technology');labels.earlyType=code.length;byte(0x83,0xf8,3);jump([0x0f,0x85],'record');labels.technology=code.length;
 byte(0x6a,2);hdc();call('GetDeviceCaps');store(19);byte(0x83,0xf8,1);jump([0x0f,0x85],'record');
 byte(0x83,0xfe,12);jump([0x0f,0x85],'stateQueries');byte(0x6a,12);hdc();call('GetDeviceCaps');byte(0x50,0x6a,14);hdc();call('GetDeviceCaps');byte(0x5a,0x0f,0xaf,0xc2);store(6);byte(0x83,0xf8,8);jump([0x0f,0x86],'record');labels.stateQueries=code.length;
 for(const [name,n] of [['GetBkMode',7],['GetBkColor',8],['GetTextColor',9],['GetMapMode',20],['GetLayout',21]]){hdc();call(name);store(n);}
 byte(0x6a,2);hdc();call('GetCurrentObject');store(10);byte(0x85,0xc0);jump([0x0f,0x84],'bitmap');
 byte(0x8d,0x95);u32(-176);byte(0x52,0x6a,12,0x50);call('GetObjectA');byte(0x83,0xf8,12);jump([0x0f,0x85],'bitmap');
 byte(0x8b,0x85);u32(-176);store(11);byte(0x8b,0x85);u32(-172);store(12);
 labels.bitmap=code.length;byte(0x83,0xfe,12);jump([0x0f,0x84],'aggregate');byte(0x6a,7);hdc();call('GetCurrentObject');byte(0x85,0xc0);jump([0x0f,0x84],'record');
 byte(0x8d,0x95);u32(-160);byte(0x52,0x6a,24,0x50);call('GetObjectA');byte(0x83,0xf8,24);jump([0x0f,0x85],'record');
 byte(0x0f,0xb7,0x85);u32(-144);byte(0x0f,0xb7,0x95);u32(-142);byte(0x0f,0xaf,0xc2);store(6);byte(0x83,0xf8,8);jump([0x0f,0x86],'record');
 byte(0x8b,0x85);u32(-156);store(13);byte(0x83,0xf8,2);jump([0x0f,0x8c],'record');
 byte(0x8b,0x85);u32(-152);store(14);byte(0x83,0xf8,2);jump([0x0f,0x8c],'record');
 byte(0x83,0x7d,0xd0,1);jump([0x0f,0x85],'record');byte(0x83,0x7d,0xd4,0);jump([0x0f,0x85],'record');
 // Only the four extreme bitmap corners; never inspect caption or center.
 for(let n=0;n<4;n++){
  if(n&2)byte(0x8b,0x45,0xb8,0x48,0x50);else byte(0x6a,0);
  if(n&1)byte(0x8b,0x45,0xb4,0x48,0x50);else byte(0x6a,0);
  hdc();call('GetPixel');store(15+n);
 }
 byte(0x83,0xfe,2);jump([0x0f,0x84],'aggregate');byte(0x83,0xfe,5);jump([0x0f,0x84],'aggregate');jump([0xe9],'record');
 labels.nullSelf=code.length;byte(0x83,0xfe,8);jump([0x0f,0x83],'cleanup');jump([0xe9],'record');

 labels.aggregate=code.length;
 for(const n of[26,27,28]){byte(0xc7,0x45,(-128+n*4)&255);u32(0);}
 byte(0xc7,0x45,0xfc);u32(1); // status1 skipped unless all guards pass
 byte(0xb8);u32(2);byte(0x83,0xfe,12);jump([0x0f,0x85],'setPattern');byte(0xb8);u32(1);labels.setPattern=code.length;store(29);
 byte(0x83,0x7d,0xd0,1);jump([0x0f,0x85],'record');byte(0x83,0x7d,0xd4,0);jump([0x0f,0x85],'record');
 for(const name of['GetWindowOrgEx','GetViewportOrgEx']){
  byte(0x8d,0x85);u32(-216);byte(0x50);hdc();call(name);byte(0x85,0xc0);jump([0x0f,0x84],'record');
  byte(0x83,0xbd);u32(-216);byte(0);jump([0x0f,0x85],'record');byte(0x83,0xbd);u32(-212);byte(0);jump([0x0f,0x85],'record');
 }
 byte(0x8d,0x85);u32(-208);byte(0x50);hdc();call('GetClipBox');store(30);byte(0x83,0xf8,2);jump([0x0f,0x8c],'record');
 // Require a positive small clip; each candidate is checked against PtVisible.
 for(const [hi,lo]of[[-200,-208],[-196,-204]]){byte(0x8b,0x85);u32(hi);byte(0x2b,0x85);u32(lo);byte(0x83,0xf8,3);jump([0x0f,0x8c],'record');byte(0x3d);u32(4096);jump([0x0f,0x8f],'record');}
 byte(0x83,0xfe,12);jump([0x0f,0x84],'aggregateSizeOkay');
 for(const n of[13,14]){byte(0x8b,0x45,(-128+n*4)&255,0x83,0xf8,3);jump([0x0f,0x8c],'record');byte(0x3d);u32(4096);jump([0x0f,0x8f],'record');}
 labels.aggregateSizeOkay=code.length;byte(0xc7,0x45,0xfc);u32(0);
 // Counts only: never retain the new interior/clip pixel values or coordinates.
 const countRefs=[];const countCall=()=>{byte(0xe8);countRefs.push(code.length);u32(0);};
 byte(0x83,0xfe,12);jump([0x0f,0x84],'screenPoints');
 for(let n=15;n<19;n++){byte(0x8b,0x45,(-128+n*4)&255);countCall();}
 // Five interior points. The four existing corner calls make nine total.
 const points=[[1,4,1,2],[1,2,1,2],[3,4,1,2],[1,2,1,3],[1,2,2,3]];
 const candidate=(xnum,xden,ynum,yden,screen)=>{
  for(const [num,den,dimension,lo,scratch]of[[xnum,xden,13,-208,-224],[ynum,yden,14,-204,-220]]){
   if(screen){byte(0x8b,0x85);u32(lo+8);byte(0x2b,0x85);u32(lo);}else byte(0x8b,0x45,(-128+dimension*4)&255);
   byte(0x6b,0xc0,num,0x99,0xb9);u32(den);byte(0xf7,0xf9);if(screen){byte(0x03,0x85);u32(lo);}byte(0x89,0x85);u32(scratch);
  }
  const skip=[];const sk=op=>{byte(0x0f,op);skip.push(code.length);u32(0);};
  for(const [coord,min,max]of[[-224,-208,-200],[-220,-204,-196]]){byte(0x8b,0x85);u32(coord);byte(0x3b,0x85);u32(min);sk(0x8c);byte(0x3b,0x85);u32(max);sk(0x8d);}
  byte(0xff,0xb5);u32(-220);byte(0xff,0xb5);u32(-224);hdc();call('PtVisible');byte(0x85,0xc0);sk(0x84);
  byte(0xff,0xb5);u32(-220);byte(0xff,0xb5);u32(-224);hdc();call('GetPixel');countCall();
  for(const at of skip){const v=code.length-at-4;for(let i=0;i<4;i++)code[at+i]=(v>>>(8*i))&255;}
 };
 for(const q of points)candidate(...q,false);jump([0xe9],'record');
 labels.screenPoints=code.length;for(let y=1;y<=5;y+=2)for(let x=1;x<=5;x+=2)candidate(x,6,y,6,true);jump([0xe9],'record');
 const countStart=code.length;for(const at of countRefs){const v=countStart-at-4;for(let i=0;i<4;i++)code[at+i]=(v>>>(8*i))&255;}
 byte(0x83,0xf8,0xff,0x0f,0x84);const invalidAt=code.length;u32(0);byte(0xff,0x45,0xe8); // count successful only
 const countExits=[]; // All three COLORREF channels must pass the threshold.
 for(const [threshold,field]of[[230,27],[250,28]]){
  const fails=[];for(const shift of[0,8,16]){byte(0x89,0xc2);if(shift)byte(0xc1,0xea,shift);byte(0x81,0xe2);u32(255);byte(0x81,0xfa);u32(threshold);byte(0x0f,0x82);fails.push(code.length);u32(0);}
  byte(0xff,0x45,(-128+field*4)&255);
  const target=code.length;for(const at of fails){const v=target-at-4;for(let i=0;i<4;i++)code[at+i]=(v>>>(8*i))&255;}
 }
 const countRet=code.length;byte(0xc3);const invalidDelta=countRet-invalidAt-4;for(let i=0;i<4;i++)code[invalidAt+i]=(invalidDelta>>>(8*i))&255;
 labels.record=code.length;
 byte(0xb8);u32(1);byte(0xf0,0x0f,0xc1,0x83);ref('nextSequenceRva');byte(0x89,0xc2,0x42,0x25);u32(255);byte(0xc1,0xe0,7,0x8d,0xbb);ref('ringRva');byte(0x01,0xc7,0xc7,7);u32(0);
 byte(0x57,0x83,0xc7,4,0x8d,0x75,0x84,0xb9);u32(31);byte(0xf3,0xa5,0x5f,0x89,0x17,0xf0,0xff,0x83);ref('committedRva');
 labels.cleanup=code.length;byte(0x8b,0x85);u32(-180);byte(0x64,0xa3,0x34,0,0,0,0xc9,0xc3);
 for(const j of jumps){if(labels[j.label]===undefined)throw Error(j.label);const v=labels[j.label]-j.at-4;for(let i=0;i<4;i++)code[j.at+i]=(v>>>(8*i))&255;}
 const dynamicSlots={},dynamicNames={};for(const name of DYNAMIC){while(code.length%4)byte(0);dynamicSlots[name]=rva+code.length;u32(0);dynamicNames[name]=rva+code.length;byte(...Buffer.from(name+'\0'));}
 const gdiNameRva=rva+code.length;byte(...Buffer.from('gdi32.dll\0'));while(code.length%16)byte(0);
 const headerRva=rva+code.length;for(const v of [0x58445050,1,256,128,0,0,0,0])u32(v);
 const ringRva=rva+code.length;for(let n=0;n<256*32;n++)u32(0);
 const diagnostics={headerRva,ringRva,nextSequenceRva:headerRva+16,committedRva:headerRva+20,magic:0x58445050,schemaVersion:1,capacity:256,recordBytes:128,byteLength:32+256*128,fields:FIELDS,sites:sites.map((s,id)=>({id,name:s.name,phase:s.phase,vmtRva:s.vmtRva,vmtRvas:s.vmtRvas})),unqueried:0xffffffff,samplePatterns:{1:'BeginPaint clip 3x3 aggregates, at most9 GetPixel',2:'final memory4existing corners plus5interior, at most9 GetPixel'},aggregateThresholds:{bright:230,white:250,rule:'every RGB channel >= threshold'},coordinateLimit:'Original four raw bitmap corners are unchanged and need not be child/clip corners. New aggregate points require MM_TEXT/layout0/zero window+viewport origins, bounded GetClipBox and PtVisible; final-memory coordinates use actual bitmap size, not HWND logical dimensions. Early display DC is only the original exact-class BeginPaint return before EndPaint, with its own clip; no separate HWND/rcPaint/client geometry or WindowFromDC query. Finite points and invalid samples cannot exclude unsampled white.',origins:{1:'exact buttons WM_PRINTCLIENT entry',2:'exact buttons native PaintWindow, no WM_PRINT association established',3:'exact virtual tree WM_PRINTCLIENT entry, no pixel query',4:'exact button valid BeginPaint window HDC before EndPaint'},privacy:'Numeric drawing state and four existing extreme memory-bitmap corner colors; new clip/interior queries retain only sample/bright/white counts, never individual new pixel values or arrays. Early window queries use only the valid exact-class BeginPaint HDC clip before EndPaint. No text, captions, image capture, mail data or I/O.'};
 for(const x of refs){const v=dynamicSlots[x.name]===undefined?diagnostics[x.name]:dynamicSlots[x.name];if(v===undefined)throw Error(x.name);for(let i=0;i<4;i++)code[x.at+i]=(v>>>(8*i))&255;}
 return{sites,patches:[...sites.slice(0,8).map(s=>({...s,patchType:'call',originalRva:s.callRva})),...extraPatches],association:'No thread context: compare Self/HDC and neighboring sequence only; nativePaint does not establish WM_PRINTCLIENT causation.',dynamicSlots,dynamicNames,gdiNameRva,diagnostics};
}
function emitInit({byte,u32,imports},meta){const api=n=>{const a=imports.find(x=>x.name===n);if(!a)throw Error(n);return a.iat;};byte(0x8d,0x83);u32(meta.gdiNameRva);byte(0x50,0xff,0x93);u32(api('GetModuleHandleA'));byte(0x89,0xc6);for(const name of Object.keys(meta.dynamicSlots)){byte(0x8d,0x83);u32(meta.dynamicNames[name]);byte(0x50,0x56,0xff,0x93);u32(api('GetProcAddress'));byte(0x89,0x83);u32(meta.dynamicSlots[name]);}}
function patchOriginal(out,offset,meta){for(const s of meta.patches||meta.sites){const originalRva=s.originalRva===undefined?s.callRva:s.originalRva,at=offset(originalRva),expected=Buffer.from(s.expectedHex,'hex');if(!out.subarray(at,at+expected.length).equals(expected))throw Error('Paint diagnostic instruction mismatch '+s.name);if(s.patchType==='prologue6'){out[at]=0xe9;out.writeInt32LE(s.entryRva-originalRva-5,at+1);out[at+5]=0x90;}else out.writeInt32LE(s.entryRva-originalRva-5,at+1);}}
module.exports={emit,emitInit,patchOriginal,SITES,FIELDS};

