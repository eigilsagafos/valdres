<!-- DOCS:START -->

# browser-focus

Wraps [`document.hasFocus()`](https://developer.mozilla.org/docs/Web/API/Document/hasFocus) plus the window `focus` / `blur` events as one global atom.

## Install

```bash
bun add @valdres/browser-focus
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-focus](https://valdres.dev/react/plugins/browser-focus)

## Usage

```tsx
import { useValue } from "valdres-react"
import { focusAtom } from "@valdres/browser-focus"

function FocusBadge() {
    const focused = useValue(focusAtom)
    return <span>{focused ? "Focused" : "Blurred"}</span>
}
```

## Exports

| Export      | Kind             | Type      |
| ----------- | ---------------- | --------- |
| `focusAtom` | atom (read-only) | `boolean` |

## Cross-framework

A global atom — works in every framework; only the read primitive's name changes (`useValue`, `createValue`, `injectValue`, `watch`, or `store.get` in plain JS). The `focus` / `blur` listeners attach on the first subscriber and detach when the last leaves. Returns `true` during SSR. Compose with `@valdres/browser-visibility` for a "user is present" signal (see `@valdres/browser-presence`).

---

Full documentation: https://valdres.dev/react/plugins/browser-focus

<!-- DOCS:END -->
