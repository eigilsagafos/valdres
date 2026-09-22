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

Every read works through a store, with no adapter at all:

```ts
import { store } from "valdres"
import { reducedDataAtom, prefersReducedDataSelector } from "@valdres/browser-reduced-data"

const app = store()
app.get(reducedDataAtom) // "no-preference" | "reduce" — reads without subscribing
app.get(prefersReducedDataSelector) // boolean
const stop = app.sub(reducedDataAtom, () => {
    console.log(app.get(reducedDataAtom))
})
stop()
```

```tsx
import { useValue } from "valdres-react"
import { prefersReducedDataSelector } from "@valdres/browser-reduced-data"

function Hero() {
    const reduced = useValue(prefersReducedDataSelector)
    return reduced ? <Poster /> : <Video />
}
```

> **Adapter support in this beta**
>
> `valdres-react` is the only adapter migrated to the v1 core. The Vue, Svelte,
> Solid and Angular adapters cannot read an external atom yet: `valdres-vue`'s
> `useValue` and `valdres-angular`'s `injectValue` are typed for `Atom | Selector`
> only, `valdres-solid`'s `createValue` still expects the pre-v1 two-parameter
> `State`, and `valdres-svelte` exports `fromState`, not the `watch` these pages
> used to show. Until those adapters ship, read this package with `store.get` /
> `store.sub` as above.

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

## Lifetime and framework notes

The state is plain Valdres: an external atom plus a derived selector, readable from any store
with `store.get` / `store.sub`. Adapter availability for this beta is listed
under [Usage](#usage) — React today, the others once they migrate to the v1 core.

The media-query listener starts when a store tree first retains the source —
through a direct subscription or a selector that reads it — and stops when that
tree's last retaining subscriber leaves or the store is disposed. Each store tree
owns its own listener; child scopes share their root's. Reads without a
subscription report the current value without attaching anything.

---

Full documentation: https://valdres.dev/react/plugins/browser-reduced-data

<!-- DOCS:END -->
