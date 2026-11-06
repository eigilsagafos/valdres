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
test("disposed captures are released while refill generations and recovery attempts are held", async () => {
    await tick()
    const root = store(),
        child = root.scope(),
        other = store()
    const tasks: (() => void)[] = []
    const timer = globalThis.setTimeout
    globalThis.setTimeout = ((fn: () => void) => {
        tasks.push(fn)
        return 0
    }) as typeof setTimeout
    const flush = async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve()
    }
    try {
        root.txn(tx => {
            for (let i = 0; i < 1100; i++) tx.onCommit(() => {})
        })
        await flush()
        expect(tasks.length).toBeGreaterThan(0)
        const detector = (() => {
            const payload = { n: 1 }
            const d = new LeakDetector(payload, "commit-refill")
            child.txn(tx => tx.onCommit(() => payload.n))
            return d
        })()
        // Later publications add recovery attempts in the exhausted generation.
        for (let i = 0; i < 3; i++) {
            other.txn(tx => tx.onCommit(() => {}))
            await flush()
        }
        child.dispose()
        expect(await collect(detector, "commit-refill")).toBe(true)
        // Keep all host closures alive, including old generations, during GC.
        for (const task of tasks.slice().reverse()) {
            task()
            task()
        }
        expect(await collect(detector, "commit-refill")).toBe(true)
    } finally {
        root.dispose()
        other.dispose()
        globalThis.setTimeout = timer
        for (const task of tasks) task()
        await tick()
    }
})
