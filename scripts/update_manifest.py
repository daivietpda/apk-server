#!/usr/bin/env python3
import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
APK_DIR = ROOT / "apk"
POLICY_PATH = ROOT / "manifest-policy.json"
MANIFEST_PATH = ROOT / "manifest.json"
DEFAULT_BASE_URL = "https://daivietpda.github.io/apk-server/apk"
PACKAGE_RE = re.compile(r"^[A-Za-z0-9._]+$")


def read_policy():
    if not POLICY_PATH.exists():
        return {}
    data = json.loads(POLICY_PATH.read_text(encoding="utf-8-sig"))
    return {
        item["file"]: {
            "packageName": item.get("packageName", ""),
            "forceInstall": bool(item.get("forceInstall", False)),
        }
        for item in data.get("packages", [])
        if item.get("file")
    }


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def atomic_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    temporary.replace(path)


def main():
    parser = argparse.ArgumentParser(description="Generate remote APK manifest")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--set-apk", help="APK filename whose policy will be changed")
    parser.add_argument("--package-name", default="")
    parser.add_argument("--force-install", choices=("true", "false"))
    args = parser.parse_args()

    apk_files = sorted(APK_DIR.glob("*.apk"), key=lambda item: item.name.lower())
    if not apk_files:
        raise SystemExit(f"No APK files found in {APK_DIR}")

    policies = read_policy()
    if args.set_apk:
        selected = APK_DIR / args.set_apk
        if not selected.is_file() or selected.suffix.lower() != ".apk":
            raise SystemExit(f"APK does not exist: {args.set_apk}")
        if args.force_install is None:
            raise SystemExit("--force-install is required with --set-apk")
        enabled = args.force_install == "true"
        if enabled and not PACKAGE_RE.fullmatch(args.package_name):
            raise SystemExit("A valid --package-name is required for force-install=true")
        policies[selected.name] = {
            "packageName": args.package_name if enabled else "",
            "forceInstall": enabled,
        }

    normalized_policies = []
    packages = []
    base_url = args.base_url.rstrip("/")
    for apk in apk_files:
        policy = policies.get(apk.name, {"packageName": "", "forceInstall": False})
        package_name = str(policy.get("packageName", ""))
        force_install = bool(policy.get("forceInstall", False))
        if force_install and not PACKAGE_RE.fullmatch(package_name):
            raise SystemExit(f"Invalid packageName policy for {apk.name}")
        normalized_policies.append({
            "file": apk.name,
            "packageName": package_name,
            "forceInstall": force_install,
        })
        packages.append({
            "name": apk.stem,
            "packageName": package_name,
            "forceInstall": force_install,
            "url": f"{base_url}/{quote(apk.name)}",
            "sha256": sha256(apk),
            "size": apk.stat().st_size,
        })

    atomic_json(POLICY_PATH, {"version": 1, "packages": normalized_policies})
    atomic_json(MANIFEST_PATH, {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "version": 1,
        "packages": packages,
    })
    print(f"Generated {MANIFEST_PATH} with {len(packages)} APK(s)")


if __name__ == "__main__":
    main()
