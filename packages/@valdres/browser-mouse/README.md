<!-- DOCS:START -->

# browser-mouse

Wraps the [`MouseEvent`](https://developer.mozilla.org/docs/Web/API/MouseEvent) stream as global atoms: cursor `position`, pressed `buttons`, and whether the cursor is `inside` the page.

For touch and pen, or for tracking multiple simultaneous contacts, reach for `@valdres/browser-pointer` instead — a mouse is a single cursor, so this package keeps it to simple singleton atoms.

## Install

```bash
bun add @valdres/browser-mouse
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-mouse](https://valdres.dev/react/plugins/browser-mouse)

## Usage

```tsx
import { useValue } from "valdres-react"
import { mousePositionAtom } from "@valdres/browser-mouse"

function Cursor() {
    const { clientX, clientY } = useValue(mousePositionAtom)
    return <span>{clientX}, {clientY}</span>
}
```

## Exports

| Export              | Kind             | Type            |
| ------------------- | ---------------- | --------------- |
| `mousePositionAtom` | atom (read-only) | `MousePosition` |
| `mouseButtonsAtom`  | atom (read-only) | `MouseButtons`  |
| `mouseInsideAtom`   | atom (read-only) | `boolean`       |

`MousePosition` carries `clientX/Y`, `pageX/Y`, and `screenX/Y`. `MouseButtons` carries the raw `buttons` bitmask plus `left` / `right` / `middle` booleans.

## Cross-framework

Global atoms — they work in every framework; only the read primitive's name changes (`useValue`, `createValue`, `injectValue`, `watch`, or `store.get` in plain JS). Each atom attaches its own listeners on the first subscriber and detaches them when the last leaves, so subscribing only to `mouseButtonsAtom` won't wire up `mousemove`.

Three things to know. There is no API to read the cursor position without an event, so `mousePositionAtom` stays zeroed until the first `mousemove`. `mouseButtonsAtom` resyncs from the live `buttons` bitmask on each mouse event — so a right-click shows as pressed while the context menu is open (which swallows the `mouseup`) and clears on the first move after the menu is dismissed; a focus loss (alt-tab, devtools, releasing outside the page) clears it immediately. And `mouseInsideAtom` tracks _geometric_ containment via `mouseenter` / `mouseleave` — it stays `true` when you alt-tab away with the cursor still over the page, because the cursor really is still there. Compose with [`@valdres/browser-focus`](https://valdres.dev/react/plugins/browser-focus) if you want a focus-gated "user is actively here" signal.

---

Full documentation: https://valdres.dev/react/plugins/browser-mouse

<!-- DOCS:END -->
