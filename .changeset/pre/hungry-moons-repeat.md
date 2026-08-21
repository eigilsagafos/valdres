---
"valdres": patch
---

Fix a scope's cold selector caches surviving `unset`.

A cold selector — one with no subscriber and no live dependent — is not
recomputed by propagation. It holds a cached value plus a snapshot of its
dependencies' revisions, and revalidates against those on the next read.

`unset` is the one write that REMOVES a store's own value instead of replacing
it, and it recorded its revision bump on the store that no longer holds the
value. Reads then resolve the revision through the parent chain instead, where
nothing changed — so the snapshot matched, the cache validated, and the selector
served its pre-unset value for the life of the scope:

```ts
const derived = selector(get => `d:${get(source)}`)
const draft = root.scope("draft")

draft.set(source, "draft")
draft.get(derived) // "d:draft"

draft.unset(source)
draft.get(derived) // was "d:draft" — now "d:root"
```

A store's effective revision for a state it does not own is now the later of its
own recorded revision and the inherited one, so the removal outranks the
unchanged ancestor revision until an ancestor write overtakes it.

Only ever affected cold selectors in a SCOPE: live selectors are recomputed by
propagation, and on a root store the revision is read from the same place it was
written. Reached through `store.unset`, `txn.unset`, and — across every value
the scope owns at once — `ScopedStore.unsetAll()`.
