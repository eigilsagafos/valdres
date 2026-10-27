/**
 * Runs in a fresh process with no Happy-DOM registration: `window` is
 * undeclared. Import, reads, subscriptions and a React server render must make
 * no request; an explicit request still works through the runtime's `fetch`
 * (scripted here, so nothing leaves the process).
 */
import { strict as assert } from "node:assert"
import { createElement } from "react"
import { renderToString } from "react-dom/server"

const urls: string[] = []
globalThis.fetch = (async (input: unknown) => {
    urls.push(String(input))
    return { ok: true, status: 200, text: async () => "203.0.113.7" }
}) as unknown as typeof fetch

const { store } = await import("valdres")
const { Provider, useValue } = await import("valdres-react")
const ip = await import("../../src/index")

assert.equal(typeof globalThis.window, "undefined")
const app = store()
assert.deepEqual(app.get(ip.publicIpAtom), {
    status: "idle",
    ip: null,
    updatedAt: null,
    error: null,
})
const stops = [
    app.sub(ip.publicIpAtom, () => {}),
    app.sub(ip.publicIpV4ValueAtom, () => {}),
    app.scope().sub(ip.publicIpV6StatusAtom, () => {}),
]
const View = () =>
    createElement(
        "p",
        null,
        `${useValue(ip.publicIpStatusAtom)}|${useValue(ip.publicIpValueAtom) ?? "-"}`,
    )
const render = () => {
    const request = store()
    try {
        return renderToString(
            createElement(Provider, { store: request }, createElement(View)),
        )
    } finally {
        request.dispose()
    }
}
assert.equal(render(), "<p>idle|-</p>")
assert.deepEqual(
    urls,
    [],
    "import, reads, subscriptions or a server render made a request",
)

assert.equal(await ip.requestPublicIp(), "203.0.113.7")
assert.deepEqual(urls, ["https://api.ipify.org"])
assert.equal(app.get(ip.publicIpValueAtom), "203.0.113.7")
// The server render still reads the fixed seed, whatever the process learned.
assert.equal(render(), "<p>idle|-</p>")
for (const call of [
    () => (app as any).set(ip.publicIpAtom, null),
    () => (app as any).reset(ip.publicIpValueAtom),
])
    assert.throws(call, TypeError)
for (const stop of stops) stop()
app.dispose()
console.log("DOMLESS_OK")
