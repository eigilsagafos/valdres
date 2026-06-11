<!-- DOCS:START -->

# browser-color-scheme

Reads the user's OS-level `prefers-color-scheme` preference and keeps it in sync via a media-query listener. Exposes the raw value plus boolean selectors.

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

## Exports

| Export            | Kind             | Type                |
| ----------------- | ---------------- | ------------------- |
| `colorSchemeAtom` | atom (read-only) | `"dark" \| "light"` |
| `isDarkSelector`  | selector         | `boolean`           |
| `isLightSelector` | selector         | `boolean`           |

## Cross-framework

A global atom plus derived selectors — works in every framework. For full theme management (system preference + user override + persistence), use `@valdres/color-mode`, which builds on top of this.

---

Full documentation: https://valdres.dev/react/plugins/browser-color-scheme

<!-- DOCS:END -->
