"""Build the two get_accName read guards against the sealed Foxmail 5.0 EXE."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import tempfile


BASELINE_SHA = "24665d0450f6a7b5efc9cba26cfc05dc9d0c8a761d6a91a093853d2ea4688f9c"
INDEX_RVA = 0x566374
LINK_RVA = 0x5663B6
LINK_STUB_OFFSET = 0x80
SITES = (
    (INDEX_RVA, bytes.fromhex("813840420f00733a8b45f48b00"), 0),
    (LINK_RVA, bytes.fromhex("8b45f48b401a"), LINK_STUB_OFFSET),
)
IMPORTS = {
    "GetModuleHandleA": "GET_MODULE",
    "GetProcAddress": "GET_PROC",
    "GetCurrentProcess": "GET_CURRENT_PROCESS",
    "GetLastError": "GET_LAST_ERROR",
    "SetLastError": "SET_LAST_ERROR",
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def align(value, unit):
    return (value + unit - 1) // unit * unit


def read32(data, offset):
    return struct.unpack_from("<I", data, offset)[0]


def read16(data, offset):
    return struct.unpack_from("<H", data, offset)[0]


def patch_jump(site, target, size):
    return b"\xe9" + struct.pack("<i", target - site - 5) + b"\x90" * (size - 5)


class Image:
    def __init__(self, data):
        self.data = data
        pe = read32(data, 60)
        self.optional = pe + 24
        if (data[:2] != b"MZ" or data[pe:pe + 4] != b"PE\0\0"
                or read16(data, pe + 4) != 0x14C or read16(data, self.optional) != 0x10B
                or read32(data, self.optional + 28) != 0x400000):
            raise ValueError("Expected the sealed x86 PE32 image")
        table = self.optional + read16(data, pe + 20)
        self.sections = [table + index * 40 for index in range(read16(data, pe + 6))]

    def offset(self, rva, length=1):
        for row in self.sections:
            _, start, size, raw = struct.unpack_from("<4I", self.data, row + 8)
            if start <= rva and rva + length <= start + size:
                return raw + rva - start
        raise ValueError(f"No file-backed bytes at RVA {rva:#x}")

    def ascii(self, rva):
        start = self.offset(rva)
        return self.data[start:self.data.index(b"\0", start)].decode("ascii")

    def kernel_imports(self):
        result = {}
        descriptor = self.offset(read32(self.data, self.optional + 104))
        while read32(self.data, descriptor + 12):
            first, _, _, dll, iat = struct.unpack_from("<5I", self.data, descriptor)
            if self.ascii(dll).lower() == "kernel32.dll":
                names = self.offset(first or iat)
                for index in range(4096):
                    entry = read32(self.data, names + 4 * index)
                    if not entry:
                        break
                    if entry < 0x80000000:
                        name = self.ascii(entry + 2)
                        if name in IMPORTS:
                            result.setdefault(f"FX_{IMPORTS[name]}_IAT_RVA", iat + 4 * index)
                else:
                    raise ValueError("Unterminated import lookup table")
            descriptor += 20
        if len(result) != len(IMPORTS):
            raise ValueError("Missing expected Kernel32 imports")
        return result


def assemble(zig, source, stage, constants):
    with tempfile.TemporaryDirectory(dir=stage) as tmp:
        obj = Path(tmp) / "guard.obj"
        subprocess.run([str(zig), "cc", "-target", "x86-windows-msvc", "-nostdinc", "-nostdlib",
                        "-c", str(source),
                        "-o", str(obj), *(f"-D{name}={value}" for name, value in constants.items())],
                       check=True)
        data = obj.read_bytes()
    if read16(data, 0) != 0x14C or read16(data, 16) != 0:
        raise ValueError("Unexpected COFF object format")
    for row in range(20, 20 + 40 * read16(data, 2), 40):
        if data[row:row + 8].rstrip(b"\0") == b".text":
            size, offset = struct.unpack_from("<II", data, row + 16)
            if read16(data, row + 32):
                raise ValueError("Guard payload must be relocation-free")
            payload = data[offset:offset + size]
            if len(payload) == size and LINK_STUB_OFFSET < size <= 512:
                return payload
    raise ValueError("Missing bounded guard payload")


def c_array(name, data):
    return f"static const unsigned char {name}[] = {{{','.join(map(str, data))}}};"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zig", type=Path, required=True)
    args = parser.parse_args()
    instance = Path(os.environ["PORTABLE_INSTANCE_ROOT"])
    if Path(os.environ["FOXMAIL_PIPELINE_LEASE"]) != instance:
        raise ValueError("Run through Invoke-FoxmailPipeline.ps1")
    project = Path(os.environ["FOXMAIL_PROJECT_ROOT"])
    workspace = next(root for root in project.parents
                     if (root / "_env/contracts/portable-v1.json").is_file())
    if not args.zig.is_absolute() or not args.zig.resolve().is_relative_to(workspace / "_env"):
        raise ValueError("Use the portable Zig tool from the project adapter")
    baseline = workspace / "_releases/foxmail/5.0/payload/Foxmail深色.exe"
    before = baseline.read_bytes()
    if sha(before) != BASELINE_SHA:
        raise ValueError("Sealed 5.0 executable hash changed")
    image = Image(before)
    last = image.sections[-1]
    virtual, rva, raw_size, raw = struct.unpack_from("<4I", before, last + 8)
    flags = read32(before, last + 36)
    if (before[last:last + 8] != b".fxcnca\0" or raw + raw_size != len(before)
            or (flags & 0x60000020) != 0x60000020):
        raise ValueError("Expected the final executable .fxcnca section without overlay")

    used = align(max(virtual, raw_size), 16)
    defines = {
        "FX_PAYLOAD_RVA": rva + used,
        "FX_LINK_STUB_OFFSET": LINK_STUB_OFFSET,
        "FX_INDEX_RVA": INDEX_RVA,
        "FX_LINK_RVA": LINK_RVA,
        "FX_LOW_RVA": 0x566381,
        "FX_LINK_NEXT_RVA": 0x5663BC,
        "FX_CLEANUP_RVA": 0x5663DA,
        **image.kernel_imports(),
    }
    stage = instance / "temp/version587-msaa-tray-guard"
    stage.mkdir(exist_ok=True)
    if stage.resolve() != stage or stage.is_symlink():
        raise ValueError("Guard staging directory must be plain")
    asm = Path(__file__).with_name("guard.S")
    payload = assemble(args.zig, asm, stage, defines)
    virtual_size = used + len(payload)
    new_raw_size = align(virtual_size, read32(before, image.optional + 36))
    image_size = align(rva + virtual_size, read32(before, image.optional + 32))
    after = bytearray(before)
    after.extend(b"\0" * (new_raw_size - raw_size))
    after[raw + used:raw + virtual_size] = payload
    headers = {
        last + 8: virtual_size,
        last + 16: new_raw_size,
        image.optional + 4: read32(before, image.optional + 4) + new_raw_size - raw_size,
        image.optional + 56: image_size,
    }
    for offset, value in headers.items():
        struct.pack_into("<I", after, offset, value)

    patched = []
    for address, expected, offset in SITES:
        at = image.offset(address, len(expected))
        if before[at:at + len(expected)] != expected:
            raise ValueError(f"Unexpected original instructions at RVA {address:#x}")
        replacement = patch_jump(address, rva + used + offset, len(expected))
        after[at:at + len(expected)] = replacement
        patched.append(replacement)

    candidate_sha = sha(after)
    header = [f'#define FX_CANDIDATE_SHA "{candidate_sha}"']
    header += [f"#define {name} {value}u" for name, value in defines.items()]
    header += [f"#define FX_IMAGE_SIZE {image_size}u", c_array("fx_payload", payload),
               c_array("fx_index_site", patched[0]), c_array("fx_link_site", patched[1])]
    (stage / "guard-fixture.h").write_text("\n".join(header) + "\n", encoding="ascii")
    dest = stage / "Foxmail.exe"
    dest.write_bytes(after)
    result = {
        "baseSHA256": BASELINE_SHA, "candidateSHA256": candidate_sha, "assemblySHA256": sha(asm.read_bytes()),
        "payloadSHA256": sha(payload), "payloadBytes": len(payload), "symbols": defines,
        "sites": [{"rva": site, "before": expected.hex(), "after": replacement.hex()}
                  for (site, expected, _), replacement in zip(SITES, patched)],
        "candidate": str(dest),
    }
    (stage / "build.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
