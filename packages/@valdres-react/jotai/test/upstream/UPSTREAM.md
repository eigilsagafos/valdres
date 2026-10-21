# Upstream Jotai tests

Adapted from [pmndrs/jotai](https://github.com/pmndrs/jotai) **v3.0.1**, commit
`6abd0ae3365e02ab432fba4b6e8e6f00aafbf508`, and
[jotaijs/jotai-family](https://github.com/jotaijs/jotai-family) **v1.1.0**,
commit `c67cbdbf8b028fb6bee752d07b80a100ce3c5427` (both MIT):

- `vanilla/`: `basic`, `store`, `dependency`, `derive`, `memoryleaks`
- `react/`: `basic`, `onmount`, `provider`, `error`, `async`, `async2`,
  `abortable`, `dependency`, `items`, `optimization`, `transition`,
  `useAtomValue`, `useAtomValueRaw`, `useAtomValueRawSync`, `useSetAtom`
- `vanilla/utils/`: `atomWithDefault`, `atomWithLazy`, `atomWithRefresh`,
  `atomWithReset`, `unwrap`
- `react/vanilla-utils/`: `atomWithDefault`, `atomWithObservable`,
  `atomWithReducer`, `atomWithRefresh`, `atomWithStorage`, `freezeAtom`,
  `selectAtom`, `splitAtom`
- `family/`: jotai-family's `atomFamily` and `atomTree`

The utils and jotai-family tests use the real `jotai/utils` (from
`jotai@3.0.1`) and `jotai-family@1.1.0` as consumers of the store under test.

Not copied: `vanilla/internals`, `storedev`, `effect` (Jotai internals),
`react/utils` (hooks bound to Jotai's own React context), and the `types` tests
(see `../types/declarations.tsx`).

## Adaptations

Only these edits were made to the upstream files:

- Imports: `vitest` → `vi.ts` (a bun:test shim with fake-timer helpers),
  `jotai`, `jotai/vanilla`, `jotai/react` → `impl.ts` (the implementation
  switch), `jotai/vanilla/utils` and `jotai/vanilla/internals` → the same paths
  in `jotai-reference`, `jotai-family`'s `../src/atomTree` → `jotai-family`,
  `jest-leak-detector` → `leakDetector.ts`, `test-utils.js` → `test-utils.ts`,
  and `atomWithStorage`'s type import from Jotai's source → `jotai/vanilla/utils`.
- `vanilla/basic.test.tsx`: two inline snapshots use Bun's function formatting.

`../impl.ts` selects the implementation: `JOTAI_IMPL=jotai` runs real
`jotai@3.0.1`, anything else this package. Tests this package does not pass are
listed with a reason in `gaps.ts`; `../vi.ts` checks each still fails.

## Running

Bun's fake timers leak between files in one process, so `run.ts` runs one file
per process:

```bash
bun run test:upstream    # against this package
bun run test:reference   # against jotai@3.0.1
```

## Updating to a new Jotai release

Bump the `jotai-reference` alias (and `jotai-family`), copy the files above from
the new tags with the same import rewrites, run `test:reference` until every
test passes against Jotai, then reconcile `gaps.ts` with `test:upstream`.
