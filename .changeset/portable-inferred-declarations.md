---
"valdres": patch
---

Make inferred values exportable from projects that emit declarations. An
unannotated `export const count = atom(0)` (likewise `atom.lazy`, `selector`,
`family` members, collection rows, `query` results, `store()`, `scope()` and
transaction cursors) failed with TS2742 / TS2883 because its type could only be
named through `valdres/dist/types/v1.js` or `v1-internal`. The root entry now
re-exports the `Atom`, `Selector`, `CollectionRow`, `State`, `Store` and
`Transaction` declarations those values carry instead of wrapping them in new
aliases, so declarations name them as `import("valdres").Atom<number>` and so
on. Declarations only; the runtime is unchanged.
