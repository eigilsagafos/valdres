<!-- DOCS:START -->

# color-mode

Resolves the active color mode from the OS preference (`prefers-color-scheme`) and a user override. `userSelectedColorModeAtom` is settable (`"light" | "dark" | "system"`); `colorModeSelector` returns the resolved `"light" | "dark"`.

## Install

```bash
bun add @valdres/color-mode
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/color-mode](https://valdres.dev/react/plugins/color-mode)

## Usage

```tsx
import { useValue, useSetAtom } from "valdres-react"
import { colorModeSelector, userSelectedColorModeAtom } from "@valdres/color-mode"

function ThemeToggle() {
    const mode = useValue(colorModeSelector) // "light" | "dark"
    const setMode = useSetAtom(userSelectedColorModeAtom)
    return (
        <select value={mode} onChange={e => setMode(e.target.value as any)}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    )
}
```

Or use the convenience hooks from [`@valdres-react/color-mode`](https://www.npmjs.com/package/@valdres-react/color-mode): `useColorMode()`, `useIsDarkMode()`, `useIsLightMode()`.

## Exports

| Export                      | Kind             | Type                            |
| --------------------------- | ---------------- | ------------------------------- |
| `colorModeSelector`         | selector         | `"light" \| "dark"`             |
| `isDarkModeSelector`        | selector         | `boolean`                       |
| `isLightModeSelector`       | selector         | `boolean`                       |
| `systemColorModeAtom`       | atom (read-only) | `"light" \| "dark"`             |
| `userSelectedColorModeAtom` | atom (settable)  | `"light" \| "dark" \| "system"` |
| `getSystemColorMode`        | util fn          | `() => "light" \| "dark"`       |
| `ColorMode`                 | type             | `"light" \| "dark"`             |
| `UserSelectedColorMode`     | type             | `"light" \| "dark" \| "system"` |

## Cross-framework

Global atoms and selectors — only the read primitive's name changes per framework. The `prefers-color-scheme` listener starts on the first subscriber and stops when the last one leaves.

---

Full documentation: https://valdres.dev/react/plugins/color-mode

<!-- DOCS:END -->
