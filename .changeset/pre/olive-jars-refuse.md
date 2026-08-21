---
"valdres": patch
---

Fix `unset`/`reset` stranding a suspense placeholder on an atom with no default.

Reading an atom declared without a default (`atom<T>()`) hands the caller a
pending placeholder promise, resolved by the next write. Removing the store's
own value while that placeholder was live — `store.unset(atom)`, or
`store.reset(atom)` on a no-default atom — left the entry in place, and the
re-initialization on the next read minted a **second** placeholder over the
same key. Only the new one was ever resolved, so a consumer already suspended
on the first (`await store.get(atom)`, or a Suspense boundary) hung forever:

```ts
const a = atom<number>()
const suspense = store.get(a)
store.unset(a)
store.set(a, 7)      // resolved a different placeholder
await suspense       // hung
```

Re-initialization now reuses the outstanding placeholder, so the suspended
reader is the one a later write resolves.
