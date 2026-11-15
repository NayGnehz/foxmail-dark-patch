"""Build a separate, anonymized Git history without touching the source repo."""
import argparse
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import struct
import subprocess
from audit_history import git, objects, PATTERNS, public_example_or_asset

PUBLIC_IDENTITY = b"Foxmail Dark Patch <noreply@example.invalid>"
EMAIL = re.compile(r"(?<![A-Z0-9._%+-])[A-Z0-9._%+-]{1,64}@[A-Z0-9.-]{1,253}\.[A-Z]{2,63}", re.I)
USER_PATH = re.compile(r"([A-Z]:[\\/]+(?:Users|Documents and Settings)[\\/]+)[^\\/\s'\"<>|]+", re.I)
ROOT_PATH = re.compile(r"([A-Z]:[\\/]+)([^\\/\r\n'\"<>|\s]+)", re.I)
UUID = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I)


def sanitize(text, private):
    text = USER_PATH.sub(lambda m: m[1] + "Public", text)
    text = ROOT_PATH.sub(lambda m: m[1] + ("Workspace" if any(ord(c) > 127 for c in m[2]) else m[2]), text)
    if private:
        text = private.sub("Contributor", text)
    text = EMAIL.sub(lambda m: m[0] if public_example_or_asset(m[0].encode()) else "user@example.invalid", text)
    text = UUID.sub("00000000-0000-0000-0000-000000000000", text)
    return text


def clean_png(data):
    assert data.startswith(b"\x89PNG\r\n\x1a\n")
    cursor = 8
    result = [data[:8]]
    while cursor < len(data):
        size = struct.unpack_from(">I", data, cursor)[0]
        kind = data[cursor + 4:cursor + 8]
        end = cursor + size + 12
        assert end <= len(data)
        if kind == b"IHDR":
            width, height = struct.unpack_from(">II", data, cursor + 8)
            assert width <= 2048 and height <= 2048 and width * height <= 1048576, "Unexpected large image"
        if kind not in (b"tEXt", b"zTXt", b"iTXt", b"eXIf", b"tIME"):
            result.append(data[cursor:end])
        cursor = end
        if kind == b"IEND":
            break
    assert cursor == len(data), "Unexpected PNG trailing data"
    return b"".join(result)


def clean_blob(data, name, private):
    if name.endswith(".png"):
        assert name.startswith(("SearchControls/", "ExternalSkinUpdate/")) or name in ("SKIN_OTHER_BORDER_PNG.png", "SKIN_OTHER_BORDERHT_SHADOW_PNG.png")
        return clean_png(data)
    if data.startswith((b"MZ", b"PK\x03\x04", b"MDMP")):
        raise ValueError("Unexpected software archive or dump in source history")
    encoding = "utf-16" if data.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8"
    text = data.decode(encoding)
    assert "\0" not in text, "Unknown binary object in source history"
    assert not PATTERNS["secret"].search(data), "Possible credential in source history"
    return sanitize(text, private).encode(encoding)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--git", required=True)
    parser.add_argument("--private-pattern", required=True)
    parser.add_argument("--group", default="github-publication")
    args = parser.parse_args()
    assert re.fullmatch(r"[a-zA-Z0-9-]+", args.group)
    source = Path(__file__).resolve().parents[1]
    stage = Path(os.environ["PORTABLE_INSTANCE_ROOT"]) / "temp" / args.group
    stage.mkdir(exist_ok=True)
    mirror = stage / "repository"
    assert not mirror.exists(), "Use a fresh publication stage"
    private = re.compile(args.private_pattern, re.I)
    assert sanitize("button@2x.png person@example.invalid", private) == "button@2x.png person@example.invalid"
    assert sanitize("user@example.invalid", private) == "user@example.invalid"
    all_objects = list(objects(args.git, source, "main"))
    blobs = {sha: (name, data) for sha, kind, name, data in all_objects if kind == "blob"}
    commits = {sha: data for sha, kind, name, data in all_objects if kind == "commit"}
    order = git(args.git, source, "rev-list", "--reverse", "--topo-order", "main").decode().splitlines()
    stream = stage / "sanitized.fast-import"
    marks = {}
    changed = 0
    with stream.open("wb") as handle:
        for mark, (sha, (name, data)) in enumerate(blobs.items(), 1):
            cleaned = clean_blob(data, name, private)
            changed += cleaned != data
            marks[sha] = mark
            handle.write(f"blob\nmark :{mark}\ndata {len(cleaned)}\n".encode() + cleaned + b"\n")
        for sha in order:
            mark = len(marks) + 1
            marks[sha] = mark
            headers, message = commits[sha].split(b"\n\n", 1)
            metadata = headers.splitlines()
            parents = [line.split()[1].decode() for line in metadata if line.startswith(b"parent ")]
            handle.write(f"commit refs/heads/main\nmark :{mark}\n".encode())
            for role in (b"author", b"committer"):
                field = next(line for line in metadata if line.startswith(role + b" "))
                timestamp = re.search(rb" (\d+) [+-]\d{4}$", field)[1]
                handle.write(role + b" " + PUBLIC_IDENTITY + b" " + timestamp + b" +0000\n")
            cleaned = sanitize(message.decode(), private).encode()
            handle.write(f"data {len(cleaned)}\n".encode() + cleaned + b"\n")
            for i, parent in enumerate(parents):
                handle.write(("from" if i == 0 else "merge").encode() + f" :{marks[parent]}\n".encode())
            handle.write(b"deleteall\n")
            for row in git(args.git, source, "ls-tree", "-rz", "--full-tree", sha).split(b"\0"):
                if not row:
                    continue
                metadata, filename = row.split(b"\t", 1)
                mode, kind, blob = metadata.split()
                assert kind == b"blob" and mode in (b"100644", b"100755"), "Unexpected link/submodule"
                name = filename.decode()
                assert not private.search(name) and not USER_PATH.search(name)
                path = json.dumps(name, ensure_ascii=True).encode()
                handle.write(b"M " + mode + f" :{marks[blob.decode()]} ".encode() + path + b"\n")
            handle.write(b"\n")
        handle.write(b"done\n")
    subprocess.run([args.git, "init", "--initial-branch=main", str(mirror)], check=True, capture_output=True)
    with stream.open("rb") as handle:
        subprocess.run([args.git, "-C", str(mirror), "fast-import", "--quiet", "--done"], stdin=handle, check=True)
    git(args.git, mirror, "reset", "--hard", "main")
    assert int(git(args.git, mirror, "rev-list", "--count", "main")) == len(order)
    report = {"sourceHead": order[-1], "publicHead": git(args.git, mirror, "rev-parse", "main").decode().strip(), "commits": len(order), "blobs": len(blobs), "changedBlobs": changed, "repository": str(mirror), "streamSHA256": hashlib.sha256(stream.read_bytes()).hexdigest()}
    (stage / "preparation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
