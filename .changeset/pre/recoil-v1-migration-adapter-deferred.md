---
"@valdres-react/recoil": minor
---

**Breaking: rebuilt as a bounded Recoil 0.7.7 migration adapter on Valdres
1.0.**

The previous build imported core APIs that Valdres 1.0 removed
(`atomFamily`, `selectorFamily`, `isSelector`, `onMount`), so it could not load
against the 1.0 betas, and it imported its types from `recoil` without
depending on it. The adapter now uses only public Valdres APIs and the
documented `valdres/adapter-internals/v1` surface, and is tested against
`recoil@0.7.7` on React 18 with the same scenarios, on React 18 and 19.

- `valdres`, `valdres-react` and React 18 or 19 are peer dependencies, and the
  package ships its own declarations.
- Supported with Recoil's behavior: `atom` (including atom and selector
  defaults), `selector` (including writable selectors), `atomFamily` and
  `selectorFamily` with Recoil's parameter identity and keys, `DefaultValue`,
  `RecoilRoot` (`initializeState`, nesting, `override`), the state hooks, and
  `useRecoilCallback` with Recoil's write batching, frozen snapshot and
  `transact_UNSTABLE`.
- Unsupported features now throw `UnsupportedRecoilFeatureError` instead of
  behaving differently: async defaults, selectors and values, reading an atom
  without a default before it is set, atom effects, selector `getCallback`,
  snapshot reads after a callback's synchronous part, snapshot retention and
  mapping, `refresh` and `gotoSnapshot`. Atom effects were previously run on
  subscription; migrate them to `initializeState` and Store subscriptions.
- `useRecoilCallback` without `deps` now returns a new callback every render,
  as Recoil does, and its snapshot no longer reads live state.
- The hooks accept only atoms and selectors from this package and require a
  `<RecoilRoot>`. `RecoilRoot` also provides its Store to `valdres-react`, and
  the new `toValdresState` exposes a Recoil value to native hooks, read-only.
- Keys are labels: a reused key warns and does not share state.

See the support matrix at https://valdres.dev/guides/vs-recoil.
