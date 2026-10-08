<!-- DOCS:START -->

# browser-visibility

Tracks the [Page Visibility API](https://developer.mozilla.org/docs/Web/API/Page_Visibility_API), which reports whether the page is currently on screen. It provides a read-only external atom and a boolean selector, both updated by `visibilitychange`.

## Install

```bash
bun add @valdres/browser-visibility
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-visibility](https://valdres.dev/react/plugins/browser-visibility)

## Usage

Every read works through a store, with no adapter at all:

```ts
import { store } from "valdres"
import { visibilityAtom, isVisibleSelector } from "@valdres/browser-visibility"

const app = store()
app.get(visibilityAtom) // "visible" | "hidden" — reads without subscribing
app.get(isVisibleSelector) // boolean
const stop = app.sub(isVisibleSelector, () => {
    if (!app.get(isVisibleSelector)) pausePolling()
})
stop()
```

```tsx
import { useValue } from "valdres-react"
import { isVisibleSelector } from "@valdres/browser-visibility"

function PausableVideo() {
    const visible = useValue(isVisibleSelector)
    // pause work when the tab is hidden
    return <video data-playing={visible} />
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

| Export              | Kind                      | Type                    |
| ------------------- | ------------------------- | ----------------------- |
| `visibilityAtom`    | external atom (read-only) | `PageVisibility`        |
| `isVisibleSelector` | selector                  | `boolean`               |
| `PageVisibility`    | type                      | `"visible" \| "hidden"` |

`PageVisibility` is assignable both ways to the DOM's `DocumentVisibilityState`.
It is declared here so that consumers without the DOM library can still type
against the package.

## Ownership

Visibility belongs to the browser, so `visibilityAtom` is an **external atom**:
stores cannot write it, and `set`, `reset` and `update` reject it at compile time
and at runtime. The value is always `document.visibilityState`. Any state other
than `"visible"` reads as `"hidden"`, including the legacy `"prerender"`. The
`visibilitychange` event only tells a store to read it again.

Visibility is not focus. A tab that stays on screen while the user clicks into
another application is still `"visible"`. For "the user is here", compose with
`@valdres/browser-focus`, or use `@valdres/browser-presence`.

## Server rendering

`visibilityAtom` reports `"visible"` when visibility cannot be observed, which
covers server rendering and runtimes without a `document`, such as a server or a
worker. `isVisibleSelector` therefore reports `true` there. The seed is fixed and
deterministic, never a per-process guess. `useValue` renders it first and
switches to the live value after hydration, which is a normal two-pass render,
not a hydration mismatch.

## Lifetime

The `visibilitychange` listener attaches to `document` when a store tree first
retains the source, either through a direct subscription or through a selector
such as `isVisibleSelector`. It detaches when that tree's last retaining
subscriber leaves or the store is disposed. Each store tree owns one listener,
and child scopes share their root's. Importing the package attaches nothing.
Reads without a subscription sample `document.visibilityState` directly and
attach nothing either.

---

Full documentation: https://valdres.dev/react/plugins/browser-visibility

<!-- DOCS:END -->
