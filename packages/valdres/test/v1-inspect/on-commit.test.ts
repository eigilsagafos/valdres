import { expect, test } from "bun:test"
import { atom } from "../../src/index"
import { createInspectableStore } from "../../src/inspect"

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 5))

test("commit callbacks create no intents; their Store work records a later operation", async () => {
    const { store: target, inspect } = createInspectableStore()
    const value = atom(0)
    let ran = false
    inspect.reset()
    target.txn(tx =>
        tx.onCommit(() => {
            ran = true
            target.set(value, 1)
        }),
    )
    const before = inspect.export()
    expect(ran).toBe(false)
    const initial = before.summaries.filter(s => s.type === "operation")
    expect(initial).toHaveLength(1)
    expect(initial[0]).toMatchObject({
        operation: "transaction",
        result: "returned",
        effect: "none",
    })
    const commits = before.summaries.filter(s => s.type === "commit")
    // Ordinary no-op transactions record an operation without a commit summary.
    expect(commits).toHaveLength(0)
    await tick()
    const report = inspect.export()
    const operations = report.summaries.filter(s => s.type === "operation")
    expect(operations).toHaveLength(2)
    expect(operations[1]).toMatchObject({
        operation: "set",
        result: "returned",
        effect: "committed",
    })
    expect(operations[1]!.operationId).not.toBe(initial[0]!.operationId)
    expect(operations[1]!.seqStart).toBeGreaterThan(initial[0]!.seqEnd)
    expect(report.fault).toBeUndefined()
    expect(JSON.parse(JSON.stringify(report))).toEqual(report)
    target.dispose()
})

test("callback failure stays outside the successful operation's inspection record", async () => {
    const { store: target, inspect } = createInspectableStore()
    const previous = globalThis.reportError
    const failures: unknown[] = []
    const error = new Error("commit callback failed")
    globalThis.reportError = error => failures.push(error)
    try {
        inspect.reset()
        target.txn(tx =>
            tx.onCommit(() => {
                throw error
            }),
        )
        const before = inspect.export()
        await tick()
        expect(failures).toEqual([error])
        expect(inspect.export()).toEqual(before)
    } finally {
        globalThis.reportError = previous
        target.dispose()
    }
})
