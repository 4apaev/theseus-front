plan - the painted client, to the end
================================================

the painted client replaces the panel client (tag `client-v1`). the
shape is in [architecture.client.md](../../docs/architecture.client.md).
this file is the order of the work, step by step.

**done means:**
- every command the panel client sends, the painted client sends:
  register, login, logout, trade, travel, preview, install, remove,
  rename, send.
- it runs on the real gateway, and every place runs on a fixture.
- `index.html` boots the shell. the old code is gone.
- `npm run check` is green, with a screenshot check of each place.

**where we are** (2026-10-05, stages A to E done):
- `src/core/`: the wire and the truth, moved unchanged. 44 tests.
- fixture mode: `?fixture=docked|transit|full`. a command only logs.
- `src/world/`: the stage, the sky (ether, stars, sun, planet), the paint
  pass, the loader, the ship with its sockets, the robots.
- `src/places/port.ts`: 9 station models at the new size, the 70 m ship
  on the berth, robots on the deck, an orbit camera.
- `npm run sync` copies sam's exports.

size: **S** is one session, **M** is 2, **L** is 3 or more.


steps
------------------------------------------------

| step | stage   | what                                       | size | needs | status |
|------|---------|--------------------------------------------|------|-------|--------|
| A1   | frame   | fixture commands answer                    | S    | -     | done ✔ |
| A2   | frame   | the kit: card, chip, toast, ₢ counter, hud | M    | -     | done ✔ |
| A3   | frame   | the place router                           | S    | A2    | done ✔ |
| A4   | frame   | hotspots and the ship focus                | M    | A3, sam: spots | done ✔ |
| A5   | frame   | login and register                         | S    | A2    | done ✔ |
| B1   | trade   | the exchange                               | M    | A1-A4 | done ✔ |
| B2   | trade   | the hold                                   | M    | B1    | done ✔ |
| B3   | trade   | effects                                    | S    | B1    | done ✔ |
| C1   | travel  | the chart                                  | L    | A4    | done ✔ |
| C2   | travel  | the system map                             | M    | C1    | done ✔ |
| C3   | travel  | transit                                    | M    | C1, server 3.7 | done ✔ |
| D1   | ship    | rigging                                    | L    | A4, the hull call | done ✔ |
| D2   | ship    | traffic at the station                     | S    | A4    | done ✔ |
| E1   | comms   | letters and the channel                    | M    | A4    | done ✔ |
| E2   | comms   | the feed line and the console              | S    | E1    | done ✔ |
| F1   | parity  | settings, voices, reduced motion           | S    | A2    |        |
| F2   | parity  | sounds                                     | S    | B3    |        |
| F3   | parity  | load and size                              | M    | -     |        |
| F4   | parity  | screenshot checks                          | M    | all places |        |
| G1   | switch  | `index.html` boots the shell               | S    | F     |        |
| G2   | switch  | remove the old code                        | S    | G1    |        |
| G3   | switch  | the docs                                   | S    | G2    |        |
| H    | server  | fuel, holds, crew, the well, the fight     | -     | phase 4, 5 |        |


A · the frame
------------------------------------------------

the shell becomes an app: places to go to, cards to act in, a way in.

### A1 - fixture commands answer

today a fixture command only logs. a place cannot be built on that.
`FixtureClient.command` answers each command with the events the server
sends: a buy gives `cargo.loaded` and `wallet.debited`, a travel gives
`ship.departed`, then `ship.arrived` after the eta. the events go
through the same parsers and the same fold.

done when: a buy on `?fixture=docked` changes the wallet and the hold.

### A2 - the kit

lit elements, from the tokens in [guide.md](guide.md):
- **card**: opens next to an anchor, a world point that follows the camera.
- **chip**, **toast**: a rejection shows as a toast.
- **₢ counter**: it runs up green and down red.
- **hud**: the wallet, the ship name, the station, the galaxy clock.

every action has a keyboard path.

done when: the port shows the hud, and a test card opens on the ship.

### A3 - the place router

a place has `enter`, `sync` and `leave` (the port has them). the url
hash names the place: `#port`, `#exchange`. escape goes back to the
port. one stage, so one webgl context: a place unmounts what it made.

done when: `#exchange` opens an empty place, and escape returns.

### A4 - hotspots and the ship focus

the player acts on things in the scene. a hotspot is an empty in the
station glb: `spot_exchange`, `spot_rigging`, `spot_comms`. a label
follows it, and a click opens its place. a click on the ship moves the
camera to the ship and opens the ship card. the camera can now come
close: today it stops at the station's size.

the user's note (2026-10-05, not a priority): a click on another ship at
anchor opens its card too: the name, the pilot, the hull, the rig, from,
to, the manifest.

sam: a job adds the 3 empties to the 9 station models.

done when: on each of the 9 stations, 3 hotspots open their places.

### A5 - login and register

the auth card over the sky. no uppercase transform, a button to show the
password. `shell.html` boots alone on the real gateway, with no token
from the old app.

done when: a new player registers on the gateway and lands in the port.

**review A:** the user checks the frame on the fixture and on the gateway.


B · trade
------------------------------------------------

the first half of the core loop.

### B1 - the exchange

the exchange plate (`assets/places/exchange/outpost`), and the tray: the
20 goods icons with the price, the stock and the trend. a card buys or
sells a quantity. the wire rule: a buy sends `price_unit_max` at
price · 1.1, a sell `price_unit_min` at price · 0.9. a ghost shows the
command in flight.

sam: exchange plates for the other 8 kits. until then, every station
uses the outpost plate.

### B2 - the hold

the cargo grid: one piece per good, with its icon and quantity. drag a
piece to the exchange to sell it. the grid shows the capacity.

open call: the server has no cell positions, and no `cargo.arrange`. v1
packs the pieces in the client, in a fixed order. a layout the player
makes waits for the server.

### B3 - effects

`fold` returns small records: a wallet change, cargo in, cargo out. an
effect animates the world: a crate on the deck, the ₢ counter. it never
changes state. tests: which event gives which effect.

done when: a buy and a sell, on the fixture and on the gateway.

**review B:** the user trades on the gateway.


C · travel
------------------------------------------------

the second half of the core loop.

### C1 - the chart

the stars in 3D, with the routes. a toggle shows light years or ship
years. a pick opens a confirm card: the eta, the hops, the capital cost.
`core/chart.ts` already finds the course.

the star positions: a build step reads x, y, z from
`data/hygdata_v42.csv` into `content/`. the client then needs nothing
from the server. phase 4 step 4.1 moves them to `/api/universe` later.

### C2 - the system map

the stations of one system on their orbits, not on one line (todo.md,
"inner well view"). the orbit radius comes from the server. the angle is
a client choice until step 4.1 sends one. a pick travels in-system.

### C3 - transit

the ship card: the eta, from, to, the speed in c and in km/s, a transit
bar, the hops. the place shows the ship underway (the painted set in
`assets/underway`). no local flip: a countdown at zero waits for
`ship.arrived`. the arrival is an effect.

needs the server's 3.7: the manifest on `GET /api/ship`. until then the
card shows the final stop only.

done when: buy at the outpost, fly to Mars, sell, on the gateway.

**review C:** the user plays the full loop.


D · the ship
------------------------------------------------

**the hull call first:** the far treasure, or `far-treasure-b`. if b,
sam scales its doors and hatches to the 70 m ship.

### D1 - rigging

the rigging plate, the ship close up under an orbit camera, its 5
slots, and the yard's stock with the 9 module icons. a pick opens the
preview card: the stats before and after. install puts a ghost module on
the socket, and the event makes it real. remove, rename.

sam: rigging plates for the other 8 kits.

### D2 - traffic at the station

the other ships docked here: a card with their pilots. phase 4 step 4.2
changes `traffic` to the system scope. the card reads either shape.

done when: install, remove and rename, on the gateway.

**review D**


E · comms
------------------------------------------------

### E1 - letters and the channel

the comms plate. letters by ansible, with their delay. the station
channel for the ships docked here. send.

the 2 bugs in [todo.md](todo.md) must not come back: a received letter
shows at once, and nothing covers the send button.

sam: comms plates for the other 8 kits.

### E2 - the feed line and the console

one line with the last event. a click opens the table: event, command,
details. the console drawer opens on the backtick key.

done when: 2 players write letters on the gateway, and the channel
updates live.

**review E**


F · parity
------------------------------------------------

### F1 - settings

the sound volume, the voice (`util.speak.ts`), reduced motion: flows
keep their time, and ambient motion stops.

### F2 - sounds

the list in [todo.md](todo.md): depart, arrive, buy, sell, install,
remove, a letter out, a letter in, and a bed of noise per place.

### F3 - load and size

the 9 station models are 5 to 8 MB each. the sync step compresses them
(meshopt, quantized). the loader shows progress. a place disposes what
it made: the memory stays flat after 20 place changes.

### F4 - screenshot checks

each place on its fixture, in a headless browser, against a stored
image. it runs in `npm run check`.

**done when:** a list of the panel client's features is all ticked in
the painted client.

**review F:** the user plays for a while on the gateway.


G · the switch
------------------------------------------------

### G1 - `index.html` boots the shell

the shell takes the old app's place. `shell.html` goes.

### G2 - remove the old code

`screens/`, `render/`, `components/`, `maps/atlas-*`, the panel styles,
`app.ts`, `main.ts`, `prototype/`, and the packages only they use.

### G3 - the docs

`architecture.client.md` "order" is done. `frontend.md`, `maps.md` and
`readme.md` describe the painted client only.

**review G:** the user commits and tags.


H · after the switch, with the server
------------------------------------------------

each one follows its server step in
[phase.4.md](../../backend/docs/phase.4.md):

| server | the client |
|--------|------------|
| 4.2 fog of war | traffic by system |
| 4.3 the well | the confirm card shows the well's ΔV and its time |
| 4.5 the hauling classes | hold variants (tank, reefer, pen: sam's h1), the refusal reason on a buy |
| 4.6 fuel | the fuel gauge, refuel at the exchange, the adrift state, the tug |
| 4.7 crew | crew cards with sam's portraits, hire at a station |
| phase 5 | flight, encounter |


sam, by stage
------------------------------------------------

| stage | sam's job |
|-------|-----------|
| A | `spot_exchange`, `spot_rigging`, `spot_comms` empties in the 9 station models |
| B | exchange plates for 8 kits |
| D | the hull call; then rigging plates for 8 kits |
| E | comms plates for 8 kits |
| F | none. the sounds come from a library, and the user picks them |
