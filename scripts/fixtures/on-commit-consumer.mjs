import { strict as assert } from "node:assert"
import {
    atom,
    store,
    TransactionClosedError,
    TransactionPhaseError,
    CallbackCapabilityError,
    SubscriberNotificationError,
} from "valdres"

const tick = () => new Promise(resolve => setTimeout(resolve, 5))
const root = store()
const child = root.scope("editor")
const value = atom(0)
const log = []
let cursor
root.sub(value, () => {
    assert.throws(() => root.set(value, 10), CallbackCapabilityError)
    log.push("notify")
})
assert.equal(
    root.txn(tx => {
        cursor = tx
        assert.throws(() => root.get(value), TransactionPhaseError)
        tx.set(value, 1)
        assert.equal(
            tx.onCommit(() => {
                assert.throws(() => cursor.get(value), TransactionClosedError)
                log.push("commit:" + root.get(value))
                root.txn(next => next.set(atom(0), 2))
            }),
            undefined,
        )
        return 42
    }),
    42,
)
assert.deepEqual(log, ["notify"])
root.set(value, 2)
await tick()
assert.deepEqual(log, ["notify", "notify", "commit:2"])

assert.throws(
    () =>
        child.txn(tx => {
            tx.scope(root).onCommit(() => log.push("aborted root"))
            throw new Error("abort")
        }),
    /abort/,
)
child.txn(tx => {
    tx.onCommit(() => log.push("disposed child"))
    tx.scope(root).onCommit(() => log.push("root lifetime"))
    tx.resetAll()
})
child.dispose()
root.txn(tx => tx.onCommit(() => log.push("noop")))
await tick()
assert.deepEqual(log.slice(3), ["root lifetime", "noop"])

const error = new Error("notification failed")
const stop = root.sub(value, () => {
    throw error
})
assert.throws(
    () =>
        root.txn(tx => {
            tx.set(value, 3)
            tx.onCommit(() => log.push("committed despite error"))
        }),
    SubscriberNotificationError,
)
stop()
await tick()
assert.equal(log.at(-1), "committed despite error")

const previous = globalThis.reportError
const failures = []
globalThis.reportError = error => failures.push(error)
try {
    const failure = new Error("callback failed")
    root.txn(tx => {
        tx.onCommit(() => {
            throw failure
        })
        tx.onCommit(() => Promise.reject(failure))
        tx.onCommit(() => log.push("after failures"))
    })
    await tick()
    assert.deepEqual(failures, [failure, failure])
    assert.equal(log.at(-1), "after failures")
} finally {
    globalThis.reportError = previous
    root.dispose()
}
console.log("ON_COMMIT_OK")
