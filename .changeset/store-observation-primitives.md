---
"valdres": minor
---

Add two low-level store observation primitives for devtools / logging /
persistence adapters:

- `subscribeStore(store, listener)` — observe every committed write across a
  store and its scopes. The listener receives the changed atoms, the store (or
  scope) the change happened in, and whether it was a lazy-init-only batch;
  returns an unsubscribe. Notifications fire from the single propagation
  chokepoint and are guarded by a module-level counter, so stores with no
  listener attached pay essentially nothing on the write path.
- `getRegisteredAtoms()` — a name → atom map of every atom declared with a
  `name`, for enumerating named state and resolving names back to atoms.
