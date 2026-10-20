<!-- DOCS:START -->

# browser-device-orientation

Wraps the [`deviceorientation`](https://developer.mozilla.org/docs/Web/API/Window/deviceorientation_event) event as read-only state: the raw tilt snapshot plus `alpha` / `beta` / `gamma` and a compass-heading selector. Readings are usually `null` on desktops, which have no orientation sensors.

> **Permission**
>
>
> Subscribing never prompts. Where the browser gates orientation behind a
> prompt (iOS Safari), call `requestOrientationPermission()` directly
> from a click handler, with no
> `await` before it. The specification checks the gesture's
> transient activation when the request starts; how a given browser presents
> or remembers the prompt has not been verified on iOS Safari.

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

- the newest answer this page has seen, shared by every store: a completed
  `requestOrientationPermission()`, a Permissions API answer or a later `change` event — an
  answer whose operation started earlier never overwrites a newer one;
- while a store subscribes, the Permissions API's combined answer for
  `accelerometer` and `gyroscope` where the engine knows those names
  (Chromium), followed through its `change` events while a store subscribes;
- otherwise `"prompt"` where `DeviceOrientationEvent.requestPermission` exists, and
  `"granted"` where it does not (those browsers fire events without asking);
- `"unsupported"` without the API or in an insecure context — nothing can be
  asked there. The status keeps the two apart (`"unsupported"` vs
  `"insecure"`), and a denial is `"denied"`, never `"unsupported"`.

`requestOrientationPermission()` is the only call that can show a prompt. It calls
`DeviceOrientationEvent.requestPermission()` synchronously, inside the caller's
task, so a call made directly from a click handler — with no `await` before it
— reaches the browser while that click's transient activation is still
current, which is when the specification checks it. That is all the package
guarantees: whether a browser then prompts, and how long it remembers the
answer, is the browser's behaviour. Verified in Chromium 151 and 154 (headless,
with emulated permission states); the iOS Safari prompt flow is not yet
verified:

| Outcome                                                       | Resolves                 | Recorded                       |
| ------------------------------------------------------------- | ------------------------ | ------------------------------ |
| The user grants or denies                                     | `"granted"` / `"denied"` | yes, for every store           |
| No transient activation (`NotAllowedError`) or a host failure | the current value        | no — a later gesture can retry |
| The browser has no `requestPermission`                        | the current value        | no                             |
| No API, or an insecure context                                | `"unsupported"`          | no                             |

Concurrent calls share one request. A browser prompt cannot be cancelled; a
request that completes after every store was disposed still records its answer,
which later permission updates replace.

**Errors.** The promise never rejects and the call never throws: it settles
with the browser's answer (or the current value, as above). If a store
subscriber throws while that answer is published, every store is still
notified, the answer is still recorded and returned, and the subscriber failure
is reported separately through `globalThis.reportError` — or thrown in a later
task where there is none — the way core reports `onCommit` failures. The
request is never retried. A subscriber that throws on a Permissions API answer
is reported the same way; one that throws on a `change` event is rethrown from
that event's listener, which the browser reports.

**Unsubscribed reads may be stale.** While no store subscribes, nothing
observes the permission: a read returns the last answer this page saw, which
can be out of date if the user changed the setting meanwhile. Observation
resumes with the next subscription, which queries again and corrects it.

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
