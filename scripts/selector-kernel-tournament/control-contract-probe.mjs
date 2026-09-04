// Read-only diagnosis of the frozen public control contract. This emits facts,
// never conformance passes, performance samples, or candidate decisions.
import * as api from "valdres"
const target = api.store()
let contextType = "not-called"
let asyncResult
try {
    target.get(
        api.selector((_get, context) => {
            contextType = typeof context
            return Promise.resolve(1)
        }),
    )
    asyncResult = { returned: true }
} catch (error) {
    asyncResult = { name: error.name, message: error.message }
}
let a, b
a = api.selector(get => get(b), { name: "a" })
b = api.selector(get => get(a), { name: "b" })
const id = state => (state === a ? "a" : state === b ? "b" : null)
const cycleErrors = []
try {
    target.get(a)
} catch (error) {
    const seen = new Set()
    while (error !== undefined && error !== null && !seen.has(error)) {
        seen.add(error)
        cycleErrors.push({
            name: error.name,
            selector: id(error.selector),
            path: Array.isArray(error.path) ? error.path.map(id) : null,
        })
        error = error.cause
    }
}
console.log(
    JSON.stringify(
        {
            kind: "foundation-control-contract-diagnostic",
            runtime: typeof Bun === "undefined" ? "node" : "bun",
            asyncResult,
            contextType,
            globalAtom: typeof api.globalAtom,
            onChange: typeof target.onChange,
            onCommitEnd: typeof target.onCommitEnd,
            scopeDetach: typeof target.scope("probe").detach,
            cycleErrors,
        },
        null,
        2,
    ),
)
target.dispose()
