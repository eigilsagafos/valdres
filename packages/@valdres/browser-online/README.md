<!-- DOCS:START -->

# browser-online

Reactive `navigator.onLine` as a read-only external atom, updated by the `online` / `offline` events.

## Install

```bash
bun add @valdres/browser-online
```

## Live example

▶ Live example: [https://valdres.dev/react/plugins/browser-online](https://valdres.dev/react/plugins/browser-online)

## Usage

Every read works through a store, with no adapter at all:

```ts
import { store } from "valdres"
import { onlineAtom } from "@valdres/browser-online"

const app = store()
app.get(onlineAtom) // boolean — reads without subscribing
const stop = app.sub(onlineAtom, () => {
    console.log(app.get(onlineAtom) ? "back online" : "offline")
})
stop()
```

```tsx
import { useValue } from "valdres-react"
import { onlineAtom } from "@valdres/browser-online"

function ConnectionBadge() {
    const online = useValue(onlineAtom)
    return <span>{online ? "Online" : "Offline"}</span>
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

| Export       | Kind                      | Type      |
| ------------ | ------------------------- | --------- |
| `onlineAtom` | external atom (read-only) | `boolean` |

## Ownership

Connectivity belongs to the browser, so `onlineAtom` is an **external atom**:
stores cannot write it, and `set`, `reset` and `update` reject it at compile time
and at runtime. The value is always `navigator.onLine` itself. The `online` and
`offline` events only tell a store to read it again, so an event cannot
report a state the browser does not.

`navigator.onLine` is `false` only when the browser knows it has no network. A
`true` value does not prove that a server is reachable. If the application needs
that, it should keep its own reachability state in its own atom.

## Server rendering

`onlineAtom` reports `true` when connectivity cannot be observed. That covers
server rendering and runtimes whose `navigator` has no boolean `onLine`, such as
Node, Bun and Deno. The value is a fixed, deterministic seed, because a server
cannot know a visitor's connection and a mutable process-wide seed would leak
between requests. `useValue` renders the seed first and switches to the live
value after hydration. That is a normal two-pass render, not a hydration
mismatch.

## Lifetime

The `online` / `offline` listeners attach when a store tree first retains the
source, either through a direct subscription or through a selector that reads it.
They detach when that tree's last retaining subscriber leaves or the store is
disposed. Each store tree owns its own pair of listeners, and child scopes share
their root's pair. Importing the package attaches nothing. Reads without a
subscription sample `navigator.onLine` directly and attach nothing either.

The listeners go on `window` in a document, or on the global scope in a worker.
Both fire `online` / `offline`.

---

Full documentation: https://valdres.dev/react/plugins/browser-online

<!-- DOCS:END -->
