/* Own allocated images only. Execute the actual emitted bridge, with synthetic
   Delphi handler and mocked Win32 routing. No Foxmail process or user data. */
typedef unsigned long U32;
typedef unsigned char U8;
typedef unsigned short U16;
__declspec(dllimport) void *__stdcall VirtualAlloc(void *,U32,U32,U32);
__declspec(dllimport) int __stdcall VirtualFree(void *,U32,U32);
__declspec(dllimport) int __stdcall VirtualProtect(void *,U32,U32,U32 *);
__declspec(dllimport) int __stdcall FlushInstructionCache(void *,const void *,U32);
__declspec(dllimport) void __stdcall ExitProcess(U32);
__declspec(dllimport) int __cdecl printf(const char *,...);
__declspec(dllimport) int __cdecl fflush(void *);
#include "compose-ready-bridge-stub.h"
#define SCENARIOS 34u
static U8 *g_self,*g_host;
static U32 g_in[8],g_out[8],g_inFlags,g_outFlags,g_seedFlags,g_outputFlags,g_stack;
static U32 g_inputSelf,g_scenario,g_error,g_seenError,g_calls[7],g_originalCalls,g_bad,g_depth,g_nested,g_hostHwnd,g_owner,g_msg,g_protected;
static void *g_entry;
static const U32 flagBits[6]={1,4,16,64,128,2048};
static const U32 inRegs[4]={0x13579bdf,0x2468ace0,0x10293847,0x56473829};
static const U32 outRegs[4]={0x11223344,0x55667788,0x10203040,0x50607080};
static U32 read32(U8 *p){return (U32)p[0]|(U32)p[1]<<8|(U32)p[2]<<16|(U32)p[3]<<24;}
static void write32(U8 *p,U32 v){U32 i;for(i=0;i<4;i++)p[i]=(U8)(v>>(8*i));}
static int sameString(const char *a,const char *b){U32 i;for(i=0;i<64;i++){if(a[i]!=b[i])return 0;if(!a[i])return 1;}return 0;}
__declspec(naked) static void Reenter(void){__asm {
 pushfd
 pushad
 mov eax,dword ptr [g_inputSelf]
 call dword ptr [g_entry]
 popad
 popfd
 ret
}}
static void __cdecl OriginalBody(void){
 U32 old;g_originalCalls++;
 if(g_depth==0){
  g_seenError=g_error;
  if(g_scenario==22){g_depth=1;Reenter();g_depth=0;g_nested++;}
  if(g_scenario==20){write32(g_self,0);write32(g_self+0x300,0);write32(g_host,0);write32(g_host+0x180,0);}
  if(g_scenario==21)write32(g_host+0x180,g_hostHwnd);
  if(g_scenario==19||g_scenario==28){
   if(!VirtualProtect(g_self,4096,1,&old)||!VirtualProtect(g_host,4096,1,&old))g_bad=90;
   g_protected=1;
  }
 }
 g_error=0x778899aa;
}
__declspec(naked) static void SyntheticOriginal(void){__asm {
 pushfd
 pop dword ptr [g_inFlags]
 mov dword ptr [g_in+0],eax
 mov dword ptr [g_in+4],ecx
 mov dword ptr [g_in+8],edx
 mov dword ptr [g_in+12],ebx
 mov dword ptr [g_in+16],esi
 mov dword ptr [g_in+20],edi
 mov dword ptr [g_in+24],ebp
 mov dword ptr [g_in+28],esp
 pushad
 call OriginalBody
 popad
 mov eax,0x12345678
 mov ecx,0x87654321
 mov edx,0xabcdef01
 mov ebx,0x11223344
 mov esi,0x55667788
 mov edi,0x10203040
 mov ebp,0x50607080
 push dword ptr [g_outputFlags]
 popfd
 ret
}}
static U32 __stdcall MockGetLastError(void){g_calls[0]++;return g_error;}
static void __stdcall MockSetLastError(U32 v){g_calls[1]++;g_error=v;}
static U32 __stdcall MockAncestor(U32 hwnd,U32 flag){
 g_calls[2]++;g_error=0x901;if(hwnd!=g_hostHwnd||flag!=2)g_bad=1;
 if(g_scenario==6||(g_originalCalls&&g_scenario==19))return 0;
 if(g_scenario==7)return hwnd;
 if(g_originalCalls&&g_scenario==14)return 0;
 if(g_originalCalls&&g_scenario==15)return 0x40506071;
 return 0x40506070;
}
static U32 __stdcall MockModule(const char *name){g_calls[5]++;g_error=0x905;if(!sameString(name,"user32.dll"))g_bad=5;return g_scenario==32?0:0x44556677;}
static U32 __stdcall MockProc(U32 module,const char *name){g_calls[6]++;g_error=0x906;if(module!=0x44556677||!sameString(name,"GetAncestor"))g_bad=6;return g_scenario==33?0:(U32)MockAncestor;}
static U32 __stdcall MockProp(U32 hwnd,const char *name){
 g_calls[3]++;g_error=0x902;if(hwnd!=0x40506070)g_bad=2;
 if(sameString(name,"FxRevealGate.Owner.43E5CD38.v2")){
  if(g_scenario==8||(g_originalCalls&&g_scenario==16))return 0;
  if(g_originalCalls&&g_scenario==17)return g_owner+1;
  return g_owner;
 }
 if(!sameString(name,"FxComposeReady.Message.43E5CD38.v1"))g_bad=3;
 return g_originalCalls&&g_scenario==30?g_msg+1:g_originalCalls&&g_scenario==31?0:g_msg;
}
static U32 __stdcall MockPost(U32 hwnd,U32 msg,U32 owner,U32 host){
 g_calls[4]++;g_error=0x903;
 if(hwnd!=0x40506070||msg!=g_msg||owner!=g_owner||host!=g_hostHwnd)g_bad=4;
 if(g_scenario==23&&g_depth==0){g_depth=1;Reenter();g_depth=0;g_nested++;g_error=0x904;}
 return g_scenario==18?0:1;
}
__declspec(naked) static void RunOne(void){__asm {
 pushad
 pushfd
 mov dword ptr [g_stack],esp
 mov eax,dword ptr [g_inputSelf]
 mov ecx,0xdeadbeef
 mov edx,0x89abcdef
 mov ebx,0x13579bdf
 mov esi,0x2468ace0
 mov edi,0x10293847
 mov ebp,0x56473829
 push dword ptr [g_seedFlags]
 popfd
 call dword ptr [g_entry]
 mov dword ptr [g_out+0],eax
 mov dword ptr [g_out+4],ecx
 mov dword ptr [g_out+8],edx
 mov dword ptr [g_out+12],ebx
 mov dword ptr [g_out+16],esi
 mov dword ptr [g_out+20],edi
 mov dword ptr [g_out+24],ebp
 mov dword ptr [g_out+28],esp
 pushfd
 pop dword ptr [g_outFlags]
 mov esp,dword ptr [g_stack]
 popfd
 popad
 ret
}}
static void jumpTo(U8 *p,void *target){p[0]=0xe9;write32(p+1,(U32)target-(U32)p-5);}
static void setup(U8 *image,U32 scenario,U32 pattern){
 U32 i;
 for(i=0;i<976;i++)g_self[i]=0;for(i=0;i<548;i++)g_host[i]=0;
 for(i=0;i<7;i++)g_calls[i]=0;
 write32(g_self,(U32)image+FX_READY_EDITOR_VMT_RVA);write32(g_self+0x300,(U32)g_host);
 write32(g_host,(U32)image+FX_READY_HOST_VMT_RVA);g_hostHwnd=scenario==25?0xf0102030:0x10203040;write32(g_host+0x180,g_hostHwnd);
 g_owner=scenario==27?0xffffffff:0x12344321;g_msg=0xc123;
 g_inputSelf=(U32)g_self;
 switch(scenario){
 case 1:g_inputSelf=0;break;
 case 2:write32(g_self,(U32)image+FX_READY_EDITOR_VMT_RVA+4);break;
 case 3:write32(g_self+0x300,0);break;
 case 4:write32(g_host,(U32)image+FX_READY_HOST_VMT_RVA+4);break;
 case 5:case 21:write32(g_host+0x180,0);break;
 case 9:g_msg=0;break;case 10:g_msg=0xbfff;break;case 11:g_msg=0x10000;break;
 case 12:g_msg=0xc000;break;case 13:g_msg=0xffff;break;case 24:g_msg=0x400;break;case 26:g_msg=0xffff0001;break;
 case 29:write32(g_self,(U32)image+0x783ac4);break;
 }
 g_scenario=scenario;g_error=0x217a;g_seenError=0;g_originalCalls=g_bad=g_depth=g_nested=g_protected=0;
 g_seedFlags=0x202;for(i=0;i<6;i++)if(pattern&(1UL<<i))g_seedFlags|=flagBits[i];g_outputFlags=0x202|((~g_seedFlags)&0x8d5);
}
static int check(void){
 U8 *images[2];U32 allocation,scenario,pattern,i,count=0,old,limit=FX_READY_SECTION_RVA+sizeof(ready_bridge_stub)+4096;
 images[0]=0;images[1]=0;
 if(sizeof(void *)!=4||FX_READY_SITE_RVA!=0x7842fc||FX_READY_ORIGINAL_RVA!=0x78ad80||FX_READY_EDITOR_VMT_RVA!=0x794a54||FX_READY_HOST_VMT_RVA!=0x76716c||sizeof(ready_bridge_stub)>4096||limit>0x10000000){printf("FAIL header layout\n");return 1;}
 g_self=(U8 *)VirtualAlloc(0,4096,0x3000,4);g_host=(U8 *)VirtualAlloc(0,4096,0x3000,4);if(!g_self||!g_host){printf("FAIL objects\n");goto failed;}
 for(allocation=0;allocation<2;allocation++){
  U8 *image=(U8 *)VirtualAlloc(0,limit,0x3000,0x40);if(!image){printf("FAIL image allocation\n");goto failed;}images[allocation]=image;
  for(i=0;i<sizeof(ready_bridge_stub);i++)image[FX_READY_SECTION_RVA+i]=ready_bridge_stub[i];
  jumpTo(image+FX_READY_ORIGINAL_RVA,SyntheticOriginal);
  write32(image+FX_READY_GetLastError_IAT,(U32)MockGetLastError);write32(image+FX_READY_SetLastError_IAT,(U32)MockSetLastError);
  write32(image+FX_READY_GetModuleHandleA_IAT,(U32)MockModule);write32(image+FX_READY_GetProcAddress_IAT,(U32)MockProc);write32(image+FX_READY_GetPropA_IAT,(U32)MockProp);write32(image+FX_READY_PostMessageW_IAT,(U32)MockPost);
  g_entry=image+FX_READY_SECTION_RVA;if(!FlushInstructionCache((void *)-1,image,limit)){printf("FAIL flush\n");goto failed;}
  for(scenario=0;scenario<SCENARIOS;scenario++)for(pattern=0;pattern<64;pattern++){
   U32 capture,resolved,root,owner,context,post,loops,expectedAncestor,expectedProp,afterAncestor,afterOwner;
   setup(image,scenario,pattern);RunOne();
   if(g_protected){if(!VirtualProtect(g_self,4096,4,&old)||!VirtualProtect(g_host,4096,4,&old)){printf("FAIL unprotect\n");goto failed;}}
   capture=!(scenario>=1&&scenario<=5)&&scenario!=21&&scenario!=29;
   resolved=capture&&scenario!=32&&scenario!=33;root=resolved&&scenario!=6&&scenario!=7;owner=root&&scenario!=8;
   context=owner&&scenario!=9&&scenario!=10&&scenario!=11&&scenario!=24&&scenario!=26;
   afterAncestor=context&&scenario!=14&&scenario!=15&&scenario!=19;
   afterOwner=afterAncestor&&scenario!=16&&scenario!=17;
   post=afterOwner&&scenario!=30&&scenario!=31;
   loops=(scenario==22||scenario==23)?2:1;
   expectedAncestor=resolved+context;expectedProp=root+owner+afterAncestor+afterOwner;
   if(g_bad||g_originalCalls!=loops||g_calls[0]!=(1+context)*loops||g_calls[1]!=(1+context)*loops||g_calls[2]!=expectedAncestor*loops||g_calls[3]!=expectedProp*loops||g_calls[4]!=post*loops||g_calls[5]!=capture*loops||g_calls[6]!=(capture&&scenario!=32)*loops||g_nested!=loops-1){printf("FAIL calls scenario=%lu pattern=%lu bad=%lu original=%lu APIs=%lu/%lu/%lu/%lu/%lu/%lu/%lu\n",scenario,pattern,g_bad,g_originalCalls,g_calls[0],g_calls[1],g_calls[2],g_calls[3],g_calls[4],g_calls[5],g_calls[6]);goto failed;}
   if(g_out[7]!=g_stack||g_out[0]!=0x12345678||g_out[1]!=0x87654321||g_out[2]!=0xabcdef01||g_error!=0x778899aa){printf("FAIL outputs/ESP/LastError scenario=%lu err=%lx\n",scenario,g_error);goto failed;}
   for(i=0;i<4;i++)if(g_out[3+i]!=outRegs[i]){printf("FAIL output register scenario=%lu reg=%lu\n",scenario,i);goto failed;}
   if((g_outFlags&0x8d5)!=(g_outputFlags&0x8d5)){printf("FAIL output flags scenario=%lu\n",scenario);goto failed;}
   if(loops==1){
    if(g_in[0]!=g_inputSelf||g_in[1]!=0xdeadbeef||g_in[2]!=0x89abcdef||g_in[7]!=g_stack-28||g_seenError!=0x217a||(g_inFlags&0x8d5)!=(g_seedFlags&0x8d5)){printf("FAIL original inputs scenario=%lu ESP=%lx expected=%lx\n",scenario,g_in[7],g_stack-28);goto failed;}
    for(i=0;i<4;i++)if(g_in[3+i]!=inRegs[i]){printf("FAIL input register scenario=%lu reg=%lu\n",scenario,i);goto failed;}
   }
   count++;
  }
  printf("STAGE ready bridge image=%lu base=%p cumulativeCases=%lu\n",allocation,image,count);fflush(0);
 }
 for(i=0;i<2;i++)VirtualFree(images[i],0,0x8000);VirtualFree(g_self,0,0x8000);VirtualFree(g_host,0,0x8000);
 printf("PASS compose-ready bridge ABI: %lu cases; two image bases; 34 scenarios; 64 flag patterns; exact original once per entry; all original outputs/flags/LastError; callback HWND reuse with changed root/owner/message rejected; synchronous reentry; callback destroys objects with PAGE_NOACCESS; lazy API lookup failures. candidate=%s\n",count,FX_CANDIDATE_SHA);return 0;
failed:
 for(i=0;i<2;i++)if(images[i])VirtualFree(images[i],0,0x8000);if(g_self)VirtualFree(g_self,0,0x8000);if(g_host)VirtualFree(g_host,0,0x8000);return 1;
}
void __cdecl FxReadyBridgeFixtureEntry(void){int result;printf("STAGE ready bridge fixture candidate=%s\n",FX_CANDIDATE_SHA);fflush(0);result=check();fflush(0);ExitProcess((U32)result);}
