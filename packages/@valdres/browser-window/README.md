<!-- DOCS:START -->

# browser-window

Tracks the browser window's inner size, updating on every `resize`. Exposed as a single global atom.

## Install

```bash
bun add @valdres/browser-window
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-window](https://valdres.dev/react/plugins/browser-window)

## Usage

```tsx
import { useValue } from "valdres-react"
import { windowSizeAtom } from "@valdres/browser-window"

function Size() {
    const { innerWidth, innerHeight } = useValue(windowSizeAtom)
    return <span>{innerWidth} × {innerHeight}</span>
}
```

## Exports

| Export           | Kind             | Type                                                   |
| ---------------- | ---------------- | ------------------------------------------------------ |
| `windowSizeAtom` | atom (read-only) | `{ innerWidth, innerHeight, outerWidth, outerHeight }` |

## Cross-framework

A global atom — works in every framework, with the resize listener attached only while something is subscribed.

---

Full documentation: https://valdres.dev/react/plugins/browser-window

<!-- DOCS:END -->
