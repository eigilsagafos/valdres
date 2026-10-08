# Comparator-driven value inference (#428)

`atom`, `atom.lazy` and `selector` type `options.equal` through
`UninferredValue` / `ComparatorValue`
(`packages/valdres/src/v1-internal/committed-store-tree/types.ts`), so Value is
inferred from the value source alone. Regression coverage:
`packages/valdres/test/v1-public-candidate/comparator-inference.test-d.ts`
(source) and the comparator block of `scripts/test-v1-beta-packed-consumer.ts`
(installed tarball).

## Packed budget adjustment

Approved by the owner on 2026-10-08 for these exact values only. The change is
declaration-only: `dist/**/*.js` is byte-identical to `main` (`d6f35f29`), so
every runtime fixture, `dist`, the core-retaining allowances, the ordinary
baselines and the certified runtime digest are unchanged. The packed tarball
ships `dist/types`, which grows by the three wrapped factory signatures in
`v1.d.ts` and two one-line aliases in
`v1-internal/committed-store-tree/types.d.ts` (no new file):

| `featureBudgets.packed` | before  | after          |
| ----------------------- | ------- | -------------- |
| raw                     | 541,062 | 541,436 (+374) |
| gzip                    | 144,941 | 145,011 (+70)  |

Measured with pinned Bun 1.4.0 / Node 24.16.0 by `bun run verify` (package gate)
and confirmed by CI on #428's head `93dd95b9`.
