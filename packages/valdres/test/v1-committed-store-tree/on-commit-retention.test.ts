import { expect, test } from "bun:test"
import { store, type Transaction, TransactionClosedError } from "../../src/index"

// GC assertions live in the mandatory fresh-process retention lane. These
// ordinary-suite checks exercise shared scheduler/lifecycle state without GC.
const tick = () => new Promise(resolve => setTimeout(resolve, 5))
const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
}
test("closed cursors reject registration after commit and abort; only commits deliver", async () => {
    const root = store(), cursors: Transaction[] = [], starts: string[] = []
    const abort = new Error("abort")
    expect(() => root.txn(tx => {
        cursors.push(tx)
        tx.onCommit(() => { starts.push("aborted") })
        throw abort
    })).toThrow(abort)
    root.txn(tx => {
        cursors.push(tx)
        tx.onCommit(() => { starts.push("committed") })
    })
    expect(starts).toEqual([])
    for (const cursor of cursors) expect(() => cursor.onCommit(() => {})).toThrow(TransactionClosedError)
    await tick()
    expect(starts).toEqual(["committed"])
    root.dispose()
})

test("disposal cancels held delivery without cancelling another Store", async () => {
    await tick()
    const root = store(), child = root.scope(), other = store()
    const held: (() => void)[] = [], starts: string[] = []
    const original = globalThis.queueMicrotask
    globalThis.queueMicrotask = callback => { held.push(callback) }
    try {
        child.txn(tx => tx.onCommit(() => { starts.push("child") }))
        other.txn(tx => tx.onCommit(() => { starts.push("other") }))
        child.dispose()
        expect(starts).toEqual([])
        for (const wake of held) { wake(); wake() }
        expect(starts).toEqual(["other"])
    } finally {
        globalThis.queueMicrotask = original
        root.dispose(); other.dispose()
        for (const wake of held) queueMicrotask(wake)
        await tick()
    }
})

test("disposed scopes stay cancelled across duplicate refill recovery attempts", async () => {
    await tick()
    const root = store(), child = root.scope(), other = store()
    const tasks: (() => void)[] = [], starts: number[] = []
    const original = globalThis.setTimeout
    globalThis.setTimeout = ((callback: () => void) => { tasks.push(callback); return 0 }) as typeof setTimeout
    try {
        root.txn(tx => {
            for (let i = 0; i < 1100; i++) tx.onCommit(() => { starts.push(i) })
        })
        await flush()
        expect(starts).toHaveLength(1024)
        child.txn(tx => tx.onCommit(() => { starts.push(-1) }))
        for (let i = 1100; i < 1103; i++) {
            other.txn(tx => tx.onCommit(() => { starts.push(i) }))
            await flush()
        }
        child.dispose()
        for (const task of tasks.slice().reverse()) { task(); task() }
        expect(starts).toEqual(Array.from({ length: 1103 }, (_, i) => i))
    } finally {
        root.dispose(); other.dispose()
        globalThis.setTimeout = original
        for (const task of tasks) task()
        await tick()
    }
})
