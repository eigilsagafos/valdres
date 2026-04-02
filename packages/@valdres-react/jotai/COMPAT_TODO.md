# Jotai Compatibility - Todo Tests

## Currently Failing (11 tests)

### onMount setSelf is object, not function (2)
The valdres adapter passes something other than a callable `setSelf` to the `onMount` callback:
- [ ] `flushPending...with mount` — `setSelf` from `onMount` is an object, not a function
- [ ] `should call subscribers after setAtom updates atom value on mount but not on unmount` — same issue

### onMount/onUnmount not called on error (2)
When a subscriber throws, valdres skips lifecycle hooks:
- [ ] `should mount and trigger listeners even when an error is thrown > in synchronous onmount`
- [ ] `should mount and trigger listeners even when an error is thrown > in synchronous onunmount`

### Flush/batching order differs from jotai (3)
Valdres notifies listeners at different points in the write cycle:
- [ ] `flushPending...with set` — listener notification order differs
- [ ] `flushPending...with unmount` — derived atom default is `undefined` instead of `null`
- [ ] `batches sync writes`

### Deep recursion / stack overflow (2)
Deeply nested or circular selector graphs blow the stack:
- [ ] `processes deep atom graph beyond maxDepth`
- [ ] `should not inf on subscribe or unsubscribe`

### Error resilience in listeners (1)
Valdres stops at the first throwing listener instead of continuing to notify remaining ones:
- [ ] `should process all atom listeners even if some of them throw errors`

### Selector eval crash on unmount (1)
Related to how pending state is handled during unsubscribe:
- [ ] `should use the correct pending on unmount`

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

## Should Support (40 tests)

### Async Atoms — HIGH priority (16)
Core jotai feature, most common migration blocker:
- [ ] `should update async atom with delay (#1813)`
- [x] `should override a promise by setting`
- [ ] `should update async atom with deps after await (#1905)`
- [ ] `should not fire subscription when async atom promise is the same`
- [ ] `resolves dependencies reliably after a delay (#2192)`
- [x] `should flush pending write triggered asynchronously and indirectly (#2451)`
- [ ] `async atom with subtle timing > case 2`
- [ ] `notifies async derived-atom subscriber when read calls store.set before await`
- [x] `can propagate updates with async atom chains`
- [ ] `can get async atom with deps more than once before resolving (#1668)`
- [ ] `settles never resolving async derivations with deps picked up sync`
- [ ] `settles never resolving async derivations with deps picked up async`
- [ ] `refreshes deps for each async read`
- [ ] `works with async get` (react)
- [ ] `works with async get without setTimeout` (react)
- [ ] `async chain for multiple sync and async atoms (#443)` (react)

### onMount Lifecycle — HIGH priority (6)
Heavily used in jotai codebases for side effects:
- [ ] `should recompute dependents' state after onMount (#2098)`
- [ ] `should mount once with atom creator atom (#2314)`
- [ ] `Unmount an atom that is no longer dependent within a derived atom (#2658)`
- [ ] `keeps atoms mounted between recalculations`
- [ ] `chained derive atom with onMount and useEffect (#897)` (react)
- [ ] `in onmount/onunmount asynchronous setAtom`

### Derived Atom Optimization — MEDIUM priority (4)
Important for correctness and performance:
- [x] `should bail out with the same value with chained dependency (#2014)`
- [x] `should not recompute a derived atom value if unchanged (#2168)`
- [x] `should update derived atom even if dependencies changed (#2697)`
- [ ] `handles complex dependency chains`

### Abort Signal Support — MEDIUM priority (3)
Used for cancellation of async atoms:
- [ ] `should abort the signal when dependencies change`
- [ ] `should abort the signal when dependencies change and the atom is mounted`
- [ ] `should not abort the signal when unsubscribed`

### Error Handling in Async — MEDIUM priority (4)
Error recovery in async lifecycle:
- [ ] `in asynchronous read`
- [ ] `in read setSelf`
- [ ] `in read promise on settled`
- [ ] `in asynchronous write`

### React Rendering — MEDIUM priority (5)
React rendering patterns with atoms:
- [ ] `re-renders a time delayed derived atom with the same initial value (#947)`
- [ ] `uses atoms with tree dependencies`
- [ ] `uses an async write-only atom`
- [ ] `uses a writable atom without read function`
- [ ] `write self atom (undocumented usage)`

### Dev Store / Mounted Atoms — LOW priority (2)
- [ ] `should unmount with store.get`
- [ ] `should unmount dependencies with store.get`
