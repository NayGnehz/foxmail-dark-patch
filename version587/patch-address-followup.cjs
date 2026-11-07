'use strict';
// Six literal-only changes for the separate address group-title/selection paths.
// Keep patch-address-native.cjs frozen: it describes the previously installed layer.
const assert=require('assert'),crypto=require('crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const guards=[
 [0xbdc810,524,'663e9ecd59ea785ed15ad6f71be7aa75a4557f11aeef377aefb3481cab443de1','address node type 0A group-title painter'],
 [0xbdd684,132,'f07b04eadee75ef4f928ea901a5e0dc76a6d1848144db00e9103d85dfa1814a1','address selection painter'],
 [0xb3a8e4,88,'34fce545dbcec6947ff15cb05fbd73a3f864a353849b40b8c9e5128b70089aa5','accepted shared mail selection painter'],
 [0xbdbc7c,1280,'44496d3fdabe0786087f817550ae8b1695c708af85254714c77d0480edfd77bd','address loader bindings'],
 [0xbdd39c,744,'a47038cf11f32cdf4380b6fefc26d1fb029bb0dc4673e816171f4039fcb99098','type 0A group-title dispatch'],
];
const patches=[
 [0xbdc96a,0xfffffe,0x282828,'group title gradient end',null],
 [0xbdc96f,0xfefdfd,0x202020,'group title gradient start',null],
 [0xbdd6be,0xae9479,0x6f5131,'focused selection gradient end',0xb3a8f9],
 [0xbdd6c3,0x967f66,0x5f4428,'focused selection gradient start',0xb3a8fe],
 [0xbdd6dc,0xb8a692,0x4f4333,'unfocused selection gradient end',0xb3a917],
 [0xbdd6e1,0xb3a08c,0x44392b,'unfocused selection gradient start',0xb3a91c],
];
function patchBuffer(input){
 const out=Buffer.from(input),pe=out.readUInt32LE(60),op=pe+24,so=op+out.readUInt16LE(pe+20);
 assert.equal(out.readUInt32LE(op+28),0x400000);assert.equal(out.readUInt16LE(pe+4),0x14c);assert.equal(out.readUInt16LE(op),0x10b);
 const sections=Array.from({length:out.readUInt16LE(pe+6)},(_,i)=>{const p=so+40*i;return{name:out.toString('ascii',p,p+8).replace(/\0/g,''),r:out.readUInt32LE(p+12),n:out.readUInt32LE(p+16),p:out.readUInt32LE(p+20)};});
 function off(va,n=5){const s=sections.find(s=>va-0x400000>=s.r&&va-0x400000+n<=s.r+s.n);assert(s&&s.name==='CODE','Exact existing native CODE required');return s.p+va-0x400000-s.r;}
 for(const[va,n,hash,label]of guards)assert.equal(sha(out.subarray(off(va,n),off(va,n)+n)),hash,'Exact 587 paint guard '+label);
 const changes=patches.map(([va,before,after,label,mailVA])=>{
  const p=off(va);assert.equal(out[p],0x68,label);assert.equal(out.readUInt32LE(p+1),before,label);
  if(mailVA){const m=off(mailVA);assert.equal(out[m],0x68);assert.equal(out.readUInt32LE(m+1),after,'Address selection must equal currently accepted mail endpoint');}
  return{kind:'native-color',va,before,after,label,mailVA,offset:p+1,size:4};
 });
 for(const p of changes)out.writeUInt32LE(p.after,p.offset);
 let changedBytes=0;for(let i=0;i<input.length;i++)if(input[i]!==out[i]){assert(changes.some(p=>i>=p.offset&&i<p.offset+4),'Unexpected non-color delta');changedBytes++;}
 assert.equal(changedBytes,18);assert.equal(out.length,input.length);
 const reverse=Buffer.from(out);for(const p of changes)reverse.writeUInt32LE(p.before,p.offset);assert(reverse.equals(input),'Reversing the six colors restores exact input');
 return{buffer:out,changes,changedBytes,guards:guards.map(([va,size,hash,label])=>({va,size,hash,label})),acceptedMailPaletteMatched:true,allOtherBytesUnchanged:true,reverseRestoresExactInput:true};
}
module.exports={patchBuffer,patches,guards};
