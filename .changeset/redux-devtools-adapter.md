---
"@valdres/redux-devtools": minor
---

Add `@valdres/redux-devtools` — connect a valdres store to the Redux DevTools
browser extension for live action logging and time-travel, built on
`store.onChange`.

`connectReduxDevtools(store, options?)` mirrors every committed change to a
named atom (in the store or any scope) into the extension as an action, and
wires the extension's jump / commit / reset controls back onto the store via
time-travel. Atoms that only appeared after the target point are `unset` on
jump-back so nothing stale lingers — a scope override re-inherits the parent, a
root atom reverts to its default. A `store.unset` surfaces as an
`unset`-sourced action and drops the override from `@scopes`.

- A transaction — including one spanning scopes — arrives as a single action;
  `store.txn(fn, name)` names it, otherwise it's labelled `txn (N atoms · …)`.
- `meta.source` distinguishes resets, deletes, and cache revalidations from
  plain sets in the timeline; deletions remove the atom from the snapshot.
- Scope state nests under a reserved `@scopes` key with `@scope:<path>` labels.
- Atoms without a `name` are tracked as `unnamed_atom_N` by default (a one-time
  hint suggests naming them, since the labels aren't stable across reloads);
  pass `unnamed: "ignore"` to leave them out.
- `serialize` shapes non-cloneable values before they're posted to the
  extension. Reducer-only controls (skip / reorder) surface an in-panel error
  when dispatched, without wiping history. `disconnect()` is per-connection (it
  does not call the global `ext.disconnect()`).
- `{ selectors: true }` additionally mirrors named selector (derived) values
  under a reserved `@computed` key — display-only, excluded from time-travel.
  Root selectors live at the top level; scope selectors nest under
  `@scopes.<scope>.@computed`.
- Honors the extension's **Pause recording** (timeline pauses, model stays
  current) and **Import** (restores the imported session's current state).
- For an **enumerable store** (`store(id, { enumerable: true })`), seeds the
  initial timeline from `store.snapshot()` so it opens with state that already
  exists instead of empty; a default store starts empty and fills via
  `onChange`.
