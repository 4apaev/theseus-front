# model sources

editable blender sources live here. the browser serves their exported
`.glb` files from `public/models/`. design illustrations live in
`../sketches/`.

```text
models/
    stations/
        lem/lem-station.blend                       the observatory outpost
        many-hands/port-of-many-hands.blend         the system gateway
    parts/reactor-mk02.blend                        a module study, not shipped
    civil/          liner, prison-barge, sunday-catch, transport, wandering-ward, yacht
    industrial/     freighter, tanker, terraforming-ark, tug
    military/       battleship, corvette, frigate
    research/       survey, vessels
    fleet-expansion/manifest.json                   mesh counts of the fleet build
```

## stations

2 station models, one runtime contract, built by
`scripts/build-lem-assets.py` and `scripts/build-port-of-many-hands.py`
on the shared `scripts/stationkit.py`:

- [lem station](stations/lem/readme.md): the observatory outpost.
- [port of many hands](stations/many-hands/readme.md): the system gateway.

`src/render/lem-station.ts` maps a station id to a model and loads its
glb in the port view.

## export convention

- export each hull as `public/models/<category>/<hull>.glb`.
- keep a consistent scale, origin, and forward direction across models:
  blender z up, bow +x; glb y up, bow +x. roots sit at the ship spine.
- keep selectable assemblies separate and name them `cargo`, `drive`, and
  `comms`. the loader maps `comms` to the `ansible` module id.
- use named empty objects for attachment sockets.
- keep preview lights and cameras out of the game asset export.

## ship studies

[the ship studies](ship-studies.md) describe the hull sources, their
palettes, exports and preview renders, and how to reproduce them with
`scripts/build-ship-studies.py`, `scripts/build-wandering-ward.py`,
`scripts/build-fleet-classes.py` and `scripts/build-fleet-expansion.py`.
`src/model.ts` lists the hulls the catalog previews.
