'use strict';
// Isolated Edge, actual static address-book UI/templates/field accessors.
// All contacts and callback invocations below are synthetic, with no live bridge.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),{spawnSync}=require('child_process'),{pathToFileURL}=require('url');
const paths=require('../foxmail-paths.cjs'),stage=paths.output('version587-address-html');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const templates='D:/Users/Public/Downloads/Foxmail/7.2.25.587/Template',base=path.join(templates,'AddrNoteInfo');
const read=p=>{const b=fs.readFileSync(p);return b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8').replace(/^\ufeff/,'');};
const src=p=>read(path.join(base,p)),nonce='synthetic-address';
const defaults={avatar_path:pathToFileURL(path.join(base,'Images/icon_contact.png')).href,note_id:'synthetic-id',name:'Synthetic group',display_name:'Synthetic Person',lastname:'Synthetic',firstname:'Person',email:'person@example.invalid',phone:'123456789',notions:'Synthetic memo',member_count:'1',item_type_num:'0',display_name_type:'0',sel_sex_num:'0',sex_male_num:'1',sex_female_num:'2',delete_hide:'',edit_hide:'',section_hide:'',default:'set_default_email',group_prefix:'',info:'Synthetic address book'};
function fill(text,values={}){return text.replace(/\{\{(\w+)\}\}/g,(_,key)=>key in values?values[key]:key in defaults?defaults[key]:/hide$/.test(key)?'':/num$/.test(key)?'0':key.replace(/^lng_/,'').replaceAll('_',' '));}
const make=(p,v)=>fill(src(p),v);
const personEdit=()=>make('Person/EditPanel.html',{
 person_basic_section:make('Person/EditBasicSection.html'),
 person_main_section:make('Person/EditMainSection.html',{email_list:make('Person/EditEmailItem.html'),phone_list:make('Person/EditPhoneItem.html'),notions:make('Person/EditNotions.html')}),
 person_profile_section:make('Person/EditProfileSection.html'),person_company_section:make('Person/EditCompanySection.html')
});
const personView=make('Person/ViewPanel.html',{
 person_basic_section:make('Person/BasicSection.html'),person_main_section:make('Person/MainSection.html',{email_list:make('Person/EmailItem.html'),phone_list:make('Person/PhoneItem.html'),notions:make('Person/Notions.html')}),
 person_profile_section:make('Person/ProfileSection.html'),person_company_section:make('Person/CompanySection.html'),person_group_section:make('Person/GroupSection.html',{group_list:make('Person/GroupItem.html')})
});
const cases=[{id:'empty',html:make('Logo.html')},{id:'person-view',html:personView},{id:'person-edit',html:personEdit()},{id:'person-new',html:personEdit()},
 {id:'group-view',html:make('Group/ViewPanel.html',{member_list:make('Group/MemberPersonItem.html')})},
 {id:'group-edit',html:make('Group/EditPanel.html',{member_list:make('Group/EditMemberPersonItem.html')})},
 {id:'group-new',html:make('Group/EditPanel.html',{member_list:''})},
 {id:'group-exmail',html:make('Group/EditExmailPanel.html',{member_list:make('Group/EditMemberPersonItem.html')})}];
let shell=read(path.join(stage,'Frame.html')).replaceAll('{{random_nonce}}',nonce).replaceAll('{{system_font}}','Arial');
shell=shell.replace(/(src|href)="(\{\{(?:common_path|template_path)\}\}[^\"]+)"/g,(_,attr,p)=>{
 const local=p.replace('{{common_path}}',path.join(templates,'Common')).replace('{{template_path}}',base);
 if(attr==='src')return 'src="data:text/javascript;base64,'+Buffer.from(read(local)).toString('base64')+'"';
 // File-URL stylesheets preserve image URL bases for the unmodified controls.
 return 'href="'+pathToFileURL(local).href+'"';
});
const script=s=>'<script nonce="'+nonce+'">'+s.replaceAll('</script','<\\/script')+'</script>';
const main=src('Javascript/Main.js'),callbacks=[...new Set(main.match(/J2D_\w+/g))];
shell=shell.replace(/(<script type=)/,script('window.__calls=[];window.__errors=[];window.addEventListener("error",e=>__errors.push(String(e.message)));'+callbacks.map(n=>'window.'+n+'=(...a)=>__calls.push(['+JSON.stringify(n)+',a]);').join(''))+'$1');
shell=shell.replace('{{ContentPanel}}','');
const test=`document.addEventListener('DOMContentLoaded',async()=>{let result;try{
 const check=(v,m)=>{if(!v)throw Error(m)},cases=${JSON.stringify(cases)},link=document.getElementById('foxmail-address-dark'),snapshots=[];
 const settle=()=>new Promise(r=>setTimeout(r,0));
 function data(){return {person:D2J_GetPersonData(),name:D2J_GetDisplayNameData(),group:D2J_GetGroupData()};}
 function boxes(){return Array.from(document.querySelectorAll('input,textarea,.foxButton,.selectBox')).map(e=>{const r=e.getBoundingClientRect();return [e.tagName,e.className,e.id,r.x,r.y,r.width,r.height,getComputedStyle(e).fontFamily,getComputedStyle(e).fontSize];});}
 function dark(e){const s=getComputedStyle(e),m=s.backgroundColor.match(/[\\d.]+/g);return !m||m.length===4&&+m[3]===0||m.slice(0,3).every(v=>+v<100);}
 for(const c of cases){
  D2J_UpdatePanel(c.html);await settle();link.disabled=true;await settle();
  const before=data(),geometry=JSON.stringify(boxes()),dom=document.body.innerHTML;
  link.disabled=false;await settle();
  check(JSON.stringify(before)===JSON.stringify(data()),c.id+' field export changed');check(dom===document.body.innerHTML,c.id+' DOM changed');
  check(geometry===JSON.stringify(boxes()),c.id+' control geometry/font changed');
  for(const e of document.querySelectorAll('body,.contactViewPanel,.contactEditPanel,.contactViewArea,.contactEditArea,.groupViewPanel,.groupEditPanel,.groupViewArea,.groupEditArea,.btnBar .inner,input,textarea,.foxButton.gray,.selectBox,.selectItems'))check(dark(e),c.id+' bright surface '+e.className);
  for(const selector of ['.contactViewArea','.contactEditArea','.groupViewArea','.groupEditArea','.contactView_basicSection','.groupEdit_basicSection','.memberSection_title_edit','.btnBar .inner'])for(const e of document.querySelectorAll(selector))check(getComputedStyle(e).borderTopColor==='rgb(61, 61, 61)'||getComputedStyle(e).borderBottomColor==='rgb(61, 61, 61)',c.id+' bright border');
  __calls.length=0;const button=document.querySelector('.cancelPersonButon,.cancelGroupButton,.contactEditBtn,.groupEditBtn');
  if(button){button.click();check(__calls.some(x=>/J2D_(CancelPerson|CancelGroup|EditPerson|EditGroup)/.test(x[0])),c.id+' callback route failed');}
  snapshots.push({id:c.id,fieldsIdentical:true,domIdentical:true,controlGeometryIdentical:true});
 }
 D2J_UpdatePanel(cases.find(c=>c.id==='person-edit').html);await settle();const input=document.querySelector('#last_name');input.focus();check(getComputedStyle(input).backgroundColor==='rgb(37, 37, 37)','Focused input bright');check(getComputedStyle(input).borderTopColor==='rgb(115, 159, 194)','Focus indicator missing');input.value='Typed synthetic';check(D2J_GetPersonData().lastName==='Typed synthetic','Typing/export failed');
 const normal=getComputedStyle(document.body).backgroundColor;link.media='not all';check(getComputedStyle(document.body).backgroundColor!==normal,'Non-screen style not isolated');link.media='screen';
 check(!__errors.length,'Application JS errors: '+__errors.join(';'));
 result={passed:true,cases:snapshots,fieldsAndCallbacksUnchanged:true,geometryAndFontsUnchanged:true,focusedTypingChecked:true,screenOnly:true,syntheticOnly:true,noLiveDataOrBridge:true};
 }catch(e){result={passed:false,error:String(e),errors:__errors}}const p=document.createElement('pre');p.id='result';p.style.display='none';p.textContent=btoa(JSON.stringify(result));document.body.appendChild(p);});`;
shell=shell.replace('</body>',script(test)+'</body>');
const file=path.join(stage,'synthetic-address-check.html');fs.writeFileSync(file,shell);
const browser='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';assert(fs.existsSync(browser));
const run=spawnSync(browser,['--headless=new','--disable-background-networking','--disable-sync','--no-first-run','--disable-extensions','--allow-file-access-from-files','--user-data-dir='+path.join(stage,'browser-profile'),'--dump-dom','--screenshot='+path.join(stage,'synthetic-contact-preview.png'),'--window-size=800,900','--virtual-time-budget=3000',pathToFileURL(file).href],{encoding:'utf8',maxBuffer:4*1024*1024,timeout:30000,windowsHide:true});
if(run.error)throw run.error;assert.equal(run.status,0);const match=run.stdout.match(/<pre id="result"[^>]*>([A-Za-z0-9+/=]+)<\/pre>/);assert(match,'Result missing');
const report=JSON.parse(Buffer.from(match[1],'base64').toString('utf8'));report.candidateSHA256=sha(fs.readFileSync(path.join(stage,'Frame.html')));report.verifierSHA256=sha(fs.readFileSync(__filename));
fs.writeFileSync(path.join(stage,'html-tests.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert(report.passed,report.error);
