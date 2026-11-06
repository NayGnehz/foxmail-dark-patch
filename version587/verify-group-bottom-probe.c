/* Own-process x86 ABI fixture only. No Foxmail loading, processes or data. */
typedef unsigned long U32;
typedef unsigned char U8;
__declspec(dllimport) void *__stdcall VirtualAlloc(void *,U32,U32,U32);
__declspec(dllimport) int __stdcall VirtualFree(void *,U32,U32);
__declspec(dllimport) int __stdcall FlushInstructionCache(void *,const void *,U32);
__declspec(dllimport) void __stdcall ExitProcess(U32);
__declspec(dllimport) int __cdecl printf(const char *,...);
__declspec(dllimport) int __cdecl fflush(void *);
#include "group-bottom-probe-stub.h"

static void *g_entry;
static U32 g_png,g_dest,g_source,g_hdc,g_errorAfter,g_frame,g_stackBytes,g_hostStack,g_seedFlags,g_targetRegs[8],g_returnRegs[8];
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
  ret 4
 }
}

__declspec(naked) static void Rejoin(void) {
 __asm {
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
  mov eax,dword ptr fs:[0x34]
  mov dword ptr [g_errorAfter],eax
  inc dword ptr [g_returns]
  mov esp,dword ptr [g_hostStack]
  popfd
  popad
  ret
 }
}
__declspec(naked) static void RunOne(void) {
 __asm {
  pushad
  pushfd
  mov dword ptr [g_hostStack],esp
  push dword ptr [g_source]
  push dword ptr [g_seedFlags]
  popfd
  mov eax,dword ptr [g_png]
  mov ecx,dword ptr [g_dest]
  mov edx,dword ptr [g_hdc]
  mov ebx,0x13579bdf
  mov esi,0x2468ace0
  mov edi,0x10293847
  mov ebp,dword ptr [g_frame]
  mov dword ptr fs:[0x34],0x13572468
  jmp dword ptr [g_entry]
 }
}

static void put(U8 *p,U32 value) {U32 i;for(i=0;i<4;i++)p[i]=(U8)(value>>(8*i));}
static U32 g_clipCalls,g_visibleCalls,g_apiBad;
static U32 __stdcall FakeClip(U32 hdc,U32 *r) {
 g_clipCalls++;if(hdc!=g_hdc)g_apiBad++;
 r[0]=0;r[1]=0;r[2]=hdc?520:0;r[3]=hdc?526:0;
 __asm {mov dword ptr fs:[0x34],0xdeadbeef}
 return hdc?3:0;
}
static U32 __stdcall FakeVisible(U32 hdc,U32 *r) {
 g_visibleCalls++;if(hdc!=g_hdc||r[0]!=259||r[1]!=525||r[2]!=260||r[3]!=526)g_apiBad++;
 __asm {mov dword ptr fs:[0x34],0xaabbccdd}
 return hdc?1:0;
}
static int check(void) {
 U8 *images[2];U32 a,s,f,w,already,i,j,cases=0;
 const U32 dest[4]={2,524,518,526},source[4]={2,20,139,22};
 images[0]=0;images[1]=0;
 for(a=0;a<2;a++) {
  U8 *image=(U8 *)VirtualAlloc(0,FX_IMAGE_LIMIT,0x3000,0x40),*target;
  if(!image)goto failed;images[a]=image;
  for(i=0;i<sizeof(probe_stub);i++)image[FX_STUB_RVA+i]=probe_stub[i];
  for(i=0;i<5;i++)image[FX_SITE_RVA+i]=probe_site[i];
  image[FX_SITE_RVA+5]=0xe9;put(image+FX_SITE_RVA+6,(U32)Rejoin-((U32)image+FX_SITE_RVA+10));
  target=image+FX_TARGET_RVA;target[0]=0xe9;put(target+1,(U32)SyntheticTarget-((U32)target+5));
  put(image+FX_CLIP_IAT_RVA,(U32)FakeClip);put(image+FX_VISIBLE_IAT_RVA,(U32)FakeVisible);
  if(!FlushInstructionCache((void *)-1,image,FX_IMAGE_LIMIT))goto failed;
  for(s=0;s<11;s++)for(f=0;f<64;f++)for(w=0;w<2;w++)for(already=0;already<2;already++) {
   U8 *group=image+0x1000,*parent=image+0x2000,*gv=image+FX_GROUP_VMT_RVA,*pv=image+FX_PARENT_VMT_RVA;
   U32 *r=(U32 *)(image+FX_RECORD_RVA),initial=w?0xffffffff:0,matched=s==0||s>=8,fresh=matched&&!already&&s<9;
   put(group,(U32)gv);put(group+48,(U32)parent);put(parent,(U32)pv);
   put(gv-76,(U32)gv);put(gv-40,536);put(pv-76,(U32)pv);put(pv-40,904);
   g_png=(U32)(image+0x6000);put(image+FX_PNG_GLOBAL_RVA,g_png);if(s==1)put(image+FX_PNG_GLOBAL_RVA,g_png+4);
   if(s==2)put(group,(U32)(image+0x3000));if(s==3)put(group+48,0);
   if(s==4)put(parent,(U32)(image+0x3000));if(s==5)put(gv-40,537);
   if(s==6)put(pv-40,905);if(s==7)put(gv-76,(U32)(gv+4));
   g_frame=(U32)(image+0x4000);put(image+0x3ff8,(U32)group);
   g_dest=(U32)(image+0x7000);g_source=(U32)(image+0x7100);g_hdc=s==8?0:0xabcdef01;
   for(i=0;i<4;i++){put(image+0x7000+i*4,dest[i]);put(image+0x7100+i*4,source[i]);}
   if(s==9)put(image+0x7008,2);if(s==10)put(image+0x700c,524);
   put(image+0xee6b64,2);put(image+0xee6b68,2);
   for(i=0;i<24;i++)r[i]=0;r[0]=already?2:0;r[1]=initial;r[2]=initial;
   g_entry=image+FX_SITE_RVA;g_hits=0;g_returns=0;g_clipCalls=0;g_visibleCalls=0;g_apiBad=0;g_seedFlags=0x202;
   for(i=0;i<6;i++)if(f&(1UL<<i))g_seedFlags|=arithmeticBits[i];
   RunOne();cases++;
   if(r[1]!=initial+1||r[2]!=initial+matched||r[0]!=(already||s==0?2:0)||g_clipCalls!=fresh||g_visibleCalls!=fresh||g_apiBad){printf("FAIL counts/state/API scenario=%lu already=%lu\n",s,already);goto failed;}
   if(fresh) {
    if(r[3]!=(g_hdc!=0)||r[4]!=(g_hdc?3:0)||r[17]!=2||r[18]!=2||r[23]!=(g_hdc!=0)){printf("FAIL numeric fields\n");goto failed;}
    for(i=0;i<4;i++)if(r[5+i]!=dest[i]||r[9+i]!=source[i]){printf("FAIL rectangles\n");goto failed;}
    if(r[13]!=0||r[14]!=0||r[15]!=(g_hdc?520:0)||r[16]!=(g_hdc?526:0)){printf("FAIL clip\n");goto failed;}
   } else for(i=3;i<24;i++)if(r[i]!=0){printf("FAIL bounded record\n");goto failed;}
   if(g_hits!=1||g_returns!=1||g_errorAfter!=0x13572468){printf("FAIL tail/LastError\n");goto failed;}
   for(i=0;i<7;i++) {
    U32 expected=i==0?g_png:i==1?g_dest:i==2?g_hdc:i==6?g_frame:expectedRegs[i];
    if(g_targetRegs[i]!=expected||g_returnRegs[i]!=expected){printf("FAIL register %lu\n",i);goto failed;}
   }
   if(g_targetRegs[7]!=g_hostStack-8||g_returnRegs[7]!=g_hostStack){printf("FAIL ESP\n");goto failed;}
   if((g_targetFlags&0x8d5)!=(g_seedFlags&0x8d5)||(g_returnFlags&0x8d5)!=(g_seedFlags&0x8d5)){printf("FAIL flags\n");goto failed;}
  }
 }
 for(i=0;i<2;i++)if(images[i])VirtualFree(images[i],0,0x8000);
 printf("PASS %lu actual-site/stub cases: account/Png guards, one finite record, two image bases, RectVisible/GetClipBox, valid/null HDC, API LastError clobber, all GPR/flags/ESP and original RET4 drawing. candidate=%s\n",cases,FX_CANDIDATE_SHA);return 0;
failed:
 for(i=0;i<2;i++)if(images[i])VirtualFree(images[i],0,0x8000);return 1;
}
void __cdecl FxCounterFixtureEntry(void) {int result=check();fflush(0);ExitProcess((U32)result);}
