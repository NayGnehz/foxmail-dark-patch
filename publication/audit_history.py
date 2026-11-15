"""Audit only versioned project objects; never traverse user mail or settings."""
import argparse
import collections
import json
import ipaddress
import os
from pathlib import Path
import re
import subprocess

PATTERNS = {
    "email": re.compile(rb"(?<![A-Z0-9._%+-])[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63}", re.I),
    "user_directory": re.compile(rb"[A-Z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/\s\x00'\"]+", re.I),
    "windows_path": re.compile(rb"[A-Z]:[\\/][^\r\n\x00'\"<>|]{2,150}", re.I),
    "secret": re.compile(rb"(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-[A-Za-z0-9_-]{32,})"),
    "ipv4": re.compile(rb"(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])"),
}


def public_example_or_asset(value):
    return bool(re.search(rb"@(?:[a-z0-9.-]*\.)?(?:example\.(?:com|org|net|invalid)|invalid|localhost)$", value, re.I)
                or re.search(rb"@\d+x\.(?:png|jpg|gif|webp|svg|bmp|ico)$", value, re.I))


def git(exe, source, *args):
    return subprocess.check_output([exe, "-C", str(source), *args])


def objects(exe, source, ref):
    rows = git(exe, source, "rev-list", "--objects", ref).splitlines()
    request = b"".join(row.split(b" ", 1)[0] + b"\n" for row in rows)
    result = git_batch(exe, source, request)
    cursor = 0
    for row in rows:
        sha, _, name = row.partition(b" ")
        end = result.index(b"\n", cursor)
        ident, kind, length = result[cursor:end].split(b" ")
        assert ident == sha
        size = int(length)
        data = result[end + 1:end + 1 + size]
        cursor = end + 2 + size
        yield sha.decode(), kind.decode(), name.decode("utf-8", "replace"), data
    assert cursor == len(result)


def git_batch(exe, source, request):
    return subprocess.run([exe, "-C", str(source), "cat-file", "--batch"], input=request,
                          stdout=subprocess.PIPE, check=True).stdout


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--git", required=True)
    parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--ref", default="main")
    parser.add_argument("--group", default="publication-audit")
    parser.add_argument("--private-pattern", default="")
    args = parser.parse_args()
    if args.private_pattern:
        PATTERNS["personal_marker"] = re.compile(args.private_pattern.encode(), re.I)
    root = Path(os.environ["PORTABLE_INSTANCE_ROOT"]) / "temp"
    assert re.fullmatch(r"[a-zA-Z0-9-]+", args.group)
    output = root / args.group
    output.mkdir(exist_ok=True)
    found = []
    counts = collections.Counter()
    types = collections.Counter()
    for sha, kind, name, data in objects(args.git, args.source, args.ref):
        types[kind] += 1
        # Text in both UTF-8 and UTF-16 is relevant to embedded program strings.
        samples = [data]
        if b"\x00" in data:
            for offset in (0, 1):
                try:
                    samples.append(data[offset:].decode("utf-16-le", "ignore").encode("utf-8"))
                except UnicodeError:
                    pass
        hits = {}
        for category, pattern in PATTERNS.items():
            matches = {m.group() for sample in samples for m in pattern.finditer(sample)}
            if category == "email":
                matches = {m for m in matches if not public_example_or_asset(m)}
            if category == "user_directory":
                matches = {m for m in matches if not re.search(rb"[\\/](?:Public|Default|All Users)$", m, re.I)}
            if category == "ipv4":
                valid = set()
                for m in matches:
                    try:
                        address = ipaddress.ip_address(m.decode())
                        if not address.is_loopback and not address.is_unspecified and m != b"255.255.255.255":
                            valid.add(m)
                    except ValueError:
                        pass
                matches = valid
            if matches:
                hits[category] = len(matches)
                counts[category] += len(matches)
        if hits:
            found.append({"sha": sha, "kind": kind, "path": name, "hits": hits})
    result = {"ref": args.ref, "objects": dict(types), "counts": dict(counts), "findings": found}
    (output / "audit.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"objects": dict(types), "counts": dict(counts), "report": str(output / "audit.json")}))


if __name__ == "__main__":
    main()
