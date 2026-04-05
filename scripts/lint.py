from __future__ import annotations

import json
import re
from pathlib import Path

from release_helpers import ROOT, get_node_command, print_step, run


TEXT_EXTENSIONS = {".js", ".json", ".html", ".css", ".md", ".py"}
JS_FILES = sorted(path.name for path in ROOT.glob("*.js"))


def ensure_no_trailing_whitespace() -> None:
    for path in ROOT.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        if any(part.startswith(".git") or part in {"dist", ".tools", "__pycache__", "node_modules", "test-results", "playwright-report"} for part in path.parts):
            continue

        for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if re.search(r"[ \t]+$", line):
                raise SystemExit(f"Trailing whitespace found in {path.relative_to(ROOT)}:{line_number}")


def ensure_manifest_is_valid() -> None:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    required = {"manifest_version", "name", "version", "background", "action"}
    missing = sorted(required - manifest.keys())
    if missing:
        raise SystemExit(f"Manifest is missing required keys: {', '.join(missing)}")


def ensure_python_syntax() -> None:
    for path in sorted((ROOT / "scripts").glob("*.py")):
        source = path.read_text(encoding="utf-8")
        compile(source, str(path), "exec")


def ensure_js_syntax() -> None:
    node = get_node_command()
    for file_name in JS_FILES:
        run(node + ["--check", file_name], f"Syntax check for {file_name}")


def main() -> None:
    print_step("checking formatting and manifest shape")
    ensure_no_trailing_whitespace()
    ensure_manifest_is_valid()
    ensure_python_syntax()
    print_step("checking JavaScript syntax")
    ensure_js_syntax()
    print("lint ok")


if __name__ == "__main__":
    main()
