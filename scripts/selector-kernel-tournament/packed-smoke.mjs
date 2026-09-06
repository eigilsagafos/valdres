import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import * as api from "valdres"
import * as adapter from "valdres/adapter-internals/v1"
const { atom, selector, store, family } = api
assert.deepEqual(
    Object.keys(api).sort(),
    [
        "CallbackCapabilityError",
        "InvalidAtomComparatorResultError",
        "InvalidSynchronousAtomValueError",
        "InvalidTransactionCallbackResultError",
        "InvalidTransactionTargetError",
        "RuntimeMismatchError",
        "ScopeNotFoundError",
        "SelectorCapabilityError",
        "SelectorCircularDependencyError",
        "StoreDisposedError",
        "StoreTreeMismatchError",
        "SubscriberNotificationError",
        "TransactionClosedError",
        "TransactionPhaseError",
        "atom",
        "family",
        "selector",
        "store",
    ].sort(),
)
assert.deepEqual(
    Object.keys(adapter).sort(),
    ["assertStore", "read", "readHydrationSnapshot", "subscribe"].sort(),
)
assert.equal(
    Boolean(globalThis[Symbol.for("VALDRES_TOURNAMENT_COUNTER_ARTIFACT_V3")]),
    process.argv[2] === "counter",
)
const target = store()
const source = atom(2)
const doubled = selector(get => get(source) * 2)
adapter.assertStore(target)
assert.equal(adapter.read(target, doubled), 4)
let notifications = 0
const off = adapter.subscribe(target, doubled, () => notifications++)
target.set(source, 3)
assert.equal(notifications, 1)
assert.equal(target.get(doubled), 6)
target.txn(tx => {
    tx.set(source, 4)
    assert.equal(tx.get(doubled), 8)
})
assert.equal(notifications, 2)
assert.throws(
    () =>
        target.txn(tx => {
            tx.set(source, 99)
            throw new Error("abort")
        }),
    /abort/,
)
assert.equal(target.get(source), 4)
const child = target.scope("child")
child.set(source, 10)
assert.equal(child.get(doubled), 20)
assert.equal(target.get(doubled), 8)
// Without a server leaf reader, hydration reads the current committed atom
// outcome through a disposable selector host.
assert.equal(adapter.readHydrationSnapshot(target, doubled), 8)
const members = family(key => atom(key.length))
const derived = family(key => selector(get => get(members(key)) + 1))
assert.equal(target.get(derived("abc")), 4)
assert.equal(members("abc"), members("abc"))
off()
target.dispose()
assert.throws(() => target.get(source), api.StoreDisposedError)
console.log(
    JSON.stringify({
        status: "pass",
        runtime: typeof Bun === "undefined" ? "node" : "bun",
        checks: [
            "root",
            "adapter-domain",
            "subscription",
            "transaction",
            "abort",
            "scope",
            "hydration",
            "family",
            "disposal",
        ],
        exports: Object.keys(api).sort(),
        adapterExports: Object.keys(adapter).sort(),
        rootEntry: fileURLToPath(import.meta.resolve("valdres")),
        rootEntrySha256: createHash("sha256")
            .update(readFileSync(fileURLToPath(import.meta.resolve("valdres"))))
            .digest("hex"),
    }),
)
