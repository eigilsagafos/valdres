---
"valdres": minor
---

**Atom values are now deep-frozen in development/test only, not in production.**

Valdres deep-freezes every object atom value on write so accidental in-place
mutation (`state.foo = x`, `arr.push(...)`) throws a `TypeError` instead of
silently corrupting state. Until now this ran in *every* build because
`isProd()` was hardcoded to `false`. It now honors `process.env.NODE_ENV`, so
production builds skip the freeze entirely — worth up to ~15–20% on write-heavy
workloads (e.g. bulk inserts of object values); a single small write saves less.
This matches how Recoil (`__DEV__`-gated freeze) and Redux Toolkit
(dev-only immutability checks) treat the same safety net: a dev-time aid, not a
prod cost.

**⚠️ Migration — read before upgrading.** If your app mutates atom values in
place, that bug was previously caught by a thrown `TypeError` in both dev and
prod. After this change it is still caught in dev/test, but in **production it
will silently corrupt state** (symptoms look like flaky reactivity, not a clear
error). Before shipping:

- Audit for in-place mutation of values read from `store.get(...)` — e.g.
  `value.push(...)`, `value.x = ...`, `Object.assign(value, ...)`,
  `value.sort()`/`splice()`.
- Replace them with immutable updates (return a new object/array), or mark the
  atom `{ mutable: true }` if mutation is intentional.
- Run your test suite under `NODE_ENV !== "production"`, where the freeze still
  throws and surfaces these bugs for you.

Also: `deepFreeze` now allocates its cycle-guard `WeakSet` lazily — flat values
(the common case, e.g. `{ title, body }`) no longer allocate one at all, making
the dev/test freeze itself ~20% cheaper. Cycle and nested-graph behavior is
unchanged.
