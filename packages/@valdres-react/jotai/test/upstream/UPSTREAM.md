# Upstream Jotai tests

Adapted from [pmndrs/jotai](https://github.com/pmndrs/jotai) **v3.0.1**, commit
`6abd0ae3365e02ab432fba4b6e8e6f00aafbf508` (MIT), for the APIs this package
exports:

- `vanilla/`: `basic`, `store`, `dependency`, `derive`, `memoryleaks`
- `react/`: `basic`, `onmount`, `provider`, `error`, `async`, `async2`,
  `abortable`, `dependency`, `items`, `optimization`, `transition`,
  `useAtomValue`, `useSetAtom`

Not copied: tests for APIs this package does not export
(`useAtomValueRaw`, `useAtomValueRawSync`, `vanilla/internals`, `storedev`,
`effect`, utils) and the `types` tests (see `../types/declarations.tsx`).

## Adaptations

Only these edits were made to the upstream files:

- Imports: `vitest` → `../../vi` (a bun:test shim with fake-timer helpers),
  `jotai`, `jotai/vanilla`, `jotai/react` → `../../impl` (the implementation
  switch), `jotai/vanilla/internals` → `jotai-reference/vanilla/internals`,
  `jest-leak-detector` → `../../leakDetector`, `../test-utils.js` →
  `../test-utils`.
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

Bump the `jotai-reference` alias, copy the files above from the new tag with the
same import rewrites, run `test:reference` until every test passes against
Jotai, then reconcile `gaps.ts` with `test:upstream`.
