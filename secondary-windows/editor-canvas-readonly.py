"""One-shot, numeric/native-window-only Foxmail canvas snapshot.
Run through the registered portable Python. No target writes, messages or content.
"""
import ctypes as C
from ctypes import wintypes as W
import datetime
import hashlib
import json
import os
from pathlib import Path
import struct
import sys

EXPECTED_PATH = r'D:\Users\Public\Downloads\Foxmail\Foxmail深色.exe'
EXPECTED_SHA = '086e0c1d3cdcb204d0cd64db1e51b60aa86fa55d144ab530734fc783c94dbdf1'
BASE = 0x400000
ATOMS = (0xEF91B6, 0xEF91B4, 0xEF5B80, 0xEF5B7E)
EDITORS = {'TFoxHTMLEditor': (0x7946F0, 0x3D0),
           'TFoxHTMLEditorBase': (0x783760, 0x370)}
kernel = C.WinDLL('kernel32', use_last_error=True)
user = C.WinDLL('user32', use_last_error=True)
psapi = C.WinDLL('psapi', use_last_error=True)

class MBI(C.Structure):
    _fields_ = [('BaseAddress', C.c_void_p), ('AllocationBase', C.c_void_p),
                ('AllocationProtect', W.DWORD), ('RegionSize', C.c_size_t),
                ('State', W.DWORD), ('Protect', W.DWORD), ('Type', W.DWORD)]

class MODULEINFO(C.Structure):
    _fields_ = [('base', C.c_void_p), ('size', W.DWORD), ('entry', C.c_void_p)]

class RECT(C.Structure):
    _fields_ = [('left', W.LONG), ('top', W.LONG), ('right', W.LONG), ('bottom', W.LONG)]

CALLBACK = C.WINFUNCTYPE(W.BOOL, W.HWND, W.LPARAM)

def bind(lib, name, result, arguments):
    fn = getattr(lib, name)
    fn.restype, fn.argtypes = result, arguments
    return fn

open_process = bind(kernel, 'OpenProcess', W.HANDLE, [W.DWORD, W.BOOL, W.DWORD])
close_handle = bind(kernel, 'CloseHandle', W.BOOL, [W.HANDLE])
query_path = bind(kernel, 'QueryFullProcessImageNameW', W.BOOL,
                  [W.HANDLE, W.DWORD, W.LPWSTR, C.POINTER(W.DWORD)])
rpm = bind(kernel, 'ReadProcessMemory', W.BOOL,
           [W.HANDLE, C.c_void_p, C.c_void_p, C.c_size_t, C.POINTER(C.c_size_t)])
query_vm = bind(kernel, 'VirtualQueryEx', C.c_size_t,
                [W.HANDLE, C.c_void_p, C.POINTER(MBI), C.c_size_t])
times = bind(kernel, 'GetProcessTimes', W.BOOL,
             [W.HANDLE] + [C.POINTER(W.FILETIME)] * 4)
exit_code = bind(kernel, 'GetExitCodeProcess', W.BOOL, [W.HANDLE, C.POINTER(W.DWORD)])
enum_modules = bind(psapi, 'EnumProcessModulesEx', W.BOOL,
                    [W.HANDLE, C.POINTER(C.c_void_p), W.DWORD, C.POINTER(W.DWORD), W.DWORD])
module_info = bind(psapi, 'GetModuleInformation', W.BOOL,
                   [W.HANDLE, C.c_void_p, C.POINTER(MODULEINFO), W.DWORD])
enum_windows = bind(user, 'EnumWindows', W.BOOL, [CALLBACK, W.LPARAM])
enum_children = bind(user, 'EnumChildWindows', W.BOOL, [W.HWND, CALLBACK, W.LPARAM])
window_pid = bind(user, 'GetWindowThreadProcessId', W.DWORD, [W.HWND, C.POINTER(W.DWORD)])
class_name = bind(user, 'GetClassNameW', C.c_int, [W.HWND, W.LPWSTR, C.c_int])
get_prop = bind(user, 'GetPropW', W.HANDLE, [W.HWND, C.c_void_p])
get_parent = bind(user, 'GetParent', W.HWND, [W.HWND])
get_rect = bind(user, 'GetWindowRect', W.BOOL, [W.HWND, C.POINTER(RECT)])
visible = bind(user, 'IsWindowVisible', W.BOOL, [W.HWND])
is_window = bind(user, 'IsWindow', W.BOOL, [W.HWND])

def hx(value):
    return f'0x{value:08X}'

def norm(path):
    return os.path.normcase(os.path.abspath(path))

class Snapshot:
    def __init__(self, pid):
        self.pid = pid
        self.handle = open_process(0x410, False, pid)  # QUERY_INFORMATION | VM_READ
        if not self.handle:
            raise RuntimeError(f'OpenProcess-read-only-failed:{C.get_last_error()}')
        self.calls = self.bytes_read = 0
        self.image_size = 0

    def read(self, address, count):
        if not (0x10000 <= address <= 0xFFFFFFFF and 1 <= count <= 128
                and address + count <= 0x100000000):
            raise RuntimeError('numeric-read-range-guard')
        mbi = MBI()
        if (query_vm(self.handle, address, C.byref(mbi), C.sizeof(mbi)) != C.sizeof(mbi)
                or mbi.State != 0x1000 or mbi.Protect & 0x101
                or address + count > (mbi.BaseAddress or 0) + mbi.RegionSize):
            raise RuntimeError('numeric-read-region-guard')
        buf, got = (C.c_ubyte * count)(), C.c_size_t()
        self.calls += 1
        if not rpm(self.handle, address, buf, count, C.byref(got)) or got.value != count:
            raise RuntimeError('numeric-read-failed')
        self.bytes_read += count
        return bytes(buf)

    def u32(self, address):
        return struct.unpack('<I', self.read(address, 4))[0]

    def u8(self, address):
        return self.read(address, 1)[0]

    def process_stamp(self):
        values = [W.FILETIME() for _ in range(4)]
        code = W.DWORD()
        if (not times(self.handle, *[C.byref(x) for x in values])
                or not exit_code(self.handle, C.byref(code)) or code.value != 259):
            raise RuntimeError('process-ended-or-times-unavailable')
        return (values[0].dwHighDateTime << 32) | values[0].dwLowDateTime

    def guard(self):
        text, length = C.create_unicode_buffer(32768), W.DWORD(32768)
        if not query_path(self.handle, 0, text, C.byref(length)) or norm(text.value) != norm(EXPECTED_PATH):
            raise RuntimeError('exact-process-path-guard')
        if hashlib.sha256(Path(EXPECTED_PATH).read_bytes()).hexdigest() != EXPECTED_SHA:
            raise RuntimeError('exact-executable-sha256-guard')
        self.created = self.process_stamp()
        modules, needed = (C.c_void_p * 512)(), W.DWORD()
        # LIST_MODULES_ALL=3. (LIST_MODULES_32BIT=1; flag2 selects64-bit modules.)
        if (not enum_modules(self.handle, modules, C.sizeof(modules), C.byref(needed), 3)
                or needed.value < C.sizeof(C.c_void_p) or modules[0] != BASE):
            raise RuntimeError(f'target32-main-module-base-guard:base={hx(modules[0] or 0)},needed={needed.value},pointerBytes={C.sizeof(C.c_void_p)},winerr={C.get_last_error()}')
        info = MODULEINFO()
        if (not module_info(self.handle, modules[0], C.byref(info), C.sizeof(info))
                or info.base != BASE):
            raise RuntimeError('main-module-info-guard')
        self.image_size = info.size
        dos = self.read(BASE, 64)
        pe_offset = struct.unpack_from('<I', dos, 60)[0]
        if dos[:2] != b'MZ' or not 64 <= pe_offset <= 0x100000:
            raise RuntimeError('DOS-header-guard')
        pe = self.read(BASE + pe_offset, 88)
        if (pe[:4] != b'PE\0\0' or struct.unpack_from('<H', pe, 4)[0] != 0x14C
                or struct.unpack_from('<H', pe, 24)[0] != 0x10B
                or struct.unpack_from('<I', pe, 52)[0] != BASE
                or struct.unpack_from('<I', pe, 80)[0] != self.image_size):
            raise RuntimeError('PE-x86-image-layout-guard')
        for rva, size in list(EDITORS.values()) + [(0x776AE0, 0x79C), (0x74F564, 0x40), (0x766E08, 0x224)]:
            self.vmt_guard(BASE + rva, rva, size)

    def vmt_guard(self, vmt, rva, size):
        if (vmt != BASE + rva or not BASE <= vmt - 76 < vmt + 4 <= BASE + self.image_size
                or self.u32(vmt - 76) != vmt or self.u32(vmt - 40) != size):
            raise RuntimeError('exact-vmt-size-guard')

    def object_guard(self, obj, rva, size):
        self.vmt_guard(self.u32(obj), rva, size)

    def window(self, hwnd):
        owner = W.DWORD()
        tid = window_pid(hwnd, C.byref(owner))
        text, rect = C.create_unicode_buffer(128), RECT()
        if not is_window(hwnd) or not tid or owner.value != self.pid or not class_name(hwnd, text, len(text)):
            raise RuntimeError('window-identity-guard')
        if not get_rect(hwnd, C.byref(rect)):
            raise RuntimeError('window-rect-unavailable')
        return dict(hwnd=hx(hwnd), pid=owner.value, tid=tid, windowClass=text.value,
                    parent=hx(get_parent(hwnd) or 0), visible=bool(visible(hwnd)),
                    rect=[rect.left, rect.top, rect.right, rect.bottom])

    def host_tree(self, hwnd):
        rows, errors = [self.window(hwnd)], []
        @CALLBACK
        def each(child, _):
            try:
                if len(rows) >= 2048:
                    raise RuntimeError('host-window-count-guard')
                rows.append(self.window(child))
                return True
            except RuntimeError as ex:
                errors.append(str(ex))
                return False
        enum_children(hwnd, each, 0)
        if errors:
            raise RuntimeError(errors[0])
        return rows

    def editor(self, hwnd, name):
        result = dict(window=self.window(hwnd), status='no-valid-fixed-atom-object')
        rva, size = EDITORS[name]
        for atom_rva in ATOMS:
            atom = struct.unpack('<H', self.read(BASE + atom_rva, 2))[0]
            if atom < 0xC000:
                continue
            obj = get_prop(hwnd, atom) or 0
            try:
                self.object_guard(obj, rva, size)
                if self.u32(obj + 0x180) != hwnd:
                    continue
            except RuntimeError:
                continue
            result = dict(window=result['window'], status='validation-failed')
            try:
                loaded = self.u8(obj + 0x324)
                chromium, host = self.u32(obj + 0x304), self.u32(obj + 0x300)
                if loaded not in (0, 1):
                    raise RuntimeError('load-byte-guard')
                data = dict(self=hx(obj), atomRva=hx(atom_rva), vmtRva=hx(rva),
                            loadEnd324=loaded, chromium304=hx(chromium), host300=hx(host))
                options = color = host_hwnd = None
                if chromium:
                    self.object_guard(chromium, 0x776AE0, 0x79C)
                    options = self.u32(chromium + 0x6C)
                    self.object_guard(options, 0x74F564, 0x40)
                    color = self.u32(options + 0x34)
                    data.update(options6C=hx(options), backgroundARGB34=hx(color),
                                equalsOpaque202020=(color == 0xFF202020))
                if host:
                    self.object_guard(host, 0x766E08, 0x224)
                    host_hwnd = self.u32(host + 0x180)
                    data['hostWindows'] = self.host_tree(host_hwnd)
                # Recheck all pointer/value/identity links; never follow guessed or raced pointers.
                self.object_guard(obj, rva, size)
                if ((get_prop(hwnd, atom) or 0) != obj or self.u32(obj + 0x180) != hwnd
                        or self.u8(obj + 0x324) != loaded or self.u32(obj + 0x304) != chromium
                        or self.u32(obj + 0x300) != host or self.window(hwnd)['windowClass'] != name):
                    raise RuntimeError('editor-race-guard')
                if chromium:
                    self.object_guard(chromium, 0x776AE0, 0x79C)
                    self.object_guard(options, 0x74F564, 0x40)
                    if self.u32(chromium + 0x6C) != options or self.u32(options + 0x34) != color:
                        raise RuntimeError('chromium-options-race-guard')
                if host:
                    self.object_guard(host, 0x766E08, 0x224)
                    if self.u32(host + 0x180) != host_hwnd:
                        raise RuntimeError('host-race-guard')
                    for item in data['hostWindows']:
                        now = self.window(int(item['hwnd'], 16))
                        if any(now[key] != item[key] for key in ('pid', 'tid', 'windowClass', 'parent')):
                            raise RuntimeError('host-child-identity-race-guard')
                result.update(status='validated-numeric-snapshot', editor=data)
            except RuntimeError as ex:
                result['reason'] = str(ex)  # Fail closed: discard partial chain and child metadata.
            return result
        return result

    def run(self):
        self.guard()
        editors, errors, seen = [], [], set()
        @CALLBACK
        def each(hwnd, _):
            try:
                if hwnd in seen:
                    return True
                seen.add(hwnd)
                owner = W.DWORD()
                window_pid(hwnd, C.byref(owner))
                if owner.value != self.pid:
                    return True
                text = C.create_unicode_buffer(100)
                class_name(hwnd, text, len(text))
                if text.value in EDITORS:
                    editors.append(self.editor(hwnd, text.value))
                return True
            except RuntimeError as ex:
                errors.append(str(ex))
                return False
        @CALLBACK
        def top(hwnd, _):
            if not each(hwnd, 0):
                return False
            owner = W.DWORD()
            window_pid(hwnd, C.byref(owner))
            if owner.value == self.pid:
                enum_children(hwnd, each, 0)
            return not errors
        enum_windows(top, 0)
        if errors or self.process_stamp() != self.created:
            raise RuntimeError(errors[0] if errors else 'process-identity-race')
        return dict(readOnly=True, pid=self.pid, processCreationFileTime=self.created,
                    utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    exactExecutableSHA256=EXPECTED_SHA, imageBase=hx(BASE), imageSize=self.image_size,
                    pythonPointerBytes=C.sizeof(C.c_void_p), editorCount=len(editors), editors=editors,
                    readCalls=self.calls, numericAndPEBytesRead=self.bytes_read,
                    noTextNoHTMLNoURLsNoScreenshots=True, notPresentationProof=True,
                    limitation='Non-atomic one-shot. Rechecks reduce but cannot eliminate pointer reuse races; load-end/clear color is not presented-pixel evidence.')

def main():
    if len(sys.argv) != 3 or not sys.argv[1].isdigit() or not 0 < int(sys.argv[1]) <= 0xFFFFFFFF:
        raise RuntimeError('usage: editor-canvas-readonly.py PID output-json')
    if (os.environ.get('PORTABLE_PROJECT_ID') != 'foxmail'
            or Path(os.environ.get('PORTABLE_INSTANCE_ROOT', '')).name != 'compose-recording-20261105'):
        raise RuntimeError('registered-portable-Python-environment-required')
    output = Path(sys.argv[2]).resolve()
    temp_root = (Path(os.environ['PORTABLE_INSTANCE_ROOT']) / 'temp').resolve()
    try:
        output.relative_to(temp_root)
    except ValueError:
        raise RuntimeError('output-must-stay-in-registered-instance-temp')
    if output.suffix.lower() != '.json' or output.exists():
        raise RuntimeError('output-must-be-new-json-file')
    probe = Snapshot(int(sys.argv[1]))
    try:
        report = probe.run()
    finally:
        close_handle(probe.handle)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(dict(saved=str(output), editors=report['editorCount'],
                          numericAndPEBytesRead=report['numericAndPEBytesRead']), ensure_ascii=False))

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(f'Closed without a snapshot: {type(exc).__name__}: {exc}', file=sys.stderr)
        sys.exit(2)
