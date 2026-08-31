---
"valdres": patch
"valdres-react": patch
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
