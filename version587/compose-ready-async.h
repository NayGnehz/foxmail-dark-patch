/* Included after the unchanged synchronous recovery engine. No mail data is read.
 * LoadEnd is a shell-readiness hint, not a presentation acknowledgement.
 * Timeout is evaluated by the owning UI thread's ordinary message loop. */
#include "compose-ready-api.h"
typedef struct FX_READY_RECT { LONG left,top,right,bottom; } FX_READY_RECT;
typedef LONG (__stdcall *FX_READY_SUBPROC)(FXG_HWND,unsigned int,FXG_DWORD,LONG,FXG_DWORD,FXG_DWORD);
typedef int (__stdcall *FX_READY_SET_SUB)(FXG_HWND,FX_READY_SUBPROC,FXG_DWORD,FXG_DWORD);
typedef int (__stdcall *FX_READY_REMOVE_SUB)(FXG_HWND,FX_READY_SUBPROC,FXG_DWORD);
typedef LONG (__stdcall *FX_READY_DEF_SUB)(FXG_HWND,unsigned int,FXG_DWORD,LONG);
IMP void *__stdcall GetModuleHandleW(const WCH *);
IMP int __stdcall GetModuleHandleExW(FXG_DWORD,const WCH *,void **);
IMP void *__stdcall GetProcAddress(void *,const char *);
IMP FXG_DWORD __stdcall GetTickCount(void);
IMP unsigned int __stdcall RegisterWindowMessageW(const WCH *);
IMP int __stdcall PostMessageW(FXG_HWND,unsigned int,FXG_DWORD,LONG);
IMP FXG_DWORD __stdcall SetTimer(FXG_HWND,FXG_DWORD,unsigned int,void (__stdcall *)(FXG_HWND,unsigned int,FXG_DWORD,FXG_DWORD));
IMP int __stdcall KillTimer(FXG_HWND,FXG_DWORD);
IMP int __stdcall EnumChildWindows(FXG_HWND,int (__stdcall *)(FXG_HWND,LONG),LONG);
IMP FXG_HWND __stdcall FindWindowExW(FXG_HWND,FXG_HWND,const WCH *,const WCH *);
IMP int __stdcall IsChild(FXG_HWND,FXG_HWND);
IMP int __stdcall GetClientRect(FXG_HWND,FX_READY_RECT *);
IMP int __stdcall GetWindowRect(FXG_HWND,FX_READY_RECT *);
FX_READY_STATS FxComposeReadyStats={sizeof(FX_READY_STATS),1};
#pragma comment(linker,"/export:FxComposeReadyStats=_FxComposeReadyStats,DATA")
#define QINC(field) ((void)InterlockedIncrement((volatile LONG *)&FxComposeReadyStats.field))
typedef struct FX_READY_SLOT {
 volatile LONG used;
 FXG_HWND hwnd,host;
 void *identity,*owner;
 FXG_DWORD thread,timer,started;
 int phase,ready,subclassed,releasing;
} FX_READY_SLOT;
static FX_READY_SLOT ready_slots[FX_READY_SLOTS];
static FX_READY_SET_SUB ready_set_sub;
static FX_READY_REMOVE_SUB ready_remove_sub;
static FX_READY_DEF_SUB ready_def_sub;
static unsigned int ready_message;
static int ready_pinned;
static const WCH *const ready_message_prop=(const WCH *)FX_READY_MESSAGE_PROP;
static LONG __stdcall ready_subproc(FXG_HWND,unsigned int,FXG_DWORD,LONG,FXG_DWORD,FXG_DWORD);
static void __stdcall ready_timer(FXG_HWND,unsigned int,FXG_DWORD,FXG_DWORD);
static int ready_class(FXG_HWND h,const WCH *target) {
 WCH n[64];unsigned int i;FXG_DWORD pid=0;
 if(!h||!IsWindow(h)||!GetWindowThreadProcessId(h,&pid)||pid!=GetCurrentProcessId()||GetClassNameW(h,n,64)<=0)return 0;
 for(i=0;i<64;i++){if(n[i]!=target[i])return 0;if(!n[i])return 1;}return 0;
}
static int ready_host(FXG_HWND root,FXG_HWND host) {
 return ready_class(host,(const WCH *)L"TCEFWindowParent")&&IsChild(root,host)&&GetAncestor(host,2)==root;
}
typedef struct FX_READY_SEARCH { FXG_HWND root,host;unsigned char *base;int loaded,count; } FX_READY_SEARCH;
static int ready_vmt(unsigned char *object,unsigned char *vmt,FXG_DWORD size) {
 return object&&*(void **)object==vmt&&*(void **)(vmt-76)==vmt&&*(FXG_DWORD *)(vmt-40)==size;
}
static int __stdcall ready_find_editor(FXG_HWND hwnd,LONG data) {
 FX_READY_SEARCH *s=(FX_READY_SEARCH *)data;unsigned int i;unsigned short atom;
 unsigned char *object,*hostObject;FXG_HWND host;int loaded;
 const FXG_DWORD offsets[4]={FX_READY_ATOM1_RVA,FX_READY_ATOM2_RVA,FX_READY_ATOM3_RVA,FX_READY_ATOM4_RVA};
 if(++s->count>2048)return 0;
 if(!(ready_class(hwnd,(const WCH *)L"TFoxHTMLEditor.UnicodeClass")||ready_class(hwnd,(const WCH *)L"TFoxHTMLEditor")||
      ready_class(hwnd,(const WCH *)L"TFoxHTMLEditorBase.UnicodeClass")||ready_class(hwnd,(const WCH *)L"TFoxHTMLEditorBase")))return 1;
 __try {
  for(i=0;i<4;i++){
   atom=*(unsigned short *)(s->base+offsets[i]);if(atom<0xc000)continue;
   object=(unsigned char *)GetPropW(hwnd,(const WCH *)(FXG_DWORD)atom);
   if(!(ready_vmt(object,s->base+FX_READY_EDITOR_VMT_RVA,976)||ready_vmt(object,s->base+FX_READY_EDITOR_BASE_VMT_RVA,880)))continue;
   if(*(FXG_HWND *)(object+0x180)!=hwnd)continue;
   loaded=object[0x324];if(loaded>1)continue;hostObject=*(unsigned char **)(object+0x300);
   if(!ready_vmt(hostObject,s->base+FX_READY_HOST_VMT_RVA,548))continue;
   host=*(FXG_HWND *)(hostObject+0x180);if(!ready_host(s->root,host))continue;
   if(*(FXG_HWND *)(object+0x180)!=hwnd||*(unsigned char **)(object+0x300)!=hostObject||*(FXG_HWND *)(hostObject+0x180)!=host||object[0x324]!=loaded)continue;
   s->host=host;s->loaded=loaded;return 0;
  }
 } __except(1) { return 1; }
 return 1;
}
static int ready_snapshot_native(FXG_HWND root,FXG_HWND *host) {
 FX_READY_SEARCH s;s.root=root;s.host=0;s.base=(unsigned char *)GetModuleHandleW(0);s.loaded=-1;s.count=0;
 if(s.base)EnumChildWindows(root,ready_find_editor,(LONG)&s);*host=s.host;return s.loaded;
}
static int ready_surface_native(FXG_HWND root,FXG_HWND host) {
 FXG_HWND browser,widget,render;FX_READY_RECT a,b,c,d;LONG w,h,rw,rh;
 if(!ready_host(root,host)||!IsWindowVisible(host))return 0;
 browser=FindWindowExW(host,0,(const WCH *)L"CefBrowserWindow",0);
 if(!ready_class(browser,(const WCH *)L"CefBrowserWindow")||!IsWindowVisible(browser))return 0;
 widget=FindWindowExW(browser,0,(const WCH *)L"Chrome_WidgetWin_0",0);
 if(!ready_class(widget,(const WCH *)L"Chrome_WidgetWin_0")||!IsWindowVisible(widget))return 0;
 render=FindWindowExW(widget,0,(const WCH *)L"Chrome_RenderWidgetHostHWND",0);
 if(!ready_class(render,(const WCH *)L"Chrome_RenderWidgetHostHWND")||!IsWindowVisible(render)||!IsChild(root,render))return 0;
 if(!GetClientRect(host,&a)||!GetClientRect(render,&b)||!GetWindowRect(host,&c)||!GetWindowRect(render,&d))return 0;
 w=a.right-a.left;h=a.bottom-a.top;rw=b.right-b.left;rh=b.bottom-b.top;
 return w>0&&h>0&&rw>=w&&rw<=w+1&&rh>=h&&rh<=h+1&&c.left==d.left&&c.top==d.top;
}
#ifdef FXG_FIXTURE
#define READY_SNAPSHOT FxReadyFixtureSnapshot
#define READY_SURFACE FxReadyFixtureSurface
#define READY_TICK FxReadyFixtureTick
#else
#define READY_SNAPSHOT ready_snapshot_native
#define READY_SURFACE ready_surface_native
#define READY_TICK GetTickCount
#endif
static int ready_owns(FX_READY_SLOT *s) {
 return s->used&&s->thread==GetCurrentThreadId()&&matching_class(s->hwnd,compose_class)&&
  GetPropW(s->hwnd,identity_name)==s->identity&&GetPropW(s->hwnd,owner_name)==s->owner;
}
static void ready_discard(FX_READY_SLOT *s,int removeProps) {
 if(s->timer){KillTimer(0,s->timer);s->timer=0;}
 if(s->subclassed&&IsWindow(s->hwnd))ready_remove_sub(s->hwnd,ready_subproc,(FXG_DWORD)s);
 if(removeProps&&ready_owns(s)){
  if(GetPropW(s->hwnd,ready_message_prop)==(void *)ready_message)RemovePropW(s->hwnd,ready_message_prop);
 }
 s->phase=0;s->subclassed=0;s->hwnd=0;s->host=0;s->owner=0;s->identity=0;s->ready=0;s->releasing=0;
 InterlockedExchange(&s->used,0);
}
static void ready_active_decrement(void) {
 LONG old;
 do {old=(LONG)FxComposeReadyStats.active;}while(InterlockedCompareExchange((volatile LONG *)&FxComposeReadyStats.active,old-1,old)!=old);
}
/* No global recovery mutation here: later gates must not release an async hold. */
static int ready_release(FX_READY_SLOT *s,int reason,int paint) {
 int no=0,ok=0,active;FXG_DWORD cloaked=0;void *owner;
 if(!s->used||s->releasing)return 0;
 if(!ready_owns(s)){active=s->phase>=2;QINC(retired);ready_discard(s,0);if(active)ready_active_decrement();return 1;}
 active=s->phase>=2;owner=s->owner;s->releasing=1;
 __try {
  if(paint&&IsWindowVisible(s->hwnd)&&!IsIconic(s->hwnd)){
   __try {if(!REDRAW(s->hwnd,0,0,0x181))QINC(redrawFailed);}__except(1){QINC(callbackExceptions);}
  }
  if(s->used&&s->owner==owner&&ready_owns(s)&&DWSET(s->hwnd,13,&no,sizeof(no))>=0&&
     s->used&&s->owner==owner&&ready_owns(s)&&DWGET(s->hwnd,14,&cloaked,sizeof(cloaked))>=0&&!(cloaked&1))ok=1;
 }__except(1){QINC(callbackExceptions);}
 if(!s->used||s->owner!=owner)return 1;
 s->releasing=0;
 if(!ok){QINC(releaseFailed);return 0;}
 if(ready_owns(s)){
  if(GetPropW(s->hwnd,ready_message_prop)==(void *)ready_message)RemovePropW(s->hwnd,ready_message_prop);
  RemovePropW(s->hwnd,owner_name);
 }
 QINC(released);INC(released);
 if(reason==1)QINC(readyReleased);else if(reason==2)QINC(timeoutReleased);else QINC(closed);
 ready_discard(s,0);if(active)ready_active_decrement();return 1;
}
static void ready_evaluate(FX_READY_SLOT *s) {
 FXG_HWND host=0;int loaded;
 if(!s->used||s->phase<2||s->releasing)return;
 if(!ready_owns(s)){ready_release(s,3,0);return;}
 if(!IsWindowVisible(s->hwnd)||IsIconic(s->hwnd)){ready_release(s,3,0);return;}
 if((FXG_DWORD)(READY_TICK()-s->started)>=FX_READY_TIMEOUT){ready_release(s,2,1);return;}
 if(!s->ready||s->phase==3)return;
 loaded=READY_SNAPSHOT(s->hwnd,&host);
 if(loaded<0||host!=s->host||!READY_SURFACE(s->hwnd,host)){QINC(surfacePending);return;}
 s->phase=3;
 if(PostMessageW(s->hwnd,ready_message,(FXG_DWORD)s->owner,0))QINC(posted);else s->phase=2;
}
static void __stdcall ready_timer(FXG_HWND hwnd,unsigned int msg,FXG_DWORD id,FXG_DWORD now) {
 FXG_DWORD saved=GetLastError();unsigned int i;(void)hwnd;(void)msg;(void)now;
 __try {for(i=0;i<FX_READY_SLOTS;i++)if(ready_slots[i].used&&ready_slots[i].timer==id&&ready_slots[i].thread==GetCurrentThreadId())ready_evaluate(&ready_slots[i]);}
 __except(1){QINC(callbackExceptions);}SetLastError(saved);
}
static void ready_notify(FX_READY_SLOT *s,FXG_HWND signalledHost) {
 FXG_HWND host=0;int loaded=READY_SNAPSHOT(s->hwnd,&host);
 if(loaded!=1||!host||host!=signalledHost)return;
 s->host=host;s->ready=1;QINC(notified);if(s->phase>=2)ready_evaluate(s);
}
static LONG __stdcall ready_subproc(FXG_HWND hwnd,unsigned int msg,FXG_DWORD wp,LONG lp,FXG_DWORD id,FXG_DWORD ref) {
 FX_READY_SLOT *s=(FX_READY_SLOT *)id;FXG_DWORD saved=GetLastError();FXG_HWND host=0;int i,valid=0;
 for(i=0;i<FX_READY_SLOTS;i++)if(s==&ready_slots[i])valid=1;
 if(!valid||!s->used||s->hwnd!=hwnd||s->owner!=(void *)ref||s->thread!=GetCurrentThreadId())return ready_def_sub(hwnd,msg,wp,lp);
 __try {
  if(msg==ready_message){
   if(wp!=(FXG_DWORD)s->owner||!ready_owns(s)){QINC(staleMessages);SetLastError(saved);return 0;}
   if(lp)ready_notify(s,(FXG_HWND)lp);
   else if(s->phase==3){
    s->phase=2;
    if(READY_SNAPSHOT(hwnd,&host)>=0&&host==s->host&&s->ready&&READY_SURFACE(hwnd,host))ready_release(s,1,1);
   }
   SetLastError(saved);return 0;
  }
  if(msg==0x82){
   int active=s->phase>=2;QINC(closed);ready_discard(s,1);
   if(active)ready_active_decrement();
  }else if(s->phase>=2&&(msg==0x10||(msg==0x18&&!wp)||(msg==5&&wp==1)))ready_release(s,3,0);
 }__except(1){QINC(callbackExceptions);}
 SetLastError(saved);return ready_def_sub(hwnd,msg,wp,lp);
}
static FX_READY_SLOT *ready_prepare(void) {
 unsigned int i;void *module,*pinned;FX_READY_SLOT *s=0;FXG_HWND host=0;int loaded;
 if(!owns_record()||!recovery.owned)return 0;
 if(!ready_set_sub){
  module=GetModuleHandleW((const WCH *)L"comctl32.dll");if(!module)goto failed;
  ready_set_sub=(FX_READY_SET_SUB)GetProcAddress(module,"SetWindowSubclass");
  ready_remove_sub=(FX_READY_REMOVE_SUB)GetProcAddress(module,"RemoveWindowSubclass");
  ready_def_sub=(FX_READY_DEF_SUB)GetProcAddress(module,"DefSubclassProc");
 }
 if(!ready_set_sub||!ready_remove_sub||!ready_def_sub)goto failed;
 if(!ready_message)ready_message=RegisterWindowMessageW((const WCH *)FX_READY_MESSAGE_NAME);if(!ready_message)goto failed;
 if(!ready_pinned){
#ifdef FXG_FIXTURE
  if(!FxReadyFixturePin())goto failed;
#else
  if(!GetModuleHandleExW(5,(const WCH *)ready_timer,&pinned))goto failed;
#endif
  ready_pinned=1;
 }
 for(i=0;i<FX_READY_SLOTS;i++)if(InterlockedCompareExchange(&ready_slots[i].used,1,0)==0){s=&ready_slots[i];break;}
 if(!s)goto failed;
 s->hwnd=recovery.hwnd;s->identity=recovery.identity;s->owner=recovery.owner;s->thread=GetCurrentThreadId();s->phase=1;
 s->host=0;s->ready=0;s->subclassed=0;s->timer=0;s->releasing=0;
 if(!ready_set_sub(s->hwnd,ready_subproc,(FXG_DWORD)s,(FXG_DWORD)s->owner))goto cancel;s->subclassed=1;
 if(!SetPropW(s->hwnd,ready_message_prop,(void *)ready_message))goto cancel;
 s->timer=SetTimer(0,0,FX_READY_INTERVAL,ready_timer);if(!s->timer)goto cancel;
 /* +324 is a lifetime latch. Only the entry snapshot can identify a previously
  * loaded shell. A fresh entry requires this owner's explicit notification. */
 loaded=READY_SNAPSHOT(s->hwnd,&host);
 if(loaded>=0)s->host=host;
 if(loaded==1){s->ready=1;QINC(snapshotReady);}
 return s;
cancel:ready_discard(s,1);
failed:QINC(setupFailed);return 0;
}
static int ready_adopt(FX_READY_SLOT *s) {
 FXG_HWND host=0;int loaded;
 if(!s||!s->used||s->phase!=1||!ready_owns(s)||!owns_record()||recovery.owner!=s->owner||!IsWindowVisible(s->hwnd)||IsIconic(s->hwnd))return 0;
 loaded=READY_SNAPSHOT(s->hwnd,&host);
 if(loaded>=0)s->host=host;
 s->started=READY_TICK();s->phase=2;QINC(armed);QINC(active);clear_record();
 ready_evaluate(s);return 1;
}
static void ready_cancel_prepared(FX_READY_SLOT *s) {if(s&&s->used&&s->phase==1)ready_discard(s,1);}
#ifdef FXG_FIXTURE
void __stdcall FxReadyFixturePump(FXG_HWND hwnd,int reason) {
 unsigned int i;FXG_DWORD saved=GetLastError();FXG_HWND host=0;
 for(i=0;i<FX_READY_SLOTS;i++)if(ready_slots[i].used&&ready_slots[i].hwnd==hwnd&&ready_slots[i].thread==GetCurrentThreadId()){
  if(reason==1)ready_evaluate(&ready_slots[i]);
  else if(reason==2){if(READY_SNAPSHOT(hwnd,&host)>=0)ready_notify(&ready_slots[i],host);}
  else if(reason==3)ready_release(&ready_slots[i],3,0);
 }
 SetLastError(saved);
}
#endif
