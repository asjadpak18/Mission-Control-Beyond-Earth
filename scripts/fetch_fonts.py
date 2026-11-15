#!/usr/bin/env python3
"""Download latin-subset variable woff2 fonts from Google Fonts for self-hosting.

Restores src/app/fonts/{orbitron,space-grotesk,jetbrains-mono}-variable.woff2
used by src/app/layout.tsx via next/font/local. Only needed if the font files
are ever lost — the game itself never calls this.
"""
import re
import subprocess
import sys

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

FAMILIES = {
    "Orbitron:wght@400..900": "orbitron",
    "Space+Grotesk:wght@300..700": "space-grotesk",
    "JetBrains+Mono:wght@100..800": "jetbrains-mono",
}

OUT_DIR = "/home/z/my-project/src/app/fonts"


def fetch(url: str) -> str:
    r = subprocess.run(
        ["curl", "-s", "-m", "20", "-H", f"User-Agent: {UA}", url],
        capture_output=True, text=True, check=True,
    )
    return r.stdout


def main() -> int:
    ok = True
    for family, name in FAMILIES.items():
        css = fetch(f"https://fonts.googleapis.com/css2?family={family}&display=swap")
        blocks = re.findall(
            r"/\*\s*([a-z-]+)\s*\*/\s*@font-face\s*\{(.*?)\}", css, re.S
        )
        latin = next(((sub, body) for sub, body in blocks if sub == "latin"), None)
        if not latin:
            print(f"[FAIL] no latin block for {family}", file=sys.stderr)
            ok = False
            continue
        body = latin[1]
        m = re.search(r"src:\s*url\(([^)]+)\)", body)
        w = re.search(r"font-weight:\s*([\d\s]+);", body)
        if not m:
            print(f"[FAIL] no src url for {family}", file=sys.stderr)
            ok = False
            continue
        url = m.group(1)
        weight_range = w.group(1).strip() if w else "?"
        data = subprocess.run(
            ["curl", "-s", "-m", "30", url], capture_output=True, check=True
        ).stdout
        ext = url.rsplit(".", 1)[-1]
        path = f"{OUT_DIR}/{name}-variable.{ext}"
        with open(path, "wb") as f:
            f.write(data)
        size = len(data)
        magic = data[:4]
        print(f"[OK] {name:16s} weight {weight_range:9s} -> {path} "
              f"({size/1024:.1f} KiB, magic={magic!r})")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
