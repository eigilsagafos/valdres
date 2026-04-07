# Jotai Compatibility - Todo Tests

## Currently Failing (10 tests)

### onMount/onUnmount not called on error (2)
When a subscriber throws, valdres skips lifecycle hooks:
- [ ] `should mount and trigger listeners even when an error is thrown > in synchronous onmount`
- [ ] `should mount and trigger listeners even when an error is thrown > in synchronous onunmount`

### Flush/batching order differs from jotai (4)
Valdres notifies listeners at different points in the write cycle:
- [ ] `flushPending...with set` — listener notification order differs
- [ ] `flushPending...with mount` — listener notification order differs (batching)
- [ ] `flushPending...with unmount` — derived atom default is `undefined` instead of `null`
- [ ] `batches sync writes`

### Deep recursion / stack overflow (1)
Deeply nested or circular selector graphs blow the stack:
- [ ] `processes deep atom graph beyond maxDepth`
- [x] `should not inf on subscribe or unsubscribe`

### Error resilience in listeners (1)
Valdres stops at the first throwing listener instead of continuing to notify remaining ones:
- [x] `should process all atom listeners even if some of them throw errors`

### Selector eval crash on unmount (1)
Related to how pending state is handled during unsubscribe:
- [x] `should use the correct pending on unmount`

---

## Safe to Ignore (14 tests)

### Jotai Internals (3)
Not part of the public API (`INTERNAL_onInit`, `createDevStore`, `deriveStore`):
- [ ] `should call onInit only once per atom`
- [ ] `should call onInit only once per store`
- [ ] `should pass store and atomState to the atom initializer`

### DEV-ONLY (1)
Debug/development warning, not functional behavior:
- [ ] `[DEV-ONLY] should warn store mutation during read`

### Memory Leak Tests (10)
Blocked by bun not supporting `node:v8 setFlagsFromString`. Tests GC behavior, not adapter correctness:
- [ ] `memory leaks (get & set only) > one atom`
- [ ] `memory leaks (get & set only) > two atoms`
- [ ] `memory leaks (get & set only) > should not hold onto dependent atoms that are not mounted`
- [ ] `memory leaks (get & set only) > with a long-lived base atom`
- [ ] `memory leaks (with subscribe) > one atom`
- [ ] `memory leaks (with subscribe) > two atoms`
- [ ] `memory leaks (with subscribe) > with a long-lived base atom`
- [ ] `memory leaks (with dependencies) > sync dependency`
- [ ] `memory leaks (with dependencies) > async dependency`
- [ ] `memory leaks (with dependencies) > async await dependency`

---

## Should Support (36 tests)

### Async Atoms — HIGH priority (16)
Core jotai feature, most common migration blocker:
- [x] `should update async atom with delay (#1813)`
- [x] `should override a promise by setting`
- [x] `should update async atom with deps after await (#1905)`
- [ ] `should not fire subscription when async atom promise is the same` (bun segfault)
- [ ] `resolves dependencies reliably after a delay (#2192)` (requires setSelf in read)
- [x] `should flush pending write triggered asynchronously and indirectly (#2451)`
- [x] `async atom with subtle timing > case 2`
- [x] `notifies async derived-atom subscriber when read calls store.set before await`
- [x] `can propagate updates with async atom chains`
- [x] `can get async atom with deps more than once before resolving (#1668)`
- [x] `settles never resolving async derivations with deps picked up sync`
- [x] `settles never resolving async derivations with deps picked up async`
- [x] `refreshes deps for each async read`
- [x] `works with async get` (react)
- [x] `works with async get without setTimeout` (react)
- [x] `async chain for multiple sync and async atoms (#443)` (react)

### onMount Lifecycle — HIGH priority (6)
Heavily used in jotai codebases for side effects:
- [x] `should recompute dependents' state after onMount (#2098)`
- [x] `should mount once with atom creator atom (#2314)`
- [x] `Unmount an atom that is no longer dependent within a derived atom (#2658)`
- [ ] `keeps atoms mounted between recalculations`
- [ ] `chained derive atom with onMount and useEffect (#897)` (react)
- [ ] `in onmount/onunmount asynchronous setAtom`

### onMount setSelf — now passing (1)
- [x] `should call subscribers after setAtom updates atom value on mount but not on unmount`

### Derived Atom Optimization — MEDIUM priority (4)
Important for correctness and performance:
- [x] `should bail out with the same value with chained dependency (#2014)`
- [x] `should not recompute a derived atom value if unchanged (#2168)`
- [x] `should update derived atom even if dependencies changed (#2697)`
- [x] `handles complex dependency chains`

### Abort Signal Support — now passing (3)
Used for cancellation of async atoms:
- [x] `should abort the signal when dependencies change`
- [x] `should abort the signal when dependencies change and the atom is mounted`
- [x] `should not abort the signal when unsubscribed`

### Error Handling in Async — MEDIUM priority (4)
Error recovery in async lifecycle:
- [x] `in asynchronous read`
- [x] `in read setSelf`
- [x] `in read promise on settled`
- [x] `in asynchronous write`

### React Rendering — MEDIUM priority (5)
React rendering patterns with atoms:
- [ ] `re-renders a time delayed derived atom with the same initial value (#947)`
- [x] `uses atoms with tree dependencies`
- [x] `uses an async write-only atom`
- [x] `uses a writable atom without read function`
- [x] `write self atom (undocumented usage)`

### Dev Store / Mounted Atoms — LOW priority (2)
- [ ] `should unmount with store.get`
- [ ] `should unmount dependencies with store.get`
