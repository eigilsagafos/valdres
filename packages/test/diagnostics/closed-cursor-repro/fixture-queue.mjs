// Minimal lifetime model: synchronous callback wrapper -> callback -> payload;
// retained handles own an emptied batch. No Valdres import or Store/transaction.
let pending
function drain() {
    for (let i = 0; pending && i < pending.length; i++) {
        const callback = pending[i]
        pending[i] = undefined
        callback()
    }
    pending = undefined
}
function invoke(operation) { return operation() }
export function dispatch(callback) {
    const batch = []
    try {
        const cursor = { push: callback => batch.push(callback) }
        const result = invoke(() => callback(cursor))
        if (batch.length) {
            if (!pending) { pending = []; queueMicrotask(drain) }
            pending.push(...batch)
        }
        return result
    } finally { batch.length = 0 }
}
