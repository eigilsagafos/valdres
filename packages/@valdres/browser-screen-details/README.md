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
call from a click handler reaches the browser with that click's activation.
The specification does not require activation for it; how a browser presents
the prompt is its own decision (verified only in headless Chromium 151 and
154, with emulated permission states). Concurrent calls share one request; a browser prompt cannot be
cancelled.

| Outcome                                            | Promise              | `screenDetailsAtom.status`                     | `screenPermissionAtom` |
| -------------------------------------------------- | -------------------- | ---------------------------------------------- | ---------------------- |
| Waiting for the browser                            | pending              | `"pending"` (unchanged when already `"ready"`) | unchanged              |
| Granted                                            | resolves the screens | `"ready"`                                      | `"granted"`            |
| `NotAllowedError` (the user, a permissions policy) | rejects with it      | `"denied"`                                     | `"denied"`             |
| Any other failure                                  | rejects with it      | `"error"`, with `{ name, message }`            | unchanged              |
| No API                                             | resolves `null`      | `"unsupported"`                                | `"unsupported"`        |
| Insecure context                                   | resolves `null`      | `"insecure"`                                   | `"unsupported"`        |

**Errors.** Once `getScreenDetails()` has been called, the caller always gets
the promise — the call never throws — and it settles only with the browser's
outcome: it resolves the screens or rejects with the browser's own error. If a
store subscriber throws while `"pending"`, `"ready"`, `"denied"` or `"error"`
is published, every store is still notified and the failure is reported
separately through `globalThis.reportError` (or thrown in a later task), the
way core reports `onCommit` failures; it never becomes the promise's outcome,
and the request is never retried. Subscriber failures on a `change` or
`screenschange` event are rethrown from that event's listener.

**Ordering.** A denial the browser reports after a request started wins over
that request's own grant: the state becomes (or stays) `"denied"` instead of
`"ready"`, while the promise still resolves with what `getScreenDetails()`
returned — the promise is the browser call's outcome, the atoms are the newest
page truth.

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

`screenPermissionAtom` never prompts. It reports the newest answer this page
has seen: a request's outcome, or the Permissions API's `window-management`
state (falling back to the pre-Chrome-111 `window-placement` name) and its
`change` events. An answer whose operation started earlier never overwrites a
newer one. With nothing known, reads report `"prompt"`.

The permission is observed while any store subscribes to
`screenPermissionAtom` **or** to the screen details (`screenDetailsAtom`,
`screensAtom`, `currentScreenAtom`, `screenDetailsStatusAtom`) — one shared
query and `change` listener, removed when the last of them leaves or its store
is disposed. So a store that only reads screens sees a revocation without
subscribing to the permission.

**Revocation.** When the browser reports the permission as `"denied"` (a
`change` event or a query answer) while `"ready"`, the screens are dropped,
not kept as stale data: the state becomes `"denied"` with a `NotAllowedError`
explaining the revocation, and the `ScreenDetails` listeners are removed. A
reset to `"prompt"` does not end access. Only changes the browser reports
through the Permissions API are seen; engines without it report none.

**Unsubscribed reads may be stale.** While no store subscribes, nothing
observes the permission: a read returns the last answer this page saw, which
can be out of date if the user changed the setting meanwhile. Observation
resumes with the next subscription, which queries again and corrects it.

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
