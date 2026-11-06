/* Own-process x86 ABI fixture only. No Foxmail loading, processes or data. */
typedef unsigned long U32;
typedef unsigned char U8;
__declspec(dllimport) void *__stdcall VirtualAlloc(void *,U32,U32,U32);
__declspec(dllimport) int __stdcall VirtualFree(void *,U32,U32);
__declspec(dllimport) int __stdcall FlushInstructionCache(void *,const void *,U32);
__declspec(dllimport) void __stdcall ExitProcess(U32);
__declspec(dllimport) int __cdecl printf(const char *,...);
__declspec(dllimport) int __cdecl fflush(void *);
#include "account-instance-counter-stub.h"

static void *g_entry;
static U32 g_self,g_hostStack,g_seedFlags,g_targetRegs[8],g_returnRegs[8];
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
  mov eax,dword ptr [g_self]
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

static void put(U8 *p,U32 value) { U32 i;for(i=0;i<4;i++)p[i]=(U8)(value>>(8*i)); }
static int check(void) {
 U8 *images[2]; U32 allocation,k,scenario,pattern,wrap,i,j,cases=0;
 images[0]=0;images[1]=0;
 for(allocation=0;allocation<2;allocation++) {
  U8 *image=(U8 *)VirtualAlloc(0,FX_IMAGE_LIMIT,0x3000,0x40);
  if(!image)goto failed;images[allocation]=image;
  for(k=0;k<FX_HOOK_COUNT;k++) {
   const Hook *h=&hooks[k];U8 *target=image+h->target;
   for(i=0;i<h->length;i++)image[h->entry+i]=h->bytes[i];
   target[0]=0xe9;put(target+1,(U32)SyntheticTarget-((U32)target+5));
  }
  if(!FlushInstructionCache((void *)-1,image,FX_IMAGE_LIMIT))goto failed;
  for(k=0;k<FX_HOOK_COUNT;k++)for(scenario=0;scenario<8;scenario++)for(pattern=0;pattern<64;pattern++)for(wrap=0;wrap<2;wrap++) {
   const Hook *h=&hooks[k];U32 initial=wrap?0xffffffff:0;
   U8 *group=image+0x1000,*parent=image+0x2000,*gv=image+FX_GROUP_VMT_RVA,*pv=image+FX_PARENT_VMT_RVA;
   put(group,(U32)gv);put(group+0x30,(U32)parent);put(parent,(U32)pv);
   put(gv-76,(U32)gv);put(gv-40,536);put(pv-76,(U32)pv);put(pv-40,904);
   if(scenario==1)put(group,(U32)(image+0x3000));
   if(scenario==2)put(group+0x30,0);
   if(scenario==3)put(parent,(U32)(image+0x3000));
   if(scenario==4)put(gv-40,537);
   if(scenario==5)put(pv-40,905);
   if(scenario==6)put(pv-76,(U32)(pv+4));
   if(scenario==7)put(gv-76,(U32)(gv+4));
   for(j=0;j<FX_HOOK_COUNT;j++){put(image+hooks[j].all,initial);put(image+hooks[j].account,initial);}
   g_self=(U32)group;g_entry=image+h->entry;g_hits=0;g_returns=0;g_seedFlags=0x202;
   for(i=0;i<6;i++)if(pattern&(1UL<<i))g_seedFlags|=arithmeticBits[i];
   RunOne();cases++;
   for(j=0;j<FX_HOOK_COUNT;j++) {
    U32 a=*(U32 *)(image+hooks[j].all),m=*(U32 *)(image+hooks[j].account);
    if(a!=initial+(j==k)||m!=initial+(j==k&&scenario==0)){printf("FAIL counters hook=%lu scenario=%lu other=%lu\n",k,scenario,j);goto failed;}
   }
   if(g_hits!=1||g_returns!=1){printf("FAIL tail return\n");goto failed;}
   for(i=0;i<7;i++) {
    U32 expected=i?expectedRegs[i]:g_self;
    if(g_targetRegs[i]!=expected||g_returnRegs[i]!=expected){printf("FAIL reg %lu\n",i);goto failed;}
   }
   if(g_targetRegs[7]!=g_hostStack-4||g_returnRegs[7]!=g_hostStack){printf("FAIL ESP\n");goto failed;}
   if((g_targetFlags&0x8d5)!=(g_seedFlags&0x8d5)||(g_returnFlags&0x8d5)!=(g_seedFlags&0x8d5)){printf("FAIL flags\n");goto failed;}
  }
 }
 for(i=0;i<2;i++)if(images[i])VirtualFree(images[i],0,0x8000);
 printf("PASS %lu actual-stub cases: four hooks, two bases, eight account guards, 64 flag patterns, zero/wrap counts; original registers/ESP/flags and single tail return. candidate=%s\n",cases,FX_CANDIDATE_SHA);return 0;
failed:
 for(i=0;i<2;i++)if(images[i])VirtualFree(images[i],0,0x8000);return 1;
}
void __cdecl FxCounterFixtureEntry(void) {int result=check();fflush(0);ExitProcess((U32)result);}
