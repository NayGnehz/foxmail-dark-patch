'use strict';
const {readResources}=require('../pe-resource-utils.cjs');
const {parseDFM}=require('../inspect-dfm-palette.cjs');
const {pngDecode,pngEncode}=require('../recolor-search-scrollbars.cjs');
const selected=/^(COMMON_BUTTON_(NORMAL|HOVER|PRESS|DISABLE)|ADDRESS_ADDRESS_HOVER|COMMON_ADD_MASK)(_2X)?_PNG$/;
function patchBuffer(input,original){
 if(!original)throw Error('Pristine original buffer required for allocation guards');
 const out=Buffer.from(input),rs=readResources(out).resources,orig=readResources(original).resources,changes=[],allowed=[];
 const resources=rs.filter(r=>r.type===10&&selected.test(r.name));if(resources.length!==12)throw Error('Expected twelve exact address/button sprites');
 for(const r of resources){const a=orig.find(x=>x.type===r.type&&x.name===r.name&&x.lang===r.lang);if(!a||a.offset!==r.offset||a.dataEntry!==r.dataEntry)throw Error('Allocation guard mismatch '+r.name);
  const im=pngDecode(out.subarray(r.offset,r.offset+r.size)),old=Buffer.from(im.rgba),isPlus=/ADD_MASK/.test(r.name),fill=isPlus?32:/DISABLE/.test(r.name)?40:/PRESS/.test(r.name)?37:/HOVER/.test(r.name)?56:45,edge=/DISABLE/.test(r.name)?60:/PRESS/.test(r.name)?90:/HOVER/.test(r.name)?100:75;let pixelsChanged=0;
  for(let p=0;p<im.rgba.length;p+=4){if(!im.rgba[p+3])continue;const c=[...im.rgba.subarray(p,p+3)],lo=Math.min(...c),hi=Math.max(...c);if(lo<100||hi-lo>80)continue;const lum=(c[0]+c[1]+c[2])/3,v=isPlus?fill:lum<210?edge:fill+Math.max(-3,Math.min(3,Math.round((lum-230)/8)));im.rgba[p]=im.rgba[p+1]=im.rgba[p+2]=v;pixelsChanged++;}
  for(let p=3;p<im.rgba.length;p+=4)if(im.rgba[p]!==old[p])throw Error('Alpha changed');const encoded=pngEncode(im);if(encoded.length>a.size)throw Error('PNG capacity exceeded '+r.name);if(!pngDecode(encoded).rgba.equals(im.rgba))throw Error('PNG roundtrip failed');encoded.copy(out,r.offset);out.fill(0,r.offset+encoded.length,r.offset+a.size);out.writeUInt32LE(encoded.length,r.dataEntry+4);allowed.push([r.offset,r.offset+a.size],[r.dataEntry+4,r.dataEntry+8]);changes.push({kind:'sprite',name:r.name,width:im.width,height:im.height,pixelsChanged,oldSize:r.size,newSize:encoded.length,allocation:a.size});
 }
 const dfm=rs.find(r=>r.type===10&&r.name==='TDLG_SELADDR');if(!dfm)throw Error('Missing chooser DFM');const tree=parseDFM(out.subarray(dfm.offset,dfm.offset+dfm.size)),targets=new Map([['.Dlg_SelAddr.P_Left.BorderColor',12433587],['.Dlg_SelAddr.P_Right.BorderColor',12433587],['.Dlg_SelAddr.P_Left.Splitter1.Color',14538967]]);let found=0;
 function walk(o,path){path+='.'+o.name;for(const p of o.properties){const key=path+'.'+p.name;if(!targets.has(key))continue;if(p.type!==4||p.value!==targets.get(key))throw Error('DFM numeric guard mismatch '+key);const at=dfm.offset+p.offset+1;out.writeUInt32LE(0x3d3d3d,at);allowed.push([at,at+4]);changes.push({kind:'DFM',name:key,offset:at,before:p.value,after:0x3d3d3d});found++;}o.children.forEach(c=>walk(c,path));}walk(tree,'');if(found!==3)throw Error('Missing chooser numeric border properties');
 const pe=out.readUInt32LE(60),op=pe+24,base=out.readUInt32LE(op+28),so=op+out.readUInt16LE(pe+20);if(base!==0x400000||out.readUInt16LE(op)!==0x10b)throw Error('Unexpected PE');
 function off(va){for(let i=0;i<out.readUInt16LE(pe+6);i++){const p=so+i*40,r=out.readUInt32LE(p+12),size=out.readUInt32LE(p+16);if(va-base>=r&&va-base+5<=r+size)return out.readUInt32LE(p+20)+va-base-r;}throw Error('Unmapped VA');}
 for(const [va,hex]of [[0xbebb4c,'558bec83c4e0'],[0xbebbdf,'e884ada6ff']]){const p=off(va);if(!out.subarray(p,p+hex.length/2).equals(Buffer.from(hex,'hex')))throw Error('Header route guard mismatch');}
 const at=off(0xbebbda);if(out[at]!==0xba||out.readUInt32LE(at+1)!==0xd0c7be)throw Error('Header pen immediate mismatch');out.writeUInt32LE(0x3d3d3d,at+1);allowed.push([at+1,at+5]);changes.push({kind:'immediate',name:'TDlg_SelAddr.pnlToTopCustomPaint separator pen',va:'0xBEBBDA',offset:at+1,before:0xd0c7be,after:0x3d3d3d});
 for(let p=0;p<out.length;p++)if(out[p]!==input[p]&&!allowed.some(([a,b])=>p>=a&&p<b))throw Error('Unexpected delta outside scope');return{buffer:out,changes};
}
module.exports={patchBuffer};
