# frontend foundations

## boundaries

`client.ts` owns the session: auth, hydration, commands, and the feed.
`app.ts` owns navigation, the hull preview choice, and notifications.
`src/screens/` contains lit components for auth, port, rigging, exchange,
comms, and flight. each keeps its own input state when hidden and
releases its rendered scenes. a screen renders one immutable session
snapshot and calls commands on the client. it never computes the next
state: the server does, and `events.ts` folds the result in from the
feed. the map is its own screen under `src/maps/`. see
[architecture](../../docs/architecture.client.md) for the full layout.

`src/components/` provides native-control template components, shared
ship viewport composition, a panel surface, theme selection, and the hull
catalog. template buttons and fields produce real buttons, labels,
selects and inputs: disabled behavior, keyboard activation, label
association and form submission stay native. `icons.ts` is the shared
svg icon component and path catalog.

`src/util.ts` contains browser-safe `Fail`, `ValidationError`, `assert`,
`raise`, number, credit, distance and time formatting, clamping, and
typed event emission. errors carry a stable code and an optional cause,
as garage's do.

## styling

`src/styles/styles.css` is an import manifest. the ordered styles are:

- tokens: semantic theme colors, spacing, type scales, weights, and control sizes.
- reset: document defaults, focus visibility, hidden content, reduced motion.
- typography: local font faces and semantic headings and inline text.
- forms and panels: shared native controls and surface and readout rules.
- layout and scene: shell, navigation, camera, and world annotations.
- station, comms, flight, fleet, atlas, lem-port, client: screen layout and artwork.
- components: shared component contracts and responsive adjustments.

styles use native css nesting and relative layout and type units.
component states and descendants belong under their owner. colors are
defined in tokens; renderer material colors belong to the models. canvas
annotations read the same theme tokens as the interface.

headings request local sf pro rounded medium, semibold, and bold. other
text requests sf mono. the project does not distribute apple font files;
the declared fallback stacks apply where those fonts are unavailable.

inline semantics are explicit: `em` and `i` emphasize prose, `small` is
supporting text or units, `samp` is machine status, `kbd` is keyboard
input, `mark` is a highlight, `time` is a timestamp, `dl` is a readout.
decorative geometry uses aria-hidden spans. all icon-only controls have
names.

## themes

use the theme select in the header: system, dark, or light. an explicit
choice persists in local storage; system follows the operating system.
denied storage falls back to a session-only choice. changes synchronize
across tabs and redraw canvas annotations. screen state and game data
are independent of theme state.

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

`npm run check` runs eslint, the node tests, type checking, and the
production build. browser checks cover login, navigation, buying,
fitting, messaging, departing from the port and the map, the hull
catalog, theme persistence, and narrow layouts, against a live gateway.
