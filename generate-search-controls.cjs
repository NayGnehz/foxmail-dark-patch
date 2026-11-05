const fs=require('fs'),{chromium}=require('C:/Users/Public/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),{pngDecode,pngEncode}=require('./recolor-search-scrollbars.cjs');
(async()=>{fs.mkdirSync('SearchControls',{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});try{const page=await browser.newPage();for(const scale of [1,2])for(const kind of ['left','advance']){
 const encoded=await page.evaluate(({scale,kind})=>{const c=document.createElement('canvas'),cols=kind==='left'?2:6,rows=kind==='left'?1:2,w=kind==='left'?24:31,h=29;c.width=w*cols*scale;c.height=h*rows*scale;const g=c.getContext('2d');g.scale(scale,scale);
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){g.save();g.translate(col*w,row*h);g.fillStyle=col%3===1?'#333333':'#202020';g.beginPath();g.roundRect(0,0,w,h,4);g.fill();g.strokeStyle='#d6d6d6';g.lineWidth=1.7;g.lineCap='round';g.lineJoin='round';
 if(kind==='left'){g.beginPath();g.arc(10.2,12.7,5.7,0,Math.PI*2);g.stroke();g.beginPath();g.moveTo(14.6,17.1);g.lineTo(19,21.5);g.stroke();}
 else{const up=col>=3;g.beginPath();g.moveTo(10,up?16:12);g.lineTo(15.5,up?10.5:17.5);g.lineTo(21,up?16:12);g.stroke();}
 if(row){g.strokeStyle='#606060';g.lineWidth=1;g.beginPath();g.roundRect(.5,.5,w-1,h-1,3.5);g.stroke();}g.restore();}
 return c.toDataURL('image/png').split(',')[1];},{scale,kind});
 const name='MAIN_SEARCH_'+(kind==='left'?'SEARCH_LEFT_BTN':'ADVANCE_SEARCH_BTN')+(scale===2?'_2X':'')+'_PNG';const image=pngDecode(Buffer.from(encoded,'base64'));fs.writeFileSync('SearchControls/'+name+'.png',pngEncode(image));console.log(name,image.width,image.height);
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
