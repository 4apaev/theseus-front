"""Assemble the preview page: python3 prototype/build.py [--wrap]

writes index.html (the artifact page) and test.html (with a doctype, for a
local server). --wrap also writes models/*.json, the glb exports as base64,
which the artifact host can serve.
"""
import base64, json, sys
from pathlib import Path

here = Path(__file__).resolve().parent
read = lambda f: (here / f).read_text()
js = '\n'.join(read(f) for f in ['core.js', 'stage.js', 'ship.js', 'screens.js'])
data = json.dumps(json.loads(read('data.json')), separators=(',', ':'))
assert js.count('/*DATA*/null') == 1
js = js.replace('/*DATA*/null', data)
scripts = ('\n<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
    '\n<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>\n<script>\n')
page = read('page.html') + scripts + js + '\n</script>\n'
(here / 'index.html').write_text(page)
(here / 'test.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n' + page)
if '--wrap' in sys.argv:
    src = here.parent / 'public' / 'models' / 'painted'
    for glb in src.rglob('*.glb'):
        out = here / 'models' / glb.relative_to(src).with_suffix('.json')
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps({'glb': base64.b64encode(glb.read_bytes()).decode()}))
print('built', len(page) // 1024, 'KB')
