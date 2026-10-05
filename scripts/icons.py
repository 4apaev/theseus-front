# the icons for the client: 256 px webp from the big painted png in ../assets/icons.
# writes only an icon that is missing or older than its source.
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
for src in sorted((root.parent / 'assets' / 'icons').glob('*/*.png')):
    out = root / 'public' / 'art' / 'icons' / src.parent.name / f'{ src.stem }.webp'
    if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
        continue
    out.parent.mkdir(parents=True, exist_ok=True)
    im = Image.open(src)
    im.thumbnail((256, 256), Image.LANCZOS)
    im.save(out, 'webp', quality=85)
    print(f'icon { out.relative_to(root) }')
