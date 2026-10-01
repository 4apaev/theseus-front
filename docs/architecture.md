# architecture

## boundaries

- `src/client.ts`: `GameClient`, the one owner of transport and session.
  auth, hydration, commands, the feed. see [transport](transport.md).
- `src/transport/`: the wire. `api.ts` fetches with the bearer token,
  `feed.ts` holds the websocket and reconnects, `pending.ts` matches a
  202 correlation id to its reply, `validate.ts` parses every row and
  frame, `types.ts` names the shapes.
- `src/session.ts`: the immutable server snapshot and its lookups.
  `legTime()` repeats the domain's leg model for the eta.
- `src/events.ts`: `fold(session, frame)` and `flavor()`. pure.
- `src/app.ts`: the shell. navigation, the hull preview choice,
  notifications. screens get one session snapshot and the client.
- `src/screens/`: auth, port, rigging, exchange, comms, flight. a screen
  renders and calls commands. it never computes the next state.
- `src/maps/`: the navigation atlas. see [maps](maps.md).
- `src/components/`: native-control templates, the panel surface, theme
  selection, the shared ship viewport composition, the hull catalog.
- `src/render/`: three.js. `lem-scene.ts` loads a station glb per
  station id from `lem-station.ts`. `space-scene.ts` shows the hull in
  the rig and at the exchange berth. `hull-model.ts` loads and caches
  hull glbs. `geometry.ts` holds the schematic reserve and the berth
  backdrop. `ship-lighting.ts` is the one lighting rig.
- `src/simulation/orbit.ts`: two-body math for the flight preview.
- `src/model.ts`: the visual catalogue only. hull previews, the 3 visual
  module groups, good swatches. the server owns the game.

## rendering

lit updates the interface; each viewport owns its three.js render loop
and disposes geometry and materials it replaces. device pixel ratio is
capped at two. reduced motion disables ambient movement. every action
has a dom control; scene picking is a shortcut.

one webgl context per live viewport. the hull catalog draws its 36
thumbnails with one shared offscreen renderer and copies each frame
into a 2d canvas: a browser keeps about 16 live contexts, and evicting
the oldest would blank the port and rig viewports.

a hull glb loads once per file and is cloned per view. a failed load
leaves the cache, so the next render retries. the schematic reserve
stands in meanwhile.

## the flight preview

kilometres, seconds and radians. earth's gravitational parameter is
398600.4418 km³/s², its radius 6371 km. the ship starts in a 7200 km
circular orbit; the target rides a 14500 km orbit. a prograde and radial
impulse fixes the ellipse, kepler's equation propagates it, and closest
approach is sampled over one revolution and refined. the brachistochrone
mode is a rest-to-rest straight line at the fitted drive's acceleration.
the budget of 7.80 km/s is a study figure. nothing here reaches the
server.

## validation

`npm run check` runs eslint, the node tests, type checking and the
production build. the tests cover the wire parsers, event folding, the
eta model against the server's `legTime()`, pending-command settlement,
the chart geometry and course search, the station asset contract, and
the orbital math. browser checks run against a live gateway.
