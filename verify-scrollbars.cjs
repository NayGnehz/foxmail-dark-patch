const fs=require('fs'),assert=require('assert');
const {chromium}=require('C:/Users/Public/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,ignoreDefaultArgs:['--hide-scrollbars']});
 try {
  const page=await browser.newPage({viewport:{width:640,height:420}});
  const stock=fs.readFileSync('D:/Users/Public/Downloads/Foxmail/7.2.25.563/Template/Common/FoxUI/FoxUI.css','utf8');
  const dark=fs.readFileSync(__dirname+'/dark-scrollbars.css','utf8');
  await page.setContent(`<html id="FoxmailClientHTML"><head><style>${stock}</style><style>${dark}</style><style>body{margin:0;background:#202020;color:#cdd5df}#scroller{width:550px;height:150px;overflow:scroll;margin:24px}#content{width:1100px;height:260px;background:#282828}#filler{height:900px;width:750px}</style></head><body id="FoxmailClientBody"><div id="scroller"><div id="content">Reading area scrollbar test</div></div><div id="filler"></div></body></html>`);
  const checks=await page.evaluate(()=>{
   const out=[];
   for(const el of [document.documentElement,document.querySelector('#scroller')])for(const part of ['track','track-piece','corner','thumb']){
    const s=getComputedStyle(el,'::-webkit-scrollbar-'+part);out.push({part,bg:s.backgroundColor,image:s.backgroundImage,shadow:s.boxShadow});
   }
   return out;
  });
  for(const s of checks){assert.strictEqual(s.bg,s.part==='thumb'?'rgb(102, 102, 102)':'rgb(32, 32, 32)');assert.strictEqual(s.image,'none');assert.strictEqual(s.shadow,'none');}
  await page.screenshot({path:__dirname+'/scrollbar-fixture.png'});
  await page.emulateMedia({media:'print'});
  assert.notStrictEqual(await page.evaluate(()=>getComputedStyle(document.documentElement,'::-webkit-scrollbar-thumb').backgroundColor),'rgb(102, 102, 102)');
  console.log('PASS: root and nested scrollbar track/track-piece/corner/thumb are dark; stock gradients removed; print excluded.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
