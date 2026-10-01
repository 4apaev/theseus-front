theseus frontend
================

## an orbital trading game

game client built with ts, lit, and three.js.
ships and port facilities are blender models and procedural geometry.
no image assets, texture maps or external fonts load at runtime.

the client talks to the theseus gateway. the server owns every rule:
trade settlement, fitting, travel time, message delivery. the client
sends a command, gets a 202, and folds the result in from the websocket
feed. see [transport](docs/transport.md).

## run

requires node 24 or newer, and a running theseus backend
(`npm run start` in the backend repo brings the gateway up on port 3000).

```sh
npm install
npm run dev
```

open `http://localhost:5174`. vite proxies `/api`, rest and websocket,
to the gateway, so the browser sees one origin. set `GATEWAY` to point
the proxy elsewhere. `npm run check` runs lint, tests, type checking, and
a production build. `npm run preview` serves that build; it still needs a
proxy in front of it, or same-origin serving.

## play

- docking clearance: register a handle to commission a starter ship, or
  log in. the session token stays in local storage.
- port: who is docked here, and the departures from this station with
  real distance, arrival time and the years you age. a departure asks
  for confirmation, then the ship flies on the server's clock.
- rigging: the hull's slots, the fitted module in each, and the packaged
  modules in your hold. the gateway previews a fit before you commit.
  rename the ship here.
- exchange: live quotes at the current station, and the hold. buy and
  sell settle on the server; the wallet and hold update from the feed. a
  station buys back only the modules it stocks; the hold says where each
  row sells.
- comms: the station channel, and a private ansible channel to any ship
  in traffic. a private signal crosses the distance at ansible speed.
- map: the universe as a chart. systems at their catalogue positions,
  stations on their orbits, every ship in transit on the server clock.
  choose a station, read the shortest course for your drive, and depart.
  see [maps](docs/maps.md).
- flight stays a local preview of maneuver planning.
- hull catalog: a visual preview of 36 blender hulls. the server knows
  one hull today; the choice is a browser preference.

## code style and dependency policy

the lint rules are the backend's: `scripts/eslint.rules.js` is a copy of
`theseus/backend/scripts/eslint.rules.js`, and `eslint.config.js` maps them
onto typescript-eslint and the stylistic plugin. `npm run lint:fix` applies
them. no runtime dependency on the server repositories is needed. see
[frontend foundations](docs/frontend.md) for boundaries, styles, themes and
the style conventions, and [architecture](docs/architecture.md) for the
module layout.

the lint tool is typescript-eslint (imported as `tslint`), not the retired tslint package. no prettier preset overrides the project style.

as of 2026-09-12, the toolchain uses current stable lit, three.js, vite, eslint, and typescript-eslint releases. typescript is kept at 6.0.3 because [typescript-eslint currently supports versions below 6.1](https://typescript-eslint.io/users/dependency-versions/); typescript 7 is not a drop-in replacement for its compiler-api dependency. node declarations stay on the node 24 line to match the minimum runtime. the lockfile records the installed versions.
