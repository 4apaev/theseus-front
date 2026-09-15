# transport: wiring this prototype to the real server

prototype.md's own "next integration step" names the target: replace
`this.commit(...)`'s direct local state writes with a transport
adapter that emits commands and consumes authoritative server
snapshots. this plans that work, and the stack decision underneath it.

## stack: stay on lit

lit over react, for this project specifically:

- **it's already built.** 6 screens, the game-state contract
  (`GameChange`/`Navigation` events, `commit()`), and the three.js
  integration are done and working. a react port means rewriting all
  of it in jsx for no functional gain - the transport layer below is
  the same amount of work either way, in either framework.
- **runtime cost.** lit-html + reactive-element is roughly 5kb
  min+gzip; react + react-dom is roughly 45kb. this project already
  chose "no image assets, no texture maps, no external fonts" as a
  footprint discipline (readme.md) - a 9x runtime jump for the ui
  layer cuts against that, for no capability this app needs.
- **web components need no framework lock-in.** a `<comms-screen>`
  is a real custom element; it does not care what mounts it. that
  keeps the door open if part of this ever needs embedding somewhere
  else, or a future rewrite, without an all-or-nothing migration.
- **it already matches your own direction.** `docs/tech.debt.md`'s
  own wishlist is a pug/stylus-flavored template compiler *for lit* -
  that's an investment in this toolchain, not a hedge against it.

the one real argument for react is `@react-three/fiber`: composing a
three.js scene declaratively is genuinely nicer than the imperative
scene-graph code in `render/space-scene.ts`. it is not worth a full
framework migration on its own - that file already handles resize,
picking, and gpu disposal correctly, per prototype.md. revisit only
if the render layer itself becomes the bottleneck, not before.

## the old client's fate

`theseus/client/js/*` (the garage-based vanilla client) stops
growing new features once this transport lands - no more panels get
built there. it keeps running as the reference implementation and
the integration tests' fixture client until this prototype's
transport adapter is proven end to end, then it's retired. don't
port work between the two in the meantime; that's double maintenance
on a client that's leaving.

## what the adapter actually does

a new `src/transport.ts` (naming to taste), doing what
`client/js/api.js` + `feed.js` + `commands.js` already do for the old
client, ported to this project's shape:

1. **rest calls** to the gateway's routes (`/register`, `/login`,
   `/travel`, `/buy`, `/sell`, `/modules/install`, `/modules/remove`,
   `/messages`, the `GET` reads) - a thin `fetch` wrapper, bearer
   token from a login response, same as today's `Api` class.
2. **a websocket subscription** to the gateway's feed, decoding each
   frame into an event and folding it into the next `GameState` -
   this is the new `commit()` origin. screens keep emitting the same
   `GameChange`/`Navigation` events; only where the state they render
   comes from changes.
3. **the pending-command pattern**, ported as-is: publish a command,
   remember its `correlation_id`, mark it done (or timed out) when a
   matching reply event arrives. `client/js/commands.js` is the
   reference for this - the logic is language-independent, ts or js.
4. **boundary validation.** typescript types don't check a value that
   arrived over a socket. validate the server's payload shape before
   folding it into state, the same caution prototype.md already
   calls for.

## data-model gaps to close first

three real mismatches between this prototype's local model and the
actual server, found by reading both sides:

- **rig shape.** `model.ts`'s `fitted: ModuleId[]` is a flat list.
  the server's rig is slot-keyed - `{ slot, gid }[]`, one hull with 4
  named slot families (power, cruise, cargo, utility) today. the rig
  screen's data model needs to become slot-aware before it can read
  real `GET /ships/:sid/modules` rows.
- **hull catalog.** this prototype ships 13 illustrative hulls across
  3 categories. the real domain has exactly one hull, `starter`, and
  a multi-hull catalog isn't a planned near-term step. don't block
  the transport on this: wire the one real hull first, and gate the
  catalog picker behind a "more hulls coming" state rather than
  pretending the other 12 are selectable.
- **flight mechanics.** this prototype's orbital-maneuver and
  brachistochrone planning have no server counterpart yet - phase
  3.5 ("ΔV mechanics - in-system travel") is still unbuilt on the
  backend. the interstellar map (`between the stars`) already maps
  to a real route - `universe.path()` - and can wire up now. the
  in-system view and the flight screen stay local-only previews
  until 3.5 ships; label them as such rather than silently going
  stale.

## comms: closest to ready

this is the one screen the backend already fully supports (theseus'
`comms-service` + gateway routes, built this week):

- `vesper` was one fixed contact with a flat 8-second delay. the real
  model is any other player's ship, addressed by its `sid` (gateway's
  `POST /messages` resolves `sid` -> `pid` server-side - the client
  never sees a raw pid, same as today's traffic/port views).
- the signal diagram's "8s transit" was a constant; the real delay
  comes from `universe.distanceTo()` and appears on the wire as
  `deliver`/`delivered` timestamps. the "in transit · Ns" countdown
  logic in `comms.ts` already reads `m.delivers > this.now` - point
  it at the real timestamps and it needs no other change.
- station chat is unaffected either way - it was always modeled as
  "docked, no delay," which is what the server does too.

## a real blocker: cors

the gateway has no cors headers today - it was only ever served
same-origin (the gateway's own `GET /` serves the old client's
`index.html` directly). this prototype runs on its own vite dev
server (5174) against the gateway (3000): a cross-origin `fetch` and
websocket upgrade need one of:

- a cors middleware added to the gateway (`Access-Control-Allow-*` on
  its responses), or
- a vite dev-server proxy (`server.proxy` in `vite.config`) so `/api`
  and the websocket forward to the gateway locally, same-origin from
  the browser's point of view.

the proxy is the smaller change and requires no gateway edit; it
does mean production hosting still needs one of the two (a proxy
layer, or same-origin serving, or real cors) once this leaves dev.

## sequencing

build the transport against what's real today, in this order: port
(traffic, already public data) -> comms (fully ready) -> exchange
(market/buy/sell) -> rigging (one real hull, slot-aware fitting) ->
map's interstellar view. leave the in-system view and flight screen
on local-only preview data, clearly labeled, until phase 3.5 lands.
that's a working, honestly-scoped client at every step, instead of
one big-bang cutover blocked on the slowest piece.
