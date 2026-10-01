# painted fleet

ships, robots, containers and modules after the painted miniatures in
`../../../sketches`. `scripts/build-painted-fleet.py` builds them all.

| model | after | export | triangles |
| --- | --- | --- | --- |
| far-treasure | `parts-2d/ship.1` | `far-treasure.glb` | 6,328 |
| tug | `painted-parts-v1/ship-02` | `tug.glb` | 6,704 |
| hauler | `painted-parts-v1/ship-01`, as a container ship | `hauler.glb` | 26,636 |
| nobody | a raider built from other ships | `nobody.glb` | 7,028 |
| patrol-cutter | sol outpost authority | `patrol-cutter.glb` | 4,432 |
| tug-buoy | the advert buoy of the adrift flow | `tug-buoy.glb` | 2,728 |
| deckhand | `painted-parts-v1/robot-01` | `deckhand.glb` | 4,048 |
| porter | `painted-parts-v1/robot-02` | `porter.glb` | 2,376 |
| containers | iso boxes: 20 ft, 40 ft, high cube, reefer, tank, open top, flat rack | `containers.glb` | 7,720 |

the exports are in `../../public/models/painted/`, the sources here as
`.blend`. `painted-fleet.json` has the triangle count and the file size
of each model and each module.

## the far treasure is modular

the hull glb has 5 socket empties: `socket_power1`, `socket_cruise1`,
`socket_maneuver1`, `socket_cargo1` and `socket_utility1`. each has the
extras `family`, `mount` and `slot`.

each module is a separate glb in `../../public/models/painted/modules/`,
named after its design id: `reactor.mk1` → `reactor-mk1.glb`. the origin
of a module is its socket. put the module on the socket of its slot.
`empty-<family>.glb` shows a bare mount.

the planned modules are not in the domain: `cargo-tank`, `cargo-reefer`,
`cargo-pen`, `radar-mk1` and `driver-mk1`.

## one mesh per material

the script merges the static parts of each assembly before the export:
one mesh per material, about 10 draw calls a ship. these parts stay
apart, so a client can move them or make them blink:

- a joint: `head`, `arm_l`, `arm_r`, `leg_l`, `leg_r`, `wheel_l`,
  `wheel_r`. a robot faces +x; its limbs swing on the lateral axis.
- a lamp that blinks: any name with `tip`, `nav`, `lightbar`, `beacon`
  or `eye`.
- the radar arm, with the extra `spin`: it turns on its up axis, at that
  rate in rad/s.

the `.blend` files keep every part separate, before the merge.

## markers

- an empty with the extra `plume` marks a drive exit. `radius` sets the
  size of the plume. the plume points along -x.
- `sign_anchor` on the buoy marks the centre of its sign. the client
  puts the neon text there.
- the lamp material is emissive.

## containers

`containers.glb` holds one of each kind, each in its own group:
`container 20`, `container 40`, `container hc`, `container reefer`,
`container tank`, `container open` and `container flat`. a group's
origin is the centre of its box. a box is 0.96 wide and 1.0 high, or
1.12 for a high cube.

## the look

the colours are flat paint from the art: cream `#E4D5B0`, teal `#46757A`,
mustard `#E2A13B`, olive `#6E7C49`, rust `#94402F`, gunmetal `#3C3F44`.
the boxes use 12 shipping colours. the forms are chunky: rounded bevels,
45° corners along the hulls, raised plates with dark seams, mustard
pipes and handles, orange lamps.

the glb has flat colour only. the client adds the toon light, the
outline and the grime. the previews in `../../../sketches/painted-models`
show the result, at the angle of the painted sprites.

## reproduce

```sh
blender --background --python scripts/build-painted-fleet.py -- --output /tmp/painted-fleet
```

add `--only <model>` or `--only modules` to build one part, and
`--no-render` to skip the previews. the whole set builds in about 10 s.

coordinates: blender z up, bow +x; glb y up, bow +x.
