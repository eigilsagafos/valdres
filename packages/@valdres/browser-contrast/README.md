<!-- DOCS:START -->

# browser-contrast

Wraps the `prefers-contrast` media query as a read-only external atom (`"no-preference" | "more" | "less" | "custom"`), plus boolean selectors for the `more`/`less` cases.

## Install

```bash
bun add @valdres/browser-contrast
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-contrast](https://valdres.dev/react/plugins/browser-contrast)

## Usage

Every read works through a store, with no adapter at all:

```ts
import { store } from "valdres"
import { contrastAtom, prefersMoreContrastSelector } from "@valdres/browser-contrast"

const app = store()
app.get(contrastAtom) // "no-preference" | "more" | "less" | "custom" — reads without subscribing
app.get(prefersMoreContrastSelector) // boolean
const stop = app.sub(contrastAtom, () => {
    console.log(app.get(contrastAtom))
})
stop()
```

```tsx
import { useValue } from "valdres-react"
import { contrastAtom, prefersMoreContrastSelector } from "@valdres/browser-contrast"

function ContrastBadge() {
    const contrast = useValue(contrastAtom)
    const more = useValue(prefersMoreContrastSelector)
    return <span data-high-contrast={more}>{contrast}</span>
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

| Export                        | Kind                      | Type                                              |
| ----------------------------- | ------------------------- | ------------------------------------------------- |
| `contrastAtom`                | external atom (read-only) | `Contrast`                                        |
| `prefersMoreContrastSelector` | selector                  | `boolean`                                         |
| `prefersLessContrastSelector` | selector                  | `boolean`                                         |
| `Contrast`                    | type                      | `"no-preference" \| "more" \| "less" \| "custom"` |

## Resolution

`prefers-contrast` is four values behind three media queries, and a host may
report more than one as matching. The first match in this order wins:

1. `(prefers-contrast: more)` → `"more"`
2. `(prefers-contrast: less)` → `"less"`
3. `(prefers-contrast: custom)` → `"custom"`
4. otherwise → `"no-preference"`

This precedence is unchanged from previous releases.

## Ownership

The preference belongs to the operating system, so `contrastAtom` is an
**external atom**: it is read-only. Stores cannot write it, and `set`, `reset`
and `update` reject it at compile time and at runtime.

Anything derived from it that the user can override — a per-app contrast toggle,
a remembered choice — is application state. Keep it in your own atom and resolve
the effective value in your own selector:

```ts
import { atom, selector } from "valdres"
import { contrastAtom, type Contrast } from "@valdres/browser-contrast"

type Preference = Contrast | "system"

export const contrastPreferenceAtom = atom<Preference>("system", {
    name: "app/contrastPreference",
})

export const effectiveContrastSelector = selector<Contrast>(
    get => {
        const preference = get(contrastPreferenceAtom)
        return preference === "system" ? get(contrastAtom) : preference
    },
    { name: "app/effectiveContrast" },
)
```

A picker sets `contrastPreferenceAtom`, never the resolved value. Persisting the
choice and applying it to the DOM are application concerns; this package stores
nothing and touches no DOM.

## Server rendering

`contrastAtom` reports `"no-preference"` when the queries cannot be observed —
while server rendering, and in DOM-less or `matchMedia`-less runtimes. The value
is a fixed, deterministic seed: a server cannot know a particular visitor's
setting, and a mutable process-wide seed would leak between requests. `useValue`
renders the seed first and swaps to the live value after hydration, which is a
normal two-pass render rather than a hydration mismatch.

## Lifetime and framework notes

The state is plain Valdres: an external atom plus derived selectors, readable from any store
with `store.get` / `store.sub`. Adapter availability for this beta is listed
under [Usage](#usage) — React today, the others once they migrate to the v1 core.

Subscribing attaches one `change` listener per contrast query. Those listeners
start when a store tree first retains the source — through a direct subscription
or a selector that reads it — and stop when that tree's last retaining subscriber
leaves or the store is disposed. Each store tree owns its own set; child scopes
share their root's. If attaching to one query fails, the listeners already
installed are released before the error propagates. Reads without a subscription
report the current value without attaching anything.

---

Full documentation: https://valdres.dev/react/plugins/browser-contrast

<!-- DOCS:END -->
