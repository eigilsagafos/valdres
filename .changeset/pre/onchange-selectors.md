---
"valdres": minor
---

`store.onChange` can now also report **selector** (derived state) changes, gated
by an options object, and the `StoreChange` shape is reworked around `type` +
`state`.

**Options — two independent toggles:**

- `atoms` (default `true`) — atom `set` / `unset` / `delete` changes.
- `selectors` (default `false`) — selectors that recomputed to a new value.

```ts
store.onChange((changes, meta) => {
  for (const c of changes) {
    if (c.type === "selector") console.log("derived", c.state, "→", c.value)
    else if (c.kind === "delete") console.log("deleted", c.state)
    else console.log("atom", c.state, "→", c.value) // set | unset
  }
}, { selectors: true })

// selectors only:
store.onChange(cs => …, { atoms: false, selectors: true })
```

A `{ selectors: true }` listener additionally receives `{ type: "selector", state,
value, scope }` for selectors that recomputed as a consequence of an operation —
in the same single callback as the atom changes. Within a store's changes, atom
entries precede that store's selector entries; descendant-scope recomputes carry
their scope path.

Only **live** selectors (those with a subscriber or a downstream dependent, i.e.
already recomputed this pass) and only **genuine value changes** (respecting the
selector's `equal`) are reported — so selector reporting forces no extra
evaluation, and an orphaned selector whose cache is merely dropped is not
reported. An async selector resolving surfaces as a `type: "selector"` change with
`meta.source === "async-set"`. When no selector listener is active the propagation
hot path is unchanged (gated on a global counter, no allocation).

The callback's `changes` type follows the options: `AtomChange[]` by default,
`StoreChange[]` with `{ selectors: true }`, `SelectorChange[]` with
`{ atoms: false, selectors: true }`.

**`StoreChange` shape.** `store.onChange` is unreleased, so this is its initial
public shape (no migration from a prior release):

- Each change has a `type` (`"atom" | "selector"`) and a `state` field — the
  changed atom or selector. (`state` matches valdres's `State` type and the
  `store.get`/`store.sub` parameter, so `store.get(change.state)` reads naturally.)
- Atom changes carry a `kind`: `"set" | "unset" | "delete"`. Selector changes
  have **no `kind`** — a selector has no operation, only a recomputed value.
  Discriminate selector-vs-atom on `type`; switch on `kind` only after narrowing
  to `type: "atom"`.
- New exported types: `AtomChange`, `SelectorChange` (with
  `StoreChange = AtomChange | SelectorChange`).
