import { afterAll, expect, test } from "bun:test"
import { LeakDetector, retentionPhase } from "../../src/LeakDetector"
import { flushRetentionCapture } from "../../src/retentionCapture"
afterAll(flushRetentionCapture)
import { dispatch } from "./fixture-factory-queue.mjs"
const tick = () => new Promise(r => setTimeout(r, 5))
const collect = async (detector, label) => {
    for (let n = 0; n < 3; n++) {
        retentionPhase(label, "collection-await-enter", n)
        const leaking = await detector.isLeaking(undefined, label)
        retentionPhase(label, leaking ? "collection-await-return-live" : "collection-await-return-collected", n)
        if (!leaking) return true
    }
    return false
}
test("retained closed cursors do not retain aborted or drained callbacks", async () => {
    retentionPhase("test", `start platform=${process.platform} arch=${process.arch} engine=${process.versions.bun ?? process.versions.node}`)
    const cursors = []
    const register = (abort) => {
        const payload = { n: 1 }
        const detector = new LeakDetector(payload, abort ? "aborted" : "committed")
        try {
            dispatch(tx => {
                cursors.push(tx)
                const callback = () => {
                    retentionPhase(abort ? "aborted" : "committed", "callback-start")
                    return payload.n
                }
                if (!abort) globalThis.__reproRetainedCallback = callback
                tx.push(callback)
                if (abort) throw new Error("abort")
            })
        } catch {}
        return detector
    }
    const aborted = register(true),
        committed = register(false)
    retentionPhase("test", "registrations-complete-wait-enter")
    await tick()
    retentionPhase("test", "wait-return-collection-enter")
    expect(await collect(aborted, "aborted")).toBe(true)
    expect(await collect(committed, "committed")).toBe(true)
    expect(cursors).toHaveLength(2)
    retentionPhase("test", "complete")
})
