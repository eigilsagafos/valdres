<!-- DOCS:START -->

# browser-presence

Read-only boolean for "is the user actually here": `true` when the tab is visible **and** the window is focused. Composes [`browser-visibility`](https://valdres.dev/plugins/browser-visibility) and [`browser-focus`](https://valdres.dev/plugins/browser-focus).

## Install

```bash
bun add @valdres/browser-presence
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-presence](https://valdres.dev/react/plugins/browser-presence)

## Usage

```tsx
import { useValue } from "valdres-react"
import { presenceSelector } from "@valdres/browser-presence"

function PresenceDot() {
    const present = useValue(presenceSelector)
    return <span>{present ? "Active" : "Away"}</span>
}
```

## Exports

| Export             | Kind                 | Type      |
| ------------------ | -------------------- | --------- |
| `presenceSelector` | selector (read-only) | `boolean` |

## Cross-framework

`presenceSelector` is a global selector — read it with `store.get` / `store.sub` in plain JS. It recomputes whenever the visibility or focus subscription fires.

---

Full documentation: https://valdres.dev/react/plugins/browser-presence

<!-- DOCS:END -->
