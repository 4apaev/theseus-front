# model sources

editable blender sources live here. the browser serves their exported `.glb`
files from `public/models/`. design illustrations live in `../sketches/`.

```text
models/
    civil/
        wandering-ward/wandering-ward.blend
        prison-barge/county-line.blend
    research/
        discovery/discovery.blend
        survey/the-hypothesis.blend
    industrial/
        tanker/tanker.blend
        terraforming-ark/garden-debt.blend
    military/
        corvette/quiet-argument.blend
        frigate/frigate.blend
        battleship/battleship.blend
    parts/
        engines.blend
        radiators.blend
```

the hull filenames above are the intended layout. `.gitkeep` files preserve
empty directories. the first editable studies are `stations/lem/lem-station.blend`
and `parts/reactor-mk02.blend`, with matching glb exports. see
[lem station notes](stations/lem/readme.md) for previews and reproduction.

## export convention

- export each hull as `public/models/<category>/<hull>.glb`.
- export reusable parts as `public/models/parts/<part>.glb`.
- keep a consistent scale, origin, and forward direction across models.
- keep selectable assemblies separate and name them `cargo`, `drive`, and `comms`.
  the loader will map `comms` to the existing `ansible` module id.
- use named empty objects for attachment sockets.
- keep preview lights and cameras out of the game asset export.

`scripts/build-lem-assets.py` reproduces the first station and reactor studies.
the station export is loaded by `src/render/lem-scene.ts`. the existing ship and
market procedural models remain in `src/render/`; reactor integration is pending.

## ship studies

[the sunday catch, patient cargo, and wandering ward](ship-studies.md) include
editable sources, glb exports, and two preview angles each. the ward keeps its
habitation, cargo market, drive, comms, external crane, and cosmetic assemblies
separate for selection and restrained animation. catalog integration is pending.
