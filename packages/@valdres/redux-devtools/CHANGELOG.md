# @valdres/redux-devtools

## 1.0.0-beta.3

### Minor Changes

- [#198](https://github.com/eigilsagafos/valdres/pull/198)
  [`5f48a3b`](https://github.com/eigilsagafos/valdres/commit/5f48a3b64fcc899f8b2defa03e0039e3c8f563ce)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Add an `exclude`
  option to `connectReduxDevtools` for leaving high-frequency atoms (e.g. a
  cursor-position atom) out of DevTools entirely — neither seeded nor reported
  as actions. A rule can be an atom/selector reference, an `atomFamily` or
  `selectorFamily` (excludes all its members), a `name` string, a predicate
  `(state) => boolean`, or an array mixing any of these.

## 1.0.0-beta.2

### Patch Changes

- Updated dependencies
  [[`67536e7`](https://github.com/eigilsagafos/valdres/commit/67536e7f177d46278b7324a56b2eecf738b1c86f),
  [`0b3dbb7`](https://github.com/eigilsagafos/valdres/commit/0b3dbb7214d640beac5c1aead9d89e45d732e4fd),
  [`ce638b0`](https://github.com/eigilsagafos/valdres/commit/ce638b0ba3871b2ba1536589da482670822c3585),
  [`a0c959a`](https://github.com/eigilsagafos/valdres/commit/a0c959a1d41bc7041a69c87c651a6e7f5587d9ca),
  [`4d57212`](https://github.com/eigilsagafos/valdres/commit/4d572129587e801ebea26c00f1e8f581b78f5035),
  [`59fab53`](https://github.com/eigilsagafos/valdres/commit/59fab53ed00b411ca3ad331f92f49c1c34fb7ae2)]:
    - valdres@1.0.0-beta.9

## 1.0.0-beta.1

### Minor Changes

- [#183](https://github.com/eigilsagafos/valdres/pull/183)
  [`19d90b2`](https://github.com/eigilsagafos/valdres/commit/19d90b2c7a6812e73b631aabdf0ab66684ad6c58)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Add
  `@valdres/redux-devtools` — connect a valdres store to the Redux DevTools
  browser extension for live action logging and time-travel, built on
  `store.onChange`.

    `connectReduxDevtools(store, options?)` mirrors every committed change to a
    named atom (in the store or any scope) into the extension as an action, and
    wires the extension's jump / commit / reset controls back onto the store via
    time-travel. Atoms that only appeared after the target point are `unset` on
    jump-back so nothing stale lingers — a scope override re-inherits the
    parent, a root atom reverts to its default. A `store.unset` surfaces as an
    `unset`-sourced action and drops the override from `@scopes`.

    - A transaction — including one spanning scopes — arrives as a single
      action; `store.txn(fn, name)` names it, otherwise it's labelled
      `txn (N atoms · …)`.
    - `meta.source` distinguishes resets, deletes, and cache revalidations from
      plain sets in the timeline; deletions remove the atom from the snapshot.
    - Scope state nests under a reserved `@scopes` key with `@scope:<path>`
      labels.
    - Atoms without a `name` are tracked as `unnamed_atom_N` by default (a
      one-time hint suggests naming them, since the labels aren't stable across
      reloads); pass `unnamed: "ignore"` to leave them out.
    - `serialize` shapes non-cloneable values before they're posted to the
      extension. Reducer-only controls (skip / reorder) surface an in-panel
      error when dispatched, without wiping history. `disconnect()` is
      per-connection (it does not call the global `ext.disconnect()`).
    - `{ selectors: true }` additionally mirrors named selector (derived) values
      under a reserved `@computed` key — display-only, excluded from
      time-travel. Root selectors live at the top level; scope selectors nest
      under `@scopes.<scope>.@computed`.
    - Honors the extension's **Pause recording** (timeline pauses, model stays
      current) and **Import** (restores the imported session's current state).
    - For an **enumerable store** (`store(id, { enumerable: true })`), seeds the
      initial timeline from `store.snapshot()` so it opens with state that
      already exists instead of empty; a default store starts empty and fills
      via `onChange`.

### Patch Changes

- Updated dependencies
  [[`affd12b`](https://github.com/eigilsagafos/valdres/commit/affd12b3845e355b71739cd7d577f5e2af5af74a),
  [`4ccd1af`](https://github.com/eigilsagafos/valdres/commit/4ccd1af8b24c69f725677222d99d055421352822),
  [`231e59d`](https://github.com/eigilsagafos/valdres/commit/231e59d15dabb8fd822e0803e93ffad0f0d0138a),
  [`b76cdc2`](https://github.com/eigilsagafos/valdres/commit/b76cdc27414abf4c55bb6dfbc9c1c5d370af8f1d),
  [`2776bff`](https://github.com/eigilsagafos/valdres/commit/2776bffa8deee3f2bc651c757aa19e788339fbfc),
  [`68b124d`](https://github.com/eigilsagafos/valdres/commit/68b124d4f191431cd608ff04ba5c5fb15429f205)]:
    - valdres@1.0.0-beta.7
