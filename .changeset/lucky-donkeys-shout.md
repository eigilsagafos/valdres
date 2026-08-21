---
"valdres": minor
---

Add `store.onDispose()` and `store.hasScope()`, and type `store.txn()`'s return
value.

**`onDispose(callback)`** runs when a store is disposed — `dispose()` on it, an
ancestor disposed, or, for a scope, its LAST lease detaching — and returns a
function that cancels the registration.

```ts
const draft = root.scope(changeSetRef)
draft.onDispose(() => cache.delete(changeSetRef))
```

For resources a consumer owns alongside a store and must release with it: an
adapter's per-scope cache, a subscription to something external, a timer. A
scope's death was otherwise unobservable from a single lease — the holder knows
when IT detaches, not whether it was the last — leaving inference on the next
acquire as the only option, which cannot tell a scope that survived from a new
one reusing the id, so state keyed by that id leaks into its successor.

The store is already terminal inside the callback, so read what you need
beforehand and close over it. Every callback runs even if an earlier one throws;
the first error reaches whoever called `dispose()`. Per-atom setup still belongs
in `onMount`, whose cleanup tracks subscribers rather than the store's lifetime.

**`hasScope(scopeId)`** answers whether a store has that child scope — the same
question `scope(scopeId, callback)` answers by throwing, without making a caller
catch to find out. Depth composes through `scope()` rather than a path argument:
`store.scope("a", s => s.hasScope("b"))`. `storeAdapter.hasScope` still works
and now forwards to it.

**`store.txn()`** returns its callback's value, which it always did at runtime
while being typed `void`. The two other callback forms — `store.scope(id, cb)`
and `txn.scope(id, cb)` — are both typed `=> ReturnType<Callback>`, so this was
an inconsistency rather than a decision, and consumers were casting. Widening
`void` to the callback's return type is not a breaking change.

Also documents a scope-local `del()`, whose two read paths differ on purpose:
`get(family)` omits the member while `get(family(key))` still returns the
parent's value, because a value read with no local value falls through the scope
chain as always. The scope said "not one of mine", not "gone everywhere".
