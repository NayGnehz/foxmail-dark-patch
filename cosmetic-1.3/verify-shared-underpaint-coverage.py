# FOXMAIL_RETIRED_BASELINE_CLI: old experiment source retained; baseline EXE retired by explicit approval.
if __name__ == '__main__':
    raise SystemExit('Retired historical baseline CLI. See docs/cleanup-report-20261105.md and existing audit reports; use the current print/compose entry.')
import importlib.util,struct,json,hashlib
spec=importlib.util.spec_from_file_location('n','native-whitebars.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n);n.b=open('cosmetic-1.2/payload/Foxmail深色.exe','rb').read()
before=n.b[n.off(0x87b3e7):n.off(0x87b3e7)+9];after=open('cosmetic-1.3/shared-edit-underpaint-fixture.bin','rb').read();ins=list(n.md.disasm(after,0x87b3e7));assert len(after)==9 and len(ins)==2 and ins[0].mnemonic=='mov' and ins[0].op_str=='dword ptr [ebp - 0x1c], 0x202020' and ins[1].mnemonic=='jmp' and ins[1].op_str=='0x87b413'
fn=list(n.md.disasm(n.b[n.off(0x87b3bc):n.off(0x87b591)],0x87b3bc));reads=[hex(i.address) for i in fn if i.mnemonic=='mov' and i.op_str in ['edx, dword ptr [ebp - 0x1c]']];assert reads==['0x87b45f','0x87b53a']
parent=list(n.md.disasm(n.b[n.off(0x87b274):n.off(0x87b3bc)],0x87b274));parentcalls=sorted(set(int(i.op_str,16) for i in parent if i.mnemonic=='call'));assert parentcalls==[0x40434c]
# Parent resolution mutates only its EBP-relative locals and normal stack; no object/DC writes.
for i in parent:
 if i.mnemonic=='mov' and i.operands[0].type==3:assert i.reg_name(i.operands[0].mem.base)=='ebp'
allcalls=[];tails=[]
for name,r,raw,size in n.sections:
 for opcode,dest in [(0xe8,allcalls),(0xe9,tails)]:
  pos=raw
  while True:
   pos=n.b.find(bytes([opcode]),pos,raw+size-4)
   if pos<0:break
   if n.va(pos)+5+struct.unpack_from('<i',n.b,pos+1)[0]==0x87b3bc:dest.append(hex(n.va(pos)))
   pos+=1
assert len(allcalls)==9 and not tails and not n.refs(0x87b3bc)
# Derive edit descendants through numeric executable metadata only.
index=json.load(open('cosmetic-1.3/class-method-index.json'));targets={'TFMEdit','TFMZRichEdit','TFMComboBox','TTimeEditBase'};families={}
for v,name in index['classes']:
 chain=[];seen=set()
 try:
  while v and v not in seen:
   seen.add(v);cn=n.classname(v);chain.append(cn)
   if cn in targets:families[name]=cn;break
   p=n.read(v-36);v=n.read(p) if p else 0
 except:pass
inventory=json.load(open('cosmetic-1.3/ui-inventory.json',encoding='utf-8-sig'));controls=[];counts={}
for form in inventory['forms']:
 for c in form['controls']:
  if c['className'] in families:
   counts[c['className']]=counts.get(c['className'],0)+1;controls.append({'resource':form['resource'],'path':c['path'],'className':c['className'],'family':families[c['className']]})
report={'baselineSHA256':hashlib.sha256(n.b).hexdigest(),'scope':'All shared custom UI outline underpaint callers; no content/font/print change','fixture':{'path':'cosmetic-1.3/shared-edit-underpaint-fixture.bin','length':9,'beforeHex':before.hex(),'afterHex':after.hex(),'decoded':[{'va':hex(i.address),'mnemonic':i.mnemonic,'operands':i.op_str} for i in ins]},'controlFlow':{'join':'0x87B413','stackDelta':0,'colorLocal':'[EBP-0x1C]','readSites':reads,'readUses':['Pen.Color before border polygon','Brush.Color in alternate non-pen outline fill'],'flags':'Join code uses only LEA/MOVSD before CMP at0x87B41D resets flags; branch0x87B421 therefore does not depend on priorCMP.','eax':'Both branches afterjoin overwrite EAX with canvas before use; skippedcolor-resolution EAX value is dead.','skippedParentResolver':'0x87B274 reads parent class/Color only; calls0x40434C RTTI InheritsFrom only; writes no object/DC state.','restore':'All later Pen.Width, Pen.Color, Brush.Style restore instructions unchanged.'},'callGraph':{'directCalls':allcalls,'tailCalls':tails,'absoluteAddressTakenReferences':[]},'familyClasses':families,'DFMResourceCount':len(inventory['forms']),'coveredControlCounts':counts,'coveredControls':controls,'coverageNotes':['Class-level paint path covers inherited and dynamically-created controls as well as listed DFM instances.','Existing DFM and runtime transparentColor values no longer leak pale colors into this UI underpaint; all remain unmodified.','State PNG selection, focused/disabled/error flags, component events, fonts and content remain untouched.','Separate message body HTML/editor canvas, native TUnicodeEdit, plus buttons, address-picker tree outlines and non-family controls are outside this patch and assigned separately.','UI stationery designer panel outline is included; no stationery HTML/content or print/export method is called by this helper.']}
open('cosmetic-1.3/audit-shared-edit-underpaint-coverage.json','w',encoding='utf-8').write(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({'coveredControlCounts':counts,'familyClasses':families,'directCalls':allcalls,'fixtureLength':len(after)}))
