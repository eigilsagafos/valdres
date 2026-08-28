# Current ShiftX evidence handoff

This audit must run on a maintainer-designated current ShiftX checkout. It
cannot run in this workspace, and the sparse October 2024 snapshot under
`.context/shiftx-audit` cannot satisfy the gate.

Return one provenance-stamped report and the exact commands/output needed to
reproduce it. Do not copy proprietary ShiftX source into Valdres.

## Provenance header

Record:

- repository remote;
- branch;
- full commit SHA;
- dirty status;
- package-manager and runtime versions;
- lockfile SHA-256;
- paths included/excluded by sparse checkout, if any;
- Valdres source/tarball path, version, Git SHA, build flags, and SHA-256;
- audit date and agent/operator.

## Required inventories

Every matching call site needs a row, not only an aggregate count.

### Store and scope ownership

```text
call site | root/child | parent | scope ID/cardinality | generation trigger |
creation owner | consumers | initialization timing | disposal/teardown signal |
transaction use | SSR/request domain | proposed migration
```

Inventory `store(...)`, Store identity options/IDs, `scope`, `detach`,
`hasScope`, `useStoreId`, `useStore(id)`, `<Scope>`, every `<Provider>`, and
every Provider initializer.

### Transactions and React capture

```text
call site | hook/API | captured Store source | scope relationships |
derived reads | retained-after-unmount behavior | proposed migration
```

Inventory native and compatibility `useTransaction`, `useValdresCallback`,
manual Transaction objects, `txn.scope`/parent targeting, cross-root writes, and
transaction callbacks reached from subscribers or lifecycle callbacks.

### Callback quarantine

```text
callback owner | registration API | triggering phase | Store operation |
target tree | required ordering | reachability | proposed migration
```

Inventory subscribers, startup/lifecycle effects, instrumentation, external
source callbacks and cleanups, hotkeys, worker callbacks, and callbacks that
register another callback.

### Async and cache flows

```text
flow | authority | key identity | loader/storage | dedupe/generation/abort |
status/error/stale policy | Suspense use | canonical Store handoff |
proposed owner (application/externalAtom/beta cache)
```

Include Promise atoms/selectors, IndexedDB/server misses, resource hooks, manual
loader caches, public-IP/bandwidth-like flows, and local optimistic mutation
caches.

### SSR and external sources

```text
source | live snapshot owner | subscription lifetime | deterministic or
transferred server seed | direct/transitive React consumers | client-only
boundary if no seed | multi-root behavior
```

## Required executable migrations

Against the exact packed Valdres candidate, exercise every distinct current
shape found above, including at minimum:

1. a long-lived app/session root;
2. any keyed route/session/modal Store replacement still present;
3. one named child Store borrowed by two React consumers;
4. one real same-StoreTree transaction spanning the scope relationships ShiftX
   actually uses and reading a derived selector;
5. every callback currently attempting a forbidden Store operation;
6. representative async/cache and SSR/hydration flows.

Run StrictMode replay, abandoned render, rerender, real replacement, teardown,
reopen, and 100 open/close cycles where applicable. Verify first render is
initialized, Provider performs zero Store ownership work, old subscriptions
detach before owner disposal, stale callbacks cannot reach the replacement, and
Store/scope/subscriber counters return to baseline.

## Return rule

If a concrete flow cannot migrate without leases, consumer-count ownership,
render-time Store creation, an ambient Store registry, a callback phase bypass,
or privileged cache access, stop and return that exact flow as a product
decision. Do not add a compatibility shim in ShiftX to make the audit green.
