/* Own-process asynchronous-cloak mechanism tests. No Foxmail is opened/read.
 * Built twice: deterministic observation/DWM seams; real production DLL. */
#include "foxmail_reveal_gate.h"
#include "compose-ready-api.h"
#define IMP __declspec(dllimport)
typedef unsigned short WCH;
typedef unsigned int UINT;
typedef long HR;
typedef long (__stdcall *WNDPROC)(FXG_HWND,UINT,UINT,long);
typedef struct WC {UINT style;WNDPROC proc;int ce,we;void *instance,*icon,*cursor,*brush;const WCH *menu,*name;} WC;
typedef struct MESSAGE {FXG_HWND hwnd;UINT message,wparam;long lparam;FXG_DWORD time;long x,y;} MESSAGE;
typedef FXG_DWORD (__stdcall *RUN)(FXG_HWND,FXG_INVOKE,void *);
IMP FXG_DWORD __stdcall GetLastError(void);
IMP void __stdcall SetLastError(FXG_DWORD);
IMP void *__stdcall GetModuleHandleW(const WCH *);
IMP FXG_DWORD __stdcall GetModuleFileNameW(void *,WCH *,FXG_DWORD);
IMP void *__stdcall LoadLibraryExW(const WCH *,void *,FXG_DWORD);
IMP void *__stdcall GetProcAddress(void *,const char *);
IMP int __stdcall FreeLibrary(void *);
IMP unsigned short __stdcall RegisterClassW(const WC *);
IMP FXG_HWND __stdcall CreateWindowExW(FXG_DWORD,const WCH *,const WCH *,FXG_DWORD,int,int,int,int,FXG_HWND,void *,void *,void *);
IMP long __stdcall DefWindowProcW(FXG_HWND,UINT,UINT,long);
IMP int __stdcall ShowWindow(FXG_HWND,int);
IMP int __stdcall DestroyWindow(FXG_HWND);
IMP int __stdcall IsWindow(FXG_HWND);
IMP int __stdcall IsWindowVisible(FXG_HWND);
IMP void *__stdcall GetPropW(FXG_HWND,const WCH *);
IMP int __stdcall SetPropW(FXG_HWND,const WCH *,void *);
IMP void *__stdcall RemovePropW(FXG_HWND,const WCH *);
IMP HR __stdcall DwmGetWindowAttribute(FXG_HWND,FXG_DWORD,void *,FXG_DWORD);
IMP HR __stdcall DwmSetWindowAttribute(FXG_HWND,FXG_DWORD,const void *,FXG_DWORD);
IMP int __stdcall RedrawWindow(FXG_HWND,const void *,void *,UINT);
IMP UINT __stdcall RegisterWindowMessageW(const WCH *);
IMP long __stdcall SendMessageW(FXG_HWND,UINT,UINT,long);
IMP int __stdcall PostMessageW(FXG_HWND,UINT,UINT,long);
IMP int __stdcall PeekMessageW(MESSAGE *,FXG_HWND,UINT,UINT,UINT);
IMP long __stdcall DispatchMessageW(const MESSAGE *);
IMP FXG_DWORD __stdcall GetTickCount(void);
IMP void __stdcall Sleep(FXG_DWORD);
IMP void __stdcall RaiseException(FXG_DWORD,FXG_DWORD,FXG_DWORD,const UINT *);
IMP void __stdcall ExitProcess(FXG_DWORD);
IMP void *__stdcall CreateThread(void *,UINT,FXG_DWORD (__stdcall *)(void *),void *,FXG_DWORD,FXG_DWORD *);
IMP FXG_DWORD __stdcall WaitForSingleObject(void *,FXG_DWORD);
IMP int __stdcall CloseHandle(void *);
IMP void *__stdcall VirtualAlloc(void *,FXG_DWORD,FXG_DWORD,FXG_DWORD);
IMP int __stdcall VirtualFree(void *,FXG_DWORD,FXG_DWORD);
IMP unsigned short __stdcall GlobalAddAtomW(const WCH *);
IMP unsigned short __stdcall GlobalDeleteAtom(unsigned short);
IMP int __cdecl printf(const char *,...);
IMP int __cdecl fflush(void *);
unsigned long __cdecl _exception_code(void);
#pragma intrinsic(_exception_code)
#define IN_ERROR 0x13572468UL
#define OUT_ERROR 0x24681357UL
#define TEST_EXCEPTION 0xe04f4455UL
#define E_FAIL ((HR)0x80004005UL)
static const WCH *const compose=(const WCH *)L"TFoxComposeForm.UnicodeClass";
static const WCH *const owner=(const WCH *)L"FxRevealGate.Owner.43E5CD38.v2";
static const WCH *const identity=(const WCH *)L"FxRevealGate.Identity.43E5CD38.v2";
static const WCH *const other=(const WCH *)L"FxReady.Unrelated.Fixture";
static const WCH *const hostClass=(const WCH *)L"TCEFWindowParent";
static const WCH *const browserClass=(const WCH *)L"CefBrowserWindow";
static const WCH *const widgetClass=(const WCH *)L"Chrome_WidgetWin_0";
static const WCH *const renderClass=(const WCH *)L"Chrome_RenderWidgetHostHWND";
static int checks,failures;
/* Reserve test-owned image storage at the real fixed RVAs used by the helper.
 * Bounds are checked before every mapped region is used; never overwrite code
 * or unrelated process memory. A BSS reservation avoids OS allocation races. */
static unsigned char syntheticImage[0x1100000];
static const char *test_name="startup";
#define CHECK(x) do{++checks;if(!(x)){++failures;printf("FAIL [%s] line %d: %s\n",test_name,__LINE__,#x);fflush(0);}}while(0)
typedef struct CTX {FXG_HWND root,editor,host,browser,widget,renderer;int loaded,surface,action,calls,incoming_ok;struct CTX *nested;FXG_DWORD expected_cloak;unsigned char editorObject[976],hostObject[548];} CTX;
static CTX contexts[20];
static RUN run;
static RUN mainRun,coldRun,settingsRun,printRun;
#ifdef FXG_FIXTURE
FXG_DWORD __stdcall FxColdRun(FXG_HWND,FXG_INVOKE,void *);
#endif
static void *instance;
static UINT readyMessage;
static FX_READY_STATS *readyStats;
static const WCH *const editorClass=(const WCH *)L"TFoxHTMLEditor.UnicodeClass";
static unsigned short objectAtom;
static void write32(unsigned char *p,FXG_DWORD v){*(FXG_DWORD *)p=v;}
static void bind_objects(CTX *c){unsigned char *base=(unsigned char *)instance;write32(c->editorObject,(FXG_DWORD)(base+FX_READY_EDITOR_VMT_RVA));write32(c->editorObject+0x180,(FXG_DWORD)c->editor);write32(c->editorObject+0x300,(FXG_DWORD)c->hostObject);c->editorObject[0x324]=(unsigned char)c->loaded;write32(c->hostObject,(FXG_DWORD)(base+FX_READY_HOST_VMT_RVA));write32(c->hostObject+0x180,(FXG_DWORD)c->host);CHECK(SetPropW(c->editor,(const WCH *)(FXG_DWORD)objectAtom,c->editorObject));}
static void loaded(CTX *c,int value){c->loaded=value;c->editorObject[0x324]=(unsigned char)value;}
static long __stdcall window_proc(FXG_HWND h,UINT msg,UINT wp,long lp){return DefWindowProcW(h,msg,wp,lp);}
static FXG_DWORD cloak(FXG_HWND h){FXG_DWORD v=0xffffffffUL;if(DwmGetWindowAttribute(h,14,&v,4)<0)return 0xffffffffUL;return v;}
static CTX *lookup(FXG_HWND h){int i;for(i=0;i<20;i++)if(contexts[i].root==h)return &contexts[i];return 0;}
static FXG_HWND window(const WCH *name,FXG_HWND parent){return CreateWindowExW(0,name,(const WCH *)L"Own asynchronous fixture",parent?0x50000000UL:0x00cf0000UL,parent?0:-24000,parent?0:-24000,300,180,parent,0,instance,0);}
static void make_host(CTX *c) {
 c->host=window(hostClass,c->editor);
 c->browser=window(browserClass,c->host);
 c->widget=window(widgetClass,c->browser);
 c->renderer=window(renderClass,c->widget);
 CHECK(c->host&&c->browser&&c->widget&&c->renderer);
 c->surface=1;
 bind_objects(c);
}
static CTX *make(int n,int tree){CTX *c=&contexts[n];unsigned int i;unsigned char *p=(unsigned char *)c;for(i=0;i<sizeof(*c);i++)p[i]=0;c->root=window(compose,0);CHECK(c->root);c->expected_cloak=1;if(tree){c->editor=window(editorClass,c->root);CHECK(c->editor);make_host(c);}return c;}
static void destroy(CTX *c){if(c->root&&IsWindow(c->root))CHECK(DestroyWindow(c->root));c->root=0;}
static void drain(void){MESSAGE m;int n=0;while(PeekMessageW(&m,0,0,0,1)){DispatchMessageW(&m);if(++n>2000){CHECK(0);break;}}}
static void pump_for(FXG_DWORD ms){FXG_DWORD start=GetTickCount();do{drain();Sleep(5);}while(GetTickCount()-start<ms);drain();}
static FXG_DWORD __stdcall invoke(void *opaque){CTX *c=(CTX *)opaque;FXG_DWORD in=GetLastError();c->calls++;c->incoming_ok=in==IN_ERROR;CHECK(c->incoming_ok);CHECK(cloak(c->root)==c->expected_cloak);if(c->action==2){SetLastError(OUT_ERROR);RaiseException(TEST_EXCEPTION,0,0,0);}if(c->action==3){DestroyWindow(c->root);SetLastError(OUT_ERROR);return 0;}if(c->action==4&&c->nested){SetLastError(IN_ERROR);run(c->nested->root,invoke,c->nested);CHECK(GetLastError()==OUT_ERROR);}if(c->action==5){
  FXG_HWND oldHost=c->host;
  // Keep the old HWND alive until the new chain has a distinct identity.
  c->loaded=0;
  make_host(c);
  CHECK(c->host!=oldHost);
  CHECK(DestroyWindow(oldHost));
 }
 if(c->action!=1)ShowWindow(c->root,4);SetLastError(OUT_ERROR);return 0;}
static void start(CTX *c){FXG_DWORD result,error;SetLastError(IN_ERROR);result=run(c->root,invoke,c);error=GetLastError();CHECK(result==0&&error==OUT_ERROR&&c->calls==1);}
static void released(CTX *c){CHECK(cloak(c->root)==0);CHECK(!GetPropW(c->root,owner));}
static FXG_DWORD __stdcall worker(void *opaque){CTX *c=(CTX *)opaque;c->action=1;c->expected_cloak=0;start(c);return 0;}

#ifdef FXG_FIXTURE
static FXG_DWORD tick=100;
static int failGet,failOn,failOff,failRedraw,throwRedraw,failPin,throwSnapshot;
static int getCalls,setOnCalls,setOffCalls,redrawCalls;
HR __stdcall FxFixtureDwmGet(FXG_HWND h,FXG_DWORD a,void *p,FXG_DWORD n){getCalls++;if(failGet){failGet--;return E_FAIL;}return DwmGetWindowAttribute(h,a,p,n);}
HR __stdcall FxFixtureDwmSet(FXG_HWND h,FXG_DWORD a,const void *p,FXG_DWORD n){if(a==13&&*(const int *)p){setOnCalls++;if(failOn){failOn--;return E_FAIL;}}else if(a==13){setOffCalls++;if(failOff){failOff--;return E_FAIL;}}return DwmSetWindowAttribute(h,a,p,n);}
int __stdcall FxFixtureRedraw(FXG_HWND h,const void *p,void *r,UINT f){redrawCalls++;if(throwRedraw){throwRedraw--;RaiseException(TEST_EXCEPTION,0,0,0);}if(failRedraw){failRedraw--;return 0;}return RedrawWindow(h,p,r,f);}
int __stdcall FxReadyFixtureSnapshot(FXG_HWND h,FXG_HWND *out){CTX *c=lookup(h);if(throwSnapshot){throwSnapshot--;RaiseException(TEST_EXCEPTION,0,0,0);}if(!c||!c->host||!IsWindow(c->host)||c->loaded<0||c->loaded>1)return -1;*out=c->host;return c->loaded;}
int __stdcall FxReadyFixtureSurface(FXG_HWND h,FXG_HWND host){CTX *c=lookup(h);return c&&c->surface&&host==c->host&&IsWindow(host)&&IsWindow(c->renderer);}
FXG_DWORD __stdcall FxReadyFixtureTick(void){return tick;}
int __stdcall FxReadyFixturePin(void){if(failPin){failPin--;return 0;}return 1;}
static void evaluate(CTX *c,int reason){FxReadyFixturePump(c->root,reason);drain();}
static void timeout(CTX *c){tick+=FX_READY_TIMEOUT+1;evaluate(c,1);pump_for(10);}
#else
static void evaluate(CTX *c,int reason){if(reason==3)SendMessageW(c->root,0x10,0,0);else if(reason==2)PostMessageW(c->root,readyMessage,(UINT)GetPropW(c->root,owner),(long)c->host);pump_for(FX_READY_INTERVAL*3);}
static void timeout(CTX *c){(void)c;pump_for(FX_READY_TIMEOUT+150);}
#endif

static int prepare_objects(void){
 unsigned char *base=(unsigned char *)instance;FXG_DWORD rvas[4]={FX_READY_EDITOR_VMT_RVA,FX_READY_HOST_VMT_RVA,FX_READY_ATOM1_RVA,FX_READY_ATOM3_RVA};int i,j;
 objectAtom=GlobalAddAtomW((const WCH *)L"FxReady.Synthetic.Object.Fixture");CHECK(objectAtom>=0xc000);
 for(i=0;i<4;i++){unsigned char *at=(unsigned char *)(((FXG_DWORD)base+rvas[i])&~0xffffUL);if(at<syntheticImage||at+65536>syntheticImage+sizeof(syntheticImage)){printf("Synthetic RVA outside own BSS: base=%p target=%p reserve=%p..%p\n",base,at,syntheticImage,syntheticImage+sizeof(syntheticImage));CHECK(0);return 0;}for(j=0;j<65536;j++)at[j]=0;}
 write32(base+FX_READY_EDITOR_VMT_RVA-76,(FXG_DWORD)(base+FX_READY_EDITOR_VMT_RVA));write32(base+FX_READY_EDITOR_VMT_RVA-40,976);
 write32(base+FX_READY_HOST_VMT_RVA-76,(FXG_DWORD)(base+FX_READY_HOST_VMT_RVA));write32(base+FX_READY_HOST_VMT_RVA-40,548);
 *(unsigned short *)(base+FX_READY_ATOM1_RVA)=objectAtom;return 1;
}
static void common_cases(void){
 CTX *c,*d;FXG_DWORD active,closed,releasedBefore,readyBefore,staleBefore;void *thread;volatile FXG_DWORD caught,error;int i;
 test_name="ready notification next boundary";c=make(0,1);active=readyStats->active;readyBefore=readyStats->readyReleased;start(c);CHECK(cloak(c->root)==1&&GetPropW(c->root,owner)&&readyStats->active==active+1);CHECK(GetPropW(c->root,(const WCH *)FX_READY_MESSAGE_PROP));loaded(c,1);evaluate(c,2);released(c);CHECK(readyStats->active==active&&readyStats->readyReleased==readyBefore+1);destroy(c);
 test_name="previously loaded shell snapshot ready";c=make(0,1);loaded(c,1);start(c);evaluate(c,1);released(c);destroy(c);
 test_name="replacement host needs its own readiness";
 c=make(0,1);loaded(c,1);c->action=5;start(c);evaluate(c,1);
 CHECK(cloak(c->root)==1&&readyStats->active==1);
 loaded(c,1);evaluate(c,2);released(c);destroy(c);
 test_name="wrong token and foreign host";c=make(0,1);d=make(1,1);start(c);loaded(c,1);staleBefore=readyStats->staleMessages;SendMessageW(c->root,readyMessage,(UINT)GetPropW(c->root,owner)+1,(long)c->host);CHECK(cloak(c->root)==1);SendMessageW(c->root,readyMessage,(UINT)GetPropW(c->root,owner),(long)d->host);CHECK(cloak(c->root)==1);CHECK(readyStats->staleMessages>=staleBefore+1);evaluate(c,2);released(c);destroy(c);destroy(d);
 test_name="missing renderer bounded timeout";c=make(0,1);CHECK(DestroyWindow(c->renderer));c->renderer=0;c->surface=0;start(c);loaded(c,1);evaluate(c,2);CHECK(cloak(c->root)==1);timeout(c);released(c);destroy(c);
 test_name="fresh latch alone cannot release";c=make(0,1);start(c);loaded(c,1);evaluate(c,1);CHECK(cloak(c->root)==1);timeout(c);released(c);destroy(c);
 test_name="invalid load byte rejected";c=make(0,1);loaded(c,2);start(c);evaluate(c,2);CHECK(cloak(c->root)==1);loaded(c,1);evaluate(c,2);released(c);destroy(c);
 test_name="close cancellation";c=make(0,1);start(c);closed=readyStats->closed;SendMessageW(c->root,0x10,0,0);drain();CHECK(!IsWindow(c->root)&&readyStats->active==0&&readyStats->closed>=closed+1);c->root=0;
 test_name="destroy cancellation";c=make(0,1);start(c);destroy(c);drain();CHECK(readyStats->active==0);
 test_name="hide cancellation";c=make(0,1);start(c);ShowWindow(c->root,0);evaluate(c,1);released(c);destroy(c);
 test_name="original exception no transfer";c=make(0,1);c->action=2;caught=error=0;active=readyStats->active;SetLastError(IN_ERROR);__try{run(c->root,invoke,c);CHECK(0);}__except((caught=_exception_code()),1){error=GetLastError();}CHECK(caught==TEST_EXCEPTION&&error==OUT_ERROR&&readyStats->active==active);released(c);c->action=0;c->calls=0;start(c);timeout(c);released(c);destroy(c);
 test_name="destroy during original";c=make(0,1);c->action=3;start(c);CHECK(!IsWindow(c->root)&&readyStats->active==0);c->root=0;
 test_name="nested distinct compose";c=make(0,1);d=make(1,1);c->action=4;c->nested=d;d->expected_cloak=0;start(c);CHECK(d->calls==1&&cloak(d->root)==0&&!GetPropW(d->root,owner));loaded(c,1);evaluate(c,2);released(c);destroy(c);destroy(d);
 test_name="maximum slots fail open";for(i=0;i<FX_READY_SLOTS;i++){c=make(i,1);start(c);CHECK(cloak(c->root)==1);}CHECK(readyStats->active==FX_READY_SLOTS);c=make(FX_READY_SLOTS,1);start(c);released(c);CHECK(readyStats->active==FX_READY_SLOTS);for(i=0;i<=FX_READY_SLOTS;i++)destroy(&contexts[i]);drain();CHECK(readyStats->active==0);
 test_name="wrong thread bypass";c=make(0,1);thread=CreateThread(0,0,worker,c,0,0);CHECK(thread);if(thread){CHECK(WaitForSingleObject(thread,2000)==0);CHECK(CloseHandle(thread));}CHECK(cloak(c->root)==0&&readyStats->active==0);destroy(c);
 test_name="reused lifetime stale notification";c=make(0,1);start(c);{UINT oldToken=(UINT)GetPropW(c->root,owner);FXG_HWND oldHost=c->host;destroy(c);c=make(0,1);start(c);loaded(c,1);SendMessageW(c->root,readyMessage,oldToken,(long)oldHost);CHECK(cloak(c->root)==1);evaluate(c,2);released(c);destroy(c);}CHECK(readyStats->active==0);
 test_name="identity token replaced";c=make(0,1);start(c);CHECK(SetPropW(c->root,identity,(void *)0x54321));releasedBefore=readyStats->released;evaluate(c,1);CHECK(readyStats->active==0&&readyStats->released==releasedBefore);destroy(c);
 test_name="noncompose routes remain synchronous";{RUN saved=run;RUN runs[3];const WCH *names[3]={(const WCH *)L"TFoxMainFrm.UnicodeClass",(const WCH *)L"TOptionForm.UnicodeClass",(const WCH *)L"TPrintPreviewForm.UnicodeClass"};runs[0]=coldRun;runs[1]=settingsRun;runs[2]=printRun;for(i=0;i<3;i++){FXG_DWORD armed=readyStats->armed;c=make(0,0);DestroyWindow(c->root);c->root=window(names[i],0);CHECK(c->root);run=runs[i];start(c);released(c);CHECK(!readyStats->active&&readyStats->armed==armed);destroy(c);}run=saved;}
 test_name="legacy main unwind and busy reset";{RUN saved=run;FXG_DWORD armed=readyStats->armed;c=make(0,0);DestroyWindow(c->root);c->root=window((const WCH *)L"TFoxMainFrm.UnicodeClass",0);CHECK(c->root);run=coldRun;start(c);released(c);ShowWindow(c->root,0);c->action=2;caught=error=0;SetLastError(IN_ERROR);__try{run(c->root,invoke,c);CHECK(0);}__except((caught=_exception_code()),1){error=GetLastError();}CHECK(caught==TEST_EXCEPTION&&error==OUT_ERROR);released(c);c->action=0;c->calls=0;run=mainRun;start(c);released(c);CHECK(!readyStats->active&&readyStats->armed==armed);destroy(c);run=saved;}
}
#ifdef FXG_FIXTURE
static void fault_cases(void){CTX *c;FXG_DWORD before;
 test_name="DWM initial read failure";c=make(0,1);failGet=1;c->expected_cloak=0;start(c);released(c);CHECK(!readyStats->active);destroy(c);
 test_name="DWM acquire failure";c=make(0,1);failOn=1;c->expected_cloak=0;start(c);released(c);CHECK(!readyStats->active);destroy(c);
 test_name="DWM release retry";c=make(0,1);start(c);loaded(c,1);failOff=1;before=readyStats->releaseFailed;evaluate(c,2);CHECK(readyStats->releaseFailed>=before+1);evaluate(c,1);released(c);destroy(c);
 test_name="redraw failure fail open";c=make(0,1);start(c);loaded(c,1);failRedraw=1;before=readyStats->redrawFailed;evaluate(c,2);released(c);CHECK(readyStats->redrawFailed>=before+1);destroy(c);
 test_name="async redraw SEH contained";c=make(0,1);start(c);loaded(c,1);throwRedraw=1;before=readyStats->callbackExceptions;evaluate(c,2);released(c);CHECK(readyStats->callbackExceptions>=before+1);destroy(c);
 test_name="snapshot SEH contained";c=make(0,1);loaded(c,1);start(c);throwSnapshot=1;before=readyStats->callbackExceptions;drain();pump_for(FX_READY_INTERVAL*3);released(c);CHECK(readyStats->callbackExceptions>=before+1);destroy(c);
 test_name="clock rollover timeout";tick=0xfffffff0UL;c=make(0,1);start(c);tick+=FX_READY_TIMEOUT+1;evaluate(c,1);released(c);destroy(c);
}
#endif
static int verify(void){WC wc;int i;unsigned int j;void *module=0,*comctl;const WCH *names[10]={compose,other,editorClass,hostClass,browserClass,widgetClass,renderClass,(const WCH *)L"TFoxMainFrm.UnicodeClass",(const WCH *)L"TOptionForm.UnicodeClass",(const WCH *)L"TPrintPreviewForm.UnicodeClass"};unsigned char *p=(unsigned char *)&wc;for(j=0;j<sizeof(wc);j++)p[j]=0;
 CHECK(sizeof(void *)==4&&sizeof(FX_READY_STATS)==72);instance=GetModuleHandleW(0);comctl=LoadLibraryExW((const WCH *)L"comctl32.dll",0,0x800);CHECK(comctl);if(!comctl)return 2;
 readyMessage=RegisterWindowMessageW((const WCH *)FX_READY_MESSAGE_NAME);CHECK(readyMessage>=0xc000);wc.proc=window_proc;wc.instance=instance;wc.brush=(void *)6;for(i=0;i<10;i++){wc.name=names[i];CHECK(RegisterClassW(&wc));}
 if(!prepare_objects())return 2;
#ifdef FXG_PRODUCTION
 {WCH path[1024];FXG_DWORD n=GetModuleFileNameW(0,path,1024);const WCH *suffix=(const WCH *)L"FoxmailRevealGate.dll";CHECK(n&&n<990);while(n&&path[n-1]!='\\')n--;for(j=0;suffix[j];j++)path[n+j]=suffix[j];path[n+j]=0;module=LoadLibraryExW(path,0,0x900);CHECK(module);if(!module)return 2;run=(RUN)GetProcAddress(module,"FxComposeGateRun");mainRun=(RUN)GetProcAddress(module,"FxGateRun");coldRun=(RUN)GetProcAddress(module,"FxColdRun");settingsRun=(RUN)GetProcAddress(module,"FxSettingsGateRun");printRun=(RUN)GetProcAddress(module,"FxPrintGateRun");readyStats=(FX_READY_STATS *)GetProcAddress(module,"FxComposeReadyStats");CHECK(mainRun&&coldRun&&settingsRun&&printRun&&GetProcAddress(module,"FxProxyGateRun"));}
#else
 run=FxComposeGateRun;mainRun=FxGateRun;coldRun=FxColdRun;settingsRun=FxSettingsGateRun;printRun=FxPrintGateRun;readyStats=&FxComposeReadyStats;
#endif
 CHECK(run&&readyStats&&readyStats->size==72&&readyStats->version==1);if(!run||!readyStats)return 2;
#ifdef FXG_FIXTURE
 {CTX *c;test_name="pin failure stays synchronous";c=make(0,1);failPin=1;start(c);released(c);CHECK(readyStats->active==0);destroy(c);}
#endif
 common_cases();
#ifdef FXG_FIXTURE
 fault_cases();
#endif
 CHECK(readyStats->active==0);for(i=0;i<20;i++)destroy(&contexts[i]);drain();if(objectAtom)GlobalDeleteAtom(objectAtom);
 if(module){FreeLibrary(module);CHECK(GetModuleHandleW((const WCH *)L"FoxmailRevealGate.dll")==module);}FreeLibrary(comctl);printf("%s async-ready %s: checks=%d failures=%d; own native windows/synthetic state only\n",failures?"FAIL":"PASS",
#ifdef FXG_PRODUCTION
 "production DLL"
#else
 "seam fixture"
#endif
 ,checks,failures);return failures?1:0;}
void __cdecl FxReadyFixtureEntry(void){int result=verify();fflush(0);ExitProcess((FXG_DWORD)result);}
