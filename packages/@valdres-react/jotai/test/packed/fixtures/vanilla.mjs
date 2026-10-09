// Store semantics through the installed tarballs, without React or a DOM.
import { strict as assert } from "node:assert"
import { atom, createStore, getDefaultStore } from "@valdres-react/jotai"
import * as valdres from "valdres"

const jotai = await import("@valdres-react/jotai")
assert.deepEqual(Object.keys(jotai).sort(), [
    "Provider",
    "atom",
    "createStore",
    "getDefaultStore",
    "useAtom",
    "useAtomValue",
    "useSetAtom",
    "useStore",
])
assert.equal(typeof globalThis.document, "undefined")
assert.equal(typeof valdres.store, "function")

const store = createStore()
const count = atom(1)
const doubled = atom(get => get(count) * 2)
const add = atom(null, (get, set, a, b) => {
    set(count, get(count) + a + b)
    return get(doubled)
})
const trace = []
count.onMount = setCount => {
    trace.push("mount")
    setCount(c => c + 1)
    return () => trace.push("unmount")
}
const unsub = store.sub(doubled, () => trace.push(`doubled ${store.get(doubled)}`))
assert.equal(store.set(add, 1, 2), 10)
unsub()
assert.deepEqual(trace, ["mount", "doubled 4", "doubled 10", "unmount"])
assert.equal(getDefaultStore(), getDefaultStore())

const promise = Promise.resolve(5)
const pending = atom(promise)
const derived = atom(async get => (await get(pending)) + 1)
assert.equal(store.get(pending), promise)
assert.equal(await store.get(derived), 6)

const late = atom(async get => {
    await Promise.resolve()
    return get(count)
})
await assert.rejects(store.get(late), { code: "VALDRES_JOTAI_LATE_GET" })
assert.throws(
    () => store.get(atom((_get, options) => options.signal)),
    { code: "VALDRES_JOTAI_SIGNAL_UNSUPPORTED" },
)
console.log("VANILLA_OK")
