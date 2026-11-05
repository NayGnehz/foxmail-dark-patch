/*
 * Disposable own-window fixture for foxmail_reveal_gate.c.
 * Compile BOTH C files for MSVC-compatible x86 with /DFXG_FIXTURE; link
 * kernel32, user32, dwmapi and the compiler's x86 SEH/CRT support.
 * No Foxmail process, executable, IAT, styles or settings are touched.
 * The exact target class belongs to THIS process, on THIS fixture thread.
 * Offscreen windows exercise actual DWM and synchronous parent/child redraw.
 * This checks mechanism semantics, not first-complete-frame efficacy or routing.
 */
#include "foxmail_reveal_gate.h"
#define IMP __declspec(dllimport)
typedef long HR;
typedef unsigned short WCH;
typedef long (__stdcall *WNDPROC)(FXG_HWND, unsigned int, unsigned int, long);
typedef struct WC {
    unsigned int style;
    WNDPROC proc;
    int class_extra, window_extra;
    void *instance, *icon, *cursor, *background;
    const WCH *menu, *name;
} WC;
IMP FXG_DWORD __stdcall GetLastError(void);
IMP void __stdcall SetLastError(FXG_DWORD);
IMP void *__stdcall GetModuleHandleW(const WCH *);
IMP unsigned short __stdcall RegisterClassW(const WC *);
IMP int __stdcall UnregisterClassW(const WCH *, void *);
IMP FXG_HWND __stdcall CreateWindowExW(FXG_DWORD, const WCH *, const WCH *, FXG_DWORD,
    int, int, int, int, FXG_HWND, void *, void *, void *);
IMP long __stdcall DefWindowProcW(FXG_HWND, unsigned int, unsigned int, long);
IMP int __stdcall ShowWindow(FXG_HWND, int);
IMP int __stdcall DestroyWindow(FXG_HWND);
IMP int __stdcall IsWindow(FXG_HWND);
IMP int __stdcall IsWindowVisible(FXG_HWND);
IMP int __stdcall IsIconic(FXG_HWND);
IMP void *__stdcall GetPropW(FXG_HWND, const WCH *);
IMP int __stdcall SetPropW(FXG_HWND, const WCH *, void *);
IMP void *__stdcall RemovePropW(FXG_HWND, const WCH *);
IMP HR __stdcall DwmGetWindowAttribute(FXG_HWND, FXG_DWORD, void *, FXG_DWORD);
IMP HR __stdcall DwmSetWindowAttribute(FXG_HWND, FXG_DWORD, const void *, FXG_DWORD);
IMP int __stdcall RedrawWindow(FXG_HWND, const void *, void *, unsigned int);
IMP void __stdcall RaiseException(FXG_DWORD, FXG_DWORD, FXG_DWORD, const unsigned int *);
unsigned long __cdecl _exception_code(void);
#pragma intrinsic(_exception_code)
int __cdecl printf(const char *, ...);
int __cdecl fflush(void *);
IMP void __stdcall ExitProcess(FXG_DWORD);

static const WCH *const CLASS_NAME = (const WCH *)L"TFoxMainFrm.UnicodeClass";
static const WCH *const IDENTITY = (const WCH *)L"FxRevealGate.Identity.43E5CD38.v1";
static const WCH *const OWNER = (const WCH *)L"FxRevealGate.Owner.43E5CD38.v1";
#define IN_ERROR 0x13572468UL
#define OUT_ERROR 0x24681357UL
#define PAINT_ERROR 0x1122eeffUL
#define ORIGINAL_EXCEPTION 0xe04f0001UL
#define PAINT_EXCEPTION 0xe04f0002UL
#define E_FAIL ((HR)0x80004005UL)
static int failures, checks, paint_count;
static const char *test_name = "startup";
#define CHECK(expr) do { ++checks; if (!(expr)) { ++failures; \
    printf("FAIL [%s] line %d: %s\n", test_name, __LINE__, #expr); } } while (0)
static int get_calls, set_on_calls, set_off_calls, redraw_calls;
static int fail_get_at, fail_set_on, fail_set_off, fail_redraw, throw_redraw;
static unsigned int last_redraw_flags;

static void reset_seams(void) {
    get_calls = set_on_calls = set_off_calls = redraw_calls = 0;
    fail_get_at = fail_set_on = fail_set_off = fail_redraw = throw_redraw = 0;
    last_redraw_flags = 0;
}
HR __stdcall FxFixtureDwmGet(FXG_HWND h, FXG_DWORD attr, void *out, FXG_DWORD bytes) {
    ++get_calls;
    if (fail_get_at && get_calls == fail_get_at) return E_FAIL;
    return DwmGetWindowAttribute(h, attr, out, bytes);
}
HR __stdcall FxFixtureDwmSet(FXG_HWND h, FXG_DWORD attr, const void *in, FXG_DWORD bytes) {
    if (attr == 13 && *(const int *)in) {
        ++set_on_calls;
        if (fail_set_on) { --fail_set_on; return E_FAIL; }
    } else if (attr == 13) {
        ++set_off_calls;
        if (fail_set_off) { --fail_set_off; return E_FAIL; }
    }
    return DwmSetWindowAttribute(h, attr, in, bytes);
}
int __stdcall FxFixtureRedraw(FXG_HWND h, const void *r, void *region, unsigned int flags) {
    ++redraw_calls;
    last_redraw_flags = flags;
    if (throw_redraw) {
        --throw_redraw;
        SetLastError(PAINT_ERROR);
        RaiseException(PAINT_EXCEPTION, 0, 0, 0);
    }
    if (fail_redraw) { --fail_redraw; return 0; }
    return RedrawWindow(h, r, region, flags);
}
static long __stdcall window_proc(FXG_HWND h, unsigned int msg, unsigned int wp, long lp) {
    if (msg == 0x000f) ++paint_count;
    return DefWindowProcW(h, msg, wp, lp);
}
static FXG_DWORD raw_cloak(FXG_HWND h) {
    FXG_DWORD cloak = 0xffffffffUL;
    if (DwmGetWindowAttribute(h, 14, &cloak, sizeof(cloak)) < 0) return 0xffffffffUL;
    return cloak;
}
static FXG_STATS stats(void) {
    FXG_STATS s;
    CHECK(FxGateGetStats(&s, sizeof(s)));
    CHECK(s.size == sizeof(s) && s.version == 1);
    return s;
}
enum ACTION { NONE, SHOW, HIDE, DESTROY, REPLACE_IDENTITY, NESTED, THROW_ORIGINAL };
typedef struct CTX {
    FXG_HWND hwnd;
    enum ACTION action;
    FXG_DWORD incoming, outgoing, result;
    int calls, incoming_ok;
    FXG_DWORD seen_cloak, after_nested_cloak;
    struct CTX *nested;
} CTX;
static CTX context(FXG_HWND hwnd, enum ACTION action) {
    CTX c = {0};
    c.hwnd = hwnd; c.action = action;
    c.incoming = IN_ERROR; c.outgoing = OUT_ERROR; c.result = 0xabcddcbaUL;
    c.seen_cloak = c.after_nested_cloak = 0xffffffffUL;
    return c;
}
static FXG_DWORD __stdcall original(void *opaque) {
    CTX *c = (CTX *)opaque;
    FXG_DWORD incoming = GetLastError();
    ++c->calls;
    c->incoming_ok = incoming == c->incoming;
    c->seen_cloak = raw_cloak(c->hwnd);
    switch (c->action) {
    case SHOW: ShowWindow(c->hwnd, 4); break;
    case HIDE: ShowWindow(c->hwnd, 0); break;
    case DESTROY: DestroyWindow(c->hwnd); break;
    case REPLACE_IDENTITY:
        CHECK(RemovePropW(c->hwnd, IDENTITY) != 0);
        CHECK(SetPropW(c->hwnd, IDENTITY, (void *)0xfffffff0UL));
        ShowWindow(c->hwnd, 4);
        break;
    case NESTED:
        ShowWindow(c->hwnd, 4);
        SetLastError(c->nested->incoming);
        CHECK(FxGateRun(c->hwnd, original, c->nested) == c->nested->result);
        CHECK(GetLastError() == c->nested->outgoing);
        c->after_nested_cloak = raw_cloak(c->hwnd);
        break;
    case THROW_ORIGINAL:
        SetLastError(c->outgoing);
        RaiseException(ORIGINAL_EXCEPTION, 0, 0, 0);
        break;
    default: break;
    }
    SetLastError(c->outgoing);
    return c->result;
}
static void invoke_normal(CTX *c) {
    FXG_DWORD result, outgoing;
    SetLastError(c->incoming);
    result = FxGateRun(c->hwnd, original, c);
    outgoing = GetLastError();
    CHECK(result == c->result);
    CHECK(outgoing == c->outgoing);
    CHECK(c->calls == 1 && c->incoming_ok);
}
static void assert_released(FXG_HWND h) {
    CHECK(raw_cloak(h) == 0);
    CHECK(GetPropW(h, OWNER) == 0);
    CHECK(stats().pending_recovery == 0);
}
static FXG_HWND new_window(void) {
    FXG_HWND h = CreateWindowExW(0, CLASS_NAME, (const WCH *)L"Disposable reveal gate fixture",
        0x00cf0000UL, -24000, -24000, 260, 180, 0, 0, GetModuleHandleW(0), 0);
    CHECK(h != 0);
    if (h) {
        FXG_HWND child = CreateWindowExW(0, (const WCH *)L"STATIC", (const WCH *)L"fixture child",
            0x50000000UL, 8, 8, 120, 30, h, 0, GetModuleHandleW(0), 0);
        CHECK(child != 0);
    }
    return h;
}
static FXG_HWND armed_window(void) {
    FXG_HWND h = new_window();
    CTX c = context(h, SHOW);
    reset_seams();
    invoke_normal(&c);
    CHECK(c.seen_cloak == 0 && set_on_calls == 0 && redraw_calls == 0);
    CHECK(GetPropW(h, IDENTITY) != 0);
    ShowWindow(h, 0);
    CHECK(!IsWindowVisible(h));
    reset_seams();
    return h;
}
static void destroy_test_window(FXG_HWND h) {
    if (h && IsWindow(h)) CHECK(DestroyWindow(h));
}
static void test_cold_and_visible(void) {
    FXG_HWND h;
    CTX c;
    test_name = "cold unknown hidden / cold show / ordinary visible";
    h = new_window();
    reset_seams();
    c = context(h, NONE); invoke_normal(&c);
    CHECK(!GetPropW(h, IDENTITY) && !set_on_calls && !redraw_calls);
    c = context(h, SHOW); invoke_normal(&c);
    CHECK(GetPropW(h, IDENTITY) && !set_on_calls && !redraw_calls);
    c = context(h, NONE); invoke_normal(&c);
    CHECK(c.seen_cloak == 0 && !set_on_calls && !redraw_calls);
    assert_released(h);
    destroy_test_window(h);
}
static void test_restore_and_zero(void) {
    FXG_HWND h;
    CTX c;
    int before_paint;
    test_name = "known hidden restore / result zero and last-error zero";
    h = armed_window();
    c = context(h, SHOW); c.result = 0; c.outgoing = 0;
    before_paint = paint_count;
    invoke_normal(&c);
    CHECK(c.seen_cloak == 1);
    CHECK(set_on_calls == 1 && set_off_calls == 1 && redraw_calls == 1);
    CHECK(last_redraw_flags == 0x181 && paint_count > before_paint);
    CHECK(IsWindowVisible(h) && !IsIconic(h));
    assert_released(h);
    destroy_test_window(h);
}
static void test_iconic_restore(void) {
    FXG_HWND h;
    CTX c;
    test_name = "known visible iconic restore";
    h = armed_window();
    ShowWindow(h, 7); /* SW_SHOWMINNOACTIVE: fixture window only. */
    CHECK(IsWindowVisible(h) && IsIconic(h));
    reset_seams();
    c = context(h, SHOW); invoke_normal(&c);
    CHECK(c.seen_cloak == 1 && set_on_calls == 1 && set_off_calls == 1);
    CHECK(redraw_calls == 1 && IsWindowVisible(h) && !IsIconic(h));
    assert_released(h);
    destroy_test_window(h);
}
static void test_nested_and_hide(void) {
    FXG_HWND h;
    CTX c, n;
    FXG_STATS before, after;
    test_name = "nested restore shares outer cloak / nested hide skips redraw";
    h = armed_window();
    before = stats();
    n = context(h, NONE); c = context(h, NESTED); c.nested = &n;
    invoke_normal(&c);
    after = stats();
    CHECK(n.calls == 1 && n.incoming_ok && n.seen_cloak == 1);
    CHECK(c.after_nested_cloak == 1 && set_on_calls == 1 && set_off_calls == 1);
    CHECK(redraw_calls == 1 && after.nested_bypasses == before.nested_bypasses + 1);
    assert_released(h);
    ShowWindow(h, 0); reset_seams();
    n = context(h, HIDE); c = context(h, NESTED); c.nested = &n;
    invoke_normal(&c);
    CHECK(n.calls == 1 && n.seen_cloak == 1 && c.after_nested_cloak == 1);
    CHECK(!IsWindowVisible(h) && redraw_calls == 0 && set_off_calls == 1);
    assert_released(h);
    destroy_test_window(h);
}
static void test_hide_and_destroy(void) {
    FXG_HWND h, replacement;
    CTX c;
    test_name = "original leaves hidden / destroys HWND / new lifetime cold";
    h = armed_window();
    c = context(h, HIDE); invoke_normal(&c);
    CHECK(c.seen_cloak == 1 && !redraw_calls && !IsWindowVisible(h));
    assert_released(h);
    reset_seams(); c = context(h, DESTROY); invoke_normal(&c);
    CHECK(c.seen_cloak == 1 && !IsWindow(h) && !redraw_calls);
    CHECK(stats().pending_recovery == 0 && set_off_calls == 0);
    replacement = new_window(); reset_seams();
    c = context(replacement, SHOW); invoke_normal(&c);
    CHECK(c.seen_cloak == 0 && !set_on_calls && !redraw_calls);
    assert_released(replacement);
    destroy_test_window(replacement);
}
static void test_identity_replaced(void) {
    FXG_HWND h;
    CTX c;
    int no = 0;
    FXG_STATS before, after;
    test_name = "identity token replaced: do not clear unowned generation";
    h = armed_window(); before = stats();
    c = context(h, REPLACE_IDENTITY); invoke_normal(&c);
    after = stats();
    CHECK(c.seen_cloak == 1 && raw_cloak(h) == 1);
    CHECK(!redraw_calls && !set_off_calls);
    CHECK(after.retired_identities == before.retired_identities + 1);
    CHECK(after.pending_recovery == 0);
    /* Fixture deliberately revoked ownership identity without destroying HWND.
     * The helper MUST NOT clear that window. Fixture owns and releases this
     * synthetic leftover itself; this is NOT a no-leftover safety success. */
    CHECK(DwmSetWindowAttribute(h, 13, &no, sizeof(no)) >= 0);
    RemovePropW(h, OWNER);
    CHECK(raw_cloak(h) == 0);
    destroy_test_window(h);
}
static void test_precloaked(void) {
    FXG_HWND h;
    CTX c;
    int yes = 1, no = 0;
    test_name = "preexisting app cloak remains untouched";
    h = armed_window();
    CHECK(DwmSetWindowAttribute(h, 13, &yes, sizeof(yes)) >= 0);
    c = context(h, SHOW); invoke_normal(&c);
    CHECK(c.seen_cloak == 1 && raw_cloak(h) == 1);
    CHECK(!set_on_calls && !set_off_calls && !redraw_calls && !GetPropW(h, OWNER));
    CHECK(DwmSetWindowAttribute(h, 13, &no, sizeof(no)) >= 0);
    assert_released(h);
    destroy_test_window(h);
}
static void test_failures(void) {
    FXG_HWND h;
    CTX c;
    int mode;
    for (mode = 0; mode < 4; ++mode) {
        test_name = mode == 0 ? "DWM prestate getter fails" : mode == 1 ? "DWM cloak setter fails" :
            mode == 2 ? "DWM acquisition readback fails" : "RedrawWindow returns FALSE";
        h = armed_window();
        if (mode == 0) fail_get_at = 1;
        if (mode == 1) fail_set_on = 1;
        if (mode == 2) fail_get_at = 2;
        if (mode == 3) fail_redraw = 1;
        c = context(h, SHOW); invoke_normal(&c);
        CHECK(c.seen_cloak == (mode == 3 ? 1UL : 0UL));
        CHECK(redraw_calls == (mode == 3 ? 1 : 0));
        if (mode == 0) CHECK(!set_on_calls && !set_off_calls);
        if (mode == 1) CHECK(set_on_calls == 1 && !set_off_calls);
        if (mode == 2) CHECK(set_on_calls == 1 && set_off_calls == 1);
        if (mode == 3) CHECK(set_on_calls == 1 && set_off_calls == 1);
        assert_released(h);
        destroy_test_window(h);
    }
}
static void test_uncloak_recovery(void) {
    FXG_HWND h;
    CTX c;
    FXG_STATS before, after;
    test_name = "uncloak HRESULT failure retains property and retries next call";
    h = armed_window(); before = stats();
    fail_set_off = 1;
    c = context(h, SHOW); invoke_normal(&c);
    after = stats();
    CHECK(raw_cloak(h) == 1 && GetPropW(h, OWNER) != 0);
    CHECK(after.pending_recovery == 1 && after.release_failures == before.release_failures + 1);
    CHECK(set_off_calls == 1);
    reset_seams(); c = context(h, NONE); invoke_normal(&c);
    CHECK(c.seen_cloak == 0 && !set_on_calls && set_off_calls == 1 && !redraw_calls);
    CHECK(stats().recovery_attempts == after.recovery_attempts + 1);
    assert_released(h);
    destroy_test_window(h);
}
static void test_seh(int paint) {
    FXG_HWND h;
    CTX c;
    volatile FXG_DWORD caught_code = 0, caught_error = 0;
    FXG_STATS before, after;
    test_name = paint ? "paint SEH propagates and finally releases / busy resets" :
        "original SEH propagates and finally releases / busy resets";
    h = armed_window(); before = stats();
    c = context(h, paint ? SHOW : THROW_ORIGINAL);
    if (paint) throw_redraw = 1;
    SetLastError(c.incoming);
    __try {
        FxGateRun(h, original, &c);
        CHECK(0); /* SEH must propagate, not become a return value. */
    } __except ((caught_code = _exception_code()), 1) {
        caught_error = GetLastError();
    }
    CHECK(caught_code == (paint ? PAINT_EXCEPTION : ORIGINAL_EXCEPTION));
    CHECK(caught_error == c.outgoing);
    CHECK(c.calls == 1 && c.incoming_ok && c.seen_cloak == 1);
    CHECK(set_off_calls == 1 && redraw_calls == (paint ? 1 : 0));
    after = stats();
    CHECK(after.unwinds == before.unwinds + 1);
    assert_released(h);
    ShowWindow(h, 0); reset_seams();
    c = context(h, SHOW); invoke_normal(&c);
    CHECK(c.seen_cloak == 1 && set_on_calls == 1 && set_off_calls == 1 && redraw_calls == 1);
    assert_released(h);
    destroy_test_window(h);
}
static int native_dwm_available(void) {
    FXG_HWND h = new_window();
    int yes = 1, no = 0, available = 0;
    if (h && raw_cloak(h) == 0 && DwmSetWindowAttribute(h, 13, &yes, sizeof(yes)) >= 0) {
        available = raw_cloak(h) == 1;
        if (DwmSetWindowAttribute(h, 13, &no, sizeof(no)) < 0) available = 0;
        if (raw_cloak(h) != 0) available = 0;
    }
    destroy_test_window(h);
    return available;
}
int main(void) {
    WC wc = {0};
    FXG_STATS final;
    void *instance = GetModuleHandleW(0);
    wc.proc = window_proc; wc.instance = instance;
    wc.background = (void *)6; wc.name = CLASS_NAME;
    if (!RegisterClassW(&wc)) {
        printf("FAIL: cannot register own exact-class fixture window, error=%lu\n", GetLastError());
        return 2;
    }
    if (!native_dwm_available()) {
        printf("UNSUPPORTED: actual own-window DWM cloak/readback unavailable; fixture not validated.\n");
        UnregisterClassW(CLASS_NAME, instance);
        return 2;
    }
    printf("START: actual DWM available; own-window fixture running.\n"); fflush(0);
    test_cold_and_visible();
    test_restore_and_zero();
    test_iconic_restore();
    test_nested_and_hide();
    test_hide_and_destroy();
    test_identity_replaced();
    test_precloaked();
    test_failures();
    test_uncloak_recovery();
    printf("TRACE: entering original SEH test; failures so far=%d\n", failures); fflush(0);
    test_seh(0);
    printf("TRACE: entering paint SEH test; failures so far=%d\n", failures); fflush(0);
    test_seh(1);
    test_name = "final cleanup and statistics";
    final = stats();
    CHECK(final.calls == final.invocations);
    CHECK(final.pending_recovery == 0);
    CHECK(final.acquired >= 10 && final.redraw_failures >= 1 && final.unwinds == 2);
    CHECK(UnregisterClassW(CLASS_NAME, instance));
    printf("%s: %d checks, %d failures; calls=%lu original=%lu acquired=%lu redraw=%lu "
        "released=%lu releaseFailures=%lu recovery=%lu retired=%lu unwinds=%lu pending=%lu\n",
        failures ? "FAIL" : "PASS", checks, failures, final.calls, final.invocations,
        final.acquired, final.redraws, final.released, final.release_failures,
        final.recovery_attempts, final.retired_identities, final.unwinds, final.pending_recovery);
    printf("Scope: own offscreen fixture only. No Foxmail patch, route proof, first-frame proof, "
        "watchdog or hang bound. ABI/register bridge is tested separately.\n");
    return failures ? 1 : 0;
}



/* The fixture links without CRT startup. Explicit exit flushes test diagnostics
 * and preserves main's result rather than relying on PE entry-return behavior. */
void __cdecl FxFixtureEntry(void) {
    int code = main();
    fflush(0);
    ExitProcess((FXG_DWORD)code);
}
