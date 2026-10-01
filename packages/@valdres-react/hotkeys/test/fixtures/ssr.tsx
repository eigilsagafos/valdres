/**
 * A fresh process with no DOM: server rendering registers nothing, activates
 * nothing and runs no command, with a Provider or an explicit Store alone.
 */
import { strict as assert } from "node:assert"
import { renderToString } from "react-dom/server"
import { atom, store } from "valdres"
import { Provider } from "valdres-react"
import { hotkeyScope } from "@valdres/hotkeys"
import { useHotkey, useHotkeyScope } from "../../src/index"
import { inspectRegistry } from "../../../../@valdres/hotkeys/src/lib/registry"
import { scopeCountAtom } from "../../../../@valdres/hotkeys/src/lib/scopeState"

assert.equal(typeof globalThis.document, "undefined")
const app = store()
const explicit = store()
const ran = atom(0)
const modal = hotkeyScope({ priority: 1 })
const Page = () => {
    useHotkeyScope(modal)
    useHotkey("Mod+s", tx => tx.set(ran, 1), { scope: modal })
    return <p>page</p>
}
const Bare = () => {
    useHotkey("k", tx => tx.set(ran, 2), { store: explicit })
    return <p>bare</p>
}
assert.equal(
    renderToString(
        <Provider store={app}>
            <Page />
        </Provider>,
    ),
    "<p>page</p>",
)
assert.equal(renderToString(<Bare />), "<p>bare</p>")
assert.deepEqual(
    [inspectRegistry(app).bindings, inspectRegistry(explicit).bindings],
    [0, 0],
)
assert.equal(app.get(scopeCountAtom(modal, app)), 0)
assert.equal(app.get(ran) + explicit.get(ran), 0)
app.dispose()
explicit.dispose()
console.log("SSR_OK")
