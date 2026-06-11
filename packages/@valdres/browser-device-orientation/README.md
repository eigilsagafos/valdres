<!-- DOCS:START -->

# browser-device-orientation

Wraps `DeviceOrientationEvent` as global atoms, exposing the raw tilt snapshot plus `alpha` / `beta` / `gamma` and a compass-heading selector.

> **Permission**
>
>
> iOS requires a user gesture: call `requestOrientationPermission()` from a click handler before subscribing. Other browsers grant on subscribe.

## Install

```bash
bun add @valdres/browser-device-orientation
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-device-orientation](https://valdres.dev/react/plugins/browser-device-orientation)

## Usage

```tsx
import { useValue } from "valdres-react"
import {
    compassHeadingSelector,
    requestOrientationPermission,
} from "@valdres/browser-device-orientation"

function Compass() {
    const heading = useValue(compassHeadingSelector)
    return (
        <>
            <button onClick={() => requestOrientationPermission()}>Enable</button>
            <span>{heading == null ? "—" : `${Math.round(heading)}°`}</span>
        </>
    )
}
```

## Exports

| Export                         | Kind             | Type                                                                                                                                        |
| ------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `orientationAtom`              | atom (read-only) | `OrientationSnapshot \| null`                                                                                                               |
| `permissionAtom`               | atom (settable)  | `PermissionValue`                                                                                                                           |
| `orientationStatusAtom`        | atom (read-only) | `OrientationStatus`                                                                                                                         |
| `alphaSelector`                | selector         | `number \| null`                                                                                                                            |
| `betaSelector`                 | selector         | `number \| null`                                                                                                                            |
| `gammaSelector`                | selector         | `number \| null`                                                                                                                            |
| `absoluteSelector`             | selector         | `boolean \| null`                                                                                                                           |
| `compassHeadingSelector`       | selector         | `number \| null`                                                                                                                            |
| `requestOrientationPermission` | util fn          | `() => Promise<PermissionValue>`                                                                                                            |
| `OrientationSnapshot`          | type             | `{ alpha, beta, gamma: number \| null; absolute: boolean; webkitCompassHeading, webkitCompassAccuracy: number \| null; timeStamp: number }` |
| `OrientationStatus`            | type             | `"unsupported" \| "idle" \| "active"`                                                                                                       |
| `PermissionValue`              | type             | `"granted" \| "denied" \| "prompt" \| "unsupported"`                                                                                        |

## Cross-framework

Global atoms/selectors — works in every framework, only the read primitive differs. The `deviceorientation` listener starts on the first subscriber and stops on the last.

---

Full documentation: https://valdres.dev/react/plugins/browser-device-orientation

<!-- DOCS:END -->
