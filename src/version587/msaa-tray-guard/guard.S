/* Both sites enter by JMP with the original Delphi stack and SEH frame. */
.intel_syntax noprefix
.text
.Lstart:
    pushfd
    pushad
    sub esp, 4
    mov esi, dword ptr [esp + 32]    /* Saved EAX = node. */
    mov edi, esp
    call .Lread_dword
    test eax, eax
    jz .Lunreadable

    mov eax, dword ptr [esp]
    cmp eax, 1000000
    pushfd
    pop edx
    /* Only CMP's six arithmetic flags replace the incoming flags. */
    and edx, 0x8d5
    and dword ptr [esp + 36], ~0x8d5
    or dword ptr [esp + 36], edx
    test edx, 1                     /* CMP carry means index < 1000000. */
    jz .Lparent
    mov dword ptr [esp + 32], eax    /* Reuse the DWORD; skip the second load. */
    add esp, 4
    popad
    popfd
    .byte 0xe9
    .long FX_LOW_RVA - (FX_PAYLOAD_RVA + (. - .Lstart) + 4)

.Lparent:
    add esp, 4
    popad
    popfd
    .byte 0xe9
    .long FX_LINK_RVA - (FX_PAYLOAD_RVA + (. - .Lstart) + 4)

.Lunreadable:
    add esp, 4
    popad
    popfd
    .byte 0xe9
    .long FX_CLEANUP_RVA - (FX_PAYLOAD_RVA + (. - .Lstart) + 4)

.org FX_LINK_STUB_OFFSET, 0x90
    pushfd
    pushad
    sub esp, 4
    mov esi, dword ptr [ebp - 12]
    add esi, 0x1a
    jc .Lunreadable
    mov edi, esp
    call .Lread_dword
    test eax, eax
    jz .Lunreadable
    mov eax, dword ptr [esp]
    mov dword ptr [esp + 32], eax
    add esp, 4
    popad
    popfd
    .byte 0xe9
    .long FX_LINK_NEXT_RVA - (FX_PAYLOAD_RVA + (. - .Lstart) + 4)

.Lkernel32:
    .asciz "kernel32.dll"
.Lapi_name:
    .asciz "ReadProcessMemory"
.set .Lkernel_rva, FX_PAYLOAD_RVA + (.Lkernel32 - .Lstart)
.set .Lapi_rva, FX_PAYLOAD_RVA + (.Lapi_name - .Lstart)

/* ESI = address, EDI = four-byte stack destination. Return BOOL in EAX. */
.Lread_dword:
    cld
    call .Lget_pc
.Lpc:
    .set .Lpc_rva, FX_PAYLOAD_RVA + (.Lpc - .Lstart)
    sub ebx, offset .Lpc_rva
    call dword ptr [ebx + FX_GET_LAST_ERROR_IAT_RVA]
    push eax
    lea eax, [ebx + .Lkernel_rva]
    push eax
    call dword ptr [ebx + FX_GET_MODULE_IAT_RVA]
    test eax, eax
    jz .Lapi_missing
    lea edx, [ebx + .Lapi_rva]
    push edx
    push eax
    call dword ptr [ebx + FX_GET_PROC_IAT_RVA]
    test eax, eax
    jz .Lapi_missing
    mov ebp, eax
    call dword ptr [ebx + FX_GET_CURRENT_PROCESS_IAT_RVA]
    push 0
    push 4
    push edi
    push esi
    push eax
    call ebp
    jmp .Lrestore_error
.Lapi_missing:
    xor eax, eax
.Lrestore_error:
    pop edx
    push eax
    push edx
    call dword ptr [ebx + FX_SET_LAST_ERROR_IAT_RVA]
    pop eax
    ret

.Lget_pc:
    mov ebx, dword ptr [esp]
    ret
