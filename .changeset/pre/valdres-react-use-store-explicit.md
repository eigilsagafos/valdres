---
"valdres-react": minor
---

**`useStore(store?)` accepts an explicit Store.** It returns that Store instead
of the nearest `<Provider>`'s — the resolution `useValue(state, store)` and the
other hooks already apply — so a library hook that takes an optional Store can
forward it and work with or without a Provider. `useStore()` is unchanged, a
string ID is still rejected, and the opt-in `valdres-react/inspect` binding's
`useStore` gains the same parameter.
