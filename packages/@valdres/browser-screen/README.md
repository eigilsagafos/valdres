<!-- DOCS:START -->

# browser-screen

Wraps `window.screen` and `window.devicePixelRatio` as one read-only external atom. Its value is a single frozen snapshot of the screen's size, available area, depth, pixel ratio and orientation, updated on `resize`, orientation changes, pixel-ratio changes and, in Chromium, screen changes.

## Install

```bash
bun add @valdres/browser-screen
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-screen](https://valdres.dev/react/plugins/browser-screen)

## Usage

Every read works through a store, with no adapter at all:

```ts
import { selector, store } from "valdres"
import { screenAtom } from "@valdres/browser-screen"

const app = store()
app.get(screenAtom) // ScreenInfo — reads without subscribing

// Derive the narrow value you need. Its subscribers are only notified when
// it changes, not on every screen event.
const pixelRatio = selector(get => get(screenAtom).devicePixelRatio)
const stop = app.sub(pixelRatio, () => redrawCanvas(app.get(pixelRatio)))
stop()
```

```tsx
import { useValue } from "valdres-react"
import { screenAtom } from "@valdres/browser-screen"

function Resolution() {
    const { width, height, orientationType } = useValue(screenAtom)
    return <span>{width} × {height} ({orientationType})</span>
}
```

> **Adapter support in this beta**
>
> `valdres-react` is the only adapter migrated to the v1 core. The Vue, Svelte,
> Solid and Angular adapters cannot read an external atom yet: `valdres-vue`'s
> `useValue` and `valdres-angular`'s `injectValue` are typed for `Atom | Selector`
> only, `valdres-solid`'s `createValue` still expects the pre-v1 two-parameter
> `State`, and `valdres-svelte` exports `fromState`, not the `watch` these pages
> used to show. Until those adapters ship, read this package with `store.get` /
> `store.sub` as above.

## Exports

| Export                  | Kind                      | Type                                                                                                                                      |
| ----------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `screenAtom`            | external atom (read-only) | `ScreenInfo`                                                                                                                              |
| `ScreenInfo`            | type                      | `{ width, height, availWidth, availHeight, colorDepth, pixelDepth, devicePixelRatio, orientationType, orientationAngle }`, all `readonly` |
| `ScreenOrientationType` | type                      | `"portrait-primary" \| "portrait-secondary" \| "landscape-primary" \| "landscape-secondary"`                                              |

All `ScreenInfo` fields are `number` except `orientationType`.
`ScreenOrientationType` is assignable both ways to the DOM's `OrientationType`.
It is declared here so that consumers without the DOM library can still type
against the package. Where `screen.orientation` is missing, or reports a value
outside those four, the snapshot reads `"landscape-primary"` at angle `0`.

## Ownership

The screen belongs to the device, so `screenAtom` is an **external atom**:
stores cannot write it, and `set`, `reset` and `update` reject it at compile
time and at runtime. Its value is always what `window.screen` and
`window.devicePixelRatio` report. The events below only tell a store to read
them again.

Configuration is the application's, and belongs in its own atoms. Those are
ordinary store state, so each store tree has its own, and one store's override
never leaks into another:

```ts
import { atom, selector } from "valdres"
import { screenAtom } from "@valdres/browser-screen"

// e.g. render a canvas at a fixed density for an export
const forcedRatioAtom = atom<number | null>(null)
const renderRatioSelector = selector(
    get => get(forcedRatioAtom) ?? get(screenAtom).devicePixelRatio,
)
```

## Snapshots

Each value is one frozen object holding every field, read together. Related
values therefore change together: a rotation that swaps `width` and `height`
and changes the orientation is published once, whichever of its events arrives
first, and a selector never sees the new orientation with the old dimensions.
An event that leaves every field unchanged returns the very same object, so
nothing is notified. A window `resize` that does not change the screen
therefore notifies no `screenAtom` subscriber.

Every store reads the same screen, so they share snapshots: two stores reading
an unchanged screen get the identical object. The objects are frozen because
they are shared, and `ScreenInfo`'s fields are `readonly`.

`screenAtom` and `@valdres/browser-window`'s `windowSizeAtom` are separate
sources. One `resize` updates them one after the other, as two updates, so a
selector that reads both can briefly see one updated and the other not.

## Server rendering

`screenAtom` reports a fixed seed when there is no screen to read, which covers
server rendering and runtimes without `window.screen`, such as a server or a
worker: `0` for the four dimensions ("unknown"), `24` for `colorDepth` and
`pixelDepth`, `1` for `devicePixelRatio`, and `"landscape-primary"` at angle
`0`. The seed is deterministic, never a per-process guess. `useValue` renders it
first and switches to the live value after hydration, which is a normal
two-pass render, not a hydration mismatch.

## Lifetime

When a store tree first retains the source, either through a direct
subscription or through a selector built on it, the source attaches:

- a `resize` listener on `window` (size, availability and, on most engines,
  rotation);
- a `change` listener on `screen.orientation`, where it exists;
- a `change` listener on `screen` itself, where `Screen` is an `EventTarget`
  (Chromium). It fires when the window's screen changes without the window
  resizing, for example when it moves to another display;
- a `change` listener on `matchMedia("(resolution: Xdppx)")` for the current
  ratio. A resolution query only changes when the ratio leaves `X`, so after
  each change the source watches the new ratio. It does so before telling the
  store, so a subscriber that throws or unsubscribes cannot leave it watching a
  stale ratio. Without `matchMedia`, pixel-ratio changes are only seen with the
  `resize` that usually accompanies them.

They detach when that tree's last retaining subscriber leaves or the store is
disposed. Each store tree owns one set, and child scopes share their root's.
Importing the package attaches nothing and reads nothing, and reads without a
subscription read the screen directly without attaching or creating a media
query.

**Failures.** If any attachment throws, the ones already made are removed and
the subscription fails with an `ExternalSourceOperationError` whose `cause` is
the original error. If a removal throws, the remaining listeners are still
removed, and the unsubscribe (or `dispose`) that caused it throws the same
error class with `phase: "cleanup"`; several failures arrive as one
`AggregateError` cause. If watching the new ratio fails during a pixel-ratio
change, the store still receives the new value, the previous watch is kept, and
the failure is rethrown to the browser's error reporting, together with any
subscriber failure as an `AggregateError`.

## What is observed

Native behavior was checked in Chromium only, by driving Chrome for Testing 151
(headless and headed) and Chrome 154 on macOS over the DevTools protocol:

- **Real browser zoom** (Chrome for Testing, through `chrome.tabs.setZoom`, the
  path Ctrl/Cmd-+ takes) to 200%, 300%, 110% and back: `resize` fired first,
  already reporting the new ratio, then the resolution query fired. Each step
  produced one publication per store, the watch moved to the new ratio
  (including `1.100000023841858`), and each store tree kept exactly one
  resolution listener.
- **Emulated rotation** of a mobile screen: `resize` and `screen.orientation`
  `change` arrived in either order across runs. Every published snapshot had
  matching dimensions and orientation.
- **Resizing the browser window** notified no `screenAtom` subscriber.
- Synthetic events that changed nothing notified nobody, and unsubscribing and
  disposing removed every listener.

Changing only the emulated device scale factor fired neither `resize` nor a
resolution change in Chromium 151 or 154, so it was not used as evidence.

**Not verified:** Safari/WebKit, Firefox/Gecko, physical rotation, moving a
window between displays (Chromium's `screen` `change`), and arrangement-only
changes, such as rearranging monitors without moving the window. For several
displays, use [`@valdres/browser-screen-details`](https://valdres.dev/plugins/browser-screen-details).

## Migrating from 1.0.0-beta.8

| Before                                                                           | Now                                                                                                                                                               |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `screenAtom` was a writable `globalAtom` shared by every store                   | A read-only `ExternalAtom<ScreenInfo>`. `set`, `reset`, `update`, `setSelf` and `resetSelf` are gone. Put overrides in your own atom, as above.                   |
| One set of listeners for the whole process, whose cached value every store saw   | One set per store tree that subscribes. Reads without a subscription read live.                                                                                   |
| A new object on every event                                                      | One frozen, shared object per distinct reading; events that change nothing notify nobody.                                                                         |
| `orientationType: OrientationType` (DOM library type)                            | `ScreenOrientationType`, the same four strings, usable without the DOM library. Fields are `readonly`.                                                            |
| `resize`, orientation and resolution listeners                                   | The same, plus Chromium's `screen` `change`. The legacy `MediaQueryList.addListener` fallback for Safari 13 and older is gone, as in the other migrated packages. |
| Peer `valdres` `^1.0.0-beta.19` (a range that admits cores without `globalAtom`) | `^1.0.0-beta.39`, the first core with `externalAtom`.                                                                                                             |

---

Full documentation: https://valdres.dev/react/plugins/browser-screen

<!-- DOCS:END -->
