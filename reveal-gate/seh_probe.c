typedef unsigned long DWORD;
__declspec(dllimport) void __stdcall ExitProcess(DWORD);
int __cdecl printf(const char *, ...);
int __cdecl fflush(void *);
void __cdecl ProbeRaise(void);
volatile int cleaned, caught;
void __cdecl ProbeEntry(void) {
 printf("SEH probe begin\n"); fflush(0);
 __try {
  __try { ProbeRaise(); }
  __finally { cleaned=1; printf("SEH finally executed\n"); fflush(0); }
 } __except(1) { caught=1; printf("SEH except executed\n"); fflush(0); }
 printf("SEH probe cleaned=%d caught=%d\n", cleaned,caught); fflush(0);
 ExitProcess(cleaned && caught ? 0 : 1);
}
