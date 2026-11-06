/* Execute the actual pre-size stub in two own-process images. All application
   functions, configuration fields and Win32 calls made by the stub are mocks. */
typedef unsigned long U32;
typedef unsigned char U8;
__declspec(dllimport) void *__stdcall VirtualAlloc(void *,U32,U32,U32);
__declspec(dllimport) int __stdcall VirtualFree(void *,U32,U32);
__declspec(dllimport) int __stdcall FlushInstructionCache(void *,const void *,U32);
__declspec(dllimport) void __stdcall ExitProcess(U32);
__declspec(dllimport) int __cdecl printf(const char *,...);
__declspec(dllimport) int __cdecl fflush(void *);
#include "compose-presize-stub.h"

#define SCENARIOS 52u
static U8 g_self[1768],g_cfg[40];
static U32 g_in[8],g_out[8],g_inFlags,g_outFlags,g_seedFlags,g_outputFlags,g_stack;
static U32 g_inputSelf,g_scenario,g_phase,g_error,g_seenError,g_calls[8],g_originalCalls,g_returns,g_bad;
static U32 g_scaledW,g_scaledH,g_scaleInputs[2],g_setArgs[5],g_nested;
static void *g_entry;
static volatile U32 *g_busy,*g_counter;
static const U32 flagBits[6]={1,4,16,64,128,2048};
static const U32 preserved[4]={0x13579bdf,0x2468ace0,0x10293847,0x56473829};
static U32 read32(U8 *p){return (U32)p[0]|(U32)p[1]<<8|(U32)p[2]<<16|(U32)p[3]<<24;}
static void write32(U8 *p,U32 v){U32 i;for(i=0;i<4;i++)p[i]=(U8)(v>>(8*i));}
static int sameString(const char *a,const char *b){U32 i;for(i=0;i<64;i++){if(a[i]!=b[i])return 0;if(!a[i])return 1;}return 0;}

__declspec(naked) static void SyntheticOriginal(void){
 __asm {
  mov dword ptr [g_in+0],eax
  mov dword ptr [g_in+4],ecx
  mov dword ptr [g_in+8],edx
  mov dword ptr [g_in+12],ebx
  mov dword ptr [g_in+16],esi
  mov dword ptr [g_in+20],edi
  mov dword ptr [g_in+24],ebp
  mov dword ptr [g_in+28],esp
  pushfd
  pop dword ptr [g_inFlags]
  mov eax,dword ptr [g_error]
  mov dword ptr [g_seenError],eax
  inc dword ptr [g_originalCalls]
  mov dword ptr [g_error],0x778899aa
  mov eax,0x12345678
  mov ecx,0x87654321
  mov edx,0xabcdef01
  push dword ptr [g_outputFlags]
  popfd
  ret
 }
}

__declspec(naked) static void Reenter(void){
 __asm {
  pushfd
  pushad
  lea eax,g_self
  mov ecx,0xdeadbeef
  mov edx,0x89abcdef
  push dword ptr [g_seedFlags]
  popfd
  call dword ptr [g_entry]
  popad
  popfd
  ret
 }
}

static U32 __stdcall MockGetLastError(void){g_calls[0]++;return g_error;}
static void __stdcall MockSetLastError(U32 value){g_calls[1]++;g_error=value;}
static U32 __stdcall MockGetPropA(U32 hwnd,const char *name){
 g_calls[2]++;g_error=0x901;
 if(hwnd!=0x10203040||!sameString(name,"FxRevealGate.Owner.43E5CD38.v2"))g_bad=1;
 return g_scenario==9?0:0x4321;
}
static U32 __stdcall MockGetModuleHandleA(const char *name){
 g_calls[3]++;g_error=0x902;if(!sameString(name,"dwmapi.dll"))g_bad=2;
 return g_scenario==10?0:0x44556677;
}
static long __stdcall MockDwm(U32 hwnd,U32 attribute,U32 *out,U32 size){
 g_calls[5]++;g_error=0x904;
 if(hwnd!=0x10203040||attribute!=14||size!=4||!out||*out!=0)g_bad=3;
 *out=g_scenario==13?0:g_scenario==14?2:g_scenario==43?3:1;
 return g_scenario==12?(long)0x80004005:g_scenario==34?1:0;
}
static U32 __stdcall MockGetProcAddress(U32 module,const char *name){
 g_calls[4]++;g_error=0x903;
 if(module!=0x44556677||!sameString(name,"DwmGetWindowAttribute"))g_bad=4;
 return g_scenario==11?0:(U32)MockDwm;
}
static U32 __cdecl ConfigBody(void){
 g_calls[6]++;g_error=0x905;if(*g_busy!=1)g_bad=5;
 if(g_scenario==48){Reenter();if(g_originalCalls!=1||g_seenError!=0x905||*g_busy!=1||g_nested)g_bad=11;g_error=0x905;}
 if(g_scenario==44)g_self[0x57]=1;
 if(g_scenario==45)g_self[0x22b]=1;
 if(g_scenario==46)write32(g_self+0x180,0x10203041);
 return g_scenario==15?0:(U32)g_cfg;
}
__declspec(naked) static void MockConfig(void){
 __asm {
  call ConfigBody
  ret
 }
}
static U32 __cdecl ScaleBody(U32 input){
 U32 n=g_calls[7]++;g_error=0x906;
 if(n>=2){g_bad=6;return 0;}
 g_scaleInputs[n]=input;
 if(*g_busy!=1||input!=read32(g_cfg+(n?0x20:0x1c)))g_bad=7;
 if(g_scenario==47&&n==0){Reenter();if(g_originalCalls!=1||g_seenError!=0x906||*g_busy!=1||g_nested)g_bad=10;g_error=0x906;}
 return n?g_scaledH:g_scaledW;
}
__declspec(naked) static void MockScale(void){
 __asm {
  push eax
  call ScaleBody
  add esp,4
  ret
 }
}
static void __cdecl SetBoundsBody(void){
 g_nested++;g_error=0x907;
 if(*g_busy!=1||g_setArgs[0]!=(U32)g_self||g_setArgs[1]!=123||g_setArgs[2]!=(U32)-37||g_setArgs[3]!=g_scaledW||g_setArgs[4]!=g_scaledH)g_bad=8;
 if(g_scenario==35){
  Reenter();
  if(g_originalCalls!=1||g_seenError!=0x907||*g_busy!=1||g_nested!=1)g_bad=9;
 }
 write32(g_self+0x48,g_setArgs[3]);write32(g_self+0x4c,g_setArgs[4]);
 if(g_scenario==49)g_self[0x57]=1;
 if(g_scenario==50)g_self[0x22b]=1;
 if(g_scenario==51)write32(g_self+0x180,0x10203041);
 g_error=0x908;
}
/* Delphi SetBounds: EAX=Self EDX=Left ECX=Top; caller pushes W then H;
   callee must remove both stack arguments. Deliberately update the object. */
__declspec(naked) static void MockSetBounds(void){
 __asm {
  mov dword ptr [g_setArgs+0],eax
  mov dword ptr [g_setArgs+4],edx
  mov dword ptr [g_setArgs+8],ecx
  mov eax,dword ptr [esp+8]
  mov dword ptr [g_setArgs+12],eax
  mov eax,dword ptr [esp+4]
  mov dword ptr [g_setArgs+16],eax
  call SetBoundsBody
  ret 8
 }
}
__declspec(naked) static void RunOne(void){
 __asm {
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
  inc dword ptr [g_returns]
  mov esp,dword ptr [g_stack]
  popfd
  popad
  ret
 }
}
static void jumpTo(U8 *p,void *target){p[0]=0xe9;write32(p+1,(U32)target-(U32)p-5);}
static void setup(U8 *image,U32 scenario,U32 pattern){
 U32 i;
 for(i=0;i<sizeof(g_self);i++)g_self[i]=0;
 for(i=0;i<sizeof(g_cfg);i++)g_cfg[i]=0;
 for(i=0;i<8;i++)g_calls[i]=0;
 for(i=0;i<5;i++)g_setArgs[i]=0;
 write32(g_self,(U32)image+FX_PRE_VMT_RVA);write32(g_self+0x180,0x10203040);
 write32(g_self+0x40,123);write32(g_self+0x44,(U32)-37);
 write32(g_self+0x48,700);write32(g_self+0x4c,300);g_self[0x98]=0xa1;
 g_cfg[0x10]=1;write32(g_cfg+0x1c,800);write32(g_cfg+0x20,600);
 g_scaledW=1000;g_scaledH=750;g_phase=8;g_inputSelf=(U32)g_self;
 *g_busy=0;*g_counter=scenario==36?0xffffffff:0;
 switch(scenario){
 case 1:g_inputSelf=0;g_phase=0;break;
 case 2:write32(g_self,(U32)image+FX_PRE_VMT_RVA+4);g_phase=0;break;
 case 3:g_self[0x57]=1;g_phase=0;break;
 case 4:g_self[0x22b]=1;g_phase=0;break;
 case 5:g_self[0x22b]=2;g_phase=0;break;
 case 6:g_self[0x58a]=1;g_phase=0;break;
 case 7:write32(g_self+0x180,0);g_phase=0;break;
 case 8:*g_busy=1;g_phase=0;break;
 case 9:g_phase=1;break;
 case 10:g_phase=2;break;
 case 11:g_phase=3;break;
 case 12:case 13:case 14:case 43:g_phase=4;break;
 case 15:g_phase=5;break;
 case 16:g_cfg[0x10]=0;g_phase=5;break;
 case 17:g_cfg[0x10]=2;g_phase=5;break;
 case 18:g_cfg[0x24]=1;g_phase=5;break;
 case 19:write32(g_cfg+0x1c,99);g_phase=5;break;
 case 20:write32(g_cfg+0x1c,12001);g_phase=5;break;
 case 21:write32(g_cfg+0x20,99);g_phase=5;break;
 case 22:write32(g_cfg+0x20,12001);g_phase=5;break;
 case 23:g_scaledW=199;g_phase=6;break;
 case 24:g_scaledW=16001;g_phase=6;break;
 case 25:g_scaledH=99;g_phase=7;break;
 case 26:g_scaledH=16001;g_phase=7;break;
 case 27:write32(g_self+0x48,g_scaledW);write32(g_self+0x4c,g_scaledH);g_phase=7;break;
 case 28:write32(g_self+0x48,g_scaledW);break;
 case 29:write32(g_self+0x4c,g_scaledH);break;
 case 30:write32(g_cfg+0x1c,100);write32(g_cfg+0x20,100);g_scaledW=200;g_scaledH=100;break;
 case 31:write32(g_cfg+0x1c,12000);write32(g_cfg+0x20,12000);g_scaledW=g_scaledH=16000;break;
 case 32:g_scaledW=200;g_scaledH=100;break;
 case 33:g_scaledW=g_scaledH=16000;break;
 case 34:case 35:case 36:break;
 case 37:g_self[0x58a]=2;break;
 case 38:g_self[0x57]=2;g_phase=0;break;
 case 39:g_cfg[0x24]=2;g_phase=5;break;
 case 40:write32(g_cfg+0x1c,0xffffffff);g_phase=5;break;
 case 41:g_scaledW=0xffffffff;g_phase=6;break;
 case 42:g_scaledH=0xffffffff;g_phase=7;break;
 case 44:case 45:case 46:g_phase=7;break;
 case 47:case 48:case 49:case 50:case 51:break;
 }
 g_scenario=scenario;g_error=0x217a;g_seenError=0;g_originalCalls=g_returns=g_bad=g_nested=0;
 g_seedFlags=0x202;for(i=0;i<6;i++)if(pattern&(1UL<<i))g_seedFlags|=flagBits[i];
 g_outputFlags=0x202|((~g_seedFlags)&0x8d5);
}
static int check(void){
 U8 *images[2];U32 allocation,scenario,pattern,i,count=0,limit=FX_PRE_SECTION_RVA+sizeof(presize_stub)+4096;
 images[0]=0;images[1]=0;
 if(sizeof(void *)!=4||FX_PRE_VMT_RVA!=0x90b0c4||FX_PRE_TRAMPOLINE_RVA!=22544975u||sizeof(presize_stub)>4096||limit>0x10000000){printf("FAIL header layout\n");return 1;}
 for(allocation=0;allocation<2;allocation++){
  U8 *image=(U8 *)VirtualAlloc(0,limit,0x3000,0x40);if(!image){printf("FAIL allocation\n");goto failed;}images[allocation]=image;
  for(i=0;i<sizeof(presize_stub);i++)image[FX_PRE_SECTION_RVA+i]=presize_stub[i];
  jumpTo(image+FX_PRE_TRAMPOLINE_RVA,SyntheticOriginal);jumpTo(image+FX_PRE_CFG_RVA,MockConfig);
  jumpTo(image+FX_PRE_SCALE_RVA,MockScale);jumpTo(image+FX_PRE_SETBOUNDS_RVA,MockSetBounds);
  write32(image+FX_PRE_VMT_RVA+0x84,(U32)image+FX_PRE_SETBOUNDS_RVA);
  write32(image+FX_PRE_GetLastError_IAT,(U32)MockGetLastError);write32(image+FX_PRE_SetLastError_IAT,(U32)MockSetLastError);
  write32(image+FX_PRE_GetPropA_IAT,(U32)MockGetPropA);write32(image+FX_PRE_GetModuleHandleA_IAT,(U32)MockGetModuleHandleA);write32(image+FX_PRE_GetProcAddress_IAT,(U32)MockGetProcAddress);
  g_entry=image+FX_PRE_SECTION_RVA;g_busy=(volatile U32 *)(image+FX_PRE_BUSY_RVA);g_counter=(volatile U32 *)(image+FX_PRE_COUNTER_RVA);
  if(!FlushInstructionCache((void *)-1,image,limit)){printf("FAIL flush\n");goto failed;}
  for(scenario=0;scenario<SCENARIOS;scenario++)for(pattern=0;pattern<64;pattern++){
   U32 beforeW,beforeH,cfgBefore[10],applied,initial;
   setup(image,scenario,pattern);beforeW=read32(g_self+0x48);beforeH=read32(g_self+0x4c);
   for(i=0;i<10;i++)cfgBefore[i]=read32(g_cfg+4*i);
   applied=g_phase==8;initial=scenario==36?0xffffffff:0;RunOne();
   if(g_bad||g_originalCalls!=((scenario==35||scenario==47||scenario==48)?2:1)||g_returns!=1||g_nested!=applied||*g_counter!=initial+applied||*g_busy!=(scenario==8?1:0)){printf("FAIL calls/busy/counter bad=%lu scenario=%lu flags=%lu original=%lu setbounds=%lu\n",g_bad,scenario,pattern,g_originalCalls,g_nested);goto failed;}
   if(g_calls[0]!=(g_phase>=1)||g_calls[1]!=(g_phase>=1)||g_calls[2]!=(g_phase>=1)||g_calls[3]!=(g_phase>=2)||g_calls[4]!=(g_phase>=3)||g_calls[5]!=(g_phase>=4)||g_calls[6]!=(g_phase>=5)||g_calls[7]!=(g_phase>=7?2:g_phase==6?1:0)){printf("FAIL API phase scenario=%lu phase=%lu calls=%lu/%lu/%lu/%lu/%lu/%lu/%lu/%lu\n",scenario,g_phase,g_calls[0],g_calls[1],g_calls[2],g_calls[3],g_calls[4],g_calls[5],g_calls[6],g_calls[7]);goto failed;}
   if(g_in[0]!=g_inputSelf||g_in[1]!=0xdeadbeef||g_in[2]!=0x89abcdef||g_in[7]!=g_stack-4||g_out[7]!=g_stack){printf("FAIL inputs/ESP scenario=%lu\n",scenario);goto failed;}
   if(g_out[0]!=0x12345678||g_out[1]!=0x87654321||g_out[2]!=0xabcdef01||g_seenError!=0x217a||g_error!=0x778899aa){printf("FAIL outputs/LastError scenario=%lu seen=%lu final=%lu\n",scenario,g_seenError,g_error);goto failed;}
   for(i=0;i<4;i++)if(g_in[3+i]!=preserved[i]||g_out[3+i]!=preserved[i]){printf("FAIL nonvolatile scenario=%lu register=%lu\n",scenario,i);goto failed;}
   if((g_inFlags&0x8d5)!=(g_seedFlags&0x8d5)||(g_outFlags&0x8d5)!=(g_outputFlags&0x8d5)){printf("FAIL flags scenario=%lu\n",scenario);goto failed;}
   if(read32(g_self+0x40)!=123||read32(g_self+0x44)!=(U32)-37||read32(g_self+0x48)!=(applied?g_scaledW:beforeW)||read32(g_self+0x4c)!=(applied?g_scaledH:beforeH)||g_self[0x98]!=(applied?0xad:0xa1)){printf("FAIL bounds/explicit bits scenario=%lu\n",scenario);goto failed;}
   for(i=0;i<10;i++)if(read32(g_cfg+4*i)!=cfgBefore[i]){printf("FAIL config write scenario=%lu\n",scenario);goto failed;}
   count++;
  }
  printf("STAGE pre-size image=%lu base=%p cumulativeCases=%lu\n",allocation,image,count);fflush(0);
 }
 for(i=0;i<2;i++)VirtualFree(images[i],0,0x8000);
 printf("PASS compose pre-size ABI: %lu cases; actual stub; two image bases; 52 guard/range/recheck/reentry scenarios; 64 arithmetic flag patterns; Delphi SetBounds ret8; original exactly once per entry; input/output registers and LastError preserved. candidate=%s\n",count,FX_CANDIDATE_SHA);return 0;
failed:
 for(i=0;i<2;i++)if(images[i])VirtualFree(images[i],0,0x8000);return 1;
}
void __cdecl FxPreSizeFixtureEntry(void){int result;printf("STAGE pre-size fixture candidate=%s\n",FX_CANDIDATE_SHA);fflush(0);result=check();fflush(0);ExitProcess((U32)result);}

