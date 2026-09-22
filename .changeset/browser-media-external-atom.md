---
"@valdres/browser-color-scheme": minor
"@valdres/browser-contrast": minor
"@valdres/browser-reduced-motion": minor
"@valdres/browser-reduced-data": minor
"@valdres/browser-reduced-transparency": minor
---

**Breaking: these OS preferences are now read-only.**

Each package's source atom was a `globalAtom`, so anything holding it could write
it — `store.set(colorSchemeAtom, "dark")`, `resetSelf()` — and its value was
shared process-wide rather than per store. `globalAtom` no longer exists in the
v1 core, and the replacement is deliberately narrower.

These atoms are now `ExternalAtom`s built on the public `externalAtom` primitive.
The operating system owns the value, so `set`, `reset` and `update` reject them at
compile time and throw `TypeError` at runtime. If your code wrote one of these
atoms — to force a theme in tests, to seed a value at bootstrap — that write moves
to your own atom:

```ts
import { atom, selector } from "valdres"
import { colorSchemeAtom, type ColorScheme } from "@valdres/browser-color-scheme"

type ThemePreference = ColorScheme | "system"

const themePreferenceAtom = atom<ThemePreference>("system")
const themeSelector = selector<ColorScheme>(get => {
    const preference = get(themePreferenceAtom)
    return preference === "system" ? get(colorSchemeAtom) : preference
})
```

Unchanged: every export name, every value domain, both boolean selectors, and
`@valdres/browser-contrast`'s `more > less > custom` precedence.
`isDarkSelector` and `isLightSelector` still describe the OS preference, never an
effective application theme.

Also in this release:

- **Deterministic server snapshots.** The value reported when the media query
  cannot be observed — `"light"` for color-scheme, `"no-preference"` for the
  others — was a computed default; it is now a real `getServerSnapshot`, so server
  rendering has a defined answer per render. The values did not change. There is
  no seed setter: a mutable process-wide seed would leak between requests.
- **Per-store-tree listeners.** A native `change` listener is attached when a
  store tree first retains the source and released when that tree's last
  retaining subscriber leaves or the store is disposed. Child scopes share their
  root's. Reads without a subscription report the current value and attach
  nothing.
- **Framework adapters.** `valdres-react` is the only adapter that can read an
  external atom today. `valdres-vue`'s `useValue` and `valdres-angular`'s
  `injectValue` are typed for `Atom | Selector`, `valdres-solid`'s `createValue`
  expects the pre-v1 `State`, and `valdres-svelte` exports `fromState` rather than
  the `watch` the old documentation showed. Until those migrate, read these
  packages with `store.get` / `store.sub`.
- **Minimum core.** The `valdres` peer range is now `^1.0.0-beta.39`;
  `externalAtom` first shipped there. The previously published `1.0.0-beta.8`
  declared `^1.0.0-beta.19`, a range that admits cores where `globalAtom` does not
  exist — so that build cannot import against a current core.
- **First release through the shared publish pipeline.** These packages were
  previously excluded from it, so this release is also where three fixes the
  certified packages already shipped reach them: ESM declarations with explicit
  `.js` import specifiers, so exports resolve for `Node16`/`NodeNext` TypeScript
  consumers with library checking enabled; published metadata for CommonJS
  `require(esm)` and legacy TypeScript resolution, including `main`, `types` and
  a declared Node.js floor; and no `workspace:` protocol left in published
  dependency ranges.
