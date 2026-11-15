"""Check exact release reproduction and refusal of modified inputs."""
import argparse
import importlib.util
from pathlib import Path
import re


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--kit", type=Path, required=True)
    parser.add_argument("--output-directory", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    spec = importlib.util.spec_from_file_location("compact_build", root / "tools/build.py")
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    args.output_directory.mkdir(parents=True, exist_ok=False)
    target = args.output_directory / "Foxmail-Dark-Patch.cmd"
    report = builder.build(args.kit, target)
    assert report["sha256"] == builder.CMD_SHA256
    try:
        builder.build(args.kit, target)
    except FileExistsError:
        pass
    else:
        raise AssertionError("Existing output was overwritten")
    altered = args.output_directory / "modified-kit.zip"
    altered.write_bytes(args.kit.read_bytes() + b"modified")
    try:
        builder.build(altered, args.output_directory / "unexpected.cmd")
    except ValueError:
        pass
    else:
        raise AssertionError("Modified kit was accepted")
    assert not (args.output_directory / "unexpected.cmd").exists()
    dependencies = 0
    for file in (root / "src").rglob("*.cjs"):
        for name in re.findall(r"require\(['\"](\.[^'\"]+\.cjs)['\"]\)", file.read_text(encoding="utf-8")):
            assert (file.parent / name).is_file(), (file.relative_to(root), name)
            dependencies += 1
    print(f"PASS: exact release CMD, existing output protection, modified kit rejection, {dependencies} local module references")


if __name__ == "__main__":
    main()
