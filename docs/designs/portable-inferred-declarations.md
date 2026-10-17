# Portable inferred declarations (#429)

A consumer emitting declarations could not export an unannotated `atom()`,
`atom.lazy()`, `selector()`, family member, collection row, `query()` result,
`store()`, `scope()` or transaction cursor: TS2742 (tsc) / TS2883 (tsgo),
because the type was only nameable through `valdres/dist/types/v1.js` or
`v1-internal`. The root entry declared every public type as a new alias
(`export type Atom<Value> = v1.Atom<Value>`, `export type Store = v1.Store`), so
the symbols those values carry (the `v1.Atom` / `v1.Selector` aliases and the
`CollectionRow`, `State`, `CommittedStoreTree` and `RootTransaction`
declarations) were not reachable from any package export.

`packages/valdres/src/index.ts` now re-exports those same symbols. `Store` and
`Transaction` get their public names in the type-only
`v1-internal/committed-store-tree/types.ts`: spelling them out in `index.ts`
shifts Bun's minified identifiers (see #428). Regression coverage: the portable
and downstream declaration probes in `scripts/test-v1-beta-packed-consumer.ts`
(installed tarball, React 18 and 19).

Still unsupported, and out of scope: assigning a factory itself to an exported
constant (`export const myAtom = atom`) fails with TS4023 / TS2742 because the
factory types are not public. `export { atom } from "valdres"` works.

## Packed budget adjustment

Approved by the owner on 2026-10-09 for the gzip value only. The change is
declaration-only: `dist/**/*.js` (production and development) is byte-identical
to `main` (`2a0ee064`), so every runtime fixture, `dist`, the core-retaining
allowances, the ordinary baselines and the certified runtime digest are
unchanged. In the packed tarball `index.d.ts` shrinks by 131 bytes (six wrapper
aliases become re-exports) and `v1-internal/committed-store-tree/types.d.ts`
grows by 66 bytes (one alias line), so raw size falls, but the replacement text
compresses slightly worse:

| `featureBudgets.packed` | before  | measured      | budget after |
| ----------------------- | ------- | ------------- | ------------ |
| raw                     | 546,411 | 546,346 (−65) | 546,411      |
| gzip                    | 146,773 | 146,776 (+3)  | 146,776      |

The raw budget is left at 546,411. Measured with pinned Bun 1.4.0 / Node 24.16.0
by `bun run verify` (package gate).

### Combined with the root `deepEqual` move (#440)

#440 landed first. It moved `deepEqual` to the root and recertified `packed` as
546,237 / 146,855 at its `valdres@1.0.0-beta.45` release manifest. With both
changes, the runtime is still byte-identical to #440's: the certified digest
`53117b76…edf6e7` and every fixture are unchanged. Only the packed declarations
differ:

| `featureBudgets.packed` | #440 budget | combined, beta.44 | combined, beta.45 release | budget after |
| ----------------------- | ----------- | ----------------- | ------------------------- | ------------ |
| raw                     | 546,237     | 546,183           | 546,183                   | 546,237      |
| gzip                    | 146,855     | 146,860           | 146,862                   | 146,862      |

The owner approved the combined gzip budget of 146,862 on 2026-10-09,
conditional on the integrated tree and its Changesets-computed release
version measuring within it. Release version `beta.45` measures exactly
146,862. No other budget or pin changed.
