---
---

Migrate `@valdres-react/jotai` to the Valdres v1 API: Jotai 3.0.1's core API
(`atom`, `createStore`, `getDefaultStore`, `Provider`, `useAtom`,
`useAtomValue`, `useSetAtom`, `useStore`) on the public `valdres` entry, checked
against Jotai's own test suite. Unsupported Jotai features fail with explicit
errors; see the package's `COMPATIBILITY.md`.

Intentionally empty: the package is still release-ignored in
`.changeset/config.json`, so this change publishes nothing. Release enablement
is a separate change.
