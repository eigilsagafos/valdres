<!-- DOCS:START -->

# browser-reduced-data

Wraps the `(prefers-reduced-data: reduce)` media query as a read-only external atom, with a boolean selector.

## Install

```bash
bun add @valdres/browser-reduced-data
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-reduced-data](https://valdres.dev/react/plugins/browser-reduced-data)

## Usage

```tsx
import { useValue } from "valdres-react"
import { prefersReducedDataSelector } from "@valdres/browser-reduced-data"

function Hero() {
    const reduced = useValue(prefersReducedDataSelector)
    return reduced ? <Poster /> : <Video />
}
```

## Exports

| Export                       | Kind                      | Type                                          |
| ---------------------------- | ------------------------- | --------------------------------------------- |
| `reducedDataAtom`            | external atom (read-only) | `ReducedData` (`"no-preference" \| "reduce"`) |
| `prefersReducedDataSelector` | selector                  | `boolean`                                     |
| `ReducedData`                | type                      | `"no-preference" \| "reduce"`                 |

## Ownership

The preference belongs to the operating system — it is exposed as the OS or
browser "reduce data usage" setting — so `reducedDataAtom` is an **external
atom**: it is read-only. Stores cannot write it, and `set`, `reset` and `update`
reject it at compile time and at runtime.

Anything derived from it that the user can override — a per-app toggle, a
remembered choice — is application state. Keep it in your own atom and resolve
the effective value in your own selector:

```ts
import { atom, selector } from "valdres"
import { reducedDataAtom, type ReducedData } from "@valdres/browser-reduced-data"

type Preference = ReducedData | "system"

export const dataPreferenceAtom = atom<Preference>("system", {
    name: "app/dataPreference",
})

export const effectiveDataSelector = selector<ReducedData>(
    get => {
        const preference = get(dataPreferenceAtom)
        return preference === "system" ? get(reducedDataAtom) : preference
    },
    { name: "app/effectiveData" },
)
```

A picker sets `dataPreferenceAtom`, never the resolved value. Persisting the choice
and applying it to the DOM are application concerns; this package stores nothing
and touches no DOM.

## Server rendering

`reducedDataAtom` reports `"no-preference"` when the query cannot be observed — while
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

Full documentation: https://valdres.dev/react/plugins/browser-reduced-data

<!-- DOCS:END -->
