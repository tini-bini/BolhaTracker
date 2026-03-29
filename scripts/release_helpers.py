from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
NODE = ROOT / ".tools" / "node-v22.15.0-win-x64" / "node.exe"


def get_node_command() -> list[str]:
    if NODE.exists():
        return [str(NODE)]

    return ["node"]


def run(command: list[str], label: str) -> None:
    completed = subprocess.run(command, cwd=ROOT, check=False)
    if completed.returncode != 0:
        raise SystemExit(f"{label} failed with exit code {completed.returncode}.")


def load_manifest() -> dict:
    return json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))


def print_step(label: str) -> None:
    print(f"[release] {label}")


if __name__ == "__main__":
    print("Use one of the dedicated scripts in /scripts.")
