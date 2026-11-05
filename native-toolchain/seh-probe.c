volatile int probe_cleanup;
__declspec(dllexport) int probe(void (*callback)(void)) {
 __try { callback(); } __finally { probe_cleanup=1; }
 return probe_cleanup;
}
