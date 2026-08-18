---
"valdres": minor
---

Replace the `{ global: true }` atom/atomFamily flag with dedicated
`globalAtom(defaultValue, options)` and
`globalAtomFamily(defaultValue, options)` constructors.

**Breaking.** `global` is no longer a key of `AtomOptions`/`AtomFamilyOptions` —
`atom()` and `atomFamily()` only ever produce ordinary, per-store state now.
Global (cross-store) atoms and families are created through the new
constructors instead, with the same call shape as `atom()`/`atomFamily()`
except `options.name` is required (it was previously optional, and plain
global atoms could be unnamed). `atom()` no longer statically imports the
global-atom engine module, shrinking the bundle for consumers who never
create a global atom.

Migration:

```diff
-const config = atom(0, { global: true, name: "app/config" })
+const config = globalAtom(0, { name: "app/config" })

-const itemById = atomFamily(null, { global: true, name: "items" })
+const itemById = globalAtomFamily(null, { name: "items" })
```

The returned `GlobalAtom`/`GlobalAtomFamily` types, and their `getSelf` /
`setSelf` / `resetSelf` surface, are unchanged. The exported
`GlobalAtomOptions` / `GlobalAtomFamilyOptions` types are identical to
`AtomOptions`/`AtomFamilyOptions`, except `name` is required instead of
optional.
