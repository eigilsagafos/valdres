---
"valdres": patch
"valdres-react": patch
"valdres-angular": patch
"valdres-solid": patch
"valdres-svelte": patch
"valdres-vue": patch
"@valdres/bandwidth": patch
"@valdres/browser-color-scheme": patch
"@valdres/browser-contrast": patch
"@valdres/browser-device-motion": patch
"@valdres/browser-device-orientation": patch
"@valdres/browser-focus": patch
"@valdres/browser-geolocation": patch
"@valdres/browser-keyboard": patch
"@valdres/browser-online": patch
"@valdres/browser-presence": patch
"@valdres/browser-reduced-data": patch
"@valdres/browser-reduced-motion": patch
"@valdres/browser-reduced-transparency": patch
"@valdres/browser-screen": patch
"@valdres/browser-screen-details": patch
"@valdres/browser-visibility": patch
"@valdres/browser-window": patch
"@valdres/color-mode": minor
"@valdres/hotkeys": minor
"@valdres/public-ip": patch
"@valdres-react/color-mode": minor
"@valdres-react/draggable": minor
"@valdres-react/hotkeys": minor
"@valdres-react/jotai": patch
"@valdres-react/panable": minor
"@valdres-react/recoil": patch
---

Fix `workspace:^` leaking into published manifests. The previous beta releases
shipped with literal `"valdres": "workspace:^"` in their `dependencies`, which
npm cannot resolve. Changesets only rewrites pinned workspace specs (e.g.
`workspace:^1.2.3`), and `changeset publish` shells out to `npm publish` —
which doesn't understand the workspace protocol — so the bare shortcut got
published verbatim. Publishable packages now use plain semver ranges for
inter-package deps; changesets keeps them in lockstep on every bump, and
`verify-publish` fails CI if any `workspace:` reference sneaks back in.

The six Lerna-era packages still on the `pre` dist-tag (`@valdres/color-mode`,
`@valdres/hotkeys`, `@valdres-react/color-mode`, `@valdres-react/draggable`,
`@valdres-react/hotkeys`, `@valdres-react/panable`) get a `minor` bump so
they land on `0.3.0-beta.0` — a clean transition from the old `0.2.0-pre.28`
line to the unified `beta` dist-tag.
