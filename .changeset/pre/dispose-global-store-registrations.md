---
"valdres": minor
---

Add `store.dispose()` and make scoped-store `detach()` dispose the scope when
its final consumer leaves. Stores now keep a lazy reverse index of only the
global atoms they touch, allowing disposal in O(touched global atoms) while
removing every strong global-atom registration, balancing global `onMount` and
`maxAge` lifecycles, and keeping future global writes independent of completed
SSR/request stores. Queued batched writes and async settlements are discarded
once their source store is disposed.

Global fan-out now identifies its origin by `StoreData` identity rather than a
user-provided store id, so separately-created stores with duplicate ids still
synchronize. The identity fast path also skips redundant validation and equality
work for the already-written origin store.

The process-wide `globalStore` now rejects disposal so it remains available as
the synchronization anchor for global atoms created later.
