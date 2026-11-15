/* Execute the actual patched erase entry, old prefill and new selector.
   All surfaces/objects are synthetic. No real windows or mail process access. */
typedef unsigned long U32;
typedef unsigned char U8;
typedef void *H;
#define API(ret,name,args) __declspec(dllimport) ret __stdcall name args
API(H,VirtualAlloc,(H,U32,U32,U32));
API(int,VirtualFree,(H,U32,U32));
API(int,FlushInstructionCache,(H,const void *,U32));
API(U32,GetLastError,(void));
API(void,SetLastError,(U32));
API(void,ExitProcess,(U32));
API(H,CreateCompatibleDC,(H));
API(H,CreateDIBSection,(H,const void *,U32,H *,H,U32));
API(H,CreateBitmap,(int,int,U32,U32,const void *));
API(H,SelectObject,(H,H));
API(int,DeleteObject,(H));
API(int,DeleteDC,(H));
API(int,GdiFlush,(void));
API(H,CreateSolidBrush,(U32));
API(H,GetCurrentObject,(H,U32));
API(int,GetObjectA,(H,int,void *));
API(U32,GetObjectType,(H));
API(int,GetDeviceCaps,(H,int));
API(int,GetMapMode,(H));
API(int,GetROP2,(H));
API(int,GetGraphicsMode,(H));
API(U32,GetLayout,(H));
API(int,GetBkMode,(H));
API(U32,GetTextColor,(H));
API(U32,GetBkColor,(H));
API(int,SetMapMode,(H,int));
API(int,SetROP2,(H,int));
API(int,SetGraphicsMode,(H,int));
API(U32,SetLayout,(H,U32));
API(int,SetBkMode,(H,int));
API(int,PatBlt,(H,int,int,int,int,U32));
API(U32,GetPixel,(H,int,int));
API(H,CreateRectRgn,(int,int,int,int));
API(int,CombineRgn,(H,H,H,int));
API(int,SelectClipRgn,(H,H));
typedef struct { int l,t,r,b; } RECT;
typedef struct { int x,y; } POINT;
API(int,GetClipBox,(H,RECT *));
API(int,GetCurrentPositionEx,(H,POINT *));
API(int,MoveToEx,(H,int,int,POINT *));
API(int,FillRect,(H,const RECT *,H));
__declspec(dllimport) int __cdecl printf(const char *,...);
__declspec(dllimport) int __cdecl fflush(void *);
#include "chooser-erase-fixture.h"

static U8 self[16],other[16],owner[0x560];
static U32 message[4],returned[8],savedStack,selfAddress,msgAddress,inputFlags;
static H entry;
static U32 fillHits,cases;
static int mode;
static void copy(U8 *to,const U8 *from,U32 length){U32 i;for(i=0;i<length;i++)to[i]=from[i];}
static void zero(void *ptr,U32 length){U32 i;for(i=0;i<length;i++)((U8 *)ptr)[i]=0;}
static void put(void *ptr,U32 value){*(U32 *)ptr=value;}
static int __stdcall CountFill(H dc,const RECT *rect,H brush){fillHits++;return FillRect(dc,rect,brush);}
static int __stdcall Caps(H dc,int index){return mode==9&&index==2?2:GetDeviceCaps(dc,index);}
static U32 __stdcall ObjectType(H dc){return mode==8?3:GetObjectType(dc);}
static int __stdcall Clip(H dc,RECT *rect){return mode==10?0:GetClipBox(dc,rect);}

__declspec(naked) static void Run(void){
 __asm {
  pushad
  pushfd
  mov dword ptr [savedStack],esp
  push dword ptr [inputFlags]
  popfd
  mov eax,dword ptr [selfAddress]
  mov edx,dword ptr [msgAddress]
  mov ecx,0x77889901
  mov ebx,0x12341234
  mov esi,0x56785678
  mov edi,0x9abc9abc
  mov ebp,0xdef0def0
  call dword ptr [entry]
  mov dword ptr [returned],eax
  mov dword ptr [returned+4],edx
  mov dword ptr [returned+8],ecx
  mov dword ptr [returned+12],ebx
  mov dword ptr [returned+16],esi
  mov dword ptr [returned+20],edi
  mov dword ptr [returned+24],ebp
  mov dword ptr [returned+28],esp
  mov esp,dword ptr [savedStack]
  popfd
  popad
  ret
 }
}

typedef struct { H object[4];U32 text,bg;int bk,map,rop,graphics;U32 layout;POINT position;RECT clip;int clipKind; } DC_STATE;
static void state(H dc,DC_STATE *s){
 const U32 kinds[]={1,2,6,7};U32 i;
 zero(s,sizeof(*s));for(i=0;i<4;i++)s->object[i]=GetCurrentObject(dc,kinds[i]);
 s->text=GetTextColor(dc);s->bg=GetBkColor(dc);s->bk=GetBkMode(dc);
 s->map=GetMapMode(dc);s->rop=GetROP2(dc);s->graphics=GetGraphicsMode(dc);s->layout=GetLayout(dc);
 GetCurrentPositionEx(dc,&s->position);s->clipKind=GetClipBox(dc,&s->clip);
}
static int equal(const void *a,const void *b,U32 count){U32 i;for(i=0;i<count;i++)if(((const U8 *)a)[i]!=((const U8 *)b)[i])return 0;return 1;}
typedef struct { H dc,bmp,previous;U32 *pixels; } SURFACE;
static int makeSurface(SURFACE *s,int clip){
 U32 info[10],i;H region,second;
 zero(s,sizeof(*s));s->dc=CreateCompatibleDC(0);if(!s->dc)return 0;
 if(mode==6)s->bmp=CreateBitmap(64,64,1,1,0);
 else{zero(info,sizeof(info));info[0]=40;info[1]=64;info[2]=(U32)-64;info[3]=1|(32u<<16);s->bmp=CreateDIBSection(s->dc,info,0,(H *)&s->pixels,0,0);}
 if(!s->bmp)return 0;s->previous=SelectObject(s->dc,s->bmp);
 if(mode==6)PatBlt(s->dc,0,0,64,64,0x00ff0062);
 else{GdiFlush();for(i=0;i<4096;i++)s->pixels[i]=0xffffff;}
 MoveToEx(s->dc,9,11,0);
 if(clip){region=CreateRectRgn(5,7,clip==3?5:20,23);if(clip==2){second=CreateRectRgn(28,31,45,48);CombineRgn(region,region,second,2);DeleteObject(second);}SelectClipRgn(s->dc,region);DeleteObject(region);}
 if(mode==1)SetROP2(s->dc,7);
 if(mode==2)SetMapMode(s->dc,8);
 if(mode==3)SetGraphicsMode(s->dc,2);
 if(mode==4)SetLayout(s->dc,1);
 if(mode==5)SetBkMode(s->dc,1);
 return 1;
}
static void dispose(SURFACE *s){SelectObject(s->dc,s->previous);DeleteObject(s->bmp);DeleteDC(s->dc);}
static int inside(int clip,int x,int y){return !clip||(clip!=3&&x>=5&&x<20&&y>=7&&y<23)||(clip==2&&x>=28&&x<45&&y>=31&&y<48);}
static int runCase(U8 *image,int variant,int clip,int flags,int before){
 SURFACE s;DC_STATE first,last;U32 i,error,expected,pixel;int eligible=variant<4||variant==8||variant==9;
 if(!makeSurface(&s,clip))return 0;
 zero(self,sizeof(self));zero(owner,sizeof(owner));zero(other,sizeof(other));
 put(owner,(U32)(image+FX_OWNER_RVA));put(self,(U32)(image+FX_STRING_RVA));put(self+4,(U32)owner);
 if(variant<4)put(owner+fx_fields[variant],(U32)self);
 if(variant==4)put(owner+fx_fields[0],(U32)other);
 if(variant==5)put(owner,(U32)(image+FX_OWNER_RVA+4));
 if(variant==6)put(self+4,0);
 if(variant==7)put(self,(U32)(image+FX_STRING_RVA+4));
 if(variant==8||variant==9)put(self,(U32)(image+FX_DRAW_RVA));
 /* An unreadable Owner must never be touched for old draw trees or other
    control types. The StringTree path requires a live component Owner. */
 if(variant==9||variant==10)put(self+4,1);
 if(variant==10)put(self,(U32)(image+FX_STRING_RVA+4));
 selfAddress=(U32)self;msgAddress=(U32)message;
 message[0]=mode==7?0x15:0x14;message[1]=mode==14?0:(U32)s.dc;message[2]=0x11223344;message[3]=0x55667788;
 if(before)eligible=0;
 if(mode==11)put(image+fx_dynamic[3],0);
 if(mode==12)put(image+FX_BRUSH_RVA,0);
 if(mode==13)put(image+FX_BRUSH_RVA,0xffffffff);
 fillHits=0;state(s.dc,&first);inputFlags=0x202;
 {const U32 bits[]={1,4,16,64,128,2048};for(i=0;i<6;i++)if(flags&(1u<<i))inputFlags|=bits[i];}
 entry=image+FX_HANDLER_RVA;SetLastError(0x2468ace0);Run();error=GetLastError();
 state(s.dc,&last);GdiFlush();
 expected=eligible&&(mode==0||mode==5||mode==8)&&clip!=3;
 /* The original Delphi handler pops its two locals into ECX, returning Self
    there. Preserve that actual behavior rather than the input ECX value. */
 if(error!=0x2468ace0||returned[0]!=(U32)message||returned[1]!=(U32)message||returned[2]!=(U32)self||
    returned[3]!=0x12341234||returned[4]!=0x56785678||returned[5]!=0x9abc9abc||returned[6]!=0xdef0def0||returned[7]!=savedStack||
    message[0]!=(mode==7?0x15u:0x14u)||message[1]!=(mode==14?0:(U32)s.dc)||message[2]!=0x11223344||message[3]!=1||
    !equal(&first,&last,sizeof(first))||fillHits!=expected){
  printf("FAIL state variant=%d mode=%d clip=%d flags=%d old=%d fill=%lu/%lu err=%lx regs=%lx,%lx,%lx stack=%lx/%lx\n",variant,mode,clip,flags,before,fillHits,expected,error,returned[0],returned[1],returned[2],returned[7],savedStack);dispose(&s);return 0;
 }
 if(mode==6){SelectClipRgn(s.dc,0);if(GetPixel(s.dc,10,10)!=0xffffff){dispose(&s);return 0;}}
 else for(i=0;i<4096;i++){pixel=expected&&inside(clip,i%64,i/64)?0x202020:0xffffff;if((s.pixels[i]&0xffffff)!=pixel){printf("FAIL pixels variant=%d mode=%d clip=%d index=%lu actual=%lx expected=%lx\n",variant,mode,clip,i,s.pixels[i],pixel);dispose(&s);return 0;}}
 dispose(&s);cases++;return 1;
}
static U32 verify(void){
 U8 *images[2];H brush;U32 i,instance;int variant,clip,flags;
 U32 apis[]={(U32)GetLastError,(U32)SetLastError,(U32)Caps,(U32)GetCurrentObject,(U32)GetObjectA,(U32)GetMapMode,(U32)Clip,(U32)CountFill};
 U32 dynamic[]={(U32)ObjectType,(U32)GetROP2,(U32)GetGraphicsMode,(U32)GetLayout};
 brush=CreateSolidBrush(0x202020);if(!brush)return 0;
 for(instance=0;instance<2;instance++){
  U8 *image=(U8 *)VirtualAlloc(0,FX_IMAGE_SIZE,0x3000,0x40);if(!image)return 0;images[instance]=image;
  copy(image+FX_HANDLER_RVA,fx_handler,sizeof(fx_handler));copy(image+FX_GUARD_RVA,fx_guard,sizeof(fx_guard));copy(image+FX_SELECTOR_RVA,fx_selector,sizeof(fx_selector));
  for(i=0;i<8;i++)put(image+fx_iats[i],apis[i]);
  mode=0;for(i=0;i<4;i++)put(image+fx_dynamic[i],dynamic[i]);put(image+FX_BRUSH_RVA,(U32)brush);
  copy(image+FX_GUARD_RVA,fx_before_guard,sizeof(fx_before_guard));FlushInstructionCache((H)-1,image,FX_IMAGE_SIZE);
  if(!runCase(image,0,0,0,1))return 0;
  copy(image+FX_GUARD_RVA,fx_guard,sizeof(fx_guard));FlushInstructionCache((H)-1,image,FX_IMAGE_SIZE);
  if(!runCase(image,0,0,0,0))return 0;
  for(mode=0;mode<15;mode++)for(variant=0;variant<11;variant++)for(clip=0;clip<4;clip++){
   put(image+fx_dynamic[3],dynamic[3]);put(image+FX_BRUSH_RVA,(U32)brush);
   if(!runCase(image,variant,clip,0,0))return 0;
  }
  mode=0;put(image+fx_dynamic[3],dynamic[3]);put(image+FX_BRUSH_RVA,(U32)brush);
  for(flags=0;flags<64;flags++)for(variant=0;variant<11;variant++)if(!runCase(image,variant,1,flags,0))return 0;
 }
 for(instance=0;instance<2;instance++)if(!VirtualFree(images[instance],0,0x8000))return 0;
 DeleteObject(brush);return cases;
}
void __cdecl FxChooserEraseFixtureEntry(void){
 U32 count=verify();printf("%s chooser first erase: %lu cases; candidate=%s\n",count==2732?"PASS":"FAIL",count,FX_CANDIDATE_SHA);fflush(0);ExitProcess(count==2732?0:1);
}
