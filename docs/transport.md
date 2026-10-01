# transport

the client talks to the theseus gateway. the server owns every rule:
trade settlement, fitting, travel time, message delivery. the client
sends a command, gets a 202 with a correlation id, and folds the result
in from the websocket feed.

## layout

| file                        | role                                                                  |
|-----------------------------|-----------------------------------------------------------------------|
| `src/transport/api.ts`      | fetch wrapper, bearer token, 401 → logout                             |
| `src/transport/feed.ts`     | websocket, reconnect with backoff, resync before reconnect            |
| `src/transport/pending.ts`  | correlation id → command label, 15s timeout                          |
| `src/transport/validate.ts` | wire parsers. every row and frame passes here. numeric strings coerce |
| `src/session.ts`            | the immutable server snapshot and lookups, `legTime()` for the eta    |
| `src/events.ts`             | `fold(session, frame)` and `flavor()`, pure, node-tested              |
| `src/client.ts`             | `GameClient`: auth, hydrate, commands, the one owner of the above     |
| `vite.config.ts`            | `/api` proxy to the gateway, websocket included                       |

screens read `session` and call the client. a screen never computes the
next state.

wired for real: port (traffic, departures, travel), rigging (slot-keyed
rig, preview, install, remove, rename), exchange (quotes, buy, sell),
comms (station chat, ansible to a ship in traffic), map (the universe as
a chart, ships in transit, the shortest course, multi-hop travel).

the flight screen stays a local preview. the hull catalog is a browser
preference; the server knows one hull, `starter`.

## decisions

**lit, not react.** the screens, the session contract and the three.js
integration exist and work. lit-html and reactive-element weigh about
5 kb; react and react-dom about 45 kb, against a project that ships no
images, textures or fonts. a `<comms-screen>` is a real custom element
and mounts anywhere. the one argument for react, `@react-three/fiber`,
does not pay for a framework migration while the imperative scene code
handles resize, picking and disposal correctly.

**the old client.** `theseus/client/js/*` in the backend repo grows no
features. it stays the reference implementation and the integration
tests' fixture until this client is proven end to end, then retires. no
work ports between the two.

**cors.** the gateway has no cors headers. the dev server proxies `/api`,
rest and websocket, so the browser sees one origin. production hosting
needs the same proxy, or same-origin serving.

**validation at the boundary.** typescript types do not check a value
that arrived over a socket. every payload passes `validate.ts` before it
touches the session. postgres numeric columns arrive as strings and
coerce there.

## gaps on the server side

- a message names its sender by pid. traffic names a ship by sid and
  never publishes a pid. the client learns one pid → sid pair per reply
  to its own signal (`session.peers`) and shows an unmatched sender as
  "unknown pilot" with no reply button. a public ship id on message
  rows, or a `sid` on `comms.sent`, closes it.
- a travel command names the destination, and the server plots the
  hops, but the ship row publishes only the current leg. the client
  keeps the destination as `session.course` until arrival; a reload
  forgets it. a `destination` column on the projection's `ships` closes
  it.
