from __future__ import annotations

import shutil
from pathlib import Path

from release_helpers import ROOT, load_manifest, print_step


INCLUDE_FILES = [
    "content.js",
    "i18n.js",
    "manifest.json",
    "options.css",
    "options.html",
    "options.js",
    "panel.css",
    "panel.js",
    "popup.css",
    "popup.html",
    "popup.js",
    "service-worker.js",
    "styles.css",
    "utils.js",
]


def build_release_zip() -> Path:
    manifest = load_manifest()
    version = manifest["version"]
    dist_dir = ROOT / "dist"
    build_dir = dist_dir / "package"
    artifact_base = dist_dir / f"bolha-price-tracker-v{version}"
    artifact_zip = Path(f"{artifact_base}.zip")

    if dist_dir.exists():
        shutil.rmtree(dist_dir)

    build_dir.mkdir(parents=True, exist_ok=True)

    for relative_name in INCLUDE_FILES:
        source = ROOT / relative_name
        destination = build_dir / relative_name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)

    shutil.copytree(ROOT / "icons", build_dir / "icons")
    shutil.make_archive(str(artifact_base), "zip", build_dir)
    return artifact_zip


def main() -> None:
    print_step("building release artifact")
    artifact = build_release_zip()
    print(f"release artifact: {artifact}")


if __name__ == "__main__":
    main()
