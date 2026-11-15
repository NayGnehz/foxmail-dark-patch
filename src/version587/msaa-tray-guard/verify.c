/* Execute the emitted x86 sites and payload in two fixture-owned images.
 * Only the original low/link/cleanup continuations are synthetic.
 */
typedef unsigned long U32;
typedef unsigned char U8;
#define IMP __declspec(dllimport)
typedef int (__stdcall *READ_MEMORY)(void *, const void *, void *, U32, U32 *);
typedef struct SYSTEM_INFO_X86 {
    U32 architecture, pageSize;
    void *minimumAddress, *maximumAddress;
    U32 activeMask, processors, processorType, allocationGranularity;
    unsigned short processorLevel, processorRevision;
} SYSTEM_INFO_X86;
typedef struct MEMORY_INFO_X86 {
    void *base, *allocationBase;
    U32 allocationProtect, regionSize, state, protect, type;
} MEMORY_INFO_X86;
IMP void *__stdcall VirtualAlloc(void *, U32, U32, U32);
IMP int __stdcall VirtualFree(void *, U32, U32);
IMP int __stdcall VirtualProtect(void *, U32, U32, U32 *);
IMP U32 __stdcall VirtualQuery(const void *, MEMORY_INFO_X86 *, U32);
IMP int __stdcall FlushInstructionCache(void *, const void *, U32);
IMP void *__stdcall GetModuleHandleA(const char *);
IMP void *__stdcall GetProcAddress(void *, const char *);
IMP void *__stdcall GetCurrentProcess(void);
IMP U32 __stdcall GetLastError(void);
IMP void __stdcall SetLastError(U32);
IMP void __stdcall GetSystemInfo(SYSTEM_INFO_X86 *);
IMP U32 __stdcall SetErrorMode(U32);
IMP void __stdcall ExitProcess(U32);
IMP int __cdecl printf(const char *, ...);
IMP int __cdecl fflush(void *);
#include "guard-fixture.h"

enum { LOW = 1, LINK, CLEANUP };
enum { GOOD, NULL_ADDRESS, CROSSES_PAGE, NO_ACCESS, GUARD_PAGE, OVERFLOW_ADDRESS };
enum { REAL_PARENT, NULL_PARENT, INACCESSIBLE_PARENT };
enum { RESOLVE, NO_MODULE, NO_PROC };
enum { INDEX = 0, DIRECT_LINK };
enum { ARITH_FLAGS = 0x8d5, DF = 0x400, PRESERVED_FLAGS = 0x602 };
enum { ERROR_SEED = 0x1234abcd, DIRECT_EAX = 0x10293847 };

typedef struct TEST {
    const char *name;
    U32 entry, index, indexSource, linkSource, parent;
    U32 failureHop, resolutionFailure, route;
} TEST;

static const TEST tests[] = {
    {"index zero", INDEX, 0, GOOD, GOOD, REAL_PARENT, 0, RESOLVE, LOW},
    {"index below boundary", INDEX, 999999, GOOD, GOOD, REAL_PARENT, 0, RESOLVE, LOW},
    {"index equal then link", INDEX, 1000000, GOOD, GOOD, REAL_PARENT, 0, RESOLVE, LINK},
    {"index above boundary then link", INDEX, 1000001, GOOD, GOOD, REAL_PARENT, 0, RESOLVE, LINK},
    {"index with signed overflow then link", INDEX, 0x80000000, GOOD, GOOD, REAL_PARENT, 0, RESOLVE, LINK},
    {"max unsigned index then link", INDEX, 0xffffffff, GOOD, GOOD, REAL_PARENT, 0, RESOLVE, LINK},
    {"null index", INDEX, 0, NULL_ADDRESS, GOOD, REAL_PARENT, 0, RESOLVE, CLEANUP},
    {"cross-page index", INDEX, 0, CROSSES_PAGE, GOOD, REAL_PARENT, 0, RESOLVE, CLEANUP},
    {"inaccessible index", INDEX, 0, NO_ACCESS, GOOD, REAL_PARENT, 0, RESOLVE, CLEANUP},
    {"guarded index does not consume guard page", INDEX, 0, GUARD_PAGE, GOOD, REAL_PARENT, 0, RESOLVE, CLEANUP},
    {"direct link ignores EAX and reads unaligned", DIRECT_LINK, 0, GOOD, GOOD, REAL_PARENT, 0, RESOLVE, LINK},
    {"direct link can return null", DIRECT_LINK, 0, GOOD, GOOD, NULL_PARENT, 0, RESOLVE, LINK},
    {"direct link does not dereference parent result", DIRECT_LINK, 0, GOOD, GOOD, INACCESSIBLE_PARENT, 0, RESOLVE, LINK},
    {"direct link null source", DIRECT_LINK, 0, GOOD, NULL_ADDRESS, REAL_PARENT, 0, RESOLVE, CLEANUP},
    {"direct link cross-page source", DIRECT_LINK, 0, GOOD, CROSSES_PAGE, REAL_PARENT, 0, RESOLVE, CLEANUP},
    {"direct link inaccessible source", DIRECT_LINK, 0, GOOD, NO_ACCESS, REAL_PARENT, 0, RESOLVE, CLEANUP},
    {"direct link guarded source preserves guard page", DIRECT_LINK, 0, GOOD, GUARD_PAGE, REAL_PARENT, 0, RESOLVE, CLEANUP},
    {"direct link rejects address wraparound", DIRECT_LINK, 0, GOOD, OVERFLOW_ADDRESS, REAL_PARENT, 0, RESOLVE, CLEANUP},
    {"high index then cross-page link", INDEX, 1000000, GOOD, CROSSES_PAGE, REAL_PARENT, 0, RESOLVE, CLEANUP},
    {"high index then rejects link address wraparound", INDEX, 1000000, GOOD, OVERFLOW_ADDRESS, REAL_PARENT, 0, RESOLVE, CLEANUP},
    {"index missing kernel module", INDEX, 0, GOOD, GOOD, REAL_PARENT, 1, NO_MODULE, CLEANUP},
    {"index missing read export", INDEX, 0, GOOD, GOOD, REAL_PARENT, 1, NO_PROC, CLEANUP},
    {"direct link missing kernel module", DIRECT_LINK, 0, GOOD, GOOD, REAL_PARENT, 1, NO_MODULE, CLEANUP},
    {"direct link missing read export", DIRECT_LINK, 0, GOOD, GOOD, REAL_PARENT, 1, NO_PROC, CLEANUP},
    {"high index then missing link module", INDEX, 1000000, GOOD, GOOD, REAL_PARENT, 2, NO_MODULE, CLEANUP},
    {"high index then missing link export", INDEX, 1000000, GOOD, GOOD, REAL_PARENT, 2, NO_PROC, CLEANUP}
};

static const U32 flagBits[] = {1, 4, 16, 64, 128, 2048, DF};
static const U32 argumentSeed[] = {0x17365912, 0x42eb213d, 0x9a234f15, 0x128594aa, 0x4a875123, 0x2613578c};
static const U32 preservedRegisters[] = {0x11223344, 0x22334455, 0x33445566, 0x44556677, 0x55667788};
static U8 indexNode[64], linkNode[64], frame[32], parent[16];
static U8 *protectedPage, *guardPage;
static void *realKernel, *processHandle;
static READ_MEMORY productionRead;
static const TEST *currentTest;

static void *entry;
static U32 inputEax, inputIndex, inputFlags, cmpFlags, callerStack, afterStack;
static U32 observedPath, observedRegs[8], observedFlags, observedArgs[6];
static U32 moduleCalls, procCalls, processCalls, readCalls, apiErrors;
static struct READ_RESULT { U32 address; int success; } reads[2];

static void write32(U8 *target, U32 value) {
    unsigned int i;
    for (i = 0; i < 4; i++) target[i] = (U8)(value >> (8 * i));
}

static void copyBytes(U8 *to, const U8 *from, U32 length) {
    while (length--) *to++ = *from++;
}

static int sameName(const char *left, const char *right) {
    while (*left && *left == *right) {
        left++;
        right++;
    }
    return *left == *right;
}

static void *__stdcall observedModule(const char *name) {
    void *module = GetModuleHandleA(name);
    moduleCalls++;
    if (module != realKernel || !sameName(name, "kernel32.dll")) apiErrors++;
    SetLastError(0xdead1111);
    return currentTest->failureHop == moduleCalls && currentTest->resolutionFailure == NO_MODULE
        ? 0 : module;
}

static int __stdcall observedRead(void *process, const void *source, void *dest, U32 length, U32 *count) {
    int result;
    U32 call = readCalls++;
    if (process != processHandle || length != 4 || count ||
        (U32)dest < callerStack - 4096 || (U32)dest >= callerStack - 28 || call >= 2) {
        apiErrors++;
        SetLastError(0xdead5555);
        return 0;
    }
    result = productionRead(process, source, dest, length, count);
    reads[call].address = (U32)source;
    reads[call].success = result != 0;
    SetLastError(0xdead4444);
    return result;
}

static void *__stdcall observedProc(void *module, const char *name) {
    void *proc = GetProcAddress(module, name);
    procCalls++;
    if (module != realKernel || proc != (void *)productionRead ||
        !sameName(name, "ReadProcessMemory")) apiErrors++;
    SetLastError(0xdead2222);
    return currentTest->failureHop == moduleCalls && currentTest->resolutionFailure == NO_PROC
        ? 0 : (void *)observedRead;
}

static void *__stdcall observedProcess(void) {
    processCalls++;
    SetLastError(0xdead3333);
    return GetCurrentProcess();
}

/* The continuation records all observable entry state before touching it.
 * RET24 mirrors the original stdcall stack boundary with dummy arguments.
 */
__declspec(naked) static void capture(void) {
    __asm {
        mov dword ptr [observedRegs], eax
        mov dword ptr [observedRegs + 4], ecx
        mov dword ptr [observedRegs + 8], edx
        mov dword ptr [observedRegs + 12], ebx
        mov dword ptr [observedRegs + 16], esi
        mov dword ptr [observedRegs + 20], edi
        mov dword ptr [observedRegs + 24], ebp
        mov dword ptr [observedRegs + 28], esp
        pushfd
        pop dword ptr [observedFlags]
        cld
        lea esi, [esp + 4]
        lea edi, observedArgs
        mov ecx, 6
        rep movsd
        ret 24
    }
}

__declspec(naked) static void low(void) {
    __asm {
        mov dword ptr [observedPath], 1
        jmp capture
    }
}

__declspec(naked) static void linkNext(void) {
    __asm {
        mov dword ptr [observedPath], 2
        jmp capture
    }
}

__declspec(naked) static void cleanup(void) {
    __asm {
        mov dword ptr [observedPath], 3
        jmp capture
    }
}

__declspec(naked) static void run(void) {
    __asm {
        pushad
        pushfd
        mov dword ptr [callerStack], esp
        push dword ptr [argumentSeed + 20]
        push dword ptr [argumentSeed + 16]
        push dword ptr [argumentSeed + 12]
        push dword ptr [argumentSeed + 8]
        push dword ptr [argumentSeed + 4]
        push dword ptr [argumentSeed]
        mov eax, dword ptr [inputIndex]
        cmp eax, 1000000
        pushfd
        pop dword ptr [cmpFlags]
        mov eax, dword ptr [inputEax]
        mov ecx, dword ptr [preservedRegisters]
        mov edx, dword ptr [preservedRegisters + 4]
        mov ebx, dword ptr [preservedRegisters + 8]
        mov esi, dword ptr [preservedRegisters + 12]
        mov edi, dword ptr [preservedRegisters + 16]
        lea ebp, frame + 12
        push dword ptr [inputFlags]
        popfd
        call dword ptr [entry]
        mov dword ptr [afterStack], esp
        mov esp, dword ptr [callerStack]
        popfd
        popad
        ret
    }
}

static void jumpTo(U8 *from, void *to) {
    from[0] = 0xe9;
    write32(from + 1, (U32)to - (U32)from - 5);
}

static int fits(U32 at, U32 length) {
    return at <= FX_IMAGE_SIZE && length <= FX_IMAGE_SIZE - at;
}

static int initializeImage(U8 *image) {
    copyBytes(image + FX_PAYLOAD_RVA, fx_payload, sizeof(fx_payload));
    copyBytes(image + FX_INDEX_RVA, fx_index_site, sizeof(fx_index_site));
    copyBytes(image + FX_LINK_RVA, fx_link_site, sizeof(fx_link_site));
    jumpTo(image + FX_LOW_RVA, low);
    jumpTo(image + FX_LINK_NEXT_RVA, linkNext);
    jumpTo(image + FX_CLEANUP_RVA, cleanup);
    write32(image + FX_GET_MODULE_IAT_RVA, (U32)observedModule);
    write32(image + FX_GET_PROC_IAT_RVA, (U32)observedProc);
    write32(image + FX_GET_CURRENT_PROCESS_IAT_RVA, (U32)observedProcess);
    write32(image + FX_GET_LAST_ERROR_IAT_RVA, (U32)GetLastError);
    write32(image + FX_SET_LAST_ERROR_IAT_RVA, (U32)SetLastError);
    return FlushInstructionCache(processHandle, image, FX_IMAGE_SIZE);
}

static U32 addressFor(U32 source, U8 *normal, U32 offset) {
    switch (source) {
    case NULL_ADDRESS: return 0;
    case CROSSES_PAGE: return (U32)protectedPage - 2 - offset;
    case NO_ACCESS: return (U32)protectedPage - offset;
    case GUARD_PAGE: return (U32)guardPage - offset;
    case OVERFLOW_ADDRESS: return 0xfffffff0;
    default: return (U32)normal;
    }
}

static int checkCase(U8 *image, const TEST *test, U32 pattern) {
    U32 i, lastError, expectedEax, expectedFlags, expectedReads;
    U32 indexAddress = addressFor(test->indexSource, indexNode, 0);
    U32 linkAddress = addressFor(test->linkSource, linkNode, 0x1a);
    U32 parentValue = test->parent == REAL_PARENT ? (U32)parent
        : test->parent == INACCESSIBLE_PARENT ? (U32)protectedPage : 0;
    int indexSucceeded = test->entry == INDEX && test->failureHop != 1 && test->indexSource == GOOD;
    int chained = indexSucceeded && test->index >= 1000000;
    int wrapped = test->linkSource == OVERFLOW_ADDRESS && (test->entry == DIRECT_LINK || chained);
    U32 hops = 1 + chained - wrapped;
    U32 expectedProcCalls = hops - (test->resolutionFailure == NO_MODULE);
    expectedReads = hops - (test->resolutionFailure != RESOLVE);
    currentTest = test;
    moduleCalls = procCalls = processCalls = readCalls = apiErrors = observedPath = 0;
    write32(indexNode, test->index);
    write32(indexNode + 0x1a, 0xbaadf00d);  /* Must not supply the high-index parent. */
    write32(linkNode + 0x1a, parentValue);
    write32(frame, linkAddress);            /* EBP-0xc. */
    inputIndex = test->index;
    inputEax = test->entry == INDEX ? indexAddress : DIRECT_EAX;
    inputFlags = 0x202;
    for (i = 0; i < sizeof(flagBits) / sizeof(flagBits[0]); i++) {
        if (pattern & (1UL << i)) inputFlags |= flagBits[i];
    }
    entry = image + (test->entry == INDEX ? FX_INDEX_RVA : FX_LINK_RVA);
    SetLastError(ERROR_SEED);
    run();
    lastError = GetLastError();
    expectedEax = test->route == LOW ? test->index : test->route == LINK ? parentValue : inputEax;
    expectedFlags = (inputFlags & PRESERVED_FLAGS) | ((indexSucceeded ? cmpFlags : inputFlags) & ARITH_FLAGS);
    if (observedPath != test->route || observedRegs[0] != expectedEax ||
        observedRegs[6] != (U32)(frame + 12) || observedRegs[7] != callerStack - 28 ||
        afterStack != callerStack || (observedFlags & (ARITH_FLAGS | PRESERVED_FLAGS)) != expectedFlags ||
        lastError != ERROR_SEED || apiErrors || moduleCalls != hops ||
        procCalls != expectedProcCalls || processCalls != expectedReads || readCalls != expectedReads) {
        printf("FAIL %s pattern=%lu route=%lu/%lu eax=%lx/%lx esp=%lx/%lx after=%lx/%lx "
               "flags=%lx/%lx error=%lx API=%lu/%lu/%lu/%lu apiErrors=%lu\n",
               test->name, pattern, observedPath, test->route, observedRegs[0], expectedEax,
               observedRegs[7], callerStack - 28, afterStack, callerStack,
               observedFlags, expectedFlags, lastError, moduleCalls, procCalls, processCalls, readCalls, apiErrors);
        return 0;
    }
    for (i = 0; i < 5; i++) {
        if (observedRegs[i + 1] != preservedRegisters[i]) {
            printf("FAIL %s pattern=%lu register=%lu\n", test->name, pattern, i + 1);
            return 0;
        }
    }
    for (i = 0; i < 6; i++) {
        if (observedArgs[i] != argumentSeed[i]) {
            printf("FAIL %s pattern=%lu stack argument=%lu\n", test->name, pattern, i);
            return 0;
        }
    }
    for (i = 0; i < expectedReads; i++) {
        int indexRead = test->entry == INDEX && i == 0;
        U32 address = indexRead ? indexAddress : linkAddress + 0x1a;
        int readable = (indexRead ? test->indexSource : test->linkSource) == GOOD;
        if (reads[i].address != address || reads[i].success != readable) {
            printf("FAIL %s pattern=%lu read=%lu address=%lx/%lx success=%d/%d\n",
                   test->name, pattern, i, reads[i].address, address, reads[i].success, readable);
            return 0;
        }
    }
    if (test->indexSource == GUARD_PAGE || test->linkSource == GUARD_PAGE) {
        MEMORY_INFO_X86 page;
        if (VirtualQuery(guardPage, &page, sizeof(page)) != sizeof(page) || page.protect != 0x104) {
            printf("FAIL %s pattern=%lu guard page changed\n", test->name, pattern);
            return 0;
        }
    }
    return 1;
}

static int verify(void) {
    SYSTEM_INFO_X86 system;
    U8 *pages, *images[2];
    U32 a, t, f, oldProtect, cases = 0;
    int result = 1;
    images[0] = images[1] = 0;
    if (sizeof(void *) != 4 || FX_IMAGE_SIZE > 0x10000000 ||
        FX_INDEX_RVA != 0x566374 || FX_LINK_RVA != 0x5663b6 ||
        FX_LOW_RVA != 0x566381 || FX_LINK_NEXT_RVA != 0x5663bc || FX_CLEANUP_RVA != 0x5663da ||
        sizeof(fx_index_site) > FX_LOW_RVA - FX_INDEX_RVA ||
        sizeof(fx_link_site) != FX_LINK_NEXT_RVA - FX_LINK_RVA ||
        !fits(FX_PAYLOAD_RVA, sizeof(fx_payload)) || !fits(FX_INDEX_RVA, sizeof(fx_index_site)) ||
        !fits(FX_LINK_RVA, sizeof(fx_link_site)) || !fits(FX_LOW_RVA, 5) ||
        !fits(FX_LINK_NEXT_RVA, 5) || !fits(FX_CLEANUP_RVA, 5) ||
        !fits(FX_GET_MODULE_IAT_RVA, 4) || !fits(FX_GET_PROC_IAT_RVA, 4) ||
        !fits(FX_GET_CURRENT_PROCESS_IAT_RVA, 4) || !fits(FX_GET_LAST_ERROR_IAT_RVA, 4) ||
        !fits(FX_SET_LAST_ERROR_IAT_RVA, 4)) {
        printf("FAIL fixture image layout\n");
        return 1;
    }
    realKernel = GetModuleHandleA("kernel32.dll");
    productionRead = realKernel ? (READ_MEMORY)GetProcAddress(realKernel, "ReadProcessMemory") : 0;
    processHandle = GetCurrentProcess();
    GetSystemInfo(&system);
    if (!productionRead || !processHandle || system.pageSize < 4096 || system.pageSize > 65536) {
        printf("FAIL fixture Win32 preflight\n");
        return 1;
    }
    pages = (U8 *)VirtualAlloc(0, system.pageSize * 3, 0x3000, 4);
    if (!pages) goto done;
    protectedPage = pages + system.pageSize;
    guardPage = protectedPage + system.pageSize;
    protectedPage[-2] = 0x5a;
    protectedPage[-1] = 0xa5;
    if (!VirtualProtect(protectedPage, system.pageSize, 1, &oldProtect) ||
        !VirtualProtect(guardPage, system.pageSize, 0x104, &oldProtect)) goto done;
    images[0] = (U8 *)VirtualAlloc(0, FX_IMAGE_SIZE, 0x3000, 0x40);
    images[1] = (U8 *)VirtualAlloc(0, FX_IMAGE_SIZE, 0x3000, 0x40);
    if (!images[0] || !images[1] || images[0] == images[1]) goto done;
    for (a = 0; a < 2; a++) {
        if (!initializeImage(images[a])) goto done;
        printf("STAGE msaa guard image=%lu base=%p\n", a, images[a]);
        fflush(0);
        for (t = 0; t < sizeof(tests) / sizeof(tests[0]); t++) {
            for (f = 0; f < 128; f++) {
                if (!checkCase(images[a], &tests[t], f)) goto done;
                cases++;
            }
        }
    }
    printf("PASS msaa tray guard: %lu cases; two image bases; %lu scenarios; 128 flag patterns; "
           "actual index/link sites, native ReadProcessMemory, ABI preserved at synthetic continuations\n",
           cases, (U32)(sizeof(tests) / sizeof(tests[0])));
    result = 0;
done:
    if (result) printf("FAIL msaa tray guard after %lu passing cases\n", cases);
    for (a = 0; a < 2; a++) if (images[a]) VirtualFree(images[a], 0, 0x8000);
    if (pages) VirtualFree(pages, 0, 0x8000);
    return result;
}

void __cdecl FxMsaaTrayGuardFixtureEntry(void) {
    int result;
    SetErrorMode(3);
    result = verify();
    fflush(0);
    ExitProcess((U32)result);
}
