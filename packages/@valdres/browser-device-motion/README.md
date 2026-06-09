<!-- DOCS:START -->

# browser-device-motion

Wraps the `devicemotion` event as global atoms — linear acceleration and rotation rate, plus derived selectors. Values are usually `null` on desktop.

> **Permission**
>
>
> iOS gates motion behind a user gesture — call `requestMotionPermission()` from a click before subscribing.

## Install

```bash
bun add @valdres/browser-device-motion
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-device-motion](https://valdres.dev/react/plugins/browser-device-motion)

## Usage

```tsx
import { useValue } from "valdres-react"
import {
    accelerationSelector,
    rotationRateSelector,
    requestMotionPermission,
} from "@valdres/browser-device-motion"

function Motion() {
    const accel = useValue(accelerationSelector) // Vector3 | null
    const rot = useValue(rotationRateSelector)   // RotationRateSnapshot | null
    return (
        <div>
            <button onClick={() => requestMotionPermission()}>Enable</button>
            <pre>{JSON.stringify({ accel, rot }, null, 2)}</pre>
        </div>
    )
}
```

## Exports

| Export                                 | Kind             | Type                                                                                                             |
| -------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `motionAtom`                           | atom (read-only) | `MotionSnapshot \| null`                                                                                         |
| `permissionAtom`                       | atom (read-only) | `PermissionValue`                                                                                                |
| `motionStatusAtom`                     | atom (read-only) | `MotionStatus`                                                                                                   |
| `accelerationSelector`                 | selector         | `Vector3 \| null`                                                                                                |
| `accelerationIncludingGravitySelector` | selector         | `Vector3 \| null`                                                                                                |
| `accelerationMagnitudeSelector`        | selector         | `number \| null`                                                                                                 |
| `rotationRateSelector`                 | selector         | `RotationRateSnapshot \| null`                                                                                   |
| `intervalSelector`                     | selector         | `number \| null`                                                                                                 |
| `requestMotionPermission`              | util fn          | `() => Promise<PermissionValue>`                                                                                 |
| `MotionSnapshot`                       | type             | `{ acceleration, accelerationIncludingGravity, rotationRate: ... \| null; interval: number; timeStamp: number }` |
| `Vector3`                              | type             | `{ x, y, z: number \| null }`                                                                                    |
| `RotationRateSnapshot`                 | type             | `{ alpha, beta, gamma: number \| null }`                                                                         |
| `MotionStatus`                         | type             | `"unsupported" \| "idle" \| "active"`                                                                            |
| `PermissionValue`                      | type             | `"granted" \| "denied" \| "prompt" \| "unsupported"`                                                             |

## Cross-framework

The `devicemotion` subscription starts on the first subscriber across all stores and stops when the last one leaves. Read primitive per framework: `useValue` (React/Vue), `createValue` (Solid), `injectValue` (Angular), `watch` (Svelte), or `store.get` / `store.sub`.

---

Full documentation: https://valdres.dev/react/plugins/browser-device-motion

<!-- DOCS:END -->
