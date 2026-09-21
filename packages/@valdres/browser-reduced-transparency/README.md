<!-- DOCS:START -->

# browser-reduced-transparency

Read-only external atom + boolean selector for the `(prefers-reduced-transparency: reduce)` media query.

## Install

```bash
bun add @valdres/browser-reduced-transparency
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-reduced-transparency](https://valdres.dev/react/plugins/browser-reduced-transparency)

Toggle "Reduce transparency" in your OS accessibility settings.

## Usage

```tsx
import { useValue } from "valdres-react"
import { prefersReducedTransparencySelector } from "@valdres/browser-reduced-transparency"

function Panel() {
    const reduce = useValue(prefersReducedTransparencySelector)
    return <div className={reduce ? "opaque" : "glass"} />
}
```

## Exports

| Export                               | Kind                      | Type                          |
| ------------------------------------ | ------------------------- | ----------------------------- |
| `reducedTransparencyAtom`            | external atom (read-only) | `"no-preference" \| "reduce"` |
| `prefersReducedTransparencySelector` | selector                  | `boolean`                     |
| `ReducedTransparency`                | type                      | `"no-preference" \| "reduce"` |

## Ownership

The preference belongs to the OS "reduce transparency" accessibility setting, so `reducedTransparencyAtom` is an **external atom**: it is
read-only. Stores cannot write it, and `set`, `reset` and `update` reject it at
compile time and at runtime.

Anything derived from it that the user can override — a per-app toggle, a
remembered choice — is application state. Keep it in your own atom and resolve
the effective value in your own selector:

```ts
import { atom, selector } from "valdres"
import { reducedTransparencyAtom, type ReducedTransparency } from "@valdres/browser-reduced-transparency"

type Preference = ReducedTransparency | "system"

export const preferenceAtom = atom<Preference>("system", {
    name: "app/preference",
})

export const effectiveSelector = selector<ReducedTransparency>(
    get => {
        const preference = get(preferenceAtom)
        return preference === "system" ? get(reducedTransparencyAtom) : preference
    },
    { name: "app/effective" },
)
```

A picker sets `preferenceAtom`, never the resolved value. Persisting the choice
and applying it to the DOM are application concerns; this package stores nothing
and touches no DOM.

## Server rendering

`reducedTransparencyAtom` reports `"no-preference"` when the query cannot be observed — while
server rendering, and in DOM-less or `matchMedia`-less runtimes. The value is a
fixed, deterministic seed: a server cannot know a particular visitor's setting,
and a mutable process-wide seed would leak between requests. `useValue` renders
the seed first and swaps to the live value after hydration, which is a normal
two-pass render rather than a hydration mismatch.

## Cross-framework

An external atom plus a derived selector — only the read primitive's name changes
per framework (`useValue`, `createValue`, `injectValue`, `watch`, or `store.get` /
`store.sub` in plain JS). In React, `useValue` reads the store from the nearest
`<Provider store={…}>` or one you pass explicitly as its second argument; there
is no implicit global store.

The media-query listener starts when a store first subscribes to the source —
directly or through the selector — and stops when that store's last subscriber
leaves or the store is disposed. Each store tree owns its own listener; child
scopes share their root's. Reads without a subscription report the current value
without attaching anything.

---

Full documentation: https://valdres.dev/react/plugins/browser-reduced-transparency

<!-- DOCS:END -->
