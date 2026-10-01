# lem station

the observatory that became a port, after `../../../sketches/lem-port-view.png`:
the domed pressure hull with cast lettering, a red lattice tower for the
listening dish with module 03 below it, market hall 02 with crate stacks
on lattice legs, the signals office with masts and a relay dish, repair
berth 04 with an ochre gantry, a sphere tank, the keel truss and probe,
and the hanging banner. the port view shows the station at every
lem-class outpost, see `stationModel()` in `src/render/lem-station.ts`.
the second station is [port of many hands](../many-hands/readme.md).

## files

- `lem-station.blend`: editable source, orthographic camera, preview lighting,
  named facility groups, sockets, and the dish animation.
- `lem-station-camera.json`: camera metadata and mesh counts.
- `../../../public/models/stations/lem-station.glb`: texture-free runtime export.
- `../../../sketches/lem-station-model-preview.png`: model preview.
- `../../parts/reactor-mk02.blend`: a separate module study the same
  script builds. its export is not shipped.
  `../../../sketches/reactor-mk02-model-preview.png` shows it.

## geometry and behavior

about 8,300 triangles in 178 meshes. no texture dependencies. mesh count
is not a performance guarantee: static assemblies can be merged by
material once interaction groups settle. the cast lettering and the
module numbers are geometry. lit windows are one mesh per band.

proportions are prototype scale. do not infer physical dimensions or
game statistics from this model.

`market`, `rig`, `comms`, `observatory` and `dish_support` are separate
groups. `socket_market`, `socket_comms`, and `socket_berth` are label
anchors; no ship is in the export, the player's hull docks at
`socket_berth` at runtime. `dish_pivot` carries a ten-second
scan-and-return animation; loop the exported clip with the three.js
animation mixer. `beacons` contains emissive meshes; the port renderer
animates their emission at runtime. preview cameras and lights are
excluded from the glb.

## typography

use the lem book references as a hierarchy: bold literary serifs for
place names, condensed slab lettering for workshop and market signs,
monospace for controls, quantities, and messages. the nameplate uses
locally available georgia bold, converted to geometry. no font file is
distributed with the asset.

## reproduce

run from the project root with blender installed:

```sh
blender --background --python scripts/build-lem-assets.py -- --output /tmp/lem-new
```

choose a new output directory. the script refuses to overwrite existing
model files. inspect the render before copying outputs into the model,
public, and sketches folders. the script imports `scripts/stationkit.py`,
shared with the second station builder. materials are shared and
opaque; the preview background is transparent.
