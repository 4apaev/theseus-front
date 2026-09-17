# ship studies / second lives

seven original low-poly blender models, with solid-color materials and transparent
renders. these are asset studies, not yet replacements in the game's hull catalog.

| ship | category | palette | source | export |
| --- | --- | --- | --- | --- |
| the sunday catch | civil / restored fishing yacht | petrol teal, ivory, brass | civil/sunday-catch/sunday-catch.blend | ../public/models/civil/sunday-catch.glb |
| patient cargo | industrial / tanker | oxblood, ochre, ceramic grey | industrial/tanker/patient-cargo.blend | ../public/models/industrial/patient-cargo.glb |
| wandering ward vii | civil / inhabited liner and market barge | municipal teal, faded vermilion, old green | civil/wandering-ward/wandering-ward.blend | ../public/models/civil/wandering-ward.glb |
| quiet argument | military / corvette | neutral armor, graphite, identification oxide | military/corvette/quiet-argument.blend | ../public/models/military/quiet-argument.glb |
| the hypothesis | research / survey vessel | oxidized cyan, laboratory ceramic, instrument brass | research/survey/the-hypothesis.blend | ../public/models/research/the-hypothesis.glb |
| county line | institutional / prison barge | nicotine grey, old maroon, faded green | civil/prison-barge/county-line.blend | ../public/models/civil/county-line.glb |
| garden debt | colony / terraforming ark | fertile green, soil brown, machinery ochre | industrial/terraforming-ark/garden-debt.blend | ../public/models/industrial/garden-debt.glb |

the yacht keeps its working hull, hatch, winch, and crane, with a new sealed
panoramic salon and restored trim. the tanker is a six-vessel tank train with
retaining bands, transfer lines, protective framing, and a replacement command
section. every large form should remain readable at game scale.

the wandering ward is a retired municipal ferry enlarged into a small mobile
district. three habitation tiers, a clinic, public terraces, market kiosks,
radiators, and an old cargo crane carry the urban reference without turning the
model into undifferentiated greeble. the radio dish, mast, crane, market, and
habitation block remain separate objects for selection or restrained animation.

the second fleet set establishes four functional silhouettes. quiet argument is
an armored drive and sensor package with flush weapon doors. the hypothesis is
a long-baseline instrument truss with replaceable labs. county line repeats
detention modules around an obsolete freight spine. garden debt carries habitat
wheels, biome vaults, water reservoirs, and atmospheric processing machinery.

editable assemblies include hull, cargo, drive, comms, external, and cosmetic.
the yacht crane has its own pivot, ready for later animation. named sockets mark
power, cruise, maneuver, cargo, utility, external, and cosmetic attachment points.
socket sizes and physical dimensions are placeholders until domain integration.

coordinates: blender z up, bow +x; glb y up, bow +x. roots sit at the ship spine,
not the geometric center. preview cameras and lights are excluded from exports.
no textures or font files are required. lettering is simplified mesh geometry.
the sources contain the full model and the original preview camera.

the yacht is approximately 4,000 triangles / 242 kib; the tanker approximately
8,100 triangles / 496 kib; the ward approximately 9,300 triangles / 709 kib.
these are geometry and file sizes, not a measured
runtime performance claim. editable pieces are separate; static assemblies can
be merged when fitting interactions are finalized.

front and rear three-quarter renders are in ../sketches, named
sunday-catch-model-preview.png, sunday-catch-model-reverse.png,
patient-cargo-model-preview.png, and patient-cargo-model-reverse.png.
the ward renders are wandering-ward-model-preview.png and
wandering-ward-model-reverse.png.

reproduce with:
    blender --background --python scripts/build-ship-studies.py -- --output /tmp/ship-study-new

reproduce the ward with:
    blender --background --python scripts/build-wandering-ward.py -- --output /tmp/wandering-ward-new

reproduce the four fleet classes with:
    blender --background --python scripts/build-fleet-classes.py -- --output /tmp/fleet-classes-new

choose a new output directory. the script refuses to overwrite its deliverables.
models were reviewed visually from both angles. no automated tests were run.
