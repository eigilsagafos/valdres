// Hydration, StrictMode lifecycle and Suspense in a DOM, on the installed React.
import { strict as assert } from "node:assert"
import { GlobalRegistrator } from "@happy-dom/global-registrator"

GlobalRegistrator.register()
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const React = await import("react")
const { act, createElement: h, StrictMode, Suspense } = React
const { createRoot, hydrateRoot } = await import("react-dom/client")
const { renderToString } = await import("react-dom/server")
const { atom, createStore, Provider, useAtom, useAtomValue, useSetAtom } =
    await import("@valdres-react/jotai")

const reactMajor = Number(React.version.split(".")[0])
assert.equal(reactMajor, Number(process.env.EXPECTED_REACT_MAJOR))
const settle = () => act(() => new Promise(resolve => setTimeout(resolve, 400)))

// Hydration of server markup, then a client update.
{
    const count = atom(0)
    const App = ({ store }) => {
        const Counter = () => {
            const [value, setValue] = useAtom(count)
            return h("button", { onClick: () => setValue(v => v + 1) }, `count ${value}`)
        }
        return h(StrictMode, null, h(Provider, { store }, h(Counter)))
    }
    const serverStore = createStore()
    serverStore.set(count, 3)
    const container = document.createElement("div")
    container.innerHTML = renderToString(h(App, { store: serverStore }))
    document.body.append(container)
    const clientStore = createStore()
    clientStore.set(count, 3)
    const errors = []
    let root
    await act(async () => {
        root = hydrateRoot(container, h(App, { store: clientStore }), {
            onRecoverableError: error => errors.push(error),
        })
    })
    await act(async () => container.querySelector("button").click())
    assert.deepEqual(errors, [])
    assert.equal(container.textContent, "count 4")
    await act(async () => root.unmount())
    container.remove()
}

// StrictMode mount, unmount and remount.
{
    const trace = []
    const value = atom(0)
    value.onMount = setValue => {
        trace.push("mount")
        setValue(v => v + 1)
        return () => trace.push("unmount")
    }
    const View = () => h("span", null, String(useAtomValue(value)))
    const container = document.createElement("div")
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(h(StrictMode, null, h(Provider, null, h(View)))))
    assert.deepEqual(trace, ["mount", "unmount", "mount"])
    assert.equal(container.textContent, "2")
    await act(async () => root.unmount())
    assert.deepEqual(trace, ["mount", "unmount", "mount", "unmount"])
    container.remove()
}

// Suspense: resolve, follow a replaced promise, and reject into a boundary.
{
    let resolveFirst
    const data = atom(new Promise(resolve => (resolveFirst = resolve)))
    const replace = atom(null, (_get, set, next) => set(data, Promise.resolve(next)))
    let setReplace
    const View = () => h("span", null, useAtomValue(data))
    const Control = () => {
        setReplace = useSetAtom(replace)
        return null
    }
    const container = document.createElement("div")
    document.body.append(container)
    const root = createRoot(container)
    await act(async () =>
        root.render(
            h(Provider, null, h(Control), h(Suspense, { fallback: h("span", null, "loading") }, h(View))),
        ),
    )
    assert.equal(container.textContent, "loading")
    await act(async () => setReplace("replaced"))
    await settle()
    assert.equal(container.textContent, "replaced")
    resolveFirst("stale")
    await settle()
    assert.equal(container.textContent, "replaced")

    class Boundary extends React.Component {
        state = {}
        static getDerivedStateFromError(error) {
            return { error }
        }
        render() {
            return this.state.error ? h("span", null, `error: ${this.state.error.message}`) : this.props.children
        }
    }
    const failing = atom(async () => {
        throw new Error("async failure")
    })
    const Failing = () => h("span", null, useAtomValue(failing))
    const consoleError = console.error
    console.error = () => {}
    await act(async () =>
        root.render(
            h(Provider, null, h(Boundary, null, h(Suspense, { fallback: h("span", null, "loading") }, h(Failing)))),
        ),
    )
    await settle()
    console.error = consoleError
    assert.equal(container.textContent, "error: async failure")
    await act(async () => root.unmount())
    container.remove()
}

await GlobalRegistrator.unregister()
console.log(`DOM_OK react@${React.version}`)
