#ifndef FOXMAIL_REVEAL_GATE_H
#define FOXMAIL_REVEAL_GATE_H
/* SDK-independent x86 Windows ABI. Include this header in native fixtures. */
#if !defined(_WIN32) || !defined(_M_IX86)
#error This fixture helper requires the MSVC-compatible Windows x86 target.
#endif
#define FXG_EXPORT __declspec(dllexport)
typedef unsigned long FXG_DWORD;
typedef void *FXG_HWND;
typedef FXG_DWORD (__stdcall *FXG_INVOKE)(void *context);
typedef struct FXG_STATS {
    FXG_DWORD size;
    FXG_DWORD version;
    FXG_DWORD calls;
    FXG_DWORD invocations;
    FXG_DWORD nested_bypasses;
    FXG_DWORD cold_bypasses;
    FXG_DWORD eligible;
    FXG_DWORD acquired;
    FXG_DWORD redraws;
    FXG_DWORD redraw_failures;
    FXG_DWORD released;
    FXG_DWORD release_failures;
    FXG_DWORD recovery_attempts;
    FXG_DWORD retired_identities;
    FXG_DWORD lifetimes_marked;
    FXG_DWORD unwinds;
    FXG_DWORD pending_recovery;
} FXG_STATS;
FXG_EXPORT FXG_DWORD __stdcall FxGateRun(FXG_HWND hwnd, FXG_INVOKE invoke, void *context);
/* Nontransactional per-counter snapshot; preserves caller last-error. */
FXG_EXPORT int __stdcall FxGateGetStats(FXG_STATS *out, FXG_DWORD bytes);
#endif
