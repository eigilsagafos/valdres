/**
 * Fresh process with a DOM: records every listener attached to `window` and
 * every `matchMedia` call from BEFORE the package is imported, so import-time
 * or read-time work cannot hide behind an earlier test.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { strict as assert } from "node:assert"

GlobalRegistrator.register()

const work: string[] = []
const add = window.addEventListener.bind(window)
window.addEventListener = ((type: string, ...rest: unknown[]) => {
    work.push(`window:${type}`)
    return (add as (...args: unknown[]) => void)(type, ...rest)
}) as typeof window.addEventListener
const matchMedia = window.matchMedia.bind(window)
window.matchMedia = ((query: string) => {
    work.push(`matchMedia:${query}`)
    return matchMedia(query)
}) as typeof window.matchMedia
let reads = 0
const screenWidth = Object.getOwnPropertyDescriptor(window.screen, "width")
const width = window.screen.width
Object.defineProperty(window.screen, "width", {
    configurable: true,
    get() {
        reads++
        return screenWidth?.get?.call(window.screen) ?? width
    },
})

const { store } = await import("valdres")
const { screenAtom } = await import("../../src/index")
assert.deepEqual(work, [], "importing attached listeners or matched media")
assert.equal(reads, 0, "importing read the screen")

const app = store()
assert.equal(app.get(screenAtom).width, width)
assert.deepEqual(work, [], "a dormant read attached listeners or matched media")

const stop = app.sub(screenAtom, () => {})
// Happy-DOM has no screen.orientation and a Screen that is not an EventTarget.
assert.deepEqual(work, ["window:resize", "matchMedia:(resolution: 1dppx)"])
stop()
app.dispose()

await GlobalRegistrator.unregister()
console.log("IMPORT_INERT_OK")
