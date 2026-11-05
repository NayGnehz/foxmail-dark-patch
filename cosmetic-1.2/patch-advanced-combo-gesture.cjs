'use strict';
const {readResources}=require('../pe-resource-utils.cjs');
const {pngDecode,pngEncode}=require('../recolor-search-scrollbars.cjs');
const combo=/^CONTROLS_COMBOBOX_SELECT_(NORMAL|HOVER|PRESS|DISABLE)_PNG$/;
function patchBuffer(input, original){
 if(!original)throw Error("Provide pristine original buffer for allocation guards");
 const originalResources=readResources(original).resources;
 const out=Buffer.from(input),resources=readResources(out).resources.filter(r=>r.type===10&&combo.test(r.name)),changes=[];
 if(resources.length!==4)throw Error('Expected four combo resources');
 for(const r of resources){const allocation=originalResources.find(x=>x.type===r.type&&x.name===r.name&&x.lang===r.lang);if(!allocation||allocation.offset!==r.offset||allocation.dataEntry!==r.dataEntry)throw Error('Original resource layout mismatch');r.allocationSize=allocation.size;const im=pngDecode(out.subarray(r.offset,r.offset+r.size)),old=Buffer.from(im.rgba);let pixelsChanged=0,alphaChanged=0;
  if(im.width!==12||im.height!==24)throw Error('Unexpected combo dimensions');
  // Final row only: intentionally replace translucent/transparent shadow with opaque panel background.
  for(let x=0;x<im.width;x++){const p=((im.height-1)*im.width+x)*4;if(old[p+3]>20)throw Error('Unexpected combo shadow alpha');im.rgba[p]=im.rgba[p+1]=im.rgba[p+2]=32;im.rgba[p+3]=255;pixelsChanged++;alphaChanged++;}
  if(!old.subarray(0,old.length-im.width*4).equals(im.rgba.subarray(0,old.length-im.width*4)))throw Error('Pixel outside final row changed');
  const encoded=pngEncode(im);if(encoded.length>r.allocationSize)throw Error('Resource allocation exceeded '+r.name);if(!pngDecode(encoded).rgba.equals(im.rgba))throw Error('PNG roundtrip failed');encoded.copy(out,r.offset);out.fill(0,r.offset+encoded.length,r.offset+r.allocationSize);out.writeUInt32LE(encoded.length,r.dataEntry+4);changes.push({name:r.name,width:im.width,height:im.height,pixelsChanged,alphaChanged,oldSize:r.size,allocation:r.allocationSize,newSize:encoded.length});
 }
 const ranges=resources.flatMap(r=>[[r.offset,r.offset+r.allocationSize],[r.dataEntry+4,r.dataEntry+8]]);for(let p=0;p<out.length;p++)if(out[p]!==input[p]&&!ranges.some(([a,b])=>p>=a&&p<b))throw Error('Delta outside selected resource allocations');return {buffer:out,changes};
}
module.exports={patchBuffer};
