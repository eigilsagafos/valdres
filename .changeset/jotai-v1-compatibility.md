---
---

Migrate `@valdres-react/jotai` to the Valdres v1 API as a bounded, partial
implementation of Jotai 3.0.1's core API (`atom`, `createStore`,
`getDefaultStore`, `Provider`, `useAtom`, `useAtomValue`, `useAtomValueRaw`,
`useAtomValueRawSync`, `useSetAtom`, `useStore`) on the public `valdres` entry,
checked against Jotai's own test suite. Dependencies read after `await`,
cancellation `signal`, `unwrap` and `INTERNAL_onInit` are unsupported and fail
with explicit errors; see the package's `COMPATIBILITY.md`.

Intentionally empty: the package is still release-ignored in
`.changeset/config.json`, so this change publishes nothing. Release enablement
is a separate change.
