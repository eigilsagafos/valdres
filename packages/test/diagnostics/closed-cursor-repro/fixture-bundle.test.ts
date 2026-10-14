import { afterAll, expect, test } from "bun:test"
import { LeakDetector, retentionPhase } from "../../src/LeakDetector"
import { flushRetentionCapture } from "../../src/retentionCapture"
afterAll(flushRetentionCapture)
import { store } from "./valdres.mjs"
import type { Transaction } from "../../../valdres/src/index"
const tick = () => new Promise(r => setTimeout(r, 5))
const collect = async (detector: LeakDetector, label?: string) => {
    for (let n = 0; n < 3; n++) {
        retentionPhase(label, "collection-await-enter", n)
        const leaking = await detector.isLeaking(undefined, label)
        retentionPhase(label, leaking ? "collection-await-return-live" : "collection-await-return-collected", n)
        if (!leaking) return true
    }
    return false
}
test("retained closed cursors do not retain aborted or drained callbacks", async () => {
    retentionPhase("test", `start platform=${process.platform} arch=${process.arch} bun=${Bun.version}`)
    const s = store(),
        cursors: Transaction[] = []
    const register = (abort: boolean) => {
        const payload = { n: 1 }
        const detector = new LeakDetector(payload, abort ? "aborted" : "committed")
        try {
            s.txn(tx => {
                cursors.push(tx)
                tx.onCommit(() => {
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
    s.dispose()
    retentionPhase("test", "complete")
})
