# navigation atlas

open **map** in the operations rail. the atlas is the server's universe
as a chart. both views use three.js geometry with lit controls and
labels. no textures or image assets load.

## views

- **interstellar:** every system at its catalogue position, in light
  years. the routes between systems are the universe's routes. a system
  with one station is that station: click it to choose the destination.
  a system with several stations opens the system view.

- **in system:** the stations of one system on their orbits, on one
  radial line. the domain measures in-system routes as the difference of
  orbit radii, so the line is the truth, not a layout choice. the chart
  compresses radii with `log1p(4 · au)`: titan at 9.5 au would crush the
  inner system into one dot. order holds; distances read from the panel.
  click the star to return to the sector. the breadcrumb select changes
  the system.

both views draw your ship, amber, and every other ship in transit, mint.
a ship moves along its leg on the server clock: the leg starts
`years_abs · time_scale` seconds before `arrives`. docked ships are not
markers. the destination panel lists who is in port.

the view follows your ship's system until you pick one.

## the course

choose a station with a label, a marker, or the destination select. the
inspector shows what it produces and consumes, its module stock, who is
docked there, and the course from your ship: the shortest travel time for
your drive, hop by hop, with the distance and real arrival time of each
leg, and the years you and the galaxy age.

the course uses the server's own model. `legTime()` in `src/session.ts`
repeats the domain's leg model: a route between stars holds one speed, an
in-system route accelerates to the midpoint, flips and brakes. the search
in `src/maps/chart.ts` weighs each edge by that time, as `universe.path()`
does. a fast route does not help a slow ship, so the course depends on the
ship.

**depart** confirms, then sends one travel command with the destination.
the server plots the same course and flies it. each leg is its own
`ship.departed` / `ship.arrived` pair on the feed; a waypoint departs again
right after it arrives. the client remembers the destination as
`session.course`, draws it solid amber until arrival, and drops it on a
travel rejection. a reload forgets it: the server does not publish the
manifest.

a selected destination that is not the active course draws dashed.

## positions

star positions come from the hipparcos-yale-gliese catalogue, in light
years. the universe's route lengths are the straight lines between them,
so the chart and the domain agree to the centimetre. a system the table
does not know sits on a ring, so universe growth cannot break the map.

orbit radii are the standard mean values: mercury 0.387, venus 0.723,
earth 1.0 for sol outpost, mars 1.524, ganymede 5.203, titan 9.537. a
station the table does not know gets the next ring out.

## implementation

- `src/maps/chart.ts`: pure. positions, nodes, edges, rings, mover
  positions and headings, the shortest-time course. no renderer.
- `src/maps/atlas-scene.ts`: orthographic scene, picking, projected
  labels, trackball camera, frame fitting, marker updates each frame.
- `src/maps/atlas-view.ts`: a game screen. mode, system, destination,
  inspector, the depart dialog, the one-second clock.
- `test/chart.test.ts`: catalogue geometry, orbit tables, edges per
  view, the time-weighted course, mover progress and framing.

the flight screen stays a local preview of maneuver planning. departures
also leave from the port screen, one direct hop at a time.
