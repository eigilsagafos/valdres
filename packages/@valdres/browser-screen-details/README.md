<!-- DOCS:START -->

# browser-screen-details

Wraps the [Window Management API](https://developer.mozilla.org/docs/Web/API/Window_Management_API) (`window.getScreenDetails()`) as read-only state: every connected screen, the current screen, the request status and the `window-management` permission.

> **Permission required**
>
>
> Screens stay empty until `requestScreenDetails()` — the only call
> that can prompt — is granted. Reading or subscribing never prompts. Requires a
> secure context, and a `window-management` permissions policy in
> cross-origin iframes.

## Install

```bash
bun add @valdres/browser-screen-details
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-screen-details](https://valdres.dev/react/plugins/browser-screen-details)

## Usage

```ts
import { store } from "valdres"
import {
    requestScreenDetails,
    screenDetailsAtom,
    screensAtom,
} from "@valdres/browser-screen-details"

const app = store()
button.addEventListener("click", () => {
    requestScreenDetails().catch(() => {}) // the state records the failure
})
const stop = app.sub(screensAtom, () => {
    layout(app.get(screensAtom)) // readonly ScreenDetail[]
})
app.get(screenDetailsAtom).status // "idle" | "pending" | "ready" | "denied" | ...
```

```tsx
import { useValue } from "valdres-react"
import {
    currentScreenAtom,
    requestScreenDetails,
    screenDetailsStatusAtom,
    screensAtom,
} from "@valdres/browser-screen-details"

function Screens() {
    const status = useValue(screenDetailsStatusAtom)
    const current = useValue(currentScreenAtom)
    const screens = useValue(screensAtom)

    if (status !== "ready")
        return (
            <button onClick={() => requestScreenDetails().catch(() => {})}>
                Allow screens
            </button>
        )
    return (
        <div>
            {current?.label}: {current?.width} × {current?.height} ({screens.length} screens)
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

| Export                    | Kind                      | Type                                                                                                                                                                                    |
| ------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `screenDetailsAtom`       | external atom (read-only) | `ScreenDetailsState`                                                                                                                                                                    |
| `screensAtom`             | selector (read-only)      | `readonly ScreenDetail[]`                                                                                                                                                               |
| `currentScreenAtom`       | selector (read-only)      | `ScreenDetail \| null`                                                                                                                                                                  |
| `screenDetailsStatusAtom` | selector (read-only)      | `ScreenDetailsStatus`                                                                                                                                                                   |
| `screenPermissionAtom`    | external atom (read-only) | `ScreenPermissionState`                                                                                                                                                                 |
| `requestScreenDetails`    | util fn                   | `() => Promise<ScreenDetail[] \| null>`                                                                                                                                                 |
| `ScreenDetail`            | type                      | `{ label, left, top, width, height, availLeft, availTop, availWidth, availHeight, colorDepth, pixelDepth, devicePixelRatio, orientationType, orientationAngle, isPrimary, isInternal }` |
| `ScreenDetailsState`      | type                      | `{ status, screens, currentScreen, error }`                                                                                                                                             |
| `ScreenDetailsStatus`     | type                      | `"unsupported" \| "insecure" \| "idle" \| "pending" \| "ready" \| "denied" \| "error"`                                                                                                  |
| `ScreenPermissionState`   | type                      | `"prompt" \| "granted" \| "denied" \| "unsupported"`                                                                                                                                    |

## Requesting access

`requestScreenDetails()` calls `window.getScreenDetails()` synchronously, so a
call from a click handler keeps that gesture's activation. The specification
does not require activation for it, but browsers decide how to present the
prompt. Concurrent calls share one request; a browser prompt cannot be
cancelled.

| Outcome                                            | Promise              | `screenDetailsAtom.status`                     | `screenPermissionAtom` |
| -------------------------------------------------- | -------------------- | ---------------------------------------------- | ---------------------- |
| Waiting for the browser                            | pending              | `"pending"` (unchanged when already `"ready"`) | unchanged              |
| Granted                                            | resolves the screens | `"ready"`                                      | `"granted"`            |
| `NotAllowedError` (the user, a permissions policy) | rejects with it      | `"denied"`                                     | `"denied"`             |
| Any other failure                                  | rejects with it      | `"error"`, with `{ name, message }`            | unchanged              |
| No API                                             | resolves `null`      | `"unsupported"`                                | `"unsupported"`        |
| Insecure context                                   | resolves `null`      | `"insecure"`                                   | `"unsupported"`        |

A later request after a denial or an error can recover. When
`screenPermissionAtom` already reports `"granted"` (an earlier visit), a request
resolves without showing a prompt. The browser keeps one
`ScreenDetails` object per window, so access is page truth: once granted, every
store reads the same screens, and a request that completes after every store was
disposed still records it.

`screenDetailsAtom` publishes status, screens, current screen and error together;
`screensAtom`, `currentScreenAtom` and `screenDetailsStatusAtom` project it.
Screens are present only while `"ready"`.

## Permission

`screenPermissionAtom` never prompts. It reports the last request's answer, or
— while a store subscribes — the Permissions API's `window-management` state
(falling back to the pre-Chrome-111 `window-placement` name), followed through
its `change` events. An answer whose operation started earlier never overwrites
a newer one. A revocation announced by `change` while `"ready"` turns the state
`"denied"` and drops the screens. The last answer is kept after the last
subscriber leaves, and the next subscription queries again; with nothing known,
reads report `"prompt"`.

## Server rendering

The server snapshots are fixed seeds: `screenDetailsAtom` is
`{ status: "idle", screens: [], currentScreen: null, error: null }` and
`screenPermissionAtom` is `"prompt"`. Nothing is requested or queried during a
server render. `useValue` renders the seeds first and switches to the live
values after hydration.

## Lifetime

Once access is granted, listeners on the browser's `ScreenDetails` object
(`screenschange`, `currentscreenchange` and each screen's `change`) are shared
by every store tree that retains the source and removed with the last one — when
its last retaining subscriber leaves or its store is disposed. Child scopes share
their root's registration. Reads without a subscription sample the platform and
attach nothing; events only tell stores to read again, and an event that changes
nothing publishes nothing. Every store tree is invalidated even when another
tree's subscriber throws; the failures are rethrown afterwards from the native
listener.

---

Full documentation: https://valdres.dev/react/plugins/browser-screen-details

<!-- DOCS:END -->
