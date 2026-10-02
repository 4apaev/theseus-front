# the painted preview

the prototype of the painted client: plain js on three.js r128, one page,
no build tool. it is the seed of the rewrite, not part of the client.
the published page: https://claude.ai/artifact/KSM5fYf1LMe7nY9g2nwn6c

## run

```sh
python3 prototype/build.py
python3 -m http.server 8770
```

open `http://localhost:8770/prototype/test.html?local`. `?local` loads the
glb exports from `public/models/painted/`. add `pdb` to keep the drawing
buffer for screenshots.

to publish, run `python3 prototype/build.py --wrap` and publish
`index.html` with `art/` and `models/` as its files.

## the parts, and where they go in the rewrite

| file | holds | goes to |
| --- | --- | --- |
| `core.js` | the seed formulas, the demo state, the ₢ counter, icons, drag | `core/` keeps the server's rules; the rest to `kit/` |
| `stage.js` | the stage and its layers, the sky shaders, planet maps | `world/` |
| `ship.js` | the toon paint, the outline, the glb loader, ships, robots | `world/` and `content/` |
| `screens.js` | port, exchange, rigging, chart, adrift, hangar | `places/` |
| `page.html` | the page, the kit styles | `kit/` styles |
| `data.json` | the seed, exported from `packages/domain` | the gateway's `/api/universe` |
| `art/` | sprites from `painted-parts-v1` as webp | `public/` through the asset sync |

the demo state is local: a wallet, a hold and a rig in memory. the real
client reads them from the session.
