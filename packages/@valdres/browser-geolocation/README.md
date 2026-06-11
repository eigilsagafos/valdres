<!-- DOCS:START -->

# browser-geolocation

Wraps the [Geolocation API](https://developer.mozilla.org/docs/Web/API/Geolocation_API) as reactive state: the current position, derived coordinate selectors, the permission state, and a status machine. The watch starts on the first subscriber and stops on the last.

> **Permission & HTTPS**
>
>
> Geolocation requires a secure context (HTTPS or localhost) and a user grant. Subscribing to `positionAtom` (or a coordinate selector) triggers the browser's permission prompt.

## Install

```bash
bun add @valdres/browser-geolocation
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-geolocation](https://valdres.dev/react/plugins/browser-geolocation)

## Usage

```tsx
import { useValue } from "valdres-react"
import { coordsSelector, geolocationStatusAtom } from "@valdres/browser-geolocation"

function Where() {
    const coords = useValue(coordsSelector)
    const status = useValue(geolocationStatusAtom)
    if (!coords) return <span>{status}</span>
    return <span>{coords.latitude.toFixed(3)}, {coords.longitude.toFixed(3)}</span>
}
```

## Exports

| Export                                                   | Kind             | Type                                                          |
| -------------------------------------------------------- | ---------------- | ------------------------------------------------------------- |
| `positionAtom`                                           | atom (read-only) | `GeolocationSnapshot \| null`                                 |
| `coordsSelector`                                         | selector         | `{ latitude, longitude } \| null`                             |
| `accuracySelector`                                       | selector         | `number \| null`                                              |
| `altitudeSelector` / `speedSelector` / `headingSelector` | selector         | `number \| null`                                              |
| `permissionAtom`                                         | atom (read-only) | `"granted" \| "denied" \| "prompt" \| "unsupported"`          |
| `geolocationStatusAtom`                                  | atom (read-only) | `"idle" \| "pending" \| "active" \| "error" \| "unsupported"` |
| `geolocationErrorAtom`                                   | atom (read-only) | `GeolocationError \| null`                                    |
| `geolocationOptionsAtom`                                 | atom (settable)  | `PositionOptions`                                             |

## Cross-framework

All state is global atoms/selectors, so it works in every framework — only the read primitive differs. Write `geolocationOptionsAtom` (via your framework's set hook, or `store.set`) to change accuracy/timeout options; the watch re-subscribes automatically.

---

Full documentation: https://valdres.dev/react/plugins/browser-geolocation

<!-- DOCS:END -->
