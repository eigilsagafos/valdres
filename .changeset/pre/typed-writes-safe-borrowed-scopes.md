---
"valdres": minor
---

Correct the public write and family contracts and prevent borrowed scope
callbacks from disposing scopes owned by lease holders.

`store.set` and transaction `set` now type synchronous writes as their value and
Promise or promise-returning-updater writes as `Promise<Value>`.
`selectorFamily` member getters receive the same `SelectorGetOptions` as plain
selectors. Global atom families now require a stable `name` at compile time,
matching their existing runtime requirement.

The global-family overload correction is a breaking type change for callers that
pass an options variable typed only as `AtomFamilyOptions`, where `global` is an
unresolved `boolean`. Narrow `global` to a literal branch or pass a literal
`{ global: true, name }` object so TypeScript can select the global return type.
Plain global atoms still permit unnamed instances, and selectors do not expose a
global option.
