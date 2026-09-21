<!-- DOCS:START -->

# browser-color-scheme

Reads the user's OS-level `prefers-color-scheme` preference and keeps it in sync
through a media-query listener. Exposes the raw value plus boolean selectors.

The preference belongs to the operating system, so `colorSchemeAtom` is an
**external atom**: it is read-only. Stores cannot write it, and both `set` and
`reset` reject it at compile time and at runtime.

## Install

```bash
bun add @valdres/browser-color-scheme
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-color-scheme](https://valdres.dev/react/plugins/browser-color-scheme)

## Usage

Every read works through a store, with no adapter at all:

```ts
import { store } from "valdres"
import { colorSchemeAtom, isDarkSelector } from "@valdres/browser-color-scheme"

const app = store()
app.get(colorSchemeAtom) // "dark" | "light" — reads without subscribing
app.get(isDarkSelector) // boolean
const stop = app.sub(colorSchemeAtom, () => {
    console.log(app.get(colorSchemeAtom))
})
stop()
```

```tsx
import { useValue } from "valdres-react"
import { colorSchemeAtom, isDarkSelector } from "@valdres/browser-color-scheme"

function Theme() {
    const scheme = useValue(colorSchemeAtom) // "dark" | "light"
    const isDark = useValue(isDarkSelector)
    return <span>{scheme}</span>
}
```

`useValue` reads the store provided by the nearest `<Provider store={…}>`, or one
you pass explicitly as its second argument — `useValue(colorSchemeAtom, myStore)`.
There is no implicit global store.

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

| Export            | Kind                      | Type                |
| ----------------- | ------------------------- | ------------------- |
| `colorSchemeAtom` | external atom (read-only) | `"dark" \| "light"` |
| `isDarkSelector`  | selector                  | `boolean`           |
| `isLightSelector` | selector                  | `boolean`           |
| `ColorScheme`     | type                      | `"dark" \| "light"` |

`isDarkSelector` and `isLightSelector` describe the **OS preference**, not the
theme your application ended up rendering. If the user picked a theme by hand,
read the effective theme from your own selector — see below.

## Building a theme on top

The OS preference is one input. A user-selected override is application state,
so the application owns it: an ordinary atom whose value lives in your store.

```ts
import { atom, selector, store } from "valdres"
import { colorSchemeAtom, type ColorScheme } from "@valdres/browser-color-scheme"

type ThemePreference = ColorScheme | "system"

// The user's choice. Defaults to following the OS.
export const themePreferenceAtom = atom<ThemePreference>("system", {
    name: "app/themePreference",
})

// The resolved theme. Only consults the OS while the preference is "system".
export const themeSelector = selector<ColorScheme>(
    get => {
        const preference = get(themePreferenceAtom)
        return preference === "system" ? get(colorSchemeAtom) : preference
    },
    { name: "app/theme" },
)

const app = store()
app.get(themeSelector) // follows the OS
app.set(themePreferenceAtom, "dark") // user pinned dark; the OS no longer matters
```

A theme picker sets `themePreferenceAtom` — never the resolved theme. Offer the
three real choices (`"system"`, `"light"`, `"dark"`) and render the current
selection from the preference atom, so "System" stays selected when the OS flips.

```tsx
import { useValue, useSetAtom } from "valdres-react"

function ThemePicker() {
    const preference = useValue(themePreferenceAtom)
    const setPreference = useSetAtom(themePreferenceAtom)
    return (
        <select
            value={preference}
            onChange={event =>
                setPreference(event.target.value as ThemePreference)
            }
        >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    )
}
```

While the preference is pinned, `themeSelector` stops reading `colorSchemeAtom`.
If nothing else in that store tree still retains the source, its media-query
listener is released; switching back to `"system"` re-attaches and reports the OS
preference as it is _then_, not as it was when the listener detached. If another
subscriber in the same tree still reads `colorSchemeAtom` — a settings screen
showing the OS value, another selector — the listener stays attached and there is
nothing to re-sample. Release is driven by the last retaining subscriber in the
tree, not by this selector alone.

**This package stores nothing and touches no DOM.** Remembering the choice
(`localStorage`, a cookie), synchronising it across tabs, and applying the theme
to `<html>` are application concerns.

So is first paint. This package does not arrange first paint and does not apply
a theme — it reports the OS preference and nothing else. How you avoid a flash
is your choice: server-render the theme from a cookie (see below), set the theme
class from a blocking inline script in `<head>`, or accept the first frame. A
blocking head script is one option, not a requirement.

## Server rendering

`colorSchemeAtom` reports `"light"` when the preference cannot be observed — while
server rendering, and in DOM-less or `matchMedia`-less runtimes. The value is a
fixed, deterministic seed: a server has no way to know a particular visitor's OS
preference, and a mutable process-wide seed would leak between requests.

Because the server and the browser can legitimately disagree, `useValue` renders
the seed first and swaps to the live preference after hydration — a normal
two-pass render, not a hydration mismatch.

To render a visitor's real theme on the server, seed your own preference atom per
request from a cookie and read `themeSelector`; it never reaches the OS source
unless the preference is `"system"`. **Seeding the server's request store is not
enough on its own.** The client builds its own store, and if that store still
holds the `"system"` default while the server rendered `"dark"`, React's first
client render disagrees with the server HTML. Initialise the client store from
the same cookie, before hydration:

```ts
// server: one store per request
const request = store()
request.set(themePreferenceAtom, themeCookie) // "light" | "dark" | "system"
renderToString(<Provider store={request}>…</Provider>)

// client: same value, set before hydrateRoot runs
const app = store()
app.set(themePreferenceAtom, readThemeCookie())
hydrateRoot(container, <Provider store={app}>…</Provider>)
```

Both sides must derive the preference from the same source. Only the OS half —
reached when the preference is `"system"` — is allowed to differ, and that is
the case `useValue`'s two-pass render already handles.

## Lifetime and framework notes

The state is plain Valdres: an external atom plus derived selectors, readable
from any store with `store.get` / `store.sub`. Adapter availability for this beta
is listed under [Usage](#usage) — React today, the others once they migrate to
the v1 core.

The media-query listener starts when a store tree first retains the source —
through a direct subscription or a selector that reads it — and stops when that
tree's last retaining subscriber leaves or the store is disposed. Each store tree
owns its own listener; child scopes share their root's. Reads without a
subscription report the current preference without attaching anything.

---

Full documentation: https://valdres.dev/react/plugins/browser-color-scheme

<!-- DOCS:END -->
