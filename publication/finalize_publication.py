"""Write public documentation and stage byte-identical reviewed release assets."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
from audit_history import git


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--git", required=True)
    parser.add_argument("--group", required=True)
    args = parser.parse_args()
    source = Path(__file__).resolve().parents[1]
    temp = Path(os.environ["PORTABLE_INSTANCE_ROOT"]) / "temp"
    stage = temp / args.group
    preparation = json.loads((stage / "preparation.json").read_text())
    mirror = stage / "repository"
    assert git(args.git, source, "rev-parse", "main").decode().strip() == preparation["sourceHead"]
    assert git(args.git, mirror, "rev-parse", "main").decode().strip() == preparation["publicHead"]
    original_readme = (mirror / "README.md").read_text(encoding="utf-8")
    (mirror / "docs" / "DEVELOPMENT.md").write_text(original_readme, encoding="utf-8")
    (mirror / "README.md").write_bytes((source / "publication/public-readme.md").read_bytes())
    (mirror / "CHANGELOG.md").write_text("# 更新记录\n\n## v5.1.0 — 2026-11-15\n\n" + (source / "publication/release-notes.md").read_text(encoding="utf-8") + "\n\n## 早期版本\n\n1.0 至 5.0 的研究、回退和验收过程保存在逐次 Git 提交与 docs、version587 文档中。\n", encoding="utf-8")
    (mirror / "PUBLICATION.md").write_text("# 公开范围与隐私\n\n本仓库保留脱敏后的全部正式修改历史。公开副本独立生成，没有改写原本地仓库。\n\n所有提交作者和提交者统一匿名化，时间统一显示为 UTC；真实邮箱、个人目录名、机器标识和诊断 UUID 已泛化。\n图片仅为已知皮肤控件，已移除文本、EXIF 和时间元数据。\n未提交实验、内部检查点、工具链、原始程序、录屏、崩溃转储、邮件、账户和个人设置未上传。\n\nRelease 保留通过验收的补丁文件原字节。隐私检查同时覆盖压缩条目、DLL、UTF-16 字符串和编码的 EXE 差分。\n历史中的目录路径为示例，旧提交 SHA 是本地开发记录中的引用，不等于公开历史 SHA。\n\n构建环境及部分历史输入不随源码提供；不能将历史开发脚本当成跨版本通用补丁。\n", encoding="utf-8")
    git(args.git, mirror, "add", "--", "README.md", "CHANGELOG.md", "PUBLICATION.md", "docs/DEVELOPMENT.md")
    env = dict(os.environ, GIT_AUTHOR_DATE="2026-11-15T04:00:00+0000", GIT_COMMITTER_DATE="2026-11-15T04:00:00+0000")
    subprocess.run([args.git, "-C", str(mirror), "-c", "user.name=Foxmail Dark Patch", "-c", "user.email=noreply@example.invalid", "commit", "-m", "Document public installation, privacy scope and v5.1.0 release"], env=env, check=True, capture_output=True)
    assets = stage / "assets"
    assets.mkdir()
    kit = temp / "version587-dark-port-kit-receive-first-erase"
    expected = {"Foxmail-Dark-Patch.cmd": "021a73246daef8d68f6d232a7e02ac87c0ecf9bec38a1ccd613451742e941e85", "Foxmail-Dark-Port-Kit.zip": "818efd3e80dabaac702a33e65f233aea6807781aca5ee183980cf58d2f6129ba"}
    for name, sha in expected.items():
        assert hashlib.sha256((kit / name).read_bytes()).hexdigest() == sha
        shutil.copyfile(kit / name, assets / name)
    usage = (source / "publication/release-notes.md").read_text(encoding="utf-8")
    (assets / "README.txt").write_text(usage, encoding="utf-8-sig")
    expected["README.txt"] = hashlib.sha256((assets / "README.txt").read_bytes()).hexdigest()
    (assets / "SHA256SUMS.txt").write_text("".join(f"{sha}  {name}\n" for name, sha in expected.items()), encoding="ascii")
    expected["SHA256SUMS.txt"] = hashlib.sha256((assets / "SHA256SUMS.txt").read_bytes()).hexdigest()
    result = {"repository": str(mirror), "version": "v5.1.0", "head": git(args.git, mirror, "rev-parse", "main").decode().strip(), "commits": int(git(args.git, mirror, "rev-list", "--count", "main")), "assets": expected}
    (stage / "ready.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
