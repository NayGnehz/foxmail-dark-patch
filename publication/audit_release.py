"""Inspect release entries including binary deltas and UTF-16 strings."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import zipfile
from audit_history import PATTERNS, public_example_or_asset


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--private-pattern", required=True)
    parser.add_argument("--explain", action="store_true")
    args = parser.parse_args()
    temp = Path(os.environ["PORTABLE_INSTANCE_ROOT"]) / "temp"
    group = temp / "version587-dark-port-kit-receive-first-erase"
    archive = group / "Foxmail-Dark-Port-Kit.zip"
    launcher = group / "Foxmail-Dark-Patch.cmd"
    patterns = {k: v for k, v in PATTERNS.items() if k in ("secret", "email", "user_directory")}
    patterns["identity"] = re.compile(args.private_pattern.encode(), re.I)
    findings = []
    inspected = 0

    def check(name, data):
        nonlocal inspected
        inspected += 1
        samples = [data]
        if b"\0" in data:
            samples.extend(data[i:].decode("utf-16-le", "ignore").encode() for i in (0, 1))
        for category, pattern in patterns.items():
            hits = {m.group() for sample in samples for m in pattern.finditer(sample)}
            if category == "email":
                hits = {m for m in hits if not public_example_or_asset(m)}
            if category == "user_directory":
                hits = {m for m in hits if not re.search(rb"[\\/](?:Public|Default|All Users)$", m, re.I)}
            if hits:
                findings.append({"entry": name, "category": category, "count": len(hits)})
                if args.explain:
                    for sample in samples:
                        for match in pattern.finditer(sample):
                            if match.group() in hits:
                                context = sample[max(0, match.start() - 90):match.end() + 90]
                                context = pattern.sub(b"[REDACTED]", context)
                                print(json.dumps({"entry": name, "category": category, "context": context.decode("utf-8", "replace")}))

    with zipfile.ZipFile(archive) as source:
        for item in source.infolist():
            assert not item.filename.lower().endswith((".exe", ".dmp", ".pdb", ".db")), "Unexpected program/user data in release"
            data = source.read(item)
            check(item.filename, data)
            if item.filename.endswith("exe-delta.json"):
                delta = json.loads(data)
                for i, edit in enumerate(delta["edits"]):
                    for side in ("before", "after"):
                        check(f"{item.filename}:edit-{i}-{side}", bytes.fromhex(edit[side]))
                check(item.filename + ":append", base64.b64decode(delta["append"]))
        manifest = json.loads(source.read("manifest.json"))
    check("launcher", launcher.read_bytes())
    result = {"passed": not findings, "entriesAndDeltaSegments": inspected, "findings": findings,
              "exeSHA256": manifest["profiles"]["5.0-msaa-contrast"]["exeSHA256"],
              "archiveSHA256": hashlib.sha256(archive.read_bytes()).hexdigest(),
              "launcherSHA256": hashlib.sha256(launcher.read_bytes()).hexdigest()}
    output = temp / "github-publication-20261115" / "release-audit.json"
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))
    if findings:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
