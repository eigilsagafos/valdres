---
"valdres": patch
"valdres-react": patch
---

Fix "Maximum update depth exceeded" with `{ batchUpdates: true }` in React

A `batchUpdates` store could drive `useSyncExternalStore` into a repair loop
during a burst of writes (a streaming load), crashing with "Maximum update depth
exceeded". React re-reads `getSnapshot` after every commit and forces another
render when it differs from the value the render used; two things made that
check fail on every commit while a batch was open:

- a staged selector read was not memoized against the committed value, so an
  **unchanged** value came back as a fresh reference on every read after any
  `set` (each `set` clears the transaction's selector cache). Staged reads now
  apply the same `equal` memoization the committed evaluators do, which also
  makes `store.txn` bodies reference-stable.
- `store.get` answers from the open batch, but only the commit notifies — so the
  snapshot moved with no subscriber callback at all. `useValue` now reads the
  committed value via the new `storeAdapter.committedGet` capability.

`store.get` keeps its documented read-your-writes behavior; only snapshot reads
changed. **Behavior change:** on a batched store a component reflects a write
when the batch commits (next microtask), not synchronously within the same tick.
Tests that `set` and then assert on rendered output without awaiting a microtask
need a flush — `await act(async () => {})`.
