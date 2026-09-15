# navigation atlas

open **map** in the operations rail.
both views use procedural three.js geometry
with lit controls and labels.
no textures or image assets are loaded.

## examples

- **interstellar:** sol → cersa by default.
    choose another surveyed system or click its label,
    adjust cruise speed, then run the travel example.
    drag the map to rotate the stellar projection.
    use zoom and reset controls.
    clicking sol opens the system view.

- **in system:** earth → mars by default.
    choose venus for an inward transfer. mercury exceeds
    the example vessel's 7.80 km/s maneuver budget,
    so playback is unavailable. clicking earth or focus orbit
    opens the existing local maneuver planner.

both maps use free trackball camera rotation:
drag in any direction to turn and tilt, including over the poles.
right-drag to pan. scroll or pinch to zoom. one-finger touch
rotates and two fingers pan/zoom. reset restores the default position,
orientation and zoom. the x, y and z buttons clear individual world-axis
rotation offsets from the initial view, using xyz euler order.
they preserve pan and zoom. labels remain upright and picking follows the view.
camera movement leaves travel coordinates and times unchanged.

playback takes 24 seconds at 1×, independent of modeled travel time. pause, scrub, restart, or choose 0.5× / 4×. switching scale or destination resets the route. leaving maps or hiding the browser pauses playback. returning retains the selected route and progress. completion adds a ship-log entry.
 inventory, credits, and actual vessel location remain unchanged. reload resets the prototype.

## models and limits

interstellar coordinates are fictional cartesian positions in light-years. distance includes depth. travel is constant-speed coast: system time is distance / speed.
 ship time applies the special-relativistic time-dilation factor. acceleration, braking, drive feasibility, fuel and departure conditions are excluded.

system orbits are circular and coplanar with symbolic planet sizes. the ship follows a two-impulse hohmann ellipse propagated with kepler's equation, while the destination advances to the same arrival point. initial phase is aligned to a launch window.
 this is not a live ephemeris or a launch-window search. displayed δv includes both heliocentric impulses and excludes planetary escape/capture, parking orbits, finite burns, inclination, perturbations, and fuel mass. the earth inset is a schematic link to the separate local planner.

constants use kilometres and seconds: au = 149597870.7 km, solar gravitational parameter = 132712440041.27942 km³/s². references: [jpl astrodynamic parameters](https://ssd.jpl.nasa.gov/astro_par.html), [jpl launch-window explanation](https://www.jpl.nasa.gov/edu/resources/lesson-plan/lets-go-to-mars-calculating-launch-windows/).

## implementation

- `src/maps/navigation.ts`: pure typed catalog, coast/transfer solutions, synchronized positions, and playback state. no renderer dependencies.
- `src/maps/atlas-scene.ts`: orthographic scene, picking, projected labels, camera controls, resize handling, and resource disposal.
- `src/maps/atlas-view.ts`: selection, inspector, playback clock, and screen events.
- `test/navigation.test.ts`: inward/outward rendezvous, orbital energy, delta-v, clock conversion, invalid routes, and playback boundaries.

server integration should replace preview completion with an authoritative travel command and timestamped state. keep the renderer consuming calculated positions rather than defining the travel rules.
