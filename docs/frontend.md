# frontend foundations

## boundaries

`core/client.ts` owns the session: auth, hydration, commands, and the feed.
`shell.ts` boots the client, mounts the stage and the kit, and lets the
router show one place. a place renders one immutable session snapshot
and calls commands on the client. it never computes the next state: the
server does, and `core/events.ts` folds the result in from the feed.
`core/effects.ts` names what happened, for the places to animate and for
the sounds. see [architecture](../../docs/architecture.client.md) for the
full layout.

- `src/world/`: the stage and its orbit camera, the sky, the loader, the
  toy look, the ship, the plane of the diagrams.
- `src/places/`: one class per place: port, transit, market (the
  exchange), crates (the hold), atlas (the chart), orbit, bay (the
  rigging), net (comms), and their helpers.
- `src/kit/`: the lit elements over the stage: the top line, cards,
  the tray, toasts, the feed, the dropdown.
- `src/content/`: the fleet, the station kinds, the palettes, the skins,
  the icons, the fixtures.
- `sound.ts`: the cues and the bed of each place, made with web audio.

`src/core/util.ts` contains browser-safe `Fail`, `ValidationError`, `assert`,
`raise`, number, credit, distance and time formatting, clamping, and
typed event emission. errors carry a stable code and an optional cause,
as garage's do.

## styling

`src/kit/kit.css` holds the kit's layout; `src/kit/toy.css` holds the toy
look over it, under `main[data-toy]`. the palette of `?theme=` sets the
`--toy-*` variables on `main`; the 3D materials read the same palette by
role (`toy-red` … `toy-glow`). styles use native css nesting and relative
units. component states and descendants belong under their owner.

the rounded sans is local sf pro rounded, with a system fallback. the
project does not distribute apple font files.

## code style

the lint rules are the backend's, verbatim: `scripts/eslint.rules.js`
is a copy of `theseus/backend/scripts/eslint.rules.js`, and
`eslint.config.js` maps them onto typescript-eslint and the stylistic
plugin. four spaces, no semicolons, single quotes, spaces inside
brackets, stroustrup braces, multi-line ternaries. aligned keys in
multi-line objects and aligned consecutive assignments follow the
backend by hand; `key-spacing` stays off. `void 0` clears a value;
`null` only comes from apis that return it. `// ──` rules divide a long
file into sections. functions stay short. every exported symbol has a
one-line doc comment where its name does not say everything.

## validation

`npm run check` runs eslint, the node tests, type checking, the
production build, and the screen checks: each place on its fixture in
headless chromium against `test/screens/`, and 20 place changes that
must keep the gpu memory flat.
