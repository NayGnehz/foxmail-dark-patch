"""Build the offline dark overlay kit from the audited 587 artifacts."""

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from textwrap import wrap
import zipfile


BASE_VERSION = "7.2.25.587"
ORIGINAL_SHA = "f208b5c29816d1a5ca5859edbaf1b5e83f2c8e9cab2cfe0c3fdfdd4566d5b399"
RELEASE_MANIFEST_SHA = "d03209a8d39d645b1451c1e014dffb050928db7d19ef5cb50281710c9126e25b"
STATIC_PREIMAGES_SHA = "d8ae35a61e9097e94ce59f22e2e6fff73022165ed1510a6ecc8d8a510fae64e9"
EXE = "Foxmail深色.exe"
HELPER = "FoxmailRevealGate.dll"
TRIAL_EXE_SHA = "1cc82aae50abc671d4c70f5afc596f590035c639a7946817a3a97cd9fa1f00ab"
TRIAL_DLL_SHA = "1a42c70987f206fb09bd69cfbe88cf836ca318bf614dd0dfeea12a86dd3c4041"
TRAY_GUARD_PROFILE = "5.0-msaa"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def checked(file, digest):
    data = file.read_bytes()
    if sha(data) != digest:
        raise ValueError(f"Unexpected software hash: {file}")
    return data


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def delta(before, after):
    # Group nearby differences to keep manifest and replay overhead bounded.
    if len(after) < len(before):
        raise ValueError("Overlay must preserve the original prefix length")
    ranges = []
    for offset, (old, new) in enumerate(zip(before, after)):
        if old == new:
            continue
        if ranges and offset - ranges[-1][1] <= 8:
            ranges[-1][1] = offset + 1
        else:
            ranges.append([offset, offset + 1])
    edits = [{"offset": start, "before": before[start:end].hex(), "after": after[start:end].hex()}
             for start, end in ranges]
    restored = bytearray(after)
    for start, end in ranges:
        restored[start:end] = before[start:end]
    if restored[:len(before)] != before:
        raise ValueError("Delta could not be reversed to the exact original")
    return {"edits": edits, "append": base64.b64encode(after[len(before):]).decode("ascii")}


def write_launcher(source, output, payload, default_profile):
    bootstrap = (source / "launch-bootstrap.ps1").read_text(encoding="ascii")
    bootstrap = bootstrap.replace("__FOXMAIL_ARCHIVE_SHA__", sha(payload))
    bootstrap = bootstrap.replace("__FOXMAIL_DEFAULT_PROFILE__", default_profile)
    script = (source / "Apply-FoxmailDark.ps1").read_text(encoding="ascii")
    requirement, _, apply = script.partition("\n")
    if requirement != "#requires -Version 5.1":
        raise ValueError("Unexpected PowerShell entry version requirement")
    install = (source / "install-in-place.ps1").read_text(encoding="ascii")
    command = "& {\n" + install + "\n$apply = {\n" + apply + "\n}\n" + bootstrap + "\n}\n\n"
    template = (source / "launch.cmd").read_text(encoding="ascii")
    archive = "\n".join(wrap(base64.b64encode(payload).decode("ascii"), 76))
    prefix, marker, _ = template.replace("__FOXMAIL_ARCHIVE__", archive).partition("__FOXMAIL_COMMAND__")
    if not marker or not prefix.endswith("\n"):
        raise ValueError("PowerShell command section must start on a new line")
    launcher = prefix.replace("__FOXMAIL_COMMAND_LINE__", str(prefix.count("\n"))) + command
    data = launcher.replace("\n", "\r\n").encode("ascii")
    with tempfile.NamedTemporaryFile(dir=output.parent, suffix=".partial", delete=False) as handle:
        partial = Path(handle.name)
    try:
        partial.write_bytes(data)
        partial.replace(output)
    finally:
        partial.unlink(missing_ok=True)
    return sha(data)


def verified_tray_guard(temp, sealed_exe_sha):
    stage = temp / "version587-msaa-tray-guard"
    build = json.loads((stage / "build.json").read_text(encoding="utf-8"))
    report = json.loads((stage / "abi-validation.json").read_text(encoding="utf-8-sig"))
    exe = stage / "Foxmail.exe"
    candidate_sha = build["candidateSHA256"]
    if (build["baseSHA256"] != sealed_exe_sha or report["passed"] is not True
            or report["candidateSHA256"] != candidate_sha
            or report["inputs"].get(str(exe)) != candidate_sha
            or report["imageBases"] < 2 or report["flagPatterns"] != 128
            or report["scenarios"] < 1
            or report["cases"] != report["imageBases"] * report["scenarios"] * report["flagPatterns"]):
        raise ValueError("Expected passing emitted-instruction validation for the sealed 5.0 guard")
    for name in ("build.json", "guard-fixture.h"):
        artifact = stage / name
        checked(artifact, report["inputs"][str(artifact)])
    return exe, candidate_sha


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--original", required=True, type=Path)
    parser.add_argument("--msaa-tray-guard", action="store_true")
    parser.add_argument("--contrast-followup", action="store_true")
    parser.add_argument("--search-chooser-followup", action="store_true")
    args = parser.parse_args()
    if args.contrast_followup and not args.msaa_tray_guard:
        parser.error("--contrast-followup requires --msaa-tray-guard")
    if args.search_chooser_followup and not args.contrast_followup:
        parser.error("--search-chooser-followup requires --contrast-followup")
    if args.original.name.lower() != "foxmail.exe":
        raise ValueError("Use the exact unmodified Foxmail.exe as --original")
    if not args.original.is_absolute():
        raise ValueError("--original requires an absolute software path")
    for part in (args.original, *args.original.parents):
        if part.lstat().st_file_attributes & 0x400:
            raise ValueError("Reparse points are not allowed in --original")

    instance = Path(os.environ["PORTABLE_INSTANCE_ROOT"])
    if Path(os.environ["FOXMAIL_PIPELINE_LEASE"]) != instance:
        raise ValueError("Run through Invoke-FoxmailPipeline.ps1")
    temp = instance / "temp"
    project = Path(os.environ["FOXMAIL_PROJECT_ROOT"])
    workspace = next(root for root in project.parents
                     if (root / "_env/contracts/portable-v1.json").is_file())
    release = workspace / "_releases/foxmail/5.0"
    manifest = json.loads(checked(release / "manifest.json", RELEASE_MANIFEST_SHA).decode("utf-8-sig"))
    original = checked(args.original, ORIGINAL_SHA)
    if manifest["release"] != "5.0" or manifest["originalExecutableSHA256"] != ORIGINAL_SHA:
        raise ValueError("Expected sealed 5.0 inventory")

    files = {item["relative"]: item for item in manifest["files"]}
    if len(files) != 41 or len(manifest["files"]) != 41:
        raise ValueError("Expected 41 distinct software entries")
    sealed_exe = files.pop(EXE)
    sealed_helper = files.pop(HELPER)
    static = json.loads(checked(temp / "version587/validation.json", STATIC_PREIMAGES_SHA).decode("utf-8-sig"))["assets"]
    static = {item["relative"]: item for item in static}
    template_preimages = {
        f"{BASE_VERSION}/Template/HtmlEditor/Common/HtmlEditor.html": (
            "version587-compose-screen-colors/HtmlEditor.before.html",
            "dd712386a5282d14c6a509598cdf47eb1b502bc966ca3f5eaab59b3620902501"),
        f"{BASE_VERSION}/Template/AddrNoteInfo/Frame.html": (
            "version587-address-html/Frame.before.html",
            "ebcef379a55b031075ca82f70ad412c9361fe41295cfd7d5d9090a522dcd834a"),
    }
    if len(static) != 37 or set(static) | set(template_preimages) != set(files):
        raise ValueError("Static preimages do not cover the sealed inventory")
    payload = release / "payload"
    content = {}
    assets = []
    for relative, item in files.items():
        if not re.fullmatch(r"7\.2\.25\.587/(?:PngImages|Skin|Template)/[A-Za-z0-9_./-]+", relative):
            raise ValueError(f"Unexpected static asset path: {relative}")
        if ".." in Path(relative).parts:
            raise ValueError(f"Unexpected traversal: {relative}")
        data = checked(payload / relative, item["sha256"])
        if len(data) != item["length"]:
            raise ValueError(f"Sealed asset length mismatch: {relative}")
        if relative in template_preimages:
            preimage_path, preimage_sha = template_preimages[relative]
            checked(temp / preimage_path, preimage_sha)
        else:
            prior = static[relative]
            preimage_sha = prior["originalSHA256"]
            if not re.fullmatch(r"[0-9a-f]{64}", preimage_sha) or prior["candidateSHA256"] != item["sha256"]:
                raise ValueError(f"Historical asset record changed: {relative}")
        assets.append({**item, "originalSHA256": preimage_sha})
        content["payload/" + relative] = data

    profiles = {}
    base_profile = "5.0"
    base_exe = checked(payload / EXE, sealed_exe["sha256"])
    inputs = [
        (base_profile, payload / EXE, sealed_exe["sha256"], payload / HELPER, sealed_helper["sha256"]),
        ("deployed-trial", temp / "version587-compose-polish" / EXE, TRIAL_EXE_SHA,
         temp / "version587-compose-ready-check-host-ownership" / HELPER, TRIAL_DLL_SHA),
    ]
    default_profile = base_profile
    if args.msaa_tray_guard:
        guarded_exe, guarded_sha = verified_tray_guard(temp, sealed_exe["sha256"])
        default_profile = TRAY_GUARD_PROFILE
        inputs.append((default_profile, guarded_exe, guarded_sha, payload / HELPER, sealed_helper["sha256"]))
    additional_assets = []
    contrast_profile = "5.0-msaa-contrast"
    if args.contrast_followup:
        stage = temp / "version587-contrast-followup"
        report = json.loads((stage / "validation.json").read_text(encoding="utf-8"))
        if (report["baselineSHA256"] != guarded_sha or report["trayGuardUnchanged"] is not True
                or report["recipientStubUnchanged"] is not True or report["recipientABI"]["passed"] is not True
                or report["recipientABI"]["cases"] != 1280):
            raise ValueError("Contrast follow-up verification is incomplete")
        if set(report["sources"]) != {"contrast-followup.cjs", "compose-recipient-contrast.cjs", "compose-toolbar-shadow.cjs"}:
            raise ValueError("Incomplete contrast source bindings")
        for name, digest in report["sources"].items():
            if name not in ("contrast-followup.cjs", "compose-recipient-contrast.cjs", "compose-toolbar-shadow.cjs"):
                raise ValueError("Unexpected contrast source")
            checked(project / "version587" / name, digest)
        target = stage / "Foxmail.exe"
        checked(target, report["candidateSHA256"])
        contrast_sha = report["candidateSHA256"]
        if args.search_chooser_followup:
            followup = temp / "version587-search-chooser-followup"
            followup_report = json.loads((followup / "validation.json").read_text(encoding="utf-8"))
            if (followup_report["baselineSHA256"] != contrast_sha
                    or followup_report["reverseRestoresExactInput"] is not True
                    or followup_report["otherPropertiesAndResourcesUnchanged"] is not True
                    or len(followup_report["colors"]) != 11 or len(followup_report["forms"]) != 4):
                raise ValueError("Search/chooser verification is incomplete")
            checked(project / "version587/search-chooser-followup.cjs", followup_report["generatorSHA256"])
            target = followup / "Foxmail.exe"
            checked(target, followup_report["candidateSHA256"])
            contrast_sha = followup_report["candidateSHA256"]
        if len(report["externalAssets"]) != 1:
            raise ValueError("Expected one additional attachment background")
        item = report["externalAssets"][0]
        if (item["relative"] != f"{BASE_VERSION}/PngImages/attach_select.png"
                or item["originalSHA256"] != "75f8ed7ab0a4e2b14a08f6c8e00ef351e541b5d4ed08862a675254813a0019dd"):
            raise ValueError("Unexpected attachment background inventory")
        data = checked(stage / "COMPOSE_ATTACH_SELECT_PNG.png", item["sha256"])
        if len(data) != item["length"]:
            raise ValueError("Unexpected additional asset length")
        additional_assets.append({key: item[key] for key in ("relative", "sha256", "length", "originalSHA256")})
        content["payload/" + item["relative"]] = data
        default_profile = contrast_profile
        inputs.append((contrast_profile, target, contrast_sha, payload / HELPER, sealed_helper["sha256"]))
    for name, executable, exe_sha, dll, helper_sha in inputs:
        target = base_exe if name == base_profile else checked(executable, exe_sha)
        helper = checked(dll, helper_sha)
        patch_path = f"profiles/{name}/exe-delta.json"
        helper_owner = base_profile if helper_sha == sealed_helper["sha256"] else name
        helper_path = f"profiles/{helper_owner}/{HELPER}"
        content[patch_path] = json_bytes(delta(original if name == base_profile else base_exe, target))
        content[helper_path] = helper
        profiles[name] = {"exeSHA256": exe_sha, "exeLength": len(target),
                          "helperSHA256": helper_sha, "helperLength": len(helper),
                          "patch": patch_path, "helper": helper_path}
        if name != base_profile:
            profiles[name]["baseProfile"] = base_profile

    kit_manifest = {
        "schema": 1, "baseVersion": BASE_VERSION, "originalExecutableSHA256": ORIGINAL_SHA,
        "originalExecutableLength": len(original), "assets": assets, "profiles": profiles,
    }
    if additional_assets:
        kit_manifest["additionalAssets"] = additional_assets
        profiles[contrast_profile]["additionalAssets"] = [item["relative"] for item in additional_assets]
    content["manifest.json"] = json_bytes(kit_manifest)
    source = Path(__file__).parent
    content["Apply-FoxmailDark.ps1"] = (source / "Apply-FoxmailDark.ps1").read_bytes()
    content["README.txt"] = (source / "README.txt").read_bytes()
    group = "version587-dark-port-kit-search-chooser" if args.search_chooser_followup else (
        "version587-dark-port-kit-contrast" if args.contrast_followup else (
            "version587-dark-port-kit-msaa" if args.msaa_tray_guard else "version587-dark-port-kit"))
    out = temp / group
    out.mkdir(exist_ok=True)
    output = out / "Foxmail-Dark-Port-Kit.zip"
    with tempfile.NamedTemporaryFile(dir=out, suffix=".partial", delete=False) as handle:
        partial = Path(handle.name)
    try:
        with zipfile.ZipFile(partial, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in sorted(content.items()):
                entry = zipfile.ZipInfo(name, date_time=(2026, 11, 7, 0, 0, 0))
                archive.writestr(entry, data, compress_type=zipfile.ZIP_DEFLATED)
        with zipfile.ZipFile(partial) as archive:
            if archive.testzip() is not None or set(archive.namelist()) != set(content):
                raise ValueError("Offline package validation failed")
        partial.replace(output)
    finally:
        partial.unlink(missing_ok=True)
    package = output.read_bytes()
    launcher = out / "Foxmail-Dark-Patch.cmd"
    cmd_sha = write_launcher(source, launcher, package, default_profile)
    print(json.dumps({"package": str(output), "sha256": sha(package), "cmd": str(launcher), "cmdSHA256": cmd_sha,
                      "entries": len(content), "assets": len(assets), "profiles": list(profiles)}))


if __name__ == "__main__":
    main()
