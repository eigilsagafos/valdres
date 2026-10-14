import { afterAll, afterEach, expect } from "bun:test"
import { atom, collection, store, TransactionClosedError, type Transaction } from "../../src/index"

// Retain relevant prior state across all GC cases, never their target objects.
// Bounded preparation, not a random stress/timing loop or extra GC pass.
const root = store(), sibling = root.scope("surviving-owner")
const rows = collection<string, number>()
const value = atom(0), cursors: Transaction[] = []
const abort = new Error("expected warmup abort")
for (let i = 0; i < 64; i++) {
    const child = root.scope()
    const row = rows(`history-${i}`)
    child.txn(tx => { cursors.push(tx); tx.set(row, i) })
    child.reset(row)
    child.dispose()
    expect(() => root.txn(tx => {
        cursors.push(tx); tx.set(value, -1); throw abort
    })).toThrow(abort)
}
root.set(value, 7)
sibling.set(value, 8)
root.set(rows("present-control"), 1)
sibling.delete(rows("absent-control"))
// Cross multiple budget generations before, then retain closed cursors during,
// the collection cases. Held/duplicate/reversed host callbacks are exercised
// by pending-disposal and refill-disposal themselves.
let starts = 0
await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error("Accumulated scheduler setup did not finish within 5000ms")), 5000)
    root.txn(tx => {
        cursors.push(tx)
        for (let i = 0; i < 2200; i++) tx.onCommit(() => {
            if (++starts === 2200) { clearTimeout(deadline); resolve() }
        })
    })
})
const check = () => {
    expect(starts).toBe(2200)
    expect(root.get(value)).toBe(7)
    expect(sibling.get(value)).toBe(8)
    expect(root.get(rows("present-control"))).toBe(1)
    expect(sibling.get(rows("absent-control"))).toBeUndefined()
    expect(cursors).toHaveLength(129)
    for (const cursor of cursors) expect(() => cursor.onCommit(() => {})).toThrow(TransactionClosedError)
}
check()
afterEach(check)
afterAll(() => { check(); root.dispose() })
