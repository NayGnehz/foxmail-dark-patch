/*
 * Disposable native mechanism fixture, NOT a Foxmail patch or approved candidate.
 * Build as C for i686-pc-windows-msvc: real compiler-emitted x86 SEH is required.
 * invoke must be non-NULL and must invoke the coordinator exactly once itself.
 * The caller supplies all coordinator ABI adaptation (including Delphi Self EAX).
 *
 * No asynchronous escape exists: an original or RedrawWindow hang prevents
 * finally from running. Successful synchronous return does not prove complete
 * application initialization, atomic DWM presentation, or visual efficacy.
 */
#include "foxmail_reveal_gate.h"
#define IMP __declspec(dllimport)
typedef long HRESULT;
typedef long LONG;
typedef unsigned short WCH;
IMP FXG_DWORD __stdcall GetLastError(void);
IMP void __stdcall SetLastError(FXG_DWORD);
IMP FXG_DWORD __stdcall GetCurrentProcessId(void);
IMP FXG_DWORD __stdcall GetCurrentThreadId(void);
IMP LONG __stdcall InterlockedCompareExchange(volatile LONG *, LONG, LONG);
IMP LONG __stdcall InterlockedExchange(volatile LONG *, LONG);
IMP LONG __stdcall InterlockedIncrement(volatile LONG *);
IMP int __stdcall IsWindow(FXG_HWND);
IMP int __stdcall IsWindowVisible(FXG_HWND);
IMP int __stdcall IsIconic(FXG_HWND);
IMP FXG_DWORD __stdcall GetWindowThreadProcessId(FXG_HWND, FXG_DWORD *);
IMP int __stdcall GetClassNameW(FXG_HWND, WCH *, int);
IMP LONG __stdcall GetWindowLongW(FXG_HWND, int);
IMP FXG_HWND __stdcall GetAncestor(FXG_HWND, unsigned int);
IMP void *__stdcall GetPropW(FXG_HWND, const WCH *);
IMP int __stdcall SetPropW(FXG_HWND, const WCH *, void *);
IMP void *__stdcall RemovePropW(FXG_HWND, const WCH *);
IMP HRESULT __stdcall DwmGetWindowAttribute(FXG_HWND, FXG_DWORD, void *, FXG_DWORD);
IMP HRESULT __stdcall DwmSetWindowAttribute(FXG_HWND, FXG_DWORD, const void *, FXG_DWORD);
IMP int __stdcall RedrawWindow(FXG_HWND, const void *, void *, unsigned int);

/* Link fixture-provided functions only with /DFXG_FIXTURE. Production defaults
 * call the native APIs directly. Keep fixture failures deterministic: HRESULT
 * failures for DWM; SEH may be raised by invoke or RedrawWindow. */
#ifdef FXG_FIXTURE
HRESULT __stdcall FxFixtureDwmGet(FXG_HWND, FXG_DWORD, void *, FXG_DWORD);
HRESULT __stdcall FxFixtureDwmSet(FXG_HWND, FXG_DWORD, const void *, FXG_DWORD);
int __stdcall FxFixtureRedraw(FXG_HWND, const void *, void *, unsigned int);
#define DWGET FxFixtureDwmGet
#define DWSET FxFixtureDwmSet
#define REDRAW FxFixtureRedraw
#else
#define DWGET DwmGetWindowAttribute
#define DWSET DwmSetWindowAttribute
#define REDRAW RedrawWindow
#endif

static const WCH *const identity_name = (const WCH *)L"FxRevealGate.Identity.43E5CD38.v1";
static const WCH *const owner_name = (const WCH *)L"FxRevealGate.Owner.43E5CD38.v1";
static const WCH *const target_class = (const WCH *)L"TFoxMainFrm.UnicodeClass";
static volatile LONG busy;
static FXG_DWORD sequence;
/* Numeric counters can be read externally without executing a remote function.
 * No pixel samples, window text or mail data are retained. */
FXG_EXPORT FXG_STATS FxGateStats = { sizeof(FXG_STATS), 1 };
#define counters FxGateStats
typedef struct RECOVERY {
    FXG_HWND hwnd;
    void *identity;
    void *owner;
    int owned;
} RECOVERY;
static RECOVERY recovery;
#define INC(field) ((void)InterlockedIncrement((volatile LONG *)&counters.field))

/* Tokens never repeat in this module lifetime; saturation simply bypasses.
 * Windows destroys both properties with the HWND, preventing reuse confusion.
 * All property and recovery mutations are serialized by busy, on the owning
 * window thread; nested invocations only call their supplied original. */
static void *next_token(void) {
    if (sequence == 0xffffffffUL) return 0;
    return (void *)(++sequence);
}
static int matching_window(FXG_HWND hwnd) {
    WCH name[64];
    FXG_DWORD pid = 0;
    FXG_DWORD tid;
    unsigned int i;
    if (!hwnd || !IsWindow(hwnd)) return 0;
    tid = GetWindowThreadProcessId(hwnd, &pid);
    if (pid != GetCurrentProcessId() || tid != GetCurrentThreadId()) return 0;
    if (((FXG_DWORD)GetWindowLongW(hwnd, -16) & 0x40000000UL) != 0) return 0;
    if (GetAncestor(hwnd, 2) != hwnd) return 0;
    if (GetClassNameW(hwnd, name, 64) <= 0) return 0;
    for (i = 0; i < 64; ++i) {
        if (name[i] != target_class[i]) return 0;
        if (!name[i]) return 1;
    }
    return 0;
}
static int same_identity(FXG_HWND hwnd, void *identity) {
    return identity && matching_window(hwnd) && GetPropW(hwnd, identity_name) == identity;
}
static int owns_record(void) {
    return same_identity(recovery.hwnd, recovery.identity) &&
        GetPropW(recovery.hwnd, owner_name) == recovery.owner;
}
static void clear_record(void) {
    recovery.hwnd = 0;
    recovery.identity = 0;
    recovery.owner = 0;
    recovery.owned = 0;
    InterlockedExchange((volatile LONG *)&counters.pending_recovery, 0);
}
/* Only call on the recorded owner thread. Retain token+record on any failed
 * clear/readback; a later same-thread invocation retries before new acquisition.
 * A successful APP-bit clear is sufficient even if SHELL/INHERITED remain. */
static void release_record(void) {
    int no = 0;
    FXG_DWORD cloaked = 0, pid = 0, tid;
    if (!recovery.hwnd) return;
    /* Token checks distinguish a destroyed/reused handle even when the next
     * invocation happens on another UI thread. An intact foreign-thread record
     * stays pending; no DWM mutation or owner-property removal is permitted. */
    if (!IsWindow(recovery.hwnd) ||
        GetPropW(recovery.hwnd, identity_name) != recovery.identity ||
        GetPropW(recovery.hwnd, owner_name) != recovery.owner) {
        INC(retired_identities);
        clear_record();
        return;
    }
    tid = GetWindowThreadProcessId(recovery.hwnd, &pid);
    if (pid != GetCurrentProcessId() || tid != GetCurrentThreadId()) return;
    if (!owns_record()) return;
    if (!recovery.owned) {
        RemovePropW(recovery.hwnd, owner_name);
        clear_record();
        return;
    }
    if (DWSET(recovery.hwnd, 13, &no, sizeof(no)) < 0 ||
        DWGET(recovery.hwnd, 14, &cloaked, sizeof(cloaked)) < 0 || (cloaked & 1)) {
        INC(release_failures);
        InterlockedExchange((volatile LONG *)&counters.pending_recovery, 1);
        return;
    }
    /* Verify again before property removal; DWM seams may be reentrant. */
    if (owns_record()) RemovePropW(recovery.hwnd, owner_name);
    INC(released);
    clear_record();
}
static void mark_completed_lifetime(FXG_HWND hwnd) {
    void *token;
    if (!matching_window(hwnd) || !IsWindowVisible(hwnd) || IsIconic(hwnd)) return;
    if (GetPropW(hwnd, identity_name)) return;
    token = next_token();
    if (token && SetPropW(hwnd, identity_name, token)) INC(lifetimes_marked);
}
static FXG_DWORD call_original(FXG_INVOKE invoke, void *context, FXG_DWORD incoming) {
    INC(invocations);
    SetLastError(incoming);
    return invoke(context);
}
FXG_EXPORT FXG_DWORD __stdcall FxGateRun(FXG_HWND hwnd, FXG_INVOKE invoke, void *context) {
    FXG_DWORD incoming = GetLastError(), outgoing = incoming, result = 0;
    FXG_DWORD cloaked = 0, exstyle;
    void *identity = 0, *owner = 0;
    int yes = 1, eligible = 0, returned = 0, completed = 0;
    INC(calls);
    if (InterlockedCompareExchange(&busy, 1, 0) != 0) {
        INC(nested_bypasses);
        return call_original(invoke, context, incoming);
    }
    __try {
        /* A retained record on another UI thread is left intact; it suppresses
         * acquisition until its own thread next enters. Never cross-thread clear. */
        if (recovery.hwnd) {
            FXG_DWORD pid = 0;
            FXG_DWORD tid = GetWindowThreadProcessId(recovery.hwnd, &pid);
            if (!IsWindow(recovery.hwnd) || !tid ||
                (pid == GetCurrentProcessId() && tid == GetCurrentThreadId())) {
                INC(recovery_attempts);
                release_record();
            }
        }
        if (!recovery.hwnd && matching_window(hwnd)) {
            identity = GetPropW(hwnd, identity_name);
            if (!identity) INC(cold_bypasses);
            exstyle = (FXG_DWORD)GetWindowLongW(hwnd, -20);
            if (identity && (!IsWindowVisible(hwnd) || IsIconic(hwnd)) &&
                !(exstyle & (0x00080000UL | 0x02000000UL)) &&
                !GetPropW(hwnd, owner_name) &&
                DWGET(hwnd, 14, &cloaked, sizeof(cloaked)) >= 0 && !cloaked) {
                owner = next_token();
                eligible = owner != 0;
            }
        }
        __try {
            if (eligible && same_identity(hwnd, identity) && SetPropW(hwnd, owner_name, owner)) {
                INC(eligible);
                recovery.hwnd = hwnd;
                recovery.identity = identity;
                recovery.owner = owner;
                if (DWSET(hwnd, 13, &yes, sizeof(yes)) >= 0) {
                    recovery.owned = 1;
                    InterlockedExchange((volatile LONG *)&counters.pending_recovery, 1);
                    if (owns_record() && DWGET(hwnd, 14, &cloaked, sizeof(cloaked)) >= 0 && cloaked == 1) {
                        INC(acquired);
                    } else {
                        /* Ambiguous readback: immediately try to undo our APP
                         * acquisition, then run original without a paint gate. */
                        release_record();
                        eligible = 0;
                    }
                } else {
                    release_record();
                    eligible = 0;
                }
            } else eligible = 0;
            result = call_original(invoke, context, incoming);
            outgoing = GetLastError();
            returned = 1;
            if (eligible && recovery.owned && owns_record() &&
                IsWindowVisible(hwnd) && !IsIconic(hwnd)) {
                INC(redraws);
                if (!REDRAW(hwnd, 0, 0, 0x181)) INC(redraw_failures);
            }
            mark_completed_lifetime(hwnd);
            completed = 1;
        } __finally {
            /* Capture exception-path last-error before cleanup WinAPI calls.
             * A paint exception retains the successful original's outgoing value. */
            if (!returned) outgoing = GetLastError();
            if (!completed) INC(unwinds);
            release_record();
            SetLastError(outgoing);
        }
    } __finally {
        if (!returned) outgoing = GetLastError();
        InterlockedExchange(&busy, 0);
        SetLastError(outgoing);
    }
    return result;
}
FXG_EXPORT int __stdcall FxGateGetStats(FXG_STATS *out, FXG_DWORD bytes) {
    FXG_DWORD saved = GetLastError();
    unsigned int i;
    if (!out || bytes < sizeof(FXG_STATS)) { SetLastError(saved); return 0; }
    for (i = 0; i < sizeof(FXG_STATS) / sizeof(FXG_DWORD); ++i)
        ((FXG_DWORD *)out)[i] = (FXG_DWORD)InterlockedCompareExchange(
            ((volatile LONG *)&counters) + i, 0, 0);
    out->size = sizeof(FXG_STATS);
    out->version = 1;
    SetLastError(saved);
    return 1;
}

