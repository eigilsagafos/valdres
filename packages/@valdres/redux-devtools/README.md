<!-- DOCS:START -->

# redux-devtools

Every committed change to a named atom is sent as an action; the extension's time-travel / commit / reset controls restore state back onto the store.

> **Requires the extension**
>
>
> Install the [Redux DevTools](https://github.com/reduxjs/redux-devtools) browser extension. Without it, `connectReduxDevtools` warns once and returns a no-op handle.

## Install

```bash
bun add @valdres/redux-devtools
```

## Usage

Call `connectReduxDevtools(store)` once on mount; call `disconnect()` on teardown.

```tsx
import { useEffect } from "react"
import { useStore } from "valdres-react"
import { connectReduxDevtools } from "@valdres/redux-devtools"

function DevtoolsBridge() {
    const store = useStore()
    useEffect(() => connectReduxDevtools(store).disconnect, [store])
    return null
}
```

Vanilla: pass the store instance directly.

```ts
import { store } from "valdres"
import { connectReduxDevtools } from "@valdres/redux-devtools"

const handle = connectReduxDevtools(store())
// handle.disconnect() to detach
```

## Options

`connectReduxDevtools(store, options?)` accepts:

| Option      | Type                           | Default     | Notes                                                                                                                                                                                                             |
| ----------- | ------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`      | `string`                       | `"valdres"` | Instance name in the extension dropdown.                                                                                                                                                                          |
| `serialize` | `(state, value) => unknown`    | identity    | Shape values that aren't structured-cloneable before they're sent.                                                                                                                                                |
| `scopes`    | `boolean`                      | `true`      | Include scope state under `@scopes` and react to scope writes.                                                                                                                                                    |
| `unnamed`   | `"track" \| "ignore"`          | `"track"`   | `track` labels unnamed atoms `unnamed_atom_N`; `ignore` omits them.                                                                                                                                               |
| `exclude`   | `ExcludeRule \| ExcludeRule[]` | —           | Leave atoms/selectors out entirely — neither seeded nor reported. A rule is an atom/selector reference, an `atomFamily`/`selectorFamily` (all its members), a `name` string, or a predicate `(state) => boolean`. |
| `selectors` | `boolean`                      | `false`     | Also report named selectors under `@computed` (display-only, never restored).                                                                                                                                     |

### Excluding high-frequency atoms

A single atom that updates on every frame — a cursor position, pointer
coordinates, a scroll offset — floods the timeline and buries the actions you
actually care about. Pass it to `exclude` and it disappears from DevTools while
your store keeps working normally:

```ts
connectReduxDevtools(store, {
  // any of: a reference, a name, an atomFamily/selectorFamily, a predicate, or a mix
  exclude: [cursorPositionAtom, "pointerAtom", pointerFamily],
})
```

## Exports

| Export                          | Kind    | Type                                                                           |
| ------------------------------- | ------- | ------------------------------------------------------------------------------ |
| `connectReduxDevtools`          | util fn | `(store: Store, options?: ConnectReduxDevtoolsOptions) => ReduxDevtoolsHandle` |
| `ConnectReduxDevtoolsOptions`   | type    | `{ name?, serialize?, scopes?, unnamed?, exclude?, selectors? }`               |
| `ExcludeOption` / `ExcludeRule` | type    | atom/selector/family reference, `name` string, or `(state) => boolean`         |
| `ReduxDevtoolsHandle`           | type    | `{ disconnect(): void }`                                                       |
| `DevtoolsSnapshot`              | type    | `Record<string, unknown> & { "@scopes"?, "@computed"? }`                       |
| `ReduxDevtoolsConnection`       | type    | extension connection surface                                                   |
| `ReduxDevtoolsExtension`        | type    | `window.__REDUX_DEVTOOLS_EXTENSION__` surface                                  |
| `ReduxDevtoolsMessage`          | type    | message from the extension                                                     |

## Notes

- A named transaction (`store.txn(fn, name)`) arrives as a single action.
- Default (non-enumerable) stores seed lazily as state first changes; only `store(id, { enumerable: true })` is seeded up front.
- Only how you obtain the `Store` differs per framework (`useStore`, `injectStore`, `getValdresContext`, or the bare instance).

---

Full documentation: https://valdres.dev/react/plugins/redux-devtools

<!-- DOCS:END -->
