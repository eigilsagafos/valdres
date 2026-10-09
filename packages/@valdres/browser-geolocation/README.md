<!-- DOCS:START -->

# browser-geolocation

Wraps [`navigator.geolocation.watchPosition`](https://developer.mozilla.org/docs/Web/API/Geolocation/watchPosition) as read-only, Store-local state: the latest position, its status and error, the `"geolocation"` permission, and per-field selectors.

> **Explicit start**
>
>
> Reading or subscribing never starts a watch and never prompts. A watch starts
> only when you call `watchGeolocation(store, options)` — typically
> from a click — and that call may show the browser's location prompt. It
> returns the disposer that stops it.

## Install

```bash
bun add @valdres/browser-geolocation
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-geolocation](https://valdres.dev/react/plugins/browser-geolocation)

## Usage

```ts
import { store } from "valdres"
import {
    coordsSelector,
    geolocationAtom,
    watchGeolocation,
} from "@valdres/browser-geolocation"

const app = store()
app.get(geolocationAtom) // { status: "idle", position: null, error: null }

let stop: (() => void) | undefined
startButton.addEventListener("click", () => {
    stop = watchGeolocation(app, { enableHighAccuracy: true })
})
app.sub(coordsSelector, () => {
    const coords = app.get(coordsSelector) // { latitude, longitude } | null
})
stopButton.addEventListener("click", () => stop?.())
```

```tsx
import { useEffect, useState } from "react"
import { useStore, useValue } from "valdres-react"
import {
    coordsSelector,
    geolocationAtom,
    watchGeolocation,
} from "@valdres/browser-geolocation"

function Location() {
    const store = useStore()
    const [on, setOn] = useState(false)
    // The effect owns the watch: unmounting or turning it off stops it.
    useEffect(() => (on ? watchGeolocation(store) : undefined), [store, on])
    const { status, error } = useValue(geolocationAtom)
    const coords = useValue(coordsSelector)
    return (
        <div>
            <button onClick={() => setOn(!on)}>{on ? "Stop" : "Share location"}</button>
            {status} {coords && `${coords.latitude}, ${coords.longitude}`}
            {error && ` (${error.code}: ${error.message})`}
        </div>
    )
}
```

Starting the watch from an effect that a click enabled is fine: geolocation
does not require transient activation. Calling `watchGeolocation` inside the
click handler itself also works, and keeps the gesture's activation.

> **Adapter support in this beta**
>
> `valdres-react` is the only adapter migrated to the v1 core. The Vue, Svelte,
> Solid and Angular adapters cannot read an external atom yet. Until they ship,
> read this package with `store.get` / `store.sub` as above.

## Exports

| Export                          | Kind                      | Type                                                                                       |
| ------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| `geolocationAtom`               | selector (read-only)      | `GeolocationState`                                                                         |
| `positionAtom`                  | selector (read-only)      | `GeolocationSnapshot \| null`                                                              |
| `geolocationStatusAtom`         | selector (read-only)      | `GeolocationStatus`                                                                        |
| `geolocationErrorAtom`          | selector (read-only)      | `GeolocationError \| null`                                                                 |
| `permissionAtom`                | external atom (read-only) | `PermissionValue`                                                                          |
| `coordsSelector`                | selector                  | `{ latitude, longitude } \| null`                                                          |
| `accuracySelector`              | selector                  | `number \| null`                                                                           |
| `altitudeSelector`              | selector                  | `number \| null`                                                                           |
| `altitudeAccuracySelector`      | selector                  | `number \| null`                                                                           |
| `headingSelector`               | selector                  | `number \| null`                                                                           |
| `speedSelector`                 | selector                  | `number \| null`                                                                           |
| `timestampSelector`             | selector                  | `number \| null`                                                                           |
| `watchGeolocation`              | util fn                   | `(store: Store, options?: GeolocationWatchOptions) => () => void`                          |
| `GeolocationWatchConflictError` | error class               | thrown for conflicting options in one store                                                |
| `GeolocationState`              | type                      | `{ status, position, error }`                                                              |
| `GeolocationSnapshot`           | type                      | `{ latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed, timestamp }` |
| `GeolocationStatus`             | type                      | `"unsupported" \| "insecure" \| "idle" \| "pending" \| "active" \| "error"`                |
| `GeolocationError`              | type                      | `{ code: 1 \| 2 \| 3; message: string }`                                                   |
| `GeolocationWatchOptions`       | type                      | `{ enableHighAccuracy?, timeout?, maximumAge? }`                                           |
| `PermissionValue`               | type                      | `"granted" \| "denied" \| "prompt" \| "unsupported"`                                       |

## Watches belong to stores

`watchGeolocation(store, options?)` starts one
`navigator.geolocation.watchPosition` for `store` and returns an idempotent
disposer. Options default to `enableHighAccuracy: false`, `timeout: 30_000` and
`maximumAge: 0`; invalid values throw a `TypeError` before anything starts.

- **Store-local.** The watch publishes into `store` and the scopes below it
  that do not run their own. Independent stores run independent watches with
  their own options, and never see each other's positions.
- **No silent overwrites.** Callers that ask one store for the same options
  share its watch, which stops when the last disposer runs. Asking the same
  store for different options throws `GeolocationWatchConflictError`
  (`active` and `requested` carry both option sets). Give a second consumer its
  own scope — `store.scope()` — for a second watch.
- **Scopes.** A child scope reads its parent's watch until it starts its own,
  and reads the parent's again when its own is released. Sibling scopes are
  independent.
- **Cancellation.** The disposer clears the native watch. Disposing the store
  clears every watch it owns. To change options, dispose and start again; a
  report from the old watch can never land in the new one, or in a store that
  stopped watching.
- **Phases.** `watchGeolocation` throws `StoreDisposedError` for a disposed
  store and the core's capability errors inside a transaction or subscriber
  callback, before anything starts. A disposer called inside a transaction
  finishes in a microtask.

## Status, position and error

`geolocationAtom` publishes all three together, so they are never observed
apart; `positionAtom`, `geolocationStatusAtom` and `geolocationErrorAtom` project
it.

| Status          | Meaning                                                                           | Position                  | Error     |
| --------------- | --------------------------------------------------------------------------------- | ------------------------- | --------- |
| `"unsupported"` | no `navigator.geolocation`                                                        | `null`                    | `null`    |
| `"insecure"`    | `isSecureContext` is `false`; browsers refuse positions there, so no watch starts | `null`                    | `null`    |
| `"idle"`        | no watch in this store or the scopes above it                                     | `null`                    | `null`    |
| `"pending"`     | a watch started and has not reported — the prompt may be showing                  | `null`                    | `null`    |
| `"active"`      | the latest report was a position                                                  | the position              | `null`    |
| `"error"`       | the latest report was an error                                                    | the last position, if any | the error |

Error codes follow `GeolocationPositionError`. `1` (PERMISSION\_DENIED: the
user, a `geolocation` permissions policy in a cross-origin iframe, or the
browser) ends the watch; recover by disposing and starting again once the user
allows location. `2` (POSITION\_UNAVAILABLE) and `3` (TIMEOUT) keep the watch
running: the next position turns the status back to `"active"`. Browsers only
deliver positions to visible documents, so a hidden page stays `"pending"` or
keeps its last report.

## Permission

`permissionAtom` reports the `"geolocation"` permission and never prompts.
Subscribing queries the Permissions API once per page and follows its `change`
events, so it moves to `"granted"` or `"denied"` when a watch's prompt is
answered. The last answer is kept after the last subscriber leaves (a remount
does not flicker back), and the next subscription queries again; before any
answer, reads report `"prompt"`. It is `"unsupported"` without the
Permissions API, when the engine rejects the query, without
`navigator.geolocation`, or in an insecure context.

## Server rendering

Reads never start anything, so a server render is inert: `geolocationAtom` is
`{ status: "idle", position: null, error: null }` and `permissionAtom` is
`"prompt"`. Start watches in effects or event handlers, which do not run on the
server. `useValue` renders the seeds first and switches to the live values after
hydration.

## Lifetime

Each running watch is one native `watchPosition`, owned by its store and
cleared by its last disposer or the store's disposal. The Permissions API
`change` listener is shared by every store tree that subscribes to
`permissionAtom` and removed with the last one. Importing the package and
reading state attach, query and request nothing.

---

Full documentation: https://valdres.dev/react/plugins/browser-geolocation

<!-- DOCS:END -->
