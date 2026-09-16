import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
assets_dir = BASE_DIR / "static" / "assets"
assets_dir.mkdir(parents=True, exist_ok=True)

svg_cover = """<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
<rect width="300" height="300" fill="#282828"/>
<circle cx="150" cy="150" r="60" fill="#1db954" opacity="0.85"/>
<polygon points="135,120 180,150 135,180" fill="#ffffff"/>
</svg>"""

svg_avatar = """<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
<rect width="300" height="300" fill="#1e1e1e"/>
<circle cx="150" cy="110" r="50" fill="#535353"/>
<circle cx="150" cy="260" r="90" fill="#535353"/>
</svg>"""

(assets_dir / "default_cover.png").write_text(svg_cover, encoding="utf-8")
(assets_dir / "default_avatar.png").write_text(svg_avatar, encoding="utf-8")
(assets_dir / "default_playlist.png").write_text(svg_cover, encoding="utf-8")
print("Assets placeholders created successfully.")
