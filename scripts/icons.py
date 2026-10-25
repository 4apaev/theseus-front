# the icons and sprites for the client: webp from the big png in ../assets.
# writes only a file that is missing or older than its source.
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
art  = root.parent / 'assets'

# the source, the folder in public/art, the size; an icon keeps its set's folder
SETS = [
    ('icons/*/*.png', 'icons', 256),
    ('icons/toy/*/*.png', 'toy/icons', 256),
    ('concepts/toy/sprites/*.png', 'toy/sprites', 512),
]

for pattern, to, px in SETS:
    for src in sorted(art.glob(pattern)):
        out = root / 'public' / 'art' / to / (src.parent.name if to.endswith('icons') else '') / f'{ src.stem }.webp'
        if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        im = Image.open(src)
        im.thumbnail((px, px), Image.LANCZOS)
        im.save(out, 'webp', quality=85)
        print(f'icon { out.relative_to(root) }')
