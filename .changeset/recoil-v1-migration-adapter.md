---
---

Migrate `@valdres-react/recoil` to the Valdres v1 API as a bounded adapter for
the synchronous part of Recoil 0.7.7's API, on the public `valdres` and
`valdres-react` entries and the documented `valdres/adapter-internals/v1`
surface. It is checked against `recoil@0.7.7` on React 18.3.1 with recorded
differential scenarios, and runs on React 18 and 19. Async atoms and
selectors, atom effects, selector `getCallback`, snapshot reads after a
callback's synchronous part, and snapshot retention/mapping fail with
`UnsupportedRecoilFeatureError`; see the support matrix at
https://valdres.dev/guides/vs-recoil.

Intentionally empty: the package is still release-ignored in
`.changeset/config.json`, so this change publishes nothing. Release enablement
is a separate change, and its changeset must carry the breaking changes
against the published `1.0.0-beta.3` (which targets the pre-1.0 core and does
not load with current Valdres betas). Compared with that build by source
review, not by running it:

- `valdres`, `valdres-react` and React 18 or 19 become peer dependencies; the
  package ships its own declarations instead of importing `recoil`'s types.
- Async atom defaults and async selectors, which the pre-1.0 core suspended
  on, and atom effects, which the old build ran on subscription, now throw
  `UnsupportedRecoilFeatureError`.
- A function `default` is stored as the value, as in Recoil; the old build
  called it.
- `useRecoilCallback` without `deps` returns a new callback every render, as in
  Recoil; its snapshot is frozen at call time instead of reading live state,
  and cannot be read after the callback's synchronous part.
- Family parameters are matched by Recoil's stable serialization.
- Recoil atoms are no longer plain Valdres atoms: `toValdresState` returns a
  read-only State, and keys label definitions without sharing state.
- Valdres extensions: the hooks also read native Valdres States and write
  native Atoms, and without a `<RecoilRoot>` use the nearest `valdres-react`
  `<Provider>`'s Store.
