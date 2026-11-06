/* Own-process x86 ABI fixture only. No Foxmail loading, processes or data. */
typedef unsigned long U32;
typedef unsigned char U8;
__declspec(dllimport) void *__stdcall VirtualAlloc(void *,U32,U32,U32);
__declspec(dllimport) int __stdcall VirtualFree(void *,U32,U32);
__declspec(dllimport) int __stdcall FlushInstructionCache(void *,const void *,U32);
__declspec(dllimport) void __stdcall ExitProcess(U32);
__declspec(dllimport) int __cdecl printf(const char *,...);
__declspec(dllimport) int __cdecl fflush(void *);
#include "counter-stub.h"

static void *g_entry;
static U32 g_hostStack,g_seedFlags,g_targetRegs[8],g_returnRegs[8];
static U32 g_targetFlags,g_returnFlags,g_hits,g_returns;
static const U32 expectedRegs[7]={0x12345678,0x87654321,0xabcdef01,0x13579bdf,0x2468ace0,0x10293847,0x56473829};
static const U32 arithmeticBits[6]={1,4,16,64,128,2048};

/* Snapshot without modifying the synthetic callee's input registers or flags.
   The synthetic callee returns directly to RunOne's original CALL continuation. */
__declspec(naked) static void SyntheticTarget(void) {
 __asm {
  mov dword ptr [g_targetRegs+0],eax
  mov dword ptr [g_targetRegs+4],ecx
  mov dword ptr [g_targetRegs+8],edx
  mov dword ptr [g_targetRegs+12],ebx
  mov dword ptr [g_targetRegs+16],esi
  mov dword ptr [g_targetRegs+20],edi
  mov dword ptr [g_targetRegs+24],ebp
  mov dword ptr [g_targetRegs+28],esp
  pushfd
  pop dword ptr [g_targetFlags]
  pushfd
  inc dword ptr [g_hits]
  popfd
  ret
 }
}

__declspec(naked) static void RunOne(void) {
 __asm {
  pushad
  pushfd
  mov dword ptr [g_hostStack],esp
  push dword ptr [g_seedFlags]
  popfd
  mov eax,0x12345678
  mov ecx,0x87654321
  mov edx,0xabcdef01
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
  mov esp,dword ptr [g_hostStack]
  popfd
  popad
  ret
 }
}

static int check(void) {
 U32 count=0,total=0,allocation,pattern,overflow,i,limit;
 U8 *images[2];
 images[0]=0;images[1]=0;
 if(sizeof(void *)!=4||sizeof(counter_stub)!=27||FX_COUNTER_RVA!=FX_COUNTER_SECTION_RVA+32||(FX_COUNTER_RVA&3)||FX_COUNTER_TARGET_RVA!=0x47aebc){printf("FAIL header layout\n");return 1;}
 limit=FX_COUNTER_SECTION_RVA;
 if(FX_COUNTER_RVA>limit)limit=FX_COUNTER_RVA;
 if(FX_COUNTER_TARGET_RVA>limit)limit=FX_COUNTER_TARGET_RVA;
 if(limit>0x10000000){printf("FAIL image bounds\n");return 1;}
 /* Hold both allocations so the second image has a distinct relocation base. */
 for(allocation=0;allocation<2;allocation++) {
  U8 *image=(U8 *)VirtualAlloc(0,limit+4096,0x3000,0x40),*target;
  U32 displacement;
  volatile U32 *counter;
  if(!image){printf("FAIL VirtualAlloc\n");goto failed;}
  images[allocation]=image;
  printf("STAGE allocated image=%lu base=%p\n",allocation,image);fflush(0);
  for(i=0;i<sizeof(counter_stub);i++)image[FX_COUNTER_SECTION_RVA+i]=counter_stub[i];
  target=image+FX_COUNTER_TARGET_RVA;
  /* Flag-neutral JMP into our RET callee; no trampoline return address added. */
  target[0]=0xe9;
  displacement=(U32)SyntheticTarget-((U32)target+5);
  /* JMP's immediate is unaligned. Byte writes avoid undefined C alignment. */
  for(i=0;i<4;i++)target[1+i]=(U8)(displacement>>(i*8));
  if(!FlushInstructionCache((void *)-1,image,limit+4096)){printf("FAIL instruction flush\n");goto failed;}
  counter=(volatile U32 *)(image+FX_COUNTER_RVA);
  g_entry=image+FX_COUNTER_SECTION_RVA;
  printf("STAGE executing actual counter image=%lu\n",allocation);fflush(0);
  for(pattern=0;pattern<64;pattern++)for(overflow=0;overflow<2;overflow++) {
   U32 initial=overflow?0xffffffff:0;
   g_seedFlags=0x202;
   for(i=0;i<6;i++)if(pattern&(1UL<<i))g_seedFlags|=arithmeticBits[i];
   *counter=initial;g_hits=0;g_returns=0;
   RunOne();total++;
   if(*counter!=initial+1||g_hits!=1||g_returns!=1){printf("FAIL counter/tail-return pattern=%lu wrap=%lu\n",pattern,overflow);goto failed;}
   for(i=0;i<7;i++)if(g_targetRegs[i]!=expectedRegs[i]||g_returnRegs[i]!=expectedRegs[i]){printf("FAIL register=%lu pattern=%lu wrap=%lu\n",i,pattern,overflow);goto failed;}
   if(g_targetRegs[7]!=g_hostStack-4||g_returnRegs[7]!=g_hostStack){printf("FAIL ESP\n");goto failed;}
   if((g_targetFlags&0x8d5)!=(g_seedFlags&0x8d5)||(g_returnFlags&0x8d5)!=(g_seedFlags&0x8d5)){printf("FAIL arithmetic EFLAGS pattern=%lu wrap=%lu\n",pattern,overflow);goto failed;}
   count++;
  }
  printf("STAGE completed image=%lu cumulativeCases=%lu\n",allocation,count);fflush(0);
 }
 for(i=0;i<2;i++)if(images[i])VirtualFree(images[i],0,0x8000);
 printf("PASS actual stub ABI: %lu/%lu cases; two image bases; 64 arithmetic EFLAGS patterns; zero/wrap counters; seven registers plus ESP; one target and one return. candidate=%s\n",count,total,FX_CANDIDATE_SHA);
 return 0;
failed:
 for(i=0;i<2;i++)if(images[i])VirtualFree(images[i],0,0x8000);
 return 1;
}
void __cdecl FxCounterFixtureEntry(void) { int result;printf("STAGE fixture entry candidate=%s\n",FX_CANDIDATE_SHA);fflush(0);result=check();fflush(0);ExitProcess((U32)result); }
