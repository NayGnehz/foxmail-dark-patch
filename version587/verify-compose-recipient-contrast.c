/* Execute the emitted x86 sites and stub against synthetic native routines. */
typedef unsigned long U32;
typedef unsigned char U8;
__declspec(dllimport) void *__stdcall VirtualAlloc(void *, U32, U32, U32);
__declspec(dllimport) int __stdcall VirtualFree(void *, U32, U32);
__declspec(dllimport) int __stdcall FlushInstructionCache(void *, const void *, U32);
__declspec(dllimport) void __stdcall ExitProcess(U32);
__declspec(dllimport) int __cdecl printf(const char *, ...);
__declspec(dllimport) int __cdecl fflush(void *);
#include "recipient-contrast-fixture.h"

static U8 recipient[0x330], selectionAttr[12], defaultAttr[12];
static void *entry;
static U32 savedStack, expectedObject, inputFlags, outputFlags;
static U32 originalHits, originalInput[3], originalFlags;
static U32 colorHits, colorReceiver, colorValue, colorAfterOriginal;
static U32 simulatedError, getHits, setHits, returned[8], returnedFlags;
static const U32 flagBits[] = {1, 4, 16, 64, 128, 2048};

__declspec(naked) static void ApplyFont(void) {
    __asm {
        mov dword ptr [originalInput], eax
        mov dword ptr [originalInput+4], ecx
        mov dword ptr [originalInput+8], edx
        pushfd
        pop dword ptr [originalFlags]
        inc dword ptr [originalHits]
        mov dword ptr [simulatedError], 0x12345678
        push dword ptr [outputFlags]
        popfd
        mov eax, 0x11112222
        mov ecx, 0x33334444
        mov edx, 0x55556666
        ret
    }
}

__declspec(naked) static void GetError(void) {
    __asm {
        inc dword ptr [getHits]
        mov eax, dword ptr [simulatedError]
        xor ecx, ecx
        xor edx, edx
        ret
    }
}

__declspec(naked) static void SetColor(void) {
    __asm {
        mov dword ptr [colorReceiver], eax
        mov dword ptr [colorValue], edx
        mov eax, dword ptr [originalHits]
        mov dword ptr [colorAfterOriginal], eax
        inc dword ptr [colorHits]
        mov dword ptr [simulatedError], 0xdeadbeef
        xor ecx, ecx
        xor edx, edx
        ret
    }
}

__declspec(naked) static void SetError(void) {
    __asm {
        inc dword ptr [setHits]
        mov eax, dword ptr [esp+4]
        mov dword ptr [simulatedError], eax
        xor ecx, ecx
        xor edx, edx
        ret 4
    }
}

__declspec(naked) static void Rejoin(void) {
    __asm {
        mov dword ptr [returned], eax
        mov dword ptr [returned+4], ecx
        mov dword ptr [returned+8], edx
        mov dword ptr [returned+12], ebx
        mov dword ptr [returned+16], esi
        mov dword ptr [returned+20], edi
        mov dword ptr [returned+24], ebp
        mov dword ptr [returned+28], esp
        pushfd
        pop dword ptr [returnedFlags]
        mov esp, dword ptr [savedStack]
        popfd
        popad
        ret
    }
}

__declspec(naked) static void Run(void) {
    __asm {
        pushad
        pushfd
        mov dword ptr [savedStack], esp
        push dword ptr [inputFlags]
        popfd
        mov eax, dword ptr [expectedObject]
        mov ecx, 0x77889901
        mov edx, 0x55667788
        mov ebx, 0x12341234
        mov esi, 0x56785678
        mov edi, 0x9abc9abc
        mov ebp, 0xdef0def0
        jmp dword ptr [entry]
    }
}

static void put32(U8 *target, U32 value) {
    unsigned int i;
    for (i = 0; i < 4; i++) target[i] = (U8)(value >> (i * 8));
}

static void jump(U8 *target, void (*fn)(void)) {
    target[0] = 0xe9;
    put32(target + 1, (U32)fn - (U32)(target + 5));
}

static U32 verify(void) {
    U32 cases = 0;
    unsigned int instance, site, hasAttr, bits, i;
    U8 *images[2];
    expectedObject = (U32)recipient;
    put32(recipient + 0x234, (U32)selectionAttr);
    for (instance = 0; instance < 2; instance++) {
        U8 *image = (U8 *)VirtualAlloc(0, FX_IMAGE_SIZE, 0x3000, 0x40);
        if (!image) return 0;
        images[instance] = image;
        for (i = 0; i < sizeof(stub); i++) image[FX_STUB_RVA + i] = stub[i];
        jump(image + FX_ORIGINAL_RVA, ApplyFont);
        jump(image + FX_GET_ERROR_RVA, GetError);
        jump(image + FX_SET_COLOR_RVA, SetColor);
        jump(image + FX_SET_ERROR_RVA, SetError);
        for (site = 0; site < FX_SITE_COUNT; site++) {
            U8 *address = image + sites[site].rva;
            for (i = 0; i < 5; i++) address[i] = sites[site].bytes[i];
            jump(address + 5, Rejoin);
        }
        if (!FlushInstructionCache((void *)-1, image, FX_IMAGE_SIZE)) return 0;
        for (site = 0; site < FX_SITE_COUNT; site++) {
            entry = image + sites[site].rva;
            for (hasAttr = 0; hasAttr <= 1; hasAttr++) {
                put32(recipient + FX_DEFAULT_ATTR_OFFSET, hasAttr ? (U32)defaultAttr : 0);
                for (bits = 0; bits < 64; bits++) {
                    inputFlags = outputFlags = 0x202;
                    for (i = 0; i < 6; i++) {
                        if (bits & (1u << i)) inputFlags |= flagBits[i];
                        else outputFlags |= flagBits[i];
                    }
                    originalHits = colorHits = getHits = setHits = colorAfterOriginal = 0;
                    colorReceiver = colorValue = 0;
                    simulatedError = 0x87654321;
                    Run();
                    if (originalHits != 1 || originalInput[0] != expectedObject ||
                        originalInput[1] != 0x77889901 || originalInput[2] != 0x55667788 ||
                        (originalFlags & 0x8d5) != (inputFlags & 0x8d5) ||
                        colorHits != hasAttr || getHits != hasAttr || setHits != hasAttr ||
                        colorAfterOriginal != hasAttr ||
                        colorReceiver != (hasAttr ? (U32)defaultAttr : 0) ||
                        colorValue != (hasAttr ? FX_COLOR : 0) || simulatedError != 0x12345678 ||
                        returned[0] != 0x11112222 || returned[1] != 0x33334444 || returned[2] != 0x55556666 ||
                        returned[3] != 0x12341234 || returned[4] != 0x56785678 || returned[5] != 0x9abc9abc ||
                        returned[6] != 0xdef0def0 || returned[7] != savedStack ||
                        (returnedFlags & 0x8d5) != (outputFlags & 0x8d5)) {
                        printf("FAIL base=%u site=%u defaultAttr=%u flags=%u\n", instance, site, hasAttr, bits);
                        return 0;
                    }
                    cases++;
                }
            }
        }
    }
    for (instance = 0; instance < 2; instance++) {
        if (!VirtualFree(images[instance], 0, 0x8000)) return 0;
    }
    return cases;
}

void __cdecl FxRecipientFixtureEntry(void) {
    U32 cases = verify();
    printf("%s compose recipient ABI: %lu cases; candidate=%s\n",
        cases == 1280 ? "PASS" : "FAIL", cases, FX_CANDIDATE_SHA);
    fflush(0);
    ExitProcess(cases == 1280 ? 0 : 1);
}
