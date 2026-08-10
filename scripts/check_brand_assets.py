#!/usr/bin/env python3
"""Verify the documentation logo and favicon against the public brand owner."""

from __future__ import annotations

import hashlib
import json
import pathlib
import struct
import sys


ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "brand-assets.json"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def png_identity(path: pathlib.Path) -> tuple[int, int, int]:
    data = path.read_bytes()
    if len(data) < 33 or data[:8] != PNG_SIGNATURE or data[12:16] != b"IHDR":
        raise ValueError(f"{path.relative_to(ROOT)} is not a canonical PNG")
    width, height, _bit_depth, color_type = struct.unpack(">IIBB", data[16:26])
    return width, height, color_type


def check() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != 1:
        raise ValueError("brand-assets.json has an unsupported schemaVersion")

    expected_paths: set[pathlib.Path] = set()
    for asset in manifest["assets"]:
        relative = pathlib.Path(asset["path"])
        path = ROOT / relative
        expected_paths.add(path)
        if not path.is_file():
            raise ValueError(f"missing approved brand asset: {relative}")
        if sha256(path) != asset["sha256"]:
            raise ValueError(f"brand asset digest drifted: {relative}")
        if png_identity(path) != (
            asset["width"],
            asset["height"],
            asset["colorType"],
        ):
            raise ValueError(f"brand PNG dimensions or alpha contract drifted: {relative}")

    for relative in map(pathlib.Path, manifest["removedPaths"]):
        if (ROOT / relative).exists():
            raise ValueError(f"legacy brand path must stay removed: {relative}")

    candidates = {
        path
        for path in ROOT.rglob("*")
        if path.is_file()
        and path.suffix.lower() in {".ico", ".png", ".svg", ".webp"}
        and ("logbrew" in path.name.lower() or "favicon" in path.name.lower())
    }
    if candidates != expected_paths:
        unexpected = sorted(path.relative_to(ROOT).as_posix() for path in candidates - expected_paths)
        missing = sorted(path.relative_to(ROOT).as_posix() for path in expected_paths - candidates)
        raise ValueError(f"brand asset inventory drifted: unexpected={unexpected}, missing={missing}")

    legacy_hashes = set(manifest["legacySha256"])
    legacy = next((path for path in candidates if sha256(path) in legacy_hashes), None)
    if legacy is not None:
        raise ValueError(f"legacy brand artwork returned at {legacy.relative_to(ROOT)}")

    docs_config = json.loads((ROOT / "docs.json").read_text(encoding="utf-8"))
    expected_logo = "/logo/logbrew-logo-transparent-512.png"
    if docs_config.get("logo") != {
        "light": expected_logo,
        "dark": expected_logo,
        "href": "https://logbrew.co",
    }:
        raise ValueError("docs.json must use the approved transparent inline logo")
    if docs_config.get("favicon") != "/favicon-512.png":
        raise ValueError("docs.json must use the approved espresso favicon")


def main() -> int:
    try:
        check()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"brand asset check failed: {error}", file=sys.stderr)
        return 1
    print("brand assets ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
