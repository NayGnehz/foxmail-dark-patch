__declspec(dllimport) void __stdcall RaiseException(unsigned long,unsigned long,unsigned long,const unsigned int*);
void __cdecl ProbeRaise(void) { RaiseException(0xe04f00ffUL,0,0,0); }
