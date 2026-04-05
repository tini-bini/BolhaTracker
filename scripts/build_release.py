from __future__ import annotations

import json
import os
import re
import shutil
from pathlib import Path
from urllib.parse import urlparse

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
    "theme.css",
    "utils.js",
]


def normalize_backend_origin(raw_origin: str, *, production: bool) -> str | None:
    value = (raw_origin or "").strip().rstrip("/")

    if not value:
        return None

    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or parsed.path not in {"", "/"}:
        raise SystemExit(f"Invalid backend origin: {value}")

    hostname = (parsed.hostname or "").lower()
    is_local = hostname in {"127.0.0.1", "localhost"}

    if production:
        if parsed.scheme != "https":
            raise SystemExit("Production release requires an HTTPS backend origin.")
        if is_local:
            raise SystemExit("Production release cannot target localhost as backend origin.")
    elif parsed.scheme == "http" and not is_local:
        raise SystemExit("Non-local HTTP backend origins are not allowed.")

    return value


def get_release_channel() -> str:
    raw = os.environ.get("BOLHA_RELEASE_CHANNEL", "development").strip().lower()

    if raw not in {"development", "production"}:
        raise SystemExit("BOLHA_RELEASE_CHANNEL must be either 'development' or 'production'.")

    return raw


def to_host_permission_pattern(origin: str) -> str:
    parsed = urlparse(origin)
    hostname = parsed.hostname or ""
    return f"{parsed.scheme}://{hostname}/*"


def patch_manifest_for_backend(manifest: dict, backend_origin: str | None, *, production: bool) -> dict:
    patched = json.loads(json.dumps(manifest))
    host_permissions = ["https://www.bolha.com/*"]
    connect_sources = ["'self'"]

    if backend_origin:
        host_permissions.append(to_host_permission_pattern(backend_origin))
        connect_sources.append(backend_origin)
    elif not production:
        host_permissions.extend([
            "http://127.0.0.1/*",
            "http://localhost/*"
        ])
        connect_sources.extend([
            "http://127.0.0.1:*",
            "http://localhost:*"
        ])
    else:
        raise SystemExit("Production release requires BOLHA_EXTENSION_API_ORIGIN to be set.")

    patched["host_permissions"] = host_permissions
    patched.setdefault("content_security_policy", {})
    patched["content_security_policy"]["extension_pages"] = (
        "script-src 'self'; object-src 'self'; base-uri 'self'; "
        f"connect-src {' '.join(connect_sources)};"
    )
    return patched


def patch_utils_backend_origin(source: str, backend_origin: str | None) -> str:
    target_origin = backend_origin or "http://127.0.0.1:8787"
    pattern = r'const PREMIUM_SERVER_ORIGIN = "[^"]+";'
    replacement = f'const PREMIUM_SERVER_ORIGIN = "{target_origin}";'
    next_source, count = re.subn(pattern, replacement, source, count=1)

    if count != 1:
        raise SystemExit("Could not patch PREMIUM_SERVER_ORIGIN in utils.js")

    return next_source


def build_release_zip() -> Path:
    release_channel = get_release_channel()
    production = release_channel == "production"
    configured_origin = normalize_backend_origin(
        os.environ.get("BOLHA_EXTENSION_API_ORIGIN", ""),
        production=production
    )
    manifest = patch_manifest_for_backend(load_manifest(), configured_origin, production=production)
    version = manifest["version"]
    dist_dir = ROOT / "dist"
    build_dir = dist_dir / "package"
    suffix = "" if production else "-dev"
    artifact_base = dist_dir / f"bolha-price-tracker-v{version}{suffix}"
    artifact_zip = Path(f"{artifact_base}.zip")

    if dist_dir.exists():
        shutil.rmtree(dist_dir)

    build_dir.mkdir(parents=True, exist_ok=True)

    for relative_name in INCLUDE_FILES:
        source = ROOT / relative_name
        destination = build_dir / relative_name
        destination.parent.mkdir(parents=True, exist_ok=True)

        if relative_name == "manifest.json":
            destination.write_text(
                json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8"
            )
            continue

        if relative_name == "utils.js":
            destination.write_text(
                patch_utils_backend_origin(source.read_text(encoding="utf-8"), configured_origin),
                encoding="utf-8"
            )
            continue

        shutil.copy2(source, destination)

    shutil.copytree(ROOT / "icons", build_dir / "icons")
    shutil.make_archive(str(artifact_base), "zip", build_dir)
    return artifact_zip


def main() -> None:
    print_step("building release artifact")
    channel = get_release_channel()
    backend_origin = normalize_backend_origin(
        os.environ.get("BOLHA_EXTENSION_API_ORIGIN", ""),
        production=channel == "production"
    )
    print(f"release channel: {channel}")
    print(f"backend origin: {backend_origin or 'development-localhost'}")
    artifact = build_release_zip()
    print(f"release artifact: {artifact}")
    print("upload this zip directly to Chrome Web Store; do not zip the repository root or dist/package.")


if __name__ == "__main__":
    main()
