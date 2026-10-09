<!-- DOCS:START -->

# browser-device-orientation

Wraps the [`deviceorientation`](https://developer.mozilla.org/docs/Web/API/Window/deviceorientation_event) event as read-only state: the raw tilt snapshot plus `alpha` / `beta` / `gamma` and a compass-heading selector. Readings are usually `null` on desktops, which have no orientation sensors.

> **Permission**
>
>
> Subscribing never prompts. Where the browser gates orientation behind a
> prompt (iOS Safari), call `requestOrientationPermission()` directly
> from a click handler: the browser only shows the prompt for a request made
> with the gesture's transient activation.

## Install

```bash
bun add @valdres/browser-device-orientation
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-device-orientation](https://valdres.dev/react/plugins/browser-device-orientation)

## Usage

Every read works through a store, with no adapter at all:

```ts
import { store } from "valdres"
import {
    compassHeadingSelector,
    orientationStatusAtom,
    permissionAtom,
    requestOrientationPermission,
} from "@valdres/browser-device-orientation"

const app = store()
app.get(permissionAtom) // "prompt" on iOS until answered
button.addEventListener("click", () => {
    // Called inside the click: no `await` before it.
    void requestOrientationPermission()
})
const stop = app.sub(compassHeadingSelector, () => {
    rotateNeedle(app.get(compassHeadingSelector)) // number | null
})
app.get(orientationStatusAtom) // "active" while a store listens
stop()
```

```tsx
import { useValue } from "valdres-react"
import {
    alphaSelector,
    betaSelector,
    gammaSelector,
    permissionAtom,
    requestOrientationPermission,
} from "@valdres/browser-device-orientation"

function Tilt() {
    const permission = useValue(permissionAtom)
    const alpha = useValue(alphaSelector) // number | null
    const beta = useValue(betaSelector)
    const gamma = useValue(gammaSelector)
    return (
        <div>
            {permission === "prompt" && (
                <button onClick={() => void requestOrientationPermission()}>Enable orientation</button>
            )}
            α {alpha?.toFixed(1)} β {beta?.toFixed(1)} γ {gamma?.toFixed(1)}
        </div>
    )
}
```

> **Adapter support in this beta**
>
> `valdres-react` is the only adapter migrated to the v1 core. The Vue, Svelte,
> Solid and Angular adapters cannot read an external atom yet. Until they ship,
> read this package with `store.get` / `store.sub` as above.

## Exports

| Export                         | Kind                      | Type                                                                                                                                        |
| ------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `orientationAtom`              | selector (read-only)      | `OrientationSnapshot \| null`                                                                                                               |
| `orientationStatusAtom`        | selector (read-only)      | `OrientationStatus`                                                                                                                         |
| `permissionAtom`               | external atom (read-only) | `PermissionValue`                                                                                                                           |
| `alphaSelector`                | selector                  | `number \| null`                                                                                                                            |
| `betaSelector`                 | selector                  | `number \| null`                                                                                                                            |
| `gammaSelector`                | selector                  | `number \| null`                                                                                                                            |
| `absoluteSelector`             | selector                  | `boolean \| null`                                                                                                                           |
| `compassHeadingSelector`       | selector                  | `number \| null`                                                                                                                            |
| `requestOrientationPermission` | util fn                   | `() => Promise<PermissionValue>`                                                                                                            |
| `OrientationSnapshot`          | type                      | `{ alpha, beta, gamma: number \| null; absolute: boolean; webkitCompassHeading, webkitCompassAccuracy: number \| null; timeStamp: number }` |
| `OrientationStatus`            | type                      | `"unsupported" \| "insecure" \| "idle" \| "active"`                                                                                         |
| `PermissionValue`              | type                      | `"granted" \| "denied" \| "prompt" \| "unsupported"`                                                                                        |

`compassHeadingSelector` prefers iOS's `webkitCompassHeading` (a true compass
heading) and falls back to `alpha`, which is rarely an absolute compass on other
platforms. This package listens to `deviceorientation` only, not
`deviceorientationabsolute`, and requests the relative-orientation permission.

## Ownership

Orientation belongs to the device, so every export is read-only: stores cannot
`set`, `reset` or `update` them, at compile time or at runtime. `orientationAtom` and
`orientationStatusAtom` project one source, so a reading and the status it was
published with are never observed apart.

`orientationStatusAtom` is:

- `"unsupported"` without a `window` or a `DeviceOrientationEvent` (servers, workers,
  browsers without the API);
- `"insecure"` when `window.isSecureContext` is `false` — the API is restricted
  to secure contexts, so nothing is attached;
- `"idle"` while no store tree listens;
- `"active"` while at least one store tree listens. Readings can still be `null`:
  no sensor, permission not granted yet, or a hidden page (browsers only fire
  `deviceorientation` for visible documents).

## Permission

`permissionAtom` never prompts. Its value is:

- the answer of the last `requestOrientationPermission()` that completed, kept for the
  page's lifetime and shared by every store;
- while a store subscribes, the Permissions API's combined answer for
  `accelerometer` and `gyroscope` where the engine knows those names
  (Chromium), followed through its `change` events. An answer whose operation
  started earlier never overwrites a newer one. The last answer is kept after
  the last subscriber leaves, and the next subscription queries again;
- otherwise `"prompt"` where `DeviceOrientationEvent.requestPermission` exists, and
  `"granted"` where it does not (those browsers fire events without asking);
- `"unsupported"` without the API or in an insecure context.

`requestOrientationPermission()` is the only call that can show a prompt. It calls
`DeviceOrientationEvent.requestPermission()` synchronously, so the transient
activation of the click that called it is the one the browser checks — do not
`await` anything before calling it. It never rejects:

| Outcome                                                       | Resolves                 | Recorded                       |
| ------------------------------------------------------------- | ------------------------ | ------------------------------ |
| The user grants or denies                                     | `"granted"` / `"denied"` | yes, for every store           |
| No transient activation (`NotAllowedError`) or a host failure | the current value        | no — a later gesture can retry |
| The browser has no `requestPermission`                        | the current value        | no                             |
| No API, or an insecure context                                | `"unsupported"`          | no                             |

Concurrent calls share one request. A browser prompt cannot be cancelled; a
request that completes after every store was disposed still records its answer,
which is page truth.

## Server rendering

The server snapshots are fixed seeds: `orientationStatusAtom` is `"idle"`,
`orientationAtom` is `null` and `permissionAtom` is `"prompt"`. `useValue` renders
them first and switches to the live values after hydration. Nothing attaches,
queries or prompts during a server render.

## Lifetime

One `deviceorientation` listener per window is shared by every store tree that
retains the source and removed with the last one — when the last retaining
subscriber leaves or its store is disposed. Child scopes share their root's
registration. The window's latest reading is cached while attached and
discarded on detach, so a later subscription never reports a stale reading.
Importing the package and reading without a subscription attach nothing.

Every store tree is invalidated for each reading even when another tree's
subscriber throws; the failures are rethrown afterwards from the native
listener, where the browser reports them.

---

Full documentation: https://valdres.dev/react/plugins/browser-device-orientation

<!-- DOCS:END -->
