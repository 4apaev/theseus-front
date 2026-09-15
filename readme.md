# theseus / frontend prototype


$codex-security:security-scan

an orbital trading game interface built with typescript, lit, and three.js. all ships and port facilities are procedural geometry. no image assets, texture maps, external fonts, or backend are required at runtime.

## run

requires node 24 or newer.

```sh
npm install
npm run dev
```

open the url printed by vite. `npm run check` runs lint, domain/physics tests, type checking, and a production build. `npm run preview` serves that build.

## explore

- port: click a facility in the scene or use the operations rail. drag to orbit the camera; use zoom and reset controls.
- rigging: select a mount, install or remove modules. power and hold limits are enforced. the hull catalog previews 12 procedural vessels in three category palettes.
- exchange: buy and sell ore, grain, and parts. credits, station inventory, and cargo capacity update together.
- comms: send local messages or choose vesper for a private channel with an eight-second simulated delivery delay. private messaging requires the fitted ansible.
- map: switch between interstellar cartography and the sol system. select a destination, then run the travel example; pause, scrub, replay, or change playback speed. earth opens the local orbital planner.
- flight: adjust an orbital maneuver's prograde/radial impulse and node angle. drag the node or use the slider, scrub/play the trajectory, and compare closest approach and relative velocity. switch to brachistochrone for the separate constant-acceleration model.

this is a local, in-memory prototype. reload resets the demo. hull selection and module installation are free. contacts are fictional, messages never leave the browser, and saving a flight plan records a summary without launching the vessel. map travel is also a preview: it leaves your trading vessel docked. see [map notes](docs/maps.md) for model assumptions and [prototype notes](docs/prototype.md) for architecture and physics limits.

## code style and dependency policy

`npm run lint:fix` applies the garage/theseus code style through the local
`eslint.config.js` and typescript-aware stylistic rules. no runtime dependency
on the server repositories is needed. see [frontend foundations](docs/frontend.md)
for component boundaries, nested styles, utilities, and light/dark themes.

the lint tool is typescript-eslint (imported as `tslint`), not the retired tslint package. no prettier preset overrides the project style.

as of 2026-09-12, the toolchain uses current stable lit, three.js, vite, eslint, and typescript-eslint releases. typescript is kept at 6.0.3 because [typescript-eslint currently supports versions below 6.1](https://typescript-eslint.io/users/dependency-versions/); typescript 7 is not a drop-in replacement for its compiler-api dependency. node declarations stay on the node 24 line to match the minimum runtime. the lockfile records the installed versions.




