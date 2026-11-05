'use strict';
const fs=require('fs');
const {readResources}=require('./pe-resource-utils.cjs');
function parseDFM(b){
 let p=4;
 if(b.toString('ascii',0,4)!=='TPF0')throw Error('Not binary DFM');
 function short(){const n=b[p++];if(p+n>b.length)throw Error('String bounds at '+(p-1));const s=b.toString('latin1',p,p+n);p+=n;return s;}
 function value(){const offset=p,t=b[p++];let v;
  if(t===0||t===13)v=null;
  else if(t===2){v=b.readInt8(p);p++;}
  else if(t===3){v=b.readInt16LE(p);p+=2;}
  else if(t===4){v=b.readInt32LE(p);p+=4;}
  else if(t===5){v='<extended>';p+=10;}
  else if(t===6||t===7)v=short();
  else if(t===8||t===9)v=t===9;
  else if(t===10){const n=b.readUInt32LE(p);p+=4;v={binaryLength:n};p+=n;}
  else if(t===11){v=[];while(b[p])v.push(short());p++;}
  else if(t===12||t===18||t===20){const n=b.readUInt32LE(p);p+=4;const len=t===18?n*2:n;v=b.toString(t===18?'utf16le':t===20?'utf8':'latin1',p,p+len);p+=len;}
  else if(t===1){v=[];while(b[p])v.push(value());p++;}
  else if(t===14){v=[];while(b[p]){let index;if(b[p]!==1)index=value();if(b[p++]!==1)throw Error('Collection list at '+p);v.push({index,properties:properties()});}p++;}
  else if(t===15){v=b.readFloatLE(p);p+=4;}
  else if(t===16||t===17||t===21){v=b.readDoubleLE(p);p+=8;}
  else if(t===19){v=b.readBigInt64LE(p).toString();p+=8;}
  else throw Error('Unknown value '+t+' at '+offset);
  if(p>b.length)throw Error('Value bounds at '+offset);
  return {offset,type:t,value:v,end:p};
 }
 function properties(){const props=[];while(b[p]){const name=short();props.push({name,...value()});}p++;return props;}
 function object(){const offset=p;let flags=0,childPosition;if(b[p]>=0xf0){flags=b[p++]&15;if(flags&2)childPosition=value();}const className=short(),name=short(),props=properties(),children=[];while(b[p])children.push(object());p++;return {offset,className,name,flags,childPosition,properties:props,children,end:p};}
 const root=object();if(p!==b.length)throw Error('Trailing bytes '+(b.length-p));return root;
}
module.exports={parseDFM};
if(require.main===module){const exe=fs.readFileSync(process.argv[2]||'D:/Users/Public/Downloads/Foxmail/Foxmail.exe'),names=process.argv.slice(3);for(const r of readResources(exe).resources.filter(r=>r.type===10&&(!names.length||names.includes(r.name))&&exe.toString('ascii',r.offset,r.offset+4)==='TPF0')){try{const root=parseDFM(exe.subarray(r.offset,r.offset+r.size));fs.writeFileSync('resource-inventory/'+r.name+'.dfm.json',JSON.stringify(root,null,2));console.log('parsed',r.name,r.size);}catch(e){console.log('FAILED',r.name,e.message);}}}
