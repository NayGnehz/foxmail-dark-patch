/* Actual emitted site + stub, in two own-process synthetic images only. */
typedef unsigned long U32;
typedef unsigned char U8;
__declspec(dllimport) void *__stdcall VirtualAlloc(void *,U32,U32,U32);
__declspec(dllimport) int __stdcall VirtualFree(void *,U32,U32);
__declspec(dllimport) int __stdcall FlushInstructionCache(void *,const void *,U32);
__declspec(dllimport) void __stdcall ExitProcess(U32);
__declspec(dllimport) int __cdecl printf(const char *,...);
__declspec(dllimport) int __cdecl fflush(void *);
#include "compose-ncactivate-stub.h"

static U8 g_self[0x6e8];
static U32 g_message[4],g_inputRegs[8],g_returnRegs[8];
static U32 g_inputFlags,g_returnFlags,g_seedFlags,g_outputFlags,g_stack,g_hits,g_returns,g_seenLP,g_nested;
static void *g_entry;
static const U32 bits[6]={1,4,16,64,128,2048};
static const U32 nonvolatileSeeds[4]={0x13579bdf,0x2468ace0,0x10293847,0x56473829};

__declspec(naked) static void SyntheticDefault(void) {
 __asm {
  mov dword ptr [g_inputRegs+0],eax
  mov dword ptr [g_inputRegs+4],ecx
  mov dword ptr [g_inputRegs+8],edx
  mov dword ptr [g_inputRegs+12],ebx
  mov dword ptr [g_inputRegs+16],esi
  mov dword ptr [g_inputRegs+20],edi
  mov dword ptr [g_inputRegs+24],ebp
  mov dword ptr [g_inputRegs+28],esp
  pushfd
  pop dword ptr [g_inputFlags]
  /* Reenter the actual patched site once, on the same message whose LP is
     already -1. Each stub invocation must keep its own saved LP on its stack. */
  pushfd
  cmp dword ptr [g_nested],0
  je noNested
  mov dword ptr [g_nested],0
  pushad
  push dword ptr [g_seedFlags]
  popfd
  call dword ptr [g_entry]
  popad
 noNested:
  popfd
  mov eax,dword ptr [edx+8]
  mov dword ptr [g_seenLP],eax
  mov dword ptr [edx+12],0x6e634143
  inc dword ptr [g_hits]
  mov eax,0x12345678
  mov ecx,0x87654321
  mov edx,0xabcdef01
  push dword ptr [g_outputFlags]
  popfd
  ret
 }
}

__declspec(naked) static void RunOne(void) {
 __asm {
  pushad
  pushfd
  mov dword ptr [g_stack],esp
  push dword ptr [g_seedFlags]
  popfd
  lea eax,g_self
  lea edx,g_message
  mov ecx,0xdeadbeef
  mov ebx,0x13579bdf
  mov esi,0x2468ace0
  mov edi,0x10293847
  mov ebp,0x56473829
  call dword ptr [g_entry]
  mov dword ptr [g_returnRegs+0],eax
  mov dword ptr [g_returnRegs+4],ecx
  mov dword ptr [g_returnRegs+8],edx
  mov dword ptr [g_returnRegs+12],ebx
  mov dword ptr [g_returnRegs+16],esi
  mov dword ptr [g_returnRegs+20],edi
  mov dword ptr [g_returnRegs+24],ebp
  mov dword ptr [g_returnRegs+28],esp
  pushfd
  pop dword ptr [g_returnFlags]
  inc dword ptr [g_returns]
  mov esp,dword ptr [g_stack]
  popfd
  popad
  ret
 }
}

static int check(void) {
 U8 *images[2];
 U32 limit=FX_NCA_SECTION_RVA,count=0,allocation,scenario,pattern,i;
 images[0]=0;images[1]=0;
 if(sizeof(void *)!=4||sizeof(nca_site)!=5||nca_site[0]!=0xe8||FX_NCA_VMT_RVA!=0x90b0c4||FX_MAIN_VMT_RVA!=0xbdd0ac||FX_NCA_SITE_RVA!=0x6166e7||(FX_NCA_COUNTER_RVA&3)){printf("FAIL header layout\n");return 1;}
 if(FX_NCA_COUNTER_RVA>limit)limit=FX_NCA_COUNTER_RVA;
 if(FX_MAIN_VMT_RVA+0x100>limit)limit=FX_MAIN_VMT_RVA+0x100;
 if(FX_MAIN_COUNTER_RVA>limit)limit=FX_MAIN_COUNTER_RVA;
 if(FX_NCA_SITE_RVA+6>limit)limit=FX_NCA_SITE_RVA+6;
 if(limit>0x10000000||sizeof(nca_stub)>512){printf("FAIL image bounds\n");return 1;}
 for(allocation=0;allocation<2;allocation++) {
  U8 *image=(U8 *)VirtualAlloc(0,limit+4096,0x3000,0x40);
  volatile U32 *counter,*mainCounter;
  if(!image){printf("FAIL VirtualAlloc\n");goto failed;}
  images[allocation]=image;
  printf("STAGE image=%lu base=%p\n",allocation,image);fflush(0);
  for(i=0;i<sizeof(nca_stub);i++)image[FX_NCA_SECTION_RVA+i]=nca_stub[i];
  for(i=0;i<sizeof(main_stub);i++)image[FX_MAIN_SECTION_RVA+i]=main_stub[i];
  for(i=0;i<sizeof(nca_site);i++)image[FX_NCA_SITE_RVA+i]=nca_site[i];
  /* A real CALL site falls through to this RET, returning to RunOne. */
  image[FX_NCA_SITE_RVA+5]=0xc3;
  *(U32 *)(image+FX_NCA_VMT_RVA-16)=(U32)SyntheticDefault;
  *(U32 *)(image+FX_NCA_VMT_RVA+0x100-16)=(U32)SyntheticDefault;
  *(U32 *)(image+FX_MAIN_VMT_RVA-16)=(U32)SyntheticDefault;
  *(U32 *)(image+FX_MAIN_VMT_RVA+0x100-16)=(U32)SyntheticDefault;
  if(!FlushInstructionCache((void *)-1,image,limit+4096)){printf("FAIL instruction flush\n");goto failed;}
  counter=(volatile U32 *)(image+FX_NCA_COUNTER_RVA);
  mainCounter=(volatile U32 *)(image+FX_MAIN_COUNTER_RVA);
  g_entry=image+FX_NCA_SITE_RVA;
  /* normal, other class, other message, wParam=0, old LP=-1,
     minimized (numeric 1), maximized (numeric 2), nested matching call. */
  /* Repeat all eight branches for compose and main. Main increments prove
     the fallback executed the actual accepted main stub, not a mock. */
  for(scenario=0;scenario<16;scenario++)for(pattern=0;pattern<64;pattern++) {
   U32 branch=scenario%8,isMain=scenario/8;
   U32 matched=branch!=1&&branch!=2&&branch!=3&&branch!=5;
   U32 originalLP=branch==4?0xffffffff:0x76543210;
   U32 message=branch==2?0x85:0x86,wp=branch==3?0:1;
   U32 initial=branch==4?0xffffffff:0;
   U32 vmt=(U32)image+(isMain?FX_MAIN_VMT_RVA:FX_NCA_VMT_RVA)+(branch==1?0x100:0);
   for(i=0;i<sizeof(g_self);i++)g_self[i]=0;
   /* Byte writes keep the C language alignment contract explicit. */
   for(i=0;i<4;i++)g_self[i]=(U8)(vmt>>(i*8));
   g_self[0x22b]=(U8)(branch==5?1:branch==6?2:0);
   g_message[0]=message;g_message[1]=wp;g_message[2]=originalLP;g_message[3]=0x11223344;
   g_seedFlags=0x202;
   for(i=0;i<6;i++)if(pattern&(1UL<<i))g_seedFlags|=bits[i];
   g_outputFlags=0x202|((~g_seedFlags)&0x8d5);
   g_hits=0;g_returns=0;g_seenLP=0;g_nested=branch==7?1:0;*counter=initial;*mainCounter=initial;
   RunOne();
   if(g_hits!=(branch==7?2:1)||g_returns!=1||*counter!=initial+(isMain?0:matched+(branch==7?1:0))||*mainCounter!=initial+(isMain?matched+(branch==7?1:0):0)){printf("FAIL calls/counter scenario=%lu pattern=%lu\n",scenario,pattern);goto failed;}
   if(g_inputRegs[0]!=(U32)g_self||g_inputRegs[1]!=vmt||g_inputRegs[2]!=(U32)g_message){printf("FAIL default inputs scenario=%lu pattern=%lu\n",scenario,pattern);goto failed;}
   if(g_seenLP!=(matched?0xffffffff:originalLP)||g_message[0]!=message||g_message[1]!=wp||g_message[2]!=originalLP||g_message[3]!=0x6e634143){printf("FAIL message/restoration scenario=%lu pattern=%lu\n",scenario,pattern);goto failed;}
   if(g_returnRegs[0]!=0x12345678||g_returnRegs[1]!=0x87654321||g_returnRegs[2]!=0xabcdef01||g_returnRegs[7]!=g_stack){printf("FAIL default outputs/ESP scenario=%lu pattern=%lu\n",scenario,pattern);goto failed;}
   for(i=0;i<4;i++)if(g_inputRegs[3+i]!=nonvolatileSeeds[i]||g_returnRegs[3+i]!=nonvolatileSeeds[i]){printf("FAIL nonvolatile register=%lu scenario=%lu\n",i,scenario);goto failed;}
   if((g_inputFlags&0x8d5)!=(g_seedFlags&0x8d5)||(g_returnFlags&0x8d5)!=(g_outputFlags&0x8d5)){printf("FAIL arithmetic flags scenario=%lu pattern=%lu\n",scenario,pattern);goto failed;}
   count++;
  }
  printf("STAGE completed image=%lu cumulativeCases=%lu\n",allocation,count);fflush(0);
 }
 for(i=0;i<2;i++)if(images[i])VirtualFree(images[i],0,0x8000);
 printf("PASS compose NC activation ABI: %lu cases; actual site+stub; two image bases; sixteen compose/main scenarios including actual old-stub fallback and same-message nested calls; 64 input/output arithmetic flag patterns; default output registers/result and original message preserved. candidate=%s\n",count,FX_CANDIDATE_SHA);
 return 0;
failed:
 for(i=0;i<2;i++)if(images[i])VirtualFree(images[i],0,0x8000);
 return 1;
}
void __cdecl FxNcActivateFixtureEntry(void) {int result;printf("STAGE fixture entry candidate=%s\n",FX_CANDIDATE_SHA);fflush(0);result=check();fflush(0);ExitProcess((U32)result);}


