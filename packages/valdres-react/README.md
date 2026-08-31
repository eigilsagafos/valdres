<!-- DOCS:START -->

# valdres-react

React 18 and 19 bindings for the Valdres v1 beta.

## Installation

```bash
npm install valdres@beta valdres-react@beta react
```

```tsx
import { atom, store } from "valdres"
import { Provider, useUpdateAtom, useValue } from "valdres-react"

const appStore = store()
const count = atom(0)

function Counter() {
    const value = useValue(count)
    const increment = useUpdateAtom(count)
    return <button onClick={() => increment(current => current + 1)}>{value}</button>
}

export function App() {
    return (
        <Provider store={appStore}>
            <Counter />
        </Provider>
    )
}
```

The public hooks are `useStore`, `useValue`, `useAtom`, `useSetAtom`, `useUpdateAtom`, and `useResetAtom`. State hooks may also receive an explicit Store as their second argument. Provider borrows the Store you pass; it never creates, initializes, or disposes it.

## Beta compatibility

Use `useSetAtom` for exact values and `useUpdateAtom` for updater functions. The legacy `Scope`, `useStoreId`, `useTransaction`, `useValdresCallback`, and optional-store Provider APIs are not part of this beta.

`valdres-react@1.0.0-beta.5` is certified with `valdres@1.0.0-beta.24` and later v1 betas accepted by its `^1.0.0-beta.24` peer range. Deferred adapters and plugins remain unsupported even when their published semver ranges allow npm to resolve this core or React package; do not mix them with the new beta until they are migrated.

<!-- DOCS:END -->
