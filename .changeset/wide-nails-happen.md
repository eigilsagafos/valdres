---
"@valdres/redux-devtools": minor
---

Add an `exclude` option to `connectReduxDevtools` for leaving high-frequency atoms (e.g. a cursor-position atom) out of DevTools entirely — neither seeded nor reported as actions. A rule can be an atom/selector reference, an `atomFamily` (excludes all its members), a `name` string, a predicate `(state) => boolean`, or an array mixing any of these.
