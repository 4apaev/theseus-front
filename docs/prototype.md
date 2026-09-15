# implementation notes

## boundaries

- `src/model.ts`: serializable game state, inventory, hulls, attachment constraints, and immutable domain operations. independent of browser, lit, and three.js.
- `src/app.ts`: application shell and shared game snapshot. `src/screens/` owns screen interactions; `src/components/` provides shared native controls, panels and catalog composition. see [frontend foundations](frontend.md).
- `src/render/geometry.ts`: procedural ship/port builders. faceted vertex colors define the palette; no textures, models, image downloads, lights, or postprocessing.
- `src/render/space-scene.ts`: orthographic three.js renderer, camera controls, picking, facility labels, resize handling, and gpu resource disposal.
- `src/render/orbit-view.ts`: canvas2d presentation of calculated coordinates, independent of the port camera. node dragging dispatches an event to the parent controller.
- `src/simulation/orbit.ts`: pure orbital math, useful from a worker later if route searches become expensive.

lit updates the operational ui; three.js owns its own render loop. the render tree rebuilds only when hull, mode, attachments, selection, or cargo changes. geometry and materials are disposed when replaced. device pixel ratio is capped at two. reduced-motion preference disables ambient ship bobbing. all essential actions have dom controls; scene picking is optional.

## category grammar

industrial: ochre / graphite / stone. exposed framing, containers, tanks, and repeated service modules. freighter, tanker, salvage tug, terraforming colony giant.

civil: ivory / teal / slate. pressure cabins, passenger volumes, observation and communications hardware. liner, passenger transport, yacht, research vessel.

security: gunmetal / oxide / cold gray. compact armor, hardpoints, repeated custody blocks. battleship, frigate, corvette, prison barge.

geometry distinguishes hulls in addition to color. common attachment mounts allow the same module operations on every preview hull. scale is illustrative, not a claim that a colony giant and a corvette have equal real dimensions.

## orbital model

kilometres, seconds, and radians internally; earth gravitational parameter 398600.4418 km³/s²; spherical radius 6371 km. the initial circular orbit is 7200 km from the center. the target follows a coplanar circular orbit at 14500 km.

an instantaneous prograde/radial impulse sets the post-burn energy and eccentricity vector. kepler's equation propagates the resulting bound ellipse. the drawn curve and markers come from that solution. the node angle rotates the departure location; target phase is fixed at that burn epoch. this is a geometry/phase experiment, not a scheduler that advances both vessels to a later burn time.

closest approach is approximated over one planned revolution with 400 samples and local refinement. relative velocity is computed at that time. it is not a guaranteed rendezvous. inclination, perturbations, spheres of influence, finite burn duration, rendezvous capture, fuel mass, and n-body effects are omitted. intersecting and unbound trajectories cannot be saved. δv available is an illustrative fixed 7.80 km/s.

brachistochrone mode is a separate idealized rest-to-rest, straight-line, constant-acceleration transfer. `t = 2 sqrt(d/a)`, peak speed `sqrt(d*a)`, and total δv `2 sqrt(d*a)`, with unit conversion. acceleration is derived from the fitted drive; gravity, initial orbital velocity, and mass change are omitted. accelerating and braking costs are both included.

## next integration step

replace the app's direct local state assignment with a transport adapter that emits commands and consumes authoritative server snapshots. keep renderer and simulation modules unchanged. validate payloads at that boundary; typescript types alone do not validate network input. the server must own trade settlement, fitting, message delivery, propellant, and travel time. this prototype does not yet implement that adapter or persistence.

## validation

node tests exercise trade conservation, rejection conditions, attachment power/capacity limits, circular and perturbed orbits, burn initial conditions, energy/angular momentum conservation, closest-approach sanity, and brachistochrone unit conversion. browser smoke checks exercise the lit bindings and renderer separately.
