# frontend foundations

## boundaries

`client.ts` owns the session: auth, hydration, commands, and the feed.
`app.ts` owns navigation, the hull preview choice, and notifications.
`src/screens/` contains lit components for auth, port, rigging, exchange,
comms, and flight. each retains its own input state when hidden and
releases its rendered scenes. a screen renders one immutable session
snapshot and calls commands on the client. it never computes the next
state: the server does, and `events.ts` folds the result in from the
feed. the map remains its own component.

`src/components/` provides native-control template components, shared station
composition, a panel surface, theme selection, and the hull catalog. template
buttons and fields produce real buttons, labels, selects and inputs: disabled
behavior, keyboard activation, label association and form submission stay native.
`icons.ts` is the shared svg icon component and path catalog.

`src/util.ts` contains browser-safe `Fail`, `ValidationError`, `assert`, `raise`,
number/credit/duration formatting, clamping, and typed event emission.
errors carry a stable code and optional cause. this follows garage's error
conventions with explicit types and browser-compatible dependencies.

## styling

`src/styles.css` is an import manifest. the ordered styles are:

- tokens: semantic theme colors, spacing, type scales, weights, and control sizes.
- reset: document defaults, focus visibility, hidden content, reduced motion.
- typography: local font faces and semantic headings/inline text.
- forms and panels: shared native controls and surface/readout rules.
- layout and scene: shell, navigation, camera, and world annotations.
- station, comms, flight, fleet, atlas: component-specific layout and artwork.
- components: shared component contracts and responsive adjustments.

styles use native css nesting and relative layout/type units. component
states and descendants belong under their owner. colors are defined in tokens;
renderer material colors remain part of the procedural artwork. canvas orbital
annotations consume the same theme tokens as the interface.

headings request local sf pro rounded medium, semibold, and bold. other text
requests sf mono. the project does not distribute apple font files; the declared
fallback stacks are used on devices where those fonts are unavailable.

inline semantics are explicit: `em`/`i` emphasize prose, `small` is supporting
text or units, `samp` is machine status, `kbd` is keyboard input, `mark` is a
highlight, `time` is a timestamp, `dl` is a readout. decorative geometry uses
aria-hidden spans, not italic text elements. all icon-only controls have names.

## themes

use the theme select in the header: system, dark, or light. an explicit choice
persists in local storage; system follows the operating system. denied storage
falls back to a session-only choice. changes synchronize across tabs and redraw
canvas annotations. screen state and game data are independent of theme state.

## validation

`npm run check` runs eslint, the domain/simulation/utility tests, type checking,
and the production build. browser checks cover screen navigation, buying,
fitting, retained input state, messaging, flight controls, map playback,
camera reset, catalog focus, theme persistence, and narrow layouts.
