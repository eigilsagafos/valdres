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

Every read works through a store, with no adapter at all:

```ts
import { store } from "valdres"
import { reducedTransparencyAtom, prefersReducedTransparencySelector } from "@valdres/browser-reduced-transparency"

const app = store()
app.get(reducedTransparencyAtom) // "no-preference" | "reduce" — reads without subscribing
app.get(prefersReducedTransparencySelector) // boolean
const stop = app.sub(reducedTransparencyAtom, () => {
    console.log(app.get(reducedTransparencyAtom))
})
stop()
```

```tsx
import { useValue } from "valdres-react"
import { prefersReducedTransparencySelector } from "@valdres/browser-reduced-transparency"

function Panel() {
    const reduce = useValue(prefersReducedTransparencySelector)
    return <div className={reduce ? "opaque" : "glass"} />
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

| Export                               | Kind                      | Type                          |
| ------------------------------------ | ------------------------- | ----------------------------- |
| `reducedTransparencyAtom`            | external atom (read-only) | `"no-preference" \| "reduce"` |
| `prefersReducedTransparencySelector` | selector                  | `boolean`                     |
| `ReducedTransparency`                | type                      | `"no-preference" \| "reduce"` |

## Ownership

The preference belongs to the operating system — it is exposed as the OS "reduce
transparency" accessibility setting — so `reducedTransparencyAtom` is an
**external atom**: it is read-only. Stores cannot write it, and `set`, `reset`
and `update` reject it at compile time and at runtime.

Anything derived from it that the user can override — a per-app toggle, a
remembered choice — is application state. Keep it in your own atom and resolve
the effective value in your own selector:

```ts
import { atom, selector } from "valdres"
import { reducedTransparencyAtom, type ReducedTransparency } from "@valdres/browser-reduced-transparency"

type Preference = ReducedTransparency | "system"

export const transparencyPreferenceAtom = atom<Preference>("system", {
    name: "app/transparencyPreference",
})

export const effectiveTransparencySelector = selector<ReducedTransparency>(
    get => {
        const preference = get(transparencyPreferenceAtom)
        return preference === "system" ? get(reducedTransparencyAtom) : preference
    },
    { name: "app/effectiveTransparency" },
)
```

A picker sets `transparencyPreferenceAtom`, never the resolved value. Persisting the choice
and applying it to the DOM are application concerns; this package stores nothing
and touches no DOM.

## Server rendering

`reducedTransparencyAtom` reports `"no-preference"` when the query cannot be observed — while
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

Full documentation: https://valdres.dev/react/plugins/browser-reduced-transparency

<!-- DOCS:END -->
