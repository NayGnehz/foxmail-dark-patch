/* Production-DLL cross-module SEH check. Own offscreen windows only. */
#include "foxmail_reveal_gate.h"
#define IMP __declspec(dllimport)
typedef unsigned short WCH;
typedef long (__stdcall *WNDPROC)(FXG_HWND,unsigned int,unsigned int,long);
typedef struct WC { unsigned int style; WNDPROC proc; int ce,we; void *instance,*icon,*cursor,*background; const WCH *menu,*name; } WC;
IMP void *__stdcall GetModuleHandleW(const WCH *);
IMP void *__stdcall LoadLibraryExW(const WCH *,void *,FXG_DWORD);
IMP void *__stdcall GetProcAddress(void *,const char *);
IMP int __stdcall FreeLibrary(void *);
IMP FXG_DWORD __stdcall GetLastError(void);
IMP void __stdcall SetLastError(FXG_DWORD);
IMP void __stdcall ExitProcess(FXG_DWORD);
IMP void __stdcall RaiseException(FXG_DWORD,FXG_DWORD,FXG_DWORD,const unsigned int *);
IMP unsigned short __stdcall RegisterClassW(const WC *);
IMP int __stdcall UnregisterClassW(const WCH *,void *);
IMP FXG_HWND __stdcall CreateWindowExW(FXG_DWORD,const WCH *,const WCH *,FXG_DWORD,int,int,int,int,FXG_HWND,void *,void *,void *);
IMP long __stdcall DefWindowProcW(FXG_HWND,unsigned int,unsigned int,long);
IMP int __stdcall ShowWindow(FXG_HWND,int);
IMP int __stdcall DestroyWindow(FXG_HWND);
IMP void *__stdcall GetPropW(FXG_HWND,const WCH *);
IMP long __stdcall DwmGetWindowAttribute(FXG_HWND,FXG_DWORD,void *,FXG_DWORD);
int __cdecl printf(const char *,...);
int __cdecl fflush(void *);
unsigned long __cdecl _exception_code(void);
#pragma intrinsic(_exception_code)
typedef FXG_DWORD (__stdcall *RUN)(FXG_HWND,FXG_INVOKE,void *);
typedef FXG_DWORD (__stdcall *PROXY_RUN)(FXG_HWND,FXG_HWND,FXG_INVOKE,void *);
typedef int (__stdcall *STATS)(FXG_STATS *,FXG_DWORD);
#define IN_ERR 0x123aaUL
#define OUT_ERR 0x234bbUL
#define TEST_EXCEPTION 0xe04f00aaUL
static int checks,failures,calls;
static const WCH *const CLASS_NAME=(const WCH *)L"TFoxMainFrm.UnicodeClass";
#define CHECK(x) do { ++checks; if(!(x)) { ++failures; printf("FAIL line %d: %s\n",__LINE__,#x); fflush(0); } } while(0)
static FXG_DWORD cloak(FXG_HWND hwnd) {
 FXG_DWORD value=0xffffffffUL;
 if(DwmGetWindowAttribute(hwnd,14,&value,sizeof(value))<0) return 0xffffffffUL;
 return value;
}
static long __stdcall window_proc(FXG_HWND h,unsigned int msg,unsigned int wp,long lp) { return DefWindowProcW(h,msg,wp,lp); }
typedef struct CONTEXT { FXG_HWND hwnd,proxy_hwnd,settings_hwnd; int fault; FXG_DWORD expected_cloak; } CONTEXT;
static FXG_DWORD __stdcall callback(void *opaque) {
 CONTEXT *c=(CONTEXT *)opaque;
 FXG_DWORD incoming=GetLastError();
 ++calls;
 CHECK(incoming==IN_ERR);
 CHECK(cloak(c->hwnd)==c->expected_cloak);
 if(c->fault) { SetLastError(OUT_ERR); RaiseException(TEST_EXCEPTION,0,0,0); }
 else ShowWindow(c->hwnd,4);
 SetLastError(OUT_ERR);
 return 0; /* A legitimate original zero return, not a failure indication. */
}
static void normal(RUN run,CONTEXT *c) {
 FXG_DWORD result,error;
 SetLastError(IN_ERR);
 result=run(c->hwnd,callback,c);
 error=GetLastError();
 CHECK(result==0 && error==OUT_ERR);
 CHECK(cloak(c->hwnd)==0);
 CHECK(!GetPropW(c->hwnd,(const WCH *)L"FxRevealGate.Owner.43E5CD38.v2"));
}
static int verify(void) {
 void *module,*instance=GetModuleHandleW(0);
 RUN run,settings_run;
 PROXY_RUN proxy_run;
 FXG_ROUTE_STATS *routes;
 STATS get_stats;
 FXG_STATS *direct,s;
 FXG_HWND hwnd,proxy_hwnd,settings_hwnd;
 WC wc={0};
 CONTEXT c;
 volatile FXG_DWORD caught=0,error=0;
 module=LoadLibraryExW((const WCH *)L"D:\\Workspace\\Foxmail\\reveal-gate-v2\\FoxmailRevealGate.dll",0,0xa00);
 CHECK(module!=0);
 if(!module) return 2;
 run=(RUN)GetProcAddress(module,"FxGateRun");
 get_stats=(STATS)GetProcAddress(module,"FxGateGetStats");
 direct=(FXG_STATS *)GetProcAddress(module,"FxGateStats");
 proxy_run=(PROXY_RUN)GetProcAddress(module,"FxProxyGateRun");
 settings_run=(RUN)GetProcAddress(module,"FxSettingsGateRun");
 routes=(FXG_ROUTE_STATS *)GetProcAddress(module,"FxGateRouteStats");
 CHECK(proxy_run && settings_run && routes);
 CHECK(run && get_stats && direct);
 if(!run || !get_stats || !direct || !proxy_run || !settings_run || !routes) { FreeLibrary(module); return 2; }
 CHECK(get_stats(&s,sizeof(s)) && s.calls==0 && s.pending_recovery==0);
 wc.proc=window_proc; wc.instance=instance; wc.background=(void *)6; wc.name=CLASS_NAME;
 CHECK(RegisterClassW(&wc)!=0);
 wc.name=(const WCH *)L"TApplication"; CHECK(RegisterClassW(&wc));
 wc.name=(const WCH *)L"TOptionForm.UnicodeClass"; CHECK(RegisterClassW(&wc));
 hwnd=CreateWindowExW(0,CLASS_NAME,(const WCH *)L"Production DLL own-window check",0x00cf0000UL,-24000,-24000,220,160,0,0,instance,0);
 CHECK(hwnd!=0);
 if(!hwnd) { UnregisterClassW(CLASS_NAME,instance); FreeLibrary(module); return 2; }
 CHECK(cloak(hwnd)==0);
 c.hwnd=hwnd; c.fault=0; c.expected_cloak=0;
 normal(run,&c);
 CHECK(GetPropW(hwnd,(const WCH *)L"FxRevealGate.Identity.43E5CD38.v2")!=0);
 CHECK(get_stats(&s,sizeof(s)) && s.acquired==0 && s.invocations==1);
 ShowWindow(hwnd,0); c.expected_cloak=1;
 normal(run,&c);
 CHECK(get_stats(&s,sizeof(s)) && s.acquired==1 && s.released==1 && s.redraws==1);
 ShowWindow(hwnd,0); c.fault=1;
 printf("TRACE: production DLL original SEH across native module boundary\n"); fflush(0);
 SetLastError(IN_ERR);
 __try { run(hwnd,callback,&c); CHECK(0); }
 __except((caught=_exception_code()),1) { error=GetLastError(); }
 CHECK(caught==TEST_EXCEPTION && error==OUT_ERR);
 CHECK(cloak(hwnd)==0);
 CHECK(!GetPropW(hwnd,(const WCH *)L"FxRevealGate.Owner.43E5CD38.v2"));
 CHECK(get_stats(&s,sizeof(s)) && s.calls==3 && s.invocations==3 && s.acquired==2 && s.released==2 && s.unwinds==1 && s.pending_recovery==0);
 c.fault=0; normal(run,&c); /* Proves cross-module unwind reset the busy guard. */
 CHECK(get_stats(&s,sizeof(s)) && s.calls==4 && s.invocations==4 && s.acquired==3 && s.released==3 && s.unwinds==1 && s.pending_recovery==0);
 CHECK(calls==4 && direct->calls==s.calls && direct->unwinds==s.unwinds && direct->pending_recovery==0);
 proxy_hwnd=CreateWindowExW(0,(const WCH *)L"TApplication",(const WCH *)L"V2 own proxy",0x00cf0000UL,-24000,-24000,220,160,0,0,instance,0);
 settings_hwnd=CreateWindowExW(0,(const WCH *)L"TOptionForm.UnicodeClass",(const WCH *)L"V2 own settings",0x00cf0000UL,-24000,-24000,220,160,0,0,instance,0);
 CHECK(proxy_hwnd && settings_hwnd);
 ShowWindow(proxy_hwnd,7);
 SetLastError(IN_ERR);
 CHECK(proxy_run(hwnd,proxy_hwnd,callback,&c)==0);
 CHECK(GetLastError()==OUT_ERR && cloak(hwnd)==0);
 c.fault=1; caught=0; error=0; SetLastError(IN_ERR);
 __try { proxy_run(hwnd,proxy_hwnd,callback,&c); CHECK(0); }
 __except((caught=_exception_code()),1) { error=GetLastError(); }
 CHECK(caught==TEST_EXCEPTION && error==OUT_ERR && cloak(hwnd)==0);
 CHECK(!GetPropW(hwnd,(const WCH *)L"FxRevealGate.Owner.43E5CD38.v2"));
 c.hwnd=settings_hwnd; c.fault=0; c.expected_cloak=1;
 normal(settings_run,&c); /* First existing hidden settings presentation. */
 CHECK(GetPropW(settings_hwnd,(const WCH *)L"FxRevealGate.Identity.43E5CD38.v2"));
 ShowWindow(settings_hwnd,0); c.fault=1; caught=0; error=0; SetLastError(IN_ERR);
 __try { settings_run(settings_hwnd,callback,&c); CHECK(0); }
 __except((caught=_exception_code()),1) { error=GetLastError(); }
 CHECK(caught==TEST_EXCEPTION && error==OUT_ERR && cloak(settings_hwnd)==0);
 CHECK(!GetPropW(settings_hwnd,(const WCH *)L"FxRevealGate.Owner.43E5CD38.v2"));
 c.fault=0; normal(settings_run,&c);
 CHECK(get_stats(&s,sizeof(s)) && s.calls==9 && s.invocations==9 && s.acquired==8 && s.released==8 && s.redraws==5 && s.unwinds==3 && s.pending_recovery==0);
 CHECK(calls==9 && direct->calls==s.calls && direct->unwinds==s.unwinds);
 CHECK(routes->size==40 && routes->version==2 && routes->main_calls==4 && routes->proxy_calls==2 && routes->settings_calls==3);
 CHECK(routes->main_acquired==3 && routes->proxy_acquired==2 && routes->settings_acquired==3);
 CHECK(DestroyWindow(settings_hwnd)); CHECK(DestroyWindow(proxy_hwnd));
 CHECK(UnregisterClassW((const WCH *)L"TOptionForm.UnicodeClass",instance));
 CHECK(UnregisterClassW((const WCH *)L"TApplication",instance));
 CHECK(DestroyWindow(hwnd));
 CHECK(UnregisterClassW(CLASS_NAME,instance));
 CHECK(FreeLibrary(module));
 printf("%s: production DLL %d checks, %d failures; calls=%lu original=%lu acquired=%lu released=%lu redraw=%lu unwinds=%lu pending=%lu\n",failures?"FAIL":"PASS",checks,failures,s.calls,s.invocations,s.acquired,s.released,s.redraws,s.unwinds,s.pending_recovery);
 printf("Scope: own offscreen exact-class HWND and actual production DLL only; no Foxmail launch/install.\n");
 return failures?1:0;
}
void __cdecl ProductionCheckEntry(void) { int code=verify(); fflush(0); ExitProcess((FXG_DWORD)code); }


