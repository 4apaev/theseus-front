# port of many hands / the second station

the system gateway: a wide concourse drum on a red frame, with arrivals,
freight, research and habitation around it. it follows the concept
painting `../../../sketches/port-of-many-hands-model-preview.png`
reproduces. the port view shows it at every hub station: `sol.mars`, and
the gateway station of every other system. see `stationModel()` in
`src/render/lem-station.ts`.

## files

- `port-of-many-hands.blend`: editable source, orthographic camera, preview lighting.
- `port-of-many-hands-camera.json`: camera metadata and mesh counts.
- `../../../public/models/stations/port-of-many-hands.glb`: texture-free runtime export.
- `../../../sketches/port-of-many-hands-model-preview.png`: model preview.

## geometry and behavior

about 14,100 triangles in 216 meshes. cast lettering is geometry. lit
windows are one mesh per band. the greenhouse dome is alpha-blended glass.
proportions are prototype scale, not physical dimensions.

the runtime contract is the lem station's:

| node            | role                                                        |
|-----------------|-------------------------------------------------------------|
| `rig`           | the arrivals arm: corridor, hall, docking ring and arms     |
| `market`        | the freight spine: hall, deck, containers, crane, fuel tanks |
| `comms`         | research: lab, greenhouse, silos, solar wing                 |
| `concourse`     | the drum, its frame, the keel module, the mast tower         |
| `habitation`    | towers 03 and the left solar wing, scenery                   |
| `socket_berth`  | label anchor at the docking ring. a docked hull goes here    |
| `socket_market` | label anchor at the freight hall                             |
| `socket_comms`  | label anchor at the lab                                      |
| `dish_pivot`    | the mast dish. one ten-second scan-and-return clip           |
| `beacons`       | 3 emissive lamps. the renderer animates their emission       |

no ships are in the export. docked traffic is runtime data.

## reproduce

run from the project root with blender installed:

```sh
blender --background --python scripts/build-port-of-many-hands.py -- --output /tmp/port-new
```

the script refuses to overwrite its deliverables. it imports
`scripts/stationkit.py`, the helpers both station builders share:
primitives, lattice towers, gantries, dishes, window bands, cast
lettering, signs, solar wings, crate stacks, preview and export.
