/**
 * Runs in a fresh process with no Happy-DOM registration: `window` is
 * undeclared. Import, reads, subscriptions and a React server render must
 * transfer nothing.
 */
import { strict as assert } from "node:assert"
import { createElement } from "react"
import { renderToString } from "react-dom/server"

const urls: string[] = []
globalThis.fetch = ((input: unknown) => {
    urls.push(String(input))
    return new Promise(() => {})
}) as unknown as typeof fetch

const { store } = await import("valdres")
const { Provider, useValue } = await import("valdres-react")
const bandwidth = await import("../../src/index")

assert.equal(typeof globalThis.window, "undefined")
const app = store()
assert.deepEqual(app.get(bandwidth.bandwidthAtom), {
    status: "idle",
    phase: null,
    progress: null,
    result: null,
    error: null,
})
const stops = [
    app.sub(bandwidth.bandwidthAtom, () => {}),
    app.sub(bandwidth.downloadSpeedAtom, () => {}),
    app.scope().sub(bandwidth.latencyAtom, () => {}),
]
const View = () =>
    createElement(
        "p",
        null,
        `${useValue(bandwidth.measurementStatusAtom)}|${useValue(bandwidth.downloadSpeedAtom) ?? "-"}`,
    )
const request = store()
assert.equal(
    renderToString(
        createElement(Provider, { store: request }, createElement(View)),
    ),
    "<p>idle|-</p>",
)
request.dispose()
assert.deepEqual(
    urls,
    [],
    "import, reads, subscriptions or a server render transferred data",
)
for (const call of [
    () => (app as any).set(bandwidth.bandwidthAtom, null),
    () => (app as any).reset(bandwidth.downloadSpeedAtom),
])
    assert.throws(call, TypeError)
for (const stop of stops) stop()
app.dispose()
console.log("DOMLESS_OK")
