---
"valdres": patch
---

Hide engine-only `__` fields from the public `Atom`, `Selector`, `AtomFamily`,
and `SelectorFamily` types. The undocumented `globalStore.atoms` and
`globalStore.atomFamilies` registries are also no longer exposed; global atom
families retain the same process-wide identity through module-private state.
