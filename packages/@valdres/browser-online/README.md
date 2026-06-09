<!-- DOCS:START -->

# browser-online

Reactive online/offline status. Wraps `navigator.onLine` and the `online` / `offline` events as a single global atom that any framework can read.

## Install

```bash
bun add @valdres/browser-online
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-online](https://valdres.dev/react/plugins/browser-online)

## Usage

```tsx
import { useValue } from "valdres-react"
import { onlineAtom } from "@valdres/browser-online"

function ConnectionBadge() {
    const online = useValue(onlineAtom)
    return <span>{online ? "Online" : "Offline"}</span>
}
```

The hook reads from the store provided by your app (see [Provider](https://valdres.dev/react/Provider)); the atom's value is kept in sync across every store automatically.

## Exports

| Export       | Kind             | Type      |
| ------------ | ---------------- | --------- |
| `onlineAtom` | atom (read-only) | `boolean` |

## Cross-framework

`onlineAtom` is a global atom, so it works identically in every framework — only the read primitive's name changes (`useValue`, `createValue`, `injectValue`, `watch`, or `store.get` / `store.sub` in plain JavaScript). The browser subscription starts on the first subscriber across all stores and stops when the last one leaves.

---

Full documentation: https://valdres.dev/react/plugins/browser-online

<!-- DOCS:END -->
