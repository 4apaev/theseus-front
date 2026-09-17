# lem station / first model study

original low-poly station blockout, with a reusable reactor module. these are
editable assets and previews. the station is integrated into the port view;
the reactor remains a reusable asset study.

## files

- `lem-station.blend`: editable source, orthographic camera, preview lighting,
  named facility groups, sockets, and dish animation.
- `../../../public/models/stations/lem-station.glb`: texture-free runtime export.
- `../../../public/art/stations/lem-station-base.png`: rgba station render with
  dish and beacons omitted, for a fixed-camera hybrid scene.
- `../../../public/art/stations/lem-station-camera.json`: matching camera metadata.
- `../../parts/reactor-mk02.blend`: separate reactor source.
- `../../../public/models/parts/reactor-mk02.glb`: reusable module export.
- `../../../sketches/lem-station-model-preview.png`: complete model preview.
- `../../../sketches/reactor-mk02-model-preview.png`: module preview.

## geometry and behavior

the station is approximately 5,200 triangles in 59 meshes. the reactor uses seven
meshes. these are deliberately simple blockouts, with no texture dependencies.
mesh count is not a performance guarantee: static assemblies can be merged by
material after interaction groups are agreed. the cast lettering is geometry.

the model uses prototype proportions. do not infer physical station dimensions
or game statistics from this study; establish physical scale before integration.

`market`, `rig`, `comms`, and `observatory` are separate selectable groups.
`socket_market`, `socket_comms`, and `socket_berth` are label anchors.
`dish_pivot` carries a ten-second scan-and-return animation; loop the exported
clip with the three.js animation mixer. `beacons` contains emissive meshes;
the port renderer animates their emission at runtime, independently of the dish.
preview cameras and lights are excluded from the glb.

## image plus 3d, or full 3d

for a fixed station composition, put a violet ether background behind the rgba
station image. render the dish and beacons with the supplied camera alignment.
the orthographic vertical span is in the camera metadata. preserve image aspect
ratio and fit the image and 3d viewport to the same rectangle. both must use the
same camera and resize transform. map blender coordinates `[x,y,z]` to exported
gltf coordinates `[x,z,-y]`.

hide the static groups visually when using the image. a depth-only copy of static
geometry can provide occlusion for moving parts, but adds draw calls. the baked
image omits shadows from the moving dish, so accurate moving shadows require a
separate solution. this alignment and occlusion pipeline is not implemented or
visually verified in the browser yet. keep the camera fixed: rotating a sprite
does not reveal a new view of the station.

the port view uses the full glb with free trackball rotation, a css ether layer,
and a simple decorative planet.
the present asset is small enough to make this worth measuring. it also gives
correct depth relationships and simpler selection. use html for labels, popups,
and accessible controls in either approach. keep atmosphere and bloom subdued
so the selected facility outline stays legible. honor reduced-motion settings.

interiors remain strong candidates for paintings: the market hall and clerk can
be one image while goods and the selected-item preview are models. match light
direction, contrast, palette, perspective, and contact shadows.

## typography

use the supplied lem book references as a hierarchy: bold literary serifs for
place names, condensed slab lettering for workshop and market signs, monospace
for controls, quantities, and messages. these are visual directions, not exact
font identifications. the model nameplate uses locally available georgia bold,
converted to geometry. no font file is distributed with the asset.

the new market mockup is `../../../sketches/lem-market-hybrid-view.png`.
it was generated with built-in imagegen; its prompt is saved beside it. the
mockup is a raster visual specification, not separately extracted background,
goods, or ui assets. its illustrated capacity bar is approximate; implement the
actual 6/24 fraction from game data.

## reproduce

run from the project root with blender installed:

```sh
blender --background --python scripts/build-lem-assets.py -- --output /tmp/lem-study-new
```

choose a new output directory. the script refuses to overwrite existing model
files. inspect the renders before copying outputs into the model, public, and
sketches folders. materials are shared and opaque; the preview backgrounds are
transparent. no app code is changed by the script.
