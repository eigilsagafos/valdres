import { expect, test } from "bun:test"
import { store, type Transaction } from "../../src/index"
import { LeakDetector } from "../../../test/src/LeakDetector"
const tick = () => new Promise(r => setTimeout(r, 5))
const collect = async (detector: LeakDetector) => {
    for (let n = 0; n < 3; n++) if (!(await detector.isLeaking())) return true
    return false
}
test("retained closed cursors do not retain aborted or drained callbacks", async () => {
    const s = store(),
        cursors: Transaction[] = []
    const register = (abort: boolean) => {
        const payload = { n: 1 }
        const detector = new LeakDetector(payload)
        try {
            s.txn(tx => {
                cursors.push(tx)
                tx.onCommit(() => payload.n)
                if (abort) throw new Error("abort")
            })
        } catch {}
        return detector
    }
    const aborted = register(true),
        committed = register(false)
    await tick()
    expect(await collect(aborted)).toBe(true)
    expect(await collect(committed)).toBe(true)
    expect(cursors).toHaveLength(2)
    s.dispose()
})
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
            const d = new LeakDetector(payload)
            child.txn(tx => tx.onCommit(() => payload.n))
            return d
        })()
        child.dispose()
        expect(await collect(detector)).toBe(true)
    } finally {
        globalThis.queueMicrotask = original
        for (const run of held) queueMicrotask(run)
        root.dispose()
        await tick()
    }
})
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
            const d = new LeakDetector(payload)
            child.txn(tx => tx.onCommit(() => payload.n))
            return d
        })()
        // Later publications add recovery attempts in the exhausted generation.
        for (let i = 0; i < 3; i++) {
            other.txn(tx => tx.onCommit(() => {}))
            await flush()
        }
        child.dispose()
        expect(await collect(detector)).toBe(true)
        // Keep all host closures alive, including old generations, during GC.
        for (const task of tasks.slice().reverse()) {
            task()
            task()
        }
        expect(await collect(detector)).toBe(true)
    } finally {
        root.dispose()
        other.dispose()
        globalThis.setTimeout = timer
        for (const task of tasks) task()
        await tick()
    }
})
