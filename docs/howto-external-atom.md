# How to connect an external source

Expose an existing synchronous source through read-only Valdres State. This
example uses only the `valdres` package and works in Node or Bun.

## Build and observe a small source

1. Install the current feature build of `valdres` and import the public API.
2. Keep the externally owned value and listeners together. Return the current
   snapshot, and synchronously unsubscribe in the cleanup function.
3. Create one definition, then subscribe through a Store.

```ts
import { externalAtom, selector, store } from "valdres"

let current = 0
const listeners = new Set<() => void>()
const counter = externalAtom(
    {
        getSnapshot: () => current,
        getServerSnapshot: () => 0,
        subscribe(invalidate) {
            listeners.add(invalidate)
            return () => {
                listeners.delete(invalidate)
            }
        },
    },
    { name: "external counter" },
)

const doubled = selector(get => get(counter) * 2)
const app = store()
const observed: number[] = []
const stop = app.sub(doubled, () => {
    observed.push(app.get(doubled))
})

current = 2
for (const invalidate of [...listeners]) invalidate()

console.assert(app.get(doubled) === 4)
console.assert(observed.length === 1 && observed[0] === 4)
stop()
console.assert(listeners.size === 0)
app.dispose()
```

The value update belongs to the source. Valdres owns each StoreTree's projection
and subscription lifetime. For a production hub with multiple root Stores,
deliver to every listener even if one throws, then report those failures using
the hub's own policy. A failure in one Store must not suppress delivery to
another Store.

## How to render and hydrate external State

Install `valdres-react`, React 18 or 19, and `react-dom` alongside the same
certified core build. Create a Store and source per request using a serialized
initial value. Recreate them in the browser with that same value:

```tsx
import { externalAtom, store } from "valdres"
import { Provider, useValue } from "valdres-react"

export function createCounterApp(initial: number) {
    let live = initial
    const listeners = new Set<() => void>()
    const counter = externalAtom({
        getSnapshot: () => live,
        getServerSnapshot: () => initial,
        subscribe(invalidate) {
            listeners.add(invalidate)
            return () => {
                listeners.delete(invalidate)
            }
        },
    })
    const app = store()
    function Counter() {
        return <span>{useValue(counter)}</span>
    }
    return {
        element: (
            <Provider store={app}>
                <Counter />
            </Provider>
        ),
        setExternal(value: number) {
            live = value
            const failures: unknown[] = []
            for (const invalidate of [...listeners]) {
                try {
                    invalidate()
                } catch (error) {
                    failures.push(error)
                }
            }
            if (failures.length) throw new AggregateError(failures)
        },
        dispose: app.dispose,
    }
}
```

On the server, pass `createCounterApp(initial).element` to `renderToString` or
your streaming renderer. Dispose that request's Store after rendering finishes
or the stream is abandoned. Transfer `initial` using the application's existing
serialization mechanism.

In the browser, create the app once, call `hydrateRoot(container, app.element)`,
and send later source changes through `app.setExternal(value)`. Unmount the
React root before calling `app.dispose()`. Creating an ExternalAtom inside a
component render creates a new identity on each render; keep the app or
definition stable instead.

For selectors that also read ordinary Atoms or collection rows, recreate the
same initial ordinary Store state in the browser. Application writes must not
race boundaries that are still hydrating. Valdres provides no global hydration
completion signal or Store write embargo; the application owns that ordering.

Verify that the server markup contains the initial value, hydration reports no
recoverable mismatch, and a later external update changes the rendered text.
StrictMode may attach, clean up, and reattach; each generation must have its own
valid cleanup. Rendering alone does not attach a source listener.

## Troubleshooting

- **Missing server snapshot:** provide `getServerSnapshot` for every
  ExternalAtom reachable through the rendered selector. `dependencyPath`
  identifies the exact dynamic route to the missing source.
- **Repeated updates for unchanged data:** preserve snapshot reference identity
  until the source changes. ExternalAtom compares outcomes with `Object.is`.
- **Invalid synchronous snapshot:** resolve asynchronous work in the source and
  expose its current synchronous status/value. Do not return or throw Promises.
- **Invalid cleanup:** return a synchronous function from `subscribe`; make its
  cleanup synchronous too.
- **Capability error:** keep Store calls out of source getters, setup, cleanup,
  and thenable accessors. Notify via the supplied invalidator.
- **Work limit:** break synchronous cross-source feedback loops before retrying
  delivery. Valdres does not schedule an automatic retry.
- **Notification error:** the new outcome is already installed. Inspect the
  immutable wrapper metadata and its occurrence-ordered causes.

For exact signatures and errors, see the
[ExternalAtom reference](external-atom.md).
