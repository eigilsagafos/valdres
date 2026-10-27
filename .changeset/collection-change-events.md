---
"valdres": minor
---

**Breaking: a direct `store.sub(collection, callback)` now receives committed row events.**

The callback is called once per event with a `CollectionEvent<Key, Value>`
(newly exported): `added`, `updated` (with `previous`), `deleted` (with
`previous`), and at most one `reordered` per transaction. Events report each
committed transaction's net change per key in the subscribed Store's effective
view, compared with `Object.is`, in the order the transaction first changed each
row as that Store sees it. Value-only row updates now call the callback; before,
it ran without arguments and only when membership or order changed.

To keep membership-only notifications, subscribe to a selector that reads the
collection, or use the `notify` handler form:

```diff
-store.sub(mutations, () => onMembershipChange())
+store.sub(selector(get => get(mutations)), () => onMembershipChange())
+// or: store.sub(mutations, { notify: () => onMembershipChange() })
```

`settle` handlers on a collection, framework bindings such as `useValue`, and
the adapter `subscribe` seam keep membership semantics.
