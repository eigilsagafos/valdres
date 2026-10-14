import { afterAll, expect, test } from "bun:test"
import { store } from "../../src/index"
import { LeakDetector, retentionPhase } from "../../../test/src/LeakDetector"
import { flushRetentionCapture } from "../../../test/src/retentionCapture"
afterAll(flushRetentionCapture)
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
test("disposal drops pending captures even when scheduler delivery is held", async () => {
    await tick()
    const root = store(),
        child = root.scope(),
        held: (() => void)[] = [],
        original = globalThis.queueMicrotask
    globalThis.queueMicrotask = fn => {
        held.push(fn)
    }
    try {
        const detector = (() => {
            const payload = { n: 1 }
            const d = new LeakDetector(payload, "commit-pending")
            child.txn(tx => tx.onCommit(() => payload.n))
            return d
        })()
        child.dispose()
        expect(await collect(detector, "commit-pending")).toBe(true)
    } finally {
        globalThis.queueMicrotask = original
        for (const run of held) queueMicrotask(run)
        root.dispose()
        await tick()
    }
})
