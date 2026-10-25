theseus frontend
================

## an orbital trading game

game client built with ts, lit, and three.js, in the toy look: sam's
toy models from `../assets` on a 3D stage, a kit of toy blocks over it.
sounds are made in the browser; no sound files load.

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
the proxy elsewhere. `npm run check` runs lint, tests, type checking, a
production build and the screen checks. `npm run preview` serves that build; it still needs a
proxy in front of it, or same-origin serving.

`?fixture=docked`, `transit` or `full` boots on a recorded session, with
no backend. `?theme=` picks the palette: meadow (the first), toybox,
lagoon or postcard. `npm run sync` compresses the toy models of
`../assets` into `public/models/toy/` and makes the icons and sprites.
`npm run screens` checks each place against a stored image in
`test/screens/`; `-- --update-snapshots` stores new ones.

the client before the toy look lives in git tags: `client-1` is the
panel client, `client-2` the painted look beside the toy look.

## play

- docking clearance: register a handle to commission a starter ship, or
  log in. the session token stays in local storage.
- port: the station as a toy world, its planet, the dry dock and the gas
  station, the ships at its pads and at anchor. the traffic list names
  who is docked here.
- exchange: the goods of the sector on a plane: who makes a good, who
  wants it, the price on each route. buy and sell settle on the server.
- hold: a toy box, a crate per unit of cargo. drag a crate to the tray
  to sell it.
- chart: the stars, the routes, the systems. pick a station, read the
  course, and depart.
- orbit: plan a burn round the planet. it changes nothing on the server.
- rigging: the ship over its diagram, a tile per slot. the gateway
  previews a fit before you commit. rename and skin the ship here.
- comms: the ansible net, the station channel and letters to a peer.

## code style and dependency policy

the lint rules are the backend's: `scripts/eslint.rules.js` is a copy of
`theseus/backend/scripts/eslint.rules.js`, and `eslint.config.js` maps them
onto typescript-eslint and the stylistic plugin. `npm run lint:fix` applies
them. no runtime dependency on the server repositories is needed. see
[frontend foundations](docs/frontend.md) for boundaries, styles, themes and
the style conventions, and [architecture](../docs/architecture.client.md) for the
module layout.

the lint tool is typescript-eslint (imported as `tslint`), not the retired tslint package. no prettier preset overrides the project style.

as of 2026-09-12, the toolchain uses current stable lit, three.js, vite, eslint, and typescript-eslint releases. typescript is kept at 6.0.3 because [typescript-eslint currently supports versions below 6.1](https://typescript-eslint.io/users/dependency-versions/); typescript 7 is not a drop-in replacement for its compiler-api dependency. node declarations stay on the node 24 line to match the minimum runtime. the lockfile records the installed versions.
