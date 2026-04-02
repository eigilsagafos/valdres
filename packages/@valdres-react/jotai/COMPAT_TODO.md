# Jotai Compatibility - Todo Tests

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
- [ ] `should override a promise by setting`
- [ ] `should update async atom with deps after await (#1905)`
- [ ] `should not fire subscription when async atom promise is the same`
- [ ] `resolves dependencies reliably after a delay (#2192)`
- [ ] `should flush pending write triggered asynchronously and indirectly (#2451)`
- [ ] `async atom with subtle timing > case 2`
- [ ] `notifies async derived-atom subscriber when read calls store.set before await`
- [ ] `can propagate updates with async atom chains`
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
- [ ] `should bail out with the same value with chained dependency (#2014)`
- [ ] `should not recompute a derived atom value if unchanged (#2168)`
- [ ] `should update derived atom even if dependencies changed (#2697)`
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
