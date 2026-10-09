/**
 * Fresh process with a DOM: counts every listener attached to `window` from
 * BEFORE the package is imported, so import-time or read-time attachment cannot
 * hide behind an earlier test.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { strict as assert } from "node:assert"

GlobalRegistrator.register()

const attached: string[] = []
const add = window.addEventListener.bind(window)
window.addEventListener = ((type: string, ...rest: unknown[]) => {
    attached.push(`window:${type}`)
    return (add as (...args: unknown[]) => void)(type, ...rest)
}) as typeof window.addEventListener
let reads = 0
const innerWidth = Object.getOwnPropertyDescriptor(window, "innerWidth")!
Object.defineProperty(window, "innerWidth", {
    configurable: true,
    get() {
        reads++
        return innerWidth.get!.call(window)
    },
})

const { store } = await import("valdres")
const { windowSizeAtom } = await import("../../src/index")
assert.deepEqual(attached, [], "importing attached listeners")
assert.equal(reads, 0, "importing measured the window")

const app = store()
assert.equal(app.get(windowSizeAtom).innerWidth, window.innerWidth)
assert.deepEqual(attached, [], "a dormant read attached listeners")

const stop = app.sub(windowSizeAtom, () => {})
assert.deepEqual(attached, ["window:resize"])
stop()
app.dispose()

await GlobalRegistrator.unregister()
console.log("IMPORT_INERT_OK")
