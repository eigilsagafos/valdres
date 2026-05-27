---
"valdres": patch
---

Route options-bearing atom and selector construction through fixed-shape
factories.

Atoms used to be built from `{ equal, ...options, defaultValue }`. Every
option combination produced a distinct hidden class, so the core's hot
property reads (`atom.equal`, `atom.maxAge`, `atom.onMount`, …) turned
megamorphic across options-bearing atoms in the wild and V8/JSC couldn't
inline them.

`createAtom` / `createGlobalAtom` / `createSelector` now write every field
as a single literal in a fixed order, so all options-bearing atoms share
one hidden class and all options-bearing selectors share another (with
global atoms on a separate, shape-stable extension whose inherited fields
sit in the same slots). No-options `atom()` / `selector()` calls keep the
pre-refactor minimal `{ equal, defaultValue }` / `{ equal, get }` literal,
which is what made `atom(1)` allocate at ~2ns — V8's escape analysis
treats it as a cheap, in-object allocation. Net result is two atom shapes
and two selector shapes in the wild instead of N, which keeps hot reads
polymorphic-but-cached rather than megamorphic.

On a microbenchmark of 1M property reads across atoms built from 8
different option combinations, hot reads drop from ~1.85ms to ~720µs
(≈2.6× faster); a 4-field fan-out benchmark drops from ~1.31ms to ~175µs
(≈7.5× faster). Public API and TypeScript types are unchanged.

Two subtle observable changes worth noting:

- `isFamilyState` now checks `!!state.family` instead of
  `Object.hasOwn(state, "family")`. Options-bearing atoms and selectors
  declare a `family` slot for shape stability (set to `undefined` on
  non-family members), so own-key presence is no longer a useful signal.
  Internally `family` is only ever assigned the family function (truthy)
  for actual family members, so the runtime semantics are unchanged. The
  only way to observe a difference is to construct an object literal
  externally and pass it to `isFamilyState` with `family: null`/`undefined`.
- Options-bearing atoms and selectors now have the full optional field
  set as own properties (`name`, `onSet`, `onMount`, `maxAge`, `mutable`,
  etc., set to `undefined` when unused). `Object.keys(atom)`,
  `JSON.stringify(atom)`, and spreads will produce more keys than before
  on those atoms. No-options atoms keep the original minimal shape.
