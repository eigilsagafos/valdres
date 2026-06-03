---
"valdres": minor
---

Allow user-provided `onSet` on global atoms. Previously, passing `onSet` to
`atom(value, { global: true, onSet })` threw at construction because the
field was reserved for the internal cross-store sync mechanism. The factory
now composes both: cross-store sync runs first (peers receive the update
with `skipOnSet=true`, so the user hook does not double-fire), then the
user hook is invoked once, in the originating store.
