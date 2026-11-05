'use strict';
// Foxmail 7.2.25.563 x86, image base 0x400000. Published TRelatedmailFrame paint
// callbacks and directly traced TMailListView header/group painters only.
// No instruction lengths or calls change.
// Addresses are instruction VAs; each replacement is the following imm32.
const fs = require('fs');
const P = { panel: 0x282828, bg: 0x202020, hover: 0x333333, border: 0x3d3d3d };
const patches = [
  // TFMGroupBox WM_PAINT calls its own painter at B6A4A4; RGB(198,198,198).
  [0xb6a52c, 'rgb', 0xc6, 0x3d, 'TFMGroupBox border pen'],
  // TMailListView{Narrow,Broad}PaintHandler slot+0x24 -> 0xB3A7EC.
  [0xb3a804, 0x68, 0xeae4db, P.hover, 'mail-list sort header hot start'],
  [0xb3a809, 0x68, 0xf1ede6, P.panel, 'mail-list sort header hot end'],
  [0xb3a827, 0x68, 0xfcfaf8, P.panel, 'mail-list sort header normal start'],
  [0xb3a82c, 0x68, 0xf6f3ef, P.bg, 'mail-list sort header normal end'],
  [0xb3a856, 0xba, 0xc9c4bf, P.border, 'mail-list sort header top border'],
  [0xb3a894, 0xba, 0xc9c4bf, P.border, 'mail-list sort header bottom border'],
  [0xb3a902, 0x68, 0xb2a499, P.border, 'mail-list sort header vertical edge start'],
  [0xb3a907, 0x68, 0xeae5df, P.border, 'mail-list sort header vertical edge end'],
  // TMailListViewPaintHandler 0xF5404C tests item kind==1 and calls 0xB3A928.
  [0xb3a93d, 0x68, 0xf2f0ed, P.hover, 'mail-list group header hot start'],
  [0xb3a942, 0x68, 0xf8f8f8, P.panel, 'mail-list group header hot end'],
  [0xb3a961, 0x68, 0xfffffe, P.panel, 'mail-list group header expanded start'],
  [0xb3a966, 0x68, 0xfefdfd, P.panel, 'mail-list group header expanded end'],
  [0xb3a97f, 0x68, 0xfbfaf8, P.panel, 'mail-list group header normal start'],
  [0xb3a984, 0x68, 0xfffefd, P.panel, 'mail-list group header normal end'],
  // Mail-list unselected row separators, PaintHandler 0xF53D48.
  [0xf53d96, 0xba, 0xd3cfcc, P.border, 'mail-list special-row bottom separator'],
  [0xf53da8, 0xba, 0xdadada, P.border, 'mail-list normal-row bottom separator'],
  // TRelatedmailFrame.RelateMailVDTDrawNode -> 0xF911C8, last row-bottom pen.
  [0xf913dd, 0xba, 0xdadada, P.border, 'related-mail row bottom separator'],
  // TAttachListFrame.lvAttachmentsAfterItemPaint, common final row-bottom pen.
  [0xf585d0, 0xba, 0xdadada, P.border, 'related-attachment row bottom separator'],
  [0xf916a0, 0x68, 0xfbf9f7, P.panel, 'xpnlTopperCustomPaint start'],
  [0xf916a5, 0x68, 0xedebe7, P.bg, 'xpnlTopperCustomPaint end'],
  [0xf9144b, 0x68, 0xf8f6f3, P.panel, 'btnChangeNameCustomPaint start'],
  [0xf91450, 0x68, 0xefede9, P.bg, 'btnChangeNameCustomPaint end'],
  [0xf9146f, 0xba, 0xcecbc8, P.hover, 'btnChangeNameCustomPaint hover brush'],
  [0xf91487, 0xba, 0xcecbc8, P.hover, 'btnChangeNameCustomPaint pressed brush'],
  [0xf93a5f, 0x68, 0xf3f1f0, P.hover, 'btnImgRelatedMailHeaderCustomPaint hover start'],
  [0xf93a64, 0x68, 0xf9f9f9, P.panel, 'btnImgRelatedMailHeaderCustomPaint hover end'],
  [0xf93a7d, 0x68, 0xfffefd, P.panel, 'btnImgRelatedMailHeaderCustomPaint normal start'],
  [0xf93a82, 0x68, 0xfbfaf8, P.bg, 'btnImgRelatedMailHeaderCustomPaint normal end'],
  [0xf93aad, 0xba, 0xcac5c1, P.border, 'btnImgRelatedMailHeaderCustomPaint top border'],
  [0xf93ae4, 0xba, 0xdbd8d6, P.border, 'btnImgRelatedMailHeaderCustomPaint bottom border'],
  [0xf93e13, 0x68, 0xf3f1f0, P.hover, 'btnImgRelatedAttachHeaderCustomPaint hover start'],
  [0xf93e18, 0x68, 0xf9f9f9, P.panel, 'btnImgRelatedAttachHeaderCustomPaint hover end'],
  [0xf93e31, 0x68, 0xfffefd, P.panel, 'btnImgRelatedAttachHeaderCustomPaint normal start'],
  [0xf93e36, 0x68, 0xfbfaf8, P.bg, 'btnImgRelatedAttachHeaderCustomPaint normal end'],
  [0xf93e61, 0xba, 0xdbd8d6, P.border, 'btnImgRelatedAttachHeaderCustomPaint bottom border'],
  [0xf91bcc, 0x68, 0xfefefd, P.panel, 'RelateMailVDTAdvancedHeaderDraw start'],
  [0xf91bd1, 0x68, 0xf3f3f3, P.bg, 'RelateMailVDTAdvancedHeaderDraw end'],
  [0xf91bf5, 0xba, 0xc9c4bf, P.border, 'RelateMailVDTAdvancedHeaderDraw border'],
  [0xf940fe, 0x68, 0xfcfcfb, P.panel, 'btnsplitCustomPaint normal start'],
  [0xf94103, 0x68, 0xfafafa, P.bg, 'btnsplitCustomPaint normal end'],
  [0xf9412f, 0x68, 0xfaf8f6, P.hover, 'btnsplitCustomPaint hover start'],
  [0xf94134, 0x68, 0xf3f3f3, P.panel, 'btnsplitCustomPaint hover end'],
  [0xf94160, 0x68, 0xf0edeb, P.hover, 'btnsplitCustomPaint pressed start'],
  [0xf94165, 0x68, 0xf3f1f0, P.panel, 'btnsplitCustomPaint pressed end'],
  [0xf94197, 0xba, 0xcac5c1, P.border, 'btnsplitCustomPaint border'],
  [0xf94202, 0xba, 0xdadada, P.border, 'btnsplitCustomPaint bottom border'],
];
function applyNativeHeaderColors(input, reverse = false) {
  const b = Buffer.from(input);
  if (b.readUInt16LE(0) !== 0x5a4d) throw new Error('Not PE');
  const pe=b.readUInt32LE(0x3c), op=pe+24;
  if (b.readUInt16LE(op)!==0x10b || b.readUInt32LE(op+28)!==0x400000) throw new Error('Unexpected PE architecture/base');
  const so=op+b.readUInt16LE(pe+20), sections=[];
  for(let i=0;i<b.readUInt16LE(pe+6);i++) { const p=so+i*40; sections.push({r:b.readUInt32LE(p+12),n:b.readUInt32LE(p+16),f:b.readUInt32LE(p+20)}); }
  const offset=va=>{const r=va-0x400000,s=sections.find(s=>r>=s.r&&r+5<=s.r+s.n);if(!s)throw new Error('Unmapped VA');return s.f+r-s.r;};
  // Validate the entire set before changing any bytes; tolerate already-applied entries.
  const pending=[];
  for(const [va,opcode,oldColor,newColor,label] of patches){
    const p=offset(va),before=reverse?newColor:oldColor,after=reverse?oldColor:newColor;
    if(opcode==='rgb'){
      if(b[p]!==0xb1||b[p+2]!==0xb2||b[p+4]!==0xb0)throw Error('RGB instruction mismatch '+label);
      for(const delta of [1,3,5]){if(b[p+delta]!==before&&b[p+delta]!==after)throw Error('RGB color mismatch '+label);if(b[p+delta]!==after)pending.push({p:p+delta,after,label,va,byte:true});}
      continue;
    }
    if(b[p]!==opcode)throw new Error(`Opcode mismatch ${label} VA ${va.toString(16)}`);
    const current=b.readUInt32LE(p+1);
    if(current!==before&&current!==after)throw new Error(`Color mismatch ${label}: ${current.toString(16)}`);
    if(current!==after)pending.push({p,after,label,va});
  }
  for(const e of pending){if(e.byte)b[e.p]=e.after;else b.writeUInt32LE(e.after,e.p+1);}
  return {buffer:b,changed:pending.map(({label,va})=>({label,va:'0x'+va.toString(16)})),total:patches.length};
}
module.exports={applyNativeHeaderColors,patches};
if(require.main===module){
  const [input,output,mode]=process.argv.slice(2);
  if(!input||!output)throw new Error('Usage: node patch-native-header-colors.cjs INPUT OUTPUT [--reverse]');
  const r=applyNativeHeaderColors(fs.readFileSync(input),mode==='--reverse');
  fs.writeFileSync(output,r.buffer);
  console.log(JSON.stringify({output,changed:r.changed.length,total:r.total}));
}
