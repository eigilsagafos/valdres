# @valdres/redux-devtools

## 1.0.0-beta.4

### Patch Changes

- [#241](https://github.com/eigilsagafos/valdres/pull/241)
  [`8d882e0`](https://github.com/eigilsagafos/valdres/commit/8d882e0993aa3ed87a27840accb91d261d0f0244)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Keep root `unset()`
  lazy when `store.onChange` is active. Reporting an unset no longer evaluates a
  function or async default just to populate the event; a root unset omits
  `value` unless propagation already rematerialized it. Redux DevTools now
  removes cold root entries when that optional value is absent.

- [#251](https://github.com/eigilsagafos/valdres/pull/251)
  [`d11de95`](https://github.com/eigilsagafos/valdres/commit/d11de95881d0548fbf47add4a942aecb8fef6b0c)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make Store runtimes
  opaque. Stores now expose stable public identity through `store.id` instead of
  publishing mutable `StoreData`; `StoreData` is no longer exported from
  `valdres`, and `onSet` receives the public Store facade. Framework and tooling
  adapters now use the capability-based, versioned
  `valdres/adapter-internals/v1` boundary, which keeps adapter lookups off atom
  get/set hot paths. Engine-only atom/global-atom synchronization fields and the
  `MaxAgeInterval` timer type are no longer part of the public type surface.
- Updated dependencies
  [[`c8faa24`](https://github.com/eigilsagafos/valdres/commit/c8faa244800025ddd1756c6a17386ef84906a25e),
  [`ca00a89`](https://github.com/eigilsagafos/valdres/commit/ca00a896025a42bf31528e505234a7bb929f292c),
  [`9ba01a1`](https://github.com/eigilsagafos/valdres/commit/9ba01a10dc4350247dec174b2ea0bdf99ed72942),
  [`20b253f`](https://github.com/eigilsagafos/valdres/commit/20b253fe91007ae8961ecc423b2d27c9420c68c7),
  [`967bb03`](https://github.com/eigilsagafos/valdres/commit/967bb038855fe0d032cf3bd6f7810ad952d75e30),
  [`888f868`](https://github.com/eigilsagafos/valdres/commit/888f868246adadac653517755c04821afc75d5cd),
  [`cdcb6a2`](https://github.com/eigilsagafos/valdres/commit/cdcb6a2bdd615d7ba04e32f43c68ed1551276eec),
  [`9278b66`](https://github.com/eigilsagafos/valdres/commit/9278b6635ebde1df9f4320e474ce54b41a0a64d9),
  [`2d31b16`](https://github.com/eigilsagafos/valdres/commit/2d31b162fd2875cbb264620d59ce01a925cc1794),
  [`e584913`](https://github.com/eigilsagafos/valdres/commit/e5849132a360c6224fbc66ed1236ddfc3f1fdbcc),
  [`01529e5`](https://github.com/eigilsagafos/valdres/commit/01529e523bbf26df6e3c188c052c44ef64303ec8),
  [`7a59614`](https://github.com/eigilsagafos/valdres/commit/7a596146a8cdf64907ceb45871a60c56fc0391aa),
  [`2556617`](https://github.com/eigilsagafos/valdres/commit/255661708bd27cad9581cf0e47c5c8610fc86c8b),
  [`27340c5`](https://github.com/eigilsagafos/valdres/commit/27340c5e250e0fdf313e670c506cd209b229b9d1),
  [`ebbaff5`](https://github.com/eigilsagafos/valdres/commit/ebbaff5ec885a82d45c01badabd2f89e430a1f5f),
  [`8d882e0`](https://github.com/eigilsagafos/valdres/commit/8d882e0993aa3ed87a27840accb91d261d0f0244),
  [`4648c40`](https://github.com/eigilsagafos/valdres/commit/4648c40c3ec3c6ab67b7d1d8b47f2b0a3762980e),
  [`f0e657c`](https://github.com/eigilsagafos/valdres/commit/f0e657cc569b652ae3c27e5ad7c0a6f09e11543f),
  [`26064d2`](https://github.com/eigilsagafos/valdres/commit/26064d2945be405a6f3909445b1da72f2f6c7158),
  [`d11de95`](https://github.com/eigilsagafos/valdres/commit/d11de95881d0548fbf47add4a942aecb8fef6b0c),
  [`2100bb3`](https://github.com/eigilsagafos/valdres/commit/2100bb35c138e4b145938bfdd3630fcb3468e9c4),
  [`b7536ab`](https://github.com/eigilsagafos/valdres/commit/b7536ab3bf4e2face50dda54a232242dd87a02f0),
  [`eafa72c`](https://github.com/eigilsagafos/valdres/commit/eafa72c78d41b6fcc2ae321244fecb26209a1410),
  [`b8a82e5`](https://github.com/eigilsagafos/valdres/commit/b8a82e512f446f5f80970573cb0a8986392ddcdf),
  [`8c2531c`](https://github.com/eigilsagafos/valdres/commit/8c2531cef47d199cdcdb163347498029ad4fab05),
  [`2046b87`](https://github.com/eigilsagafos/valdres/commit/2046b87f254666909528912a2dade380bd16b864),
  [`2d21f06`](https://github.com/eigilsagafos/valdres/commit/2d21f06a66277e760e65de57b3f8b528d3ed9cc6),
  [`5dcd530`](https://github.com/eigilsagafos/valdres/commit/5dcd5309381f4f78f87038bd638ee9b3ce22bc5e),
  [`f092e71`](https://github.com/eigilsagafos/valdres/commit/f092e71eb3604c57552ced5058693766732330eb),
  [`165cdc4`](https://github.com/eigilsagafos/valdres/commit/165cdc4346091f860c193a686f4ea55e1e955671)]:
    - valdres@1.0.0-beta.17

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
