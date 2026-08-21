---
"valdres": minor
---

Give every type reachable from an exported signature a name consumers can
import. `AtomOptions`, `SelectorOptions`, `StoreOptions`, `AtomDefaultValue`,
`AtomFamilyAtom`, `AtomFamilyDefaultValue`, `AtomFamilySelector`,
`GlobalAtomFamily`, `EqualFunc`, `AtomOnMount`, `AtomOnSet`, `SubscribeFn`,
`ScopedStore`, and `ScopeFn` are now exported from the package root, so a typed
wrapper can annotate them directly instead of re-deriving private shapes with
`Parameters`/`ReturnType`.

`StoreOptions` is the full `store()` bag — including `id` and `batchUpdates`,
which now carries doc comments describing the tick-coalescing commit and its
scope-sharing semantics.

`AtomOnMount` is properly typed:
`(store: Store, state: Atom<Value> | Selector<Value>)` instead of
`(store?: any, state?: any)`, so hooks that use their arguments get real types.
Hooks that ignore the arguments — the common
`onMount: () => bootstrap(thisAtom)` shape — are unaffected. A second type
parameter narrows the state at the use site when a hook needs fields only one
side has: `AtomOnMount<number, Atom<number>>` reaches `defaultValue` without
narrowing, and still assigns into `atom()`.
