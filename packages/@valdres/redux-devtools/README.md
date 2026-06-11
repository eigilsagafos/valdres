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

| Option      | Type                        | Default     | Notes                                                                         |
| ----------- | --------------------------- | ----------- | ----------------------------------------------------------------------------- |
| `name`      | `string`                    | `"valdres"` | Instance name in the extension dropdown.                                      |
| `serialize` | `(state, value) => unknown` | identity    | Shape values that aren't structured-cloneable before they're sent.            |
| `scopes`    | `boolean`                   | `true`      | Include scope state under `@scopes` and react to scope writes.                |
| `unnamed`   | `"track" \| "ignore"`       | `"track"`   | `track` labels unnamed atoms `unnamed_atom_N`; `ignore` omits them.           |
| `selectors` | `boolean`                   | `false`     | Also report named selectors under `@computed` (display-only, never restored). |

## Exports

| Export                        | Kind    | Type                                                                           |
| ----------------------------- | ------- | ------------------------------------------------------------------------------ |
| `connectReduxDevtools`        | util fn | `(store: Store, options?: ConnectReduxDevtoolsOptions) => ReduxDevtoolsHandle` |
| `ConnectReduxDevtoolsOptions` | type    | `{ name?, serialize?, scopes?, unnamed?, selectors? }`                         |
| `ReduxDevtoolsHandle`         | type    | `{ disconnect(): void }`                                                       |
| `DevtoolsSnapshot`            | type    | `Record<string, unknown> & { "@scopes"?, "@computed"? }`                       |
| `ReduxDevtoolsConnection`     | type    | extension connection surface                                                   |
| `ReduxDevtoolsExtension`      | type    | `window.__REDUX_DEVTOOLS_EXTENSION__` surface                                  |
| `ReduxDevtoolsMessage`        | type    | message from the extension                                                     |

## Notes

- A named transaction (`store.txn(fn, name)`) arrives as a single action.
- Default (non-enumerable) stores seed lazily as state first changes; only `store(id, { enumerable: true })` is seeded up front.
- Only how you obtain the `Store` differs per framework (`useStore`, `injectStore`, `getValdresContext`, or the bare instance).

---

Full documentation: https://valdres.dev/react/plugins/redux-devtools

<!-- DOCS:END -->
