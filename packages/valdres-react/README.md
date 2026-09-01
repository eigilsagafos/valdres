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

## Opt-in React correlation

`valdres-react/inspect` binds the React adapter to a Store created by `valdres/inspect`. Use the returned Provider and hooks only for the tree being measured:

```tsx
import { createInspectableStore } from "valdres/inspect"
import { createInspectableReact } from "valdres-react/inspect"

const core = createInspectableStore()
const react = createInspectableReact(core)
const editorStore = core.store.scope("editor")

function Editor() {
    const document = react.useValue(documentAtom)
    return <DocumentView document={document} />
}

export function InspectedEditor() {
    return (
        <react.Provider store={editorStore}>
            <Editor />
        </react.Provider>
    )
}

const report = react.inspect.export()
react.inspect.reset()
```

Omit the Provider's `store` prop to use the inspected root Store, or pass a child scope owned by the same inspector. The returned state and writer hooks also retain their optional explicit Store overrides and reject Stores outside that inspector.

The immutable composite export contains the exact core flight-recorder report plus separately bounded React timelines. Subscriber rows retain the genuinely active core IDs read through the recording-neutral `core.inspect.capture(store, state?)` seam. Snapshot rows distinguish React's synchronous subscriber check from later reads; they are reads, not component render counts. Profiler rows are boundary callbacks on the same clock, while their `commitTimeGroupId` is only a timestamp grouping key—not a unique commit or a causal link to a Store operation.

Subscriber and snapshot timelines work in ordinary production React builds. Profiler timing is available only in development or a profiling-enabled production build. The recording/export retains no State values, props, children, callbacks, errors, or component instances. The opt-in entry is absent from the ordinary `valdres-react` root bundle and adds no capture work to ordinary hooks.

## Beta compatibility

Use `useSetAtom` for exact values and `useUpdateAtom` for updater functions. The legacy `Scope`, `useStoreId`, `useTransaction`, `useValdresCallback`, and optional-store Provider APIs are not part of this beta.

`valdres-react@1.0.0-beta.6` is certified with `valdres@1.0.0-beta.27` and later v1 betas accepted by its `^1.0.0-beta.27` peer range. Deferred adapters and plugins remain unsupported even when their published semver ranges allow npm to resolve this core or React package; do not mix them with the new beta until they are migrated.

<!-- DOCS:END -->
