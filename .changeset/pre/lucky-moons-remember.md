---
"valdres": patch
---

Demote orphaned selectors to a cold cache instead of dropping their value

Unsubscribing the last observer of a selector deleted its cached value, so a
remount re-ran the selector body. Under component churn — a virtualized list
scrolling, a route leaving and returning, Suspense retrying during a load — that
made every mount/unmount cycle re-evaluate the whole subscribed subtree. Because
teardown is deferred and drained by the next public read, the cost landed inside
`store.get`, which is where `useSyncExternalStore`'s `getSnapshot` runs.

Orphan cleanup now leaves the selector in exactly the shape a cold read produces:
committed value and forward dependency set retained behind a revision snapshot,
reverse edges released. A remount re-wires the graph through the existing
promote path instead of re-evaluating, and a dependency written while unmounted
still invalidates the snapshot so the next read re-evaluates once. Reads across
an unmount/remount boundary are `Object.is`-stable again.

Measured on 181 components each subscribing a per-item selector over a shared
high-fan-in layout selector: scroll churn and full remount drop from 910 selector
evaluations to 0, and time inside `getSnapshot` from 2.5 ms / 1.4 ms to
0.4 ms / 0.1 ms. Write propagation and teardown linearity are unchanged.

Two deliberate trade-offs. Recording a snapshot enables the store's cold-cache
bookkeeping, so the first selector teardown moves that store onto the
cold-cache-aware read and evaluation paths for good — the same switch any read of
an unsubscribed selector already causes, costing single-digit nanoseconds per
cached read (measured 12 ns to 15 ns on a 20-selector fan). React stores already
flip it via `getSnapshot` before subscribing; imperative `sub()`-then-`get()`
consumers that never read an unsubscribed selector will now see it too.

Stores created with `{ enumerable: true }` keep the previous drop behaviour and
still pay the re-evaluation: their `values` is a strong `Map`, so a retained value
would outlive its selector rather than being reclaimed with it, and
`store.snapshot()` — which `@valdres/redux-devtools` enumerates — would begin
listing torn-down selectors.
