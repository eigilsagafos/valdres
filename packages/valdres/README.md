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

## Parameterized State identity

`family(factory)` memoizes one Atom or Selector per non-empty ordered tuple of primitive keys (`string`, `number`, `bigint`, `boolean`, `symbol`, `null`, or `undefined`). Keys use SameValueZero, so `NaN` matches `NaN` and `0` matches `-0`; tuple arity and order still matter.

```ts
import { atom, family } from "valdres"

const cellValue = family((sheetId: string, row: number) => atom(""))
cellValue("budget", 4) === cellValue("budget", 4) // true

type Step = { readonly id: string; readonly title: string }

const stepProgress = family((step: Step) => atom(0), {
    encodeKey: step => step.id,
})

stepProgress({ id: "step-1", title: "Draft" }) ===
    stepProgress({ id: "step-1", title: "Review" }) // true
```

Structured arguments require a synchronous `encodeKey` that returns one canonical primitive key. The factory must construct and return its Atom or Selector during that member's construction, or return any member already published by a family. Returning an arbitrary pre-existing State is rejected.

The exported `FamilyKey` type names the primitive-key union for reusable APIs.

Factories and encoders are synchronous definition callbacks, not Store work. Neither may perform Store, scope, transaction, or subscription operations or borrow an active selector's `get`. Encoders also cannot construct State definitions or call a family; factories may do both. A violation throws without caching a member.

The family cache is weak. A live reference, a committed Store override for a family Atom, an active subscription, or a retained selector dependency keeps that member alive. Reset or disposal releases Store ownership, and unsubscription releases subscription ownership. After the last owner disappears, a later lookup may run the factory again.

A family is only a callable identity cache. It has no membership or enumeration API and no `delete`, `release`, `index`, Store, or collection surface.

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

The report correlates human labels with opaque operation, commit, evaluation, session, and search IDs. It includes selector work, proposed topology changes, forward cycle-search visits by host and call site, bounded reverse-proof outcomes and work, topology-delta reverse-snapshot attempts/outcomes/scanned and captured work, aggregate negative-proof memo admission/probe/prune counters, transient selector-host counts, and propagation/notification totals. Completed summaries and details use separate bounded rings with explicit overflow. Exports are immutable and JSON-safe; application values, callbacks, errors, and live State handles are never recorded. Labels are metadata, not identity. The core inspection schema is version 5.

Inspection adds recording and timing work only to the Store created by `createInspectableStore`. The recorder stays outside the ordinary root entry and ordinary consumer bundles remain within their existing size budget.

The versioned `valdres/adapter-internals/v1` entry is for framework bindings. It exports only `assertStore`, `read`, `subscribe`, and `readHydrationSnapshot`; application code should use Store methods directly.

## Beta compatibility

`valdres@1.0.0-beta.24` and later v1 betas intentionally replace the legacy beta API. `valdres-react@1.0.0-beta.6` is certified with `valdres@1.0.0-beta.27` and later v1 betas accepted by its `^1.0.0-beta.27` peer range. Deferred framework adapters and plugins remain unsupported even when their published semver ranges allow npm to resolve this core; do not mix them with the new beta until they are migrated.

<!-- DOCS:END -->
