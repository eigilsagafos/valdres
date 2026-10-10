<!-- DOCS:START -->

# @valdres-react/jotai

Jotai API compatibility layer for Valdres

## Installation

```bash
npm install @valdres-react/jotai react valdres
```

Part of [Valdres](https://valdres.dev) — reactive state management for React, Vue, Svelte, Solid, and Angular.

Full documentation: https://valdres.dev/guides/migration

<!-- DOCS:END -->

## Compatibility status

A bounded, **partial** implementation of Jotai 3.0.1's core API (`atom`,
`createStore`, `getDefaultStore`, `Provider`, `useAtom`, `useAtomValue`,
`useAtomValueRaw`, `useAtomValueRawSync`, `useSetAtom`, `useStore`) on Valdres
v1. Not yet released for Valdres 1.0; the published `1.0.0-beta.3` does not
load with current Valdres betas.

**Not supported:**

- `get()` after a read function's first `await`: throws
  `VALDRES_JOTAI_LATE_GET`. Promises as atom values and async read functions
  that call `get` before their first `await` are supported.
- Cancellation: read `options.signal` throws
  `VALDRES_JOTAI_SIGNAL_UNSUPPORTED`.
- `unwrap` from `jotai/utils`, `INTERNAL_onInit`, store calls inside read
  functions, `jotai/react/utils`, and using these atoms with `valdres-react`.

`selectAtom` and `splitAtom` pass Jotai's tests but keep known identity
differences. Against Jotai 3.0.1's own tests (364, with `jotai/utils` and
`jotai-family`): 305 pass, 47 known failures, 12 skipped. Details, every
difference and how it was tested:
[COMPATIBILITY.md](https://github.com/eigilsagafos/valdres/blob/main/packages/@valdres-react/jotai/COMPATIBILITY.md).
