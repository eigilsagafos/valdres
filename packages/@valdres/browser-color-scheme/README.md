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

While the preference is pinned, `themeSelector` stops reading `colorSchemeAtom`
and the media-query listener is released; switching back to `"system"` re-attaches
and reports the OS preference as it is _then_, not as it was when the listener
detached.

**This package stores nothing and touches no DOM.** Remembering the choice
(`localStorage`, a cookie), synchronising it across tabs, and applying the theme
to `<html>` are application concerns. So is the first paint: no state library
runs before the browser's first frame, so if you need a flash-free load, set the
theme class from a blocking inline script in `<head>` and let the store drive
everything after that.

## Server rendering

`colorSchemeAtom` reports `"light"` when the preference cannot be observed — while
server rendering, and in DOM-less or `matchMedia`-less runtimes. The value is a
fixed, deterministic seed: a server has no way to know a particular visitor's OS
preference, and a mutable process-wide seed would leak between requests.

Because the server and the browser can legitimately disagree, `useValue` renders
the seed first and swaps to the live preference after hydration — a normal
two-pass render, not a hydration mismatch. To render a visitor's real theme on
the server, seed your own preference atom per request (from a cookie) and read
`themeSelector`; it never reaches the OS source unless the preference is
`"system"`.

## Cross-framework

An external atom plus derived selectors — works in every framework; only the read
primitive's name changes (`useValue`, `createValue`, `injectValue`, `watch`, or
`store.get` / `store.sub` in plain JS).

The media-query listener starts when a store first subscribes to the source —
directly or through a selector — and stops when that store's last subscriber
leaves or the store is disposed. Each store tree owns its own listener; child
scopes share their root's. Reads without a subscription report the current
preference without attaching anything.

---

Full documentation: https://valdres.dev/react/plugins/browser-color-scheme

<!-- DOCS:END -->
