// Reproduction only. No production imports in the queue/direct/released cases.
import assert from "node:assert/strict"
const stage = process.env.REPRO_STAGE
const retain = process.env.REPRO_RETAIN === "1"
let started = 0
let pending
let active

// The synchronous wrapper intentionally has separate parameter/block lexical
// environments, like #transact. A retained handle does not reference its caller.
function invoke(operation) {
    const previous = active
    active = true
    try { return operation() } finally { active = previous }
}
function drain() {
    for (let i = 0; pending && i < pending.length; i++) {
        const callback = pending[i]
        pending[i] = undefined
        callback()
    }
    pending = undefined
}
function enqueue(callback) {
    if (!pending) { pending = []; queueMicrotask(drain) }
    pending.push(callback)
}
function withQueue(callback) {
    try {
        const cursor = { push: enqueue }
        return invoke(() => callback(cursor))
    } finally { /* no owner retained here */ }
}
export async function runCase(Detector, phase, createStore) {
    const cursors = []
    const s = stage === "valdres" ? createStore() : undefined
    // This function returns only a detector containing a WeakRef. Payloads and
    // callbacks never become locals in this awaiting frame or diagnostic buffers.
    function register(abort) {
        const payload = { n: 1 }
        const detector = new Detector(payload, abort ? "aborted" : "committed")
        if (stage === "valdres") {
            try {
                s.txn(tx => {
                    cursors.push(tx)
                    const callback = () => { started++; phase("committed", "callback-start"); return payload.n }
                    if (!abort && retain) globalThis.__reproRetainedCallback = callback
                    tx.onCommit(callback)
                    if (abort) throw Error("abort")
                })
            } catch (error) { if (error.message !== "abort") throw error }
        } else if (stage === "queue") {
            withQueue(cursor => {
                cursors.push(cursor)
                const callback = () => { started++; phase("committed", "callback-start"); return payload.n }
                if (!abort && retain) globalThis.__reproRetainedCallback = callback
                if (!abort) cursor.push(callback)
            })
        } else if (stage === "direct") {
            const callback = () => { started++; phase("committed", "callback-start"); return payload.n }
            if (!abort && retain) globalThis.__reproRetainedCallback = callback
            if (!abort) queueMicrotask(callback)
        } else if (stage === "released") {
            if (!abort && retain) globalThis.__reproRetainedObject = payload
        } else throw Error(`Unknown stage ${stage}`)
        return detector
    }
    phase("test", "start")
    const aborted = register(true), committed = register(false)
    phase("test", "registrations-complete-wait-enter")
    await new Promise(resolve => setTimeout(resolve, 5))
    phase("test", "wait-return-collection-enter")
    assert.equal(started, stage === "released" ? 0 : 1, "exact callback starts")
    async function collect(detector, label) {
        for (let n = 0; n < 3; n++) {
            phase(label, "collection-await-enter", n)
            const leaking = await detector.isLeaking(undefined, label)
            phase(label, leaking ? "collection-await-return-live" : "collection-await-return-collected", n)
            if (!leaking) return true
        }
        return false
    }
    assert.equal(await collect(aborted, "aborted"), true, "aborted capture must collect")
    assert.equal(await collect(committed, "committed"), true, "committed capture must collect")
    assert.equal(cursors.length, stage === "valdres" || stage === "queue" ? 2 : 0)
    if (s) s.dispose()
    phase("test", "complete")
}
