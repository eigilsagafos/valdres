<!-- DOCS:START -->

# valdres

The first public beta of Valdres's new synchronous state engine.

## Installation

```bash
npm install valdres@beta
```

```ts
import { store, atom, selector } from "valdres"

const countAtom = atom(0)
const doubledSelector = selector(get => get(countAtom) * 2)

const s = store()
s.set(countAtom, 21)
s.get(doubledSelector) // 42
```

`set` always stores the exact value you pass, including functions. Use `update` when the next value depends on the current value:

```ts
s.set(countAtom, 1)
s.update(countAtom, current => current + 1)
```

A store also exposes `sub`, `reset`, `txn`, `scope`, and `dispose`. Store operations are stable bound functions, so they can be passed as callbacks without rebinding. `store.txn(callback, name?)` accepts an optional human-readable diagnostic label; labels are metadata, not identity.

`atom(initial, options)` and `atom.lazy(initialize, options)` create writable state. `selector(read, options)` creates synchronous derived state. Atom and selector options accept an inert diagnostic `name` and an `equal(previous, next)` comparator.

## Opt-in structural equality

`Object.is` remains the default comparator. Import `deepEqual` from the separate equality entry only where structurally equal replacements should retain the previous reference and stop notifications or downstream propagation:

```ts
import { atom } from "valdres"
import { deepEqual } from "valdres/equality"

const documentAtom = atom({ blocks: [] }, { equal: deepEqual })
```

`deepEqual` recursively compares supported values using SameValueZero primitive leaves, own enumerable string and symbol properties, and native identity for Map keys and Set members. Non-binary objects require the same prototype. Matching binary brands compare visible bytes across realms and ignore attached properties. Functions, Promises, Errors, URLs, weak collections, other opaque platform objects, and DOM nodes compare only by identity. Cyclic structures are unsupported. Reached getters, Proxy traps, `valueOf`, and `toString` hooks can run and throw.

Structural comparison walks the compared values, so use it deliberately on allocation-heavy results where pruning redundant updates outweighs that work. The separate `valdres/equality` entry keeps it out of ordinary root bundles.

## Inspect a Store

`valdres/inspect` creates an opt-in Store with a bounded structural flight recorder. It belongs to the same runtime domain as ordinary Stores, so existing atoms, selectors, scopes, and framework adapters work unchanged:

```ts
import { createInspectableStore } from "valdres/inspect"

const { store: appStore, inspect } = createInspectableStore()

inspect.span("drop interaction", () =>
    appStore.txn(transaction => {
        transaction.update(processAtom, updateProcess)
    }, "collapse process"),
)

const report = inspect.export()
inspect.reset()
```

The report correlates human labels with opaque operation, commit, evaluation, session, and search IDs. It includes selector work, proposed topology changes, forward cycle-search visits by host and call site, bounded reverse-proof outcomes and work, aggregate negative-proof memo admission/probe/prune counters, transient selector-host counts, and propagation/notification totals. Completed summaries and details use separate bounded rings with explicit overflow. Exports are immutable and JSON-safe; application values, callbacks, errors, and live State handles are never recorded. Labels are metadata, not identity. The core inspection schema is version 4.

Inspection adds recording and timing work only to the Store created by `createInspectableStore`. The recorder stays outside the ordinary root entry and ordinary consumer bundles remain within their existing size budget.

The versioned `valdres/adapter-internals/v1` entry is for framework bindings. It exports only `assertStore`, `read`, `subscribe`, and `readHydrationSnapshot`; application code should use Store methods directly.

## Beta compatibility

`valdres@1.0.0-beta.24` and later v1 betas intentionally replace the legacy beta API. `valdres-react@1.0.0-beta.6` is certified with `valdres@1.0.0-beta.27` and later v1 betas accepted by its `^1.0.0-beta.27` peer range. Deferred framework adapters and plugins remain unsupported even when their published semver ranges allow npm to resolve this core; do not mix them with the new beta until they are migrated.

<!-- DOCS:END -->
