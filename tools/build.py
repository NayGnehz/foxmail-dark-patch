"""Reproduce the reviewed v5.1.0 CMD from its kit and installer source."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
from textwrap import wrap
import zipfile

KIT_SHA256 = "818efd3e80dabaac702a33e65f233aea6807781aca5ee183980cf58d2f6129ba"
CMD_SHA256 = "021a73246daef8d68f6d232a7e02ac87c0ecf9bec38a1ccd613451742e941e85"
DEFAULT_PROFILE = "5.0-msaa-contrast"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def build(kit, output):
    data = Path(kit).read_bytes()
    if sha(data) != KIT_SHA256:
        raise ValueError("Use the reviewed v5.1.0 kit; its SHA-256 differs")
    source = Path(__file__).resolve().parents[1] / "src/installer"
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        if archive.testzip() is not None:
            raise ValueError("Invalid kit archive")
        manifest = json.loads(archive.read("manifest.json"))
        assert manifest["profiles"][DEFAULT_PROFILE]["exeSHA256"] == "845dd43375c99a24b4f9e4273f50aa2c4a041a2b734d9f3144a04880881d1920"
        loader = (source / "Apply-FoxmailDark.ps1").read_text(encoding="ascii")
        if archive.read("Apply-FoxmailDark.ps1").decode("ascii").replace("\r\n", "\n") != loader:
            raise ValueError("Installer source differs from the reviewed kit")
    bootstrap = (source / "launch-bootstrap.ps1").read_text(encoding="ascii")
    bootstrap = bootstrap.replace("__FOXMAIL_ARCHIVE_SHA__", sha(data)).replace("__FOXMAIL_DEFAULT_PROFILE__", DEFAULT_PROFILE)
    requirement, _, apply = loader.partition("\n")
    if requirement != "#requires -Version 5.1":
        raise ValueError("Windows PowerShell 5.1 requirement missing")
    install = (source / "install-in-place.ps1").read_text(encoding="ascii")
    command = "& {\n" + install + "\n$apply = {\n" + apply + "\n}\n" + bootstrap + "\n}\n\n"
    template = (source / "launch.cmd").read_text(encoding="ascii")
    encoded = "\n".join(wrap(base64.b64encode(data).decode("ascii"), 76))
    prefix, marker, _ = template.replace("__FOXMAIL_ARCHIVE__", encoded).partition("__FOXMAIL_COMMAND__")
    if not marker or not prefix.endswith("\n"):
        raise ValueError("Invalid launcher template")
    launcher = prefix.replace("__FOXMAIL_COMMAND_LINE__", str(prefix.count("\n"))) + command
    result = launcher.replace("\n", "\r\n").encode("ascii")
    if sha(result) != CMD_SHA256:
        raise ValueError("Rebuilt CMD differs from the reviewed release")
    output = Path(output)
    if output.exists():
        raise FileExistsError("Output must not exist")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(result)
    return {"file": output.name, "bytes": len(result), "sha256": sha(result)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--kit", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.kit, args.output)))
