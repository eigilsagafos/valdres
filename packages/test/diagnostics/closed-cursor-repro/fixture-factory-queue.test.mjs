import assert from "node:assert/strict"
import { test as nodeTest } from "node:test"
import { Detector as LeakDetector, phase as retentionPhase } from "./node-adapter.mjs"
const test = (name, body) => nodeTest(name, { timeout: 5000 }, body)
const expect = value => ({ toBe: expected => assert.equal(value, expected), toHaveLength: expected => assert.equal(value.length, expected) })
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
                tx.push(() => {
                    retentionPhase(abort ? "aborted" : "committed", "callback-start")
                    return payload.n
                })
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
