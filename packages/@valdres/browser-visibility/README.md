<!-- DOCS:START -->

# browser-visibility

Tracks the [Page Visibility API](https://developer.mozilla.org/docs/Web/API/Page_Visibility_API) — whether the tab is currently visible — via the `visibilitychange` event.

## Install

```bash
bun add @valdres/browser-visibility
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-visibility](https://valdres.dev/react/plugins/browser-visibility)

## Usage

```tsx
import { useValue } from "valdres-react"
import { visibilityAtom, isVisibleSelector } from "@valdres/browser-visibility"

function PausableVideo() {
    const visible = useValue(isVisibleSelector)
    // pause work when the tab is hidden
    return <video data-playing={visible} />
}
```

## Exports

| Export              | Kind             | Type                    |
| ------------------- | ---------------- | ----------------------- |
| `visibilityAtom`    | atom (read-only) | `"visible" \| "hidden"` |
| `isVisibleSelector` | selector         | `boolean`               |

## Cross-framework

A global atom plus a boolean selector — works in every framework. Compose it with `@valdres/browser-focus` for a "user is present" signal (see `@valdres/browser-presence`).

---

Full documentation: https://valdres.dev/react/plugins/browser-visibility

<!-- DOCS:END -->
