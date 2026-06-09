import { describe, test, expect, mock, spyOn } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { trackScopeValue } from "./setValueInData"

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe("deep nesting (4+ levels)", () => {
    test("grandparent atom read from great-grandchild walks the chain", () => {
        const A = store("A")
        const B = A.scope("B")
        const C = B.scope("C")
        const D = C.scope("D")
        const E = D.scope("E")

        const greeting = atom("hello")
        A.set(greeting, "from-A")

        // E reads through 4 ancestors back to A
        expect(E.get(greeting)).toBe("from-A")
        // No intermediate scope shadowed it, so the value lives only on A
        expect(A.data.values.has(greeting)).toBe(true)
        expect(B.data.values.has(greeting)).toBe(false)
        expect(C.data.values.has(greeting)).toBe(false)
        expect(D.data.values.has(greeting)).toBe(false)
        expect(E.data.values.has(greeting)).toBe(false)
    })

    test("shadow at mid-level masks ancestor for descendants only", () => {
        const A = store("A")
        const B = A.scope("B")
        const C = B.scope("C")
        const D = C.scope("D")
        const E = D.scope("E")

        const counter = atom(0)
        A.set(counter, 1)
        C.set(counter, 100) // shadow at C — D and E see 100, A and B see 1

        expect(A.get(counter)).toBe(1)
        expect(B.get(counter)).toBe(1)
        expect(C.get(counter)).toBe(100)
        expect(D.get(counter)).toBe(100)
        expect(E.get(counter)).toBe(100)
    })

    test("update at root propagates to subscriber 4 levels deep", () => {
        const A = store("A")
        const B = A.scope("B")
        const C = B.scope("C")
        const D = C.scope("D")
        const E = D.scope("E")

        const a = atom(1)
        const sel = selector(get => get(a) * 10)

        const eCallback = mock(() => {})
        E.sub(sel, eCallback)
        expect(E.get(sel)).toBe(10)

        A.set(a, 5)
        expect(eCallback).toHaveBeenCalledTimes(1)
        expect(E.get(sel)).toBe(50)

        A.set(a, 7)
        expect(eCallback).toHaveBeenCalledTimes(2)
        expect(E.get(sel)).toBe(70)
    })

    test("shadow at level 3 stops propagation from root to level 5", () => {
        const A = store("A")
        const B = A.scope("B")
        const C = B.scope("C")
        const D = C.scope("D")
        const E = D.scope("E")

        const a = atom(1)
        const sel = selector(get => get(a))

        const eCallback = mock(() => {})
        E.sub(sel, eCallback)

        // C shadows — E now reads from C, not A
        C.set(a, 100)
        expect(eCallback).toHaveBeenCalledTimes(1)
        expect(E.get(sel)).toBe(100)

        // Root change should NOT reach E because C is shadowing
        A.set(a, 2)
        expect(eCallback).toHaveBeenCalledTimes(1)
        expect(E.get(sel)).toBe(100)

        // But changing C does propagate
        C.set(a, 200)
        expect(eCallback).toHaveBeenCalledTimes(2)
        expect(E.get(sel)).toBe(200)
    })

    test("selector with two atoms — one from root, one from mid-level — re-evaluates correctly", () => {
        const A = store("A")
        const B = A.scope("B")
        const C = B.scope("C")
        const D = C.scope("D")

        const a1 = atom(1) // stays in A
        const a2 = atom(10)
        A.set(a2, 10)
        B.set(a2, 20) // shadow in B

        const sumSel = selector(get => get(a1) + get(a2))

        const dCallback = mock(() => {})
        D.sub(sumSel, dCallback)
        // D inherits a1 from A (1) and a2 from B (20)
        expect(D.get(sumSel)).toBe(21)

        A.set(a1, 5)
        expect(dCallback).toHaveBeenCalledTimes(1)
        expect(D.get(sumSel)).toBe(25)

        B.set(a2, 30)
        expect(dCallback).toHaveBeenCalledTimes(2)
        expect(D.get(sumSel)).toBe(35)
    })
})

describe("family deletion across scope levels", () => {
    test("root del propagates 3 levels down through chained scope family indexes", () => {
        const A = store("A")
        const family = atomFamily<string>(undefined, { name: "f" })
        const m1 = family("a")
        const m2 = family("b")
        const m3 = family("c")

        A.set(m1, "1")
        A.set(m2, "2")
        A.set(m3, "3")

        const B = A.scope("B")
        const C = B.scope("C")
        const D = C.scope("D")

        // D adds its own member, forcing creation of family indexes
        // up the chain in B, C, D
        D.set(family("d-only"), "D")

        const countSel = selector(get => get(family).length, { name: "count" })

        expect(A.get(countSel)).toBe(3)
        expect(D.get(countSel)).toBe(4)

        const dCallback = mock(() => {})
        D.sub(countSel, dCallback)

        // Delete at the root — must walk down to D's family index
        A.del(m2)

        expect(dCallback).toHaveBeenCalledTimes(1)
        expect(A.get(countSel)).toBe(2)
        expect(D.get(countSel)).toBe(3)
    })

    test("scope shadows a member then root deletes it — scope retains its shadowed value", () => {
        const A = store("A")
        const family = atomFamily<string>(undefined, { name: "shadowFam" })
        const k = family("k")

        A.set(k, "root-val")

        const B = A.scope("B")
        B.set(k, "scope-val") // shadow

        expect(A.get(k)).toBe("root-val")
        expect(B.get(k)).toBe("scope-val")

        const bCallback = mock(() => {})
        B.sub(k, bCallback)

        A.del(k)

        // B's shadow keeps the value alive locally; B sees its own value still.
        expect(B.get(k)).toBe("scope-val")
        // B is not notified — its visible value didn't change.
        expect(bCallback).toHaveBeenCalledTimes(0)
    })

    test("root del of a member re-evaluates a descendant scope's selector that reads the member directly", () => {
        const A = store("A")
        const family = atomFamily<string, [string]>("DEFAULT", {
            name: "memberFam",
        })
        const member = family("a")
        A.set(member, "root-val")

        const B = A.scope("B")

        // The selector reads the FAMILY MEMBER directly (not get(family)).
        const sel = selector(get => `sel:${get(member)}`, { name: "memberSel" })

        const aCb = mock(() => {})
        const bCb = mock(() => {})
        A.sub(sel, aCb)
        B.sub(sel, bCb) // B inherits member from A — no shadow

        expect(A.get(sel)).toBe("sel:root-val")
        expect(B.get(sel)).toBe("sel:root-val")

        A.del(member)

        // Root subscriber fires and its value updates.
        expect(aCb).toHaveBeenCalledTimes(1)
        expect(A.get(sel)).toBe("sel:DEFAULT")

        // Descendant scope: its selector must re-evaluate and its subscriber fire.
        expect(bCb).toHaveBeenCalledTimes(1)
        expect(B.get(sel)).toBe("sel:DEFAULT")
    })

    test("txn del of a member re-evaluates a descendant scope's selector that reads the member directly", () => {
        const A = store("A")
        const family = atomFamily<string, [string]>("DEFAULT", {
            name: "memberFamTxn",
        })
        const member = family("a")
        A.set(member, "root-val")

        const B = A.scope("B")

        const sel = selector(get => `sel:${get(member)}`, {
            name: "memberSelTxn",
        })

        const aCb = mock(() => {})
        const bCb = mock(() => {})
        A.sub(sel, aCb)
        B.sub(sel, bCb)

        expect(A.get(sel)).toBe("sel:root-val")
        expect(B.get(sel)).toBe("sel:root-val")

        A.txn(({ del }) => del(member))

        expect(aCb).toHaveBeenCalledTimes(1)
        expect(A.get(sel)).toBe("sel:DEFAULT")
        expect(bCb).toHaveBeenCalledTimes(1)
        expect(B.get(sel)).toBe("sel:DEFAULT")
    })

    test("root del of a member re-evaluates an inheriting selector 3 scopes deep", () => {
        const A = store("A")
        const family = atomFamily<string, [string]>("DEFAULT", {
            name: "deepMemberFam",
        })
        const member = family("a")
        A.set(member, "root-val")

        const B = A.scope("B")
        const C = B.scope("C")
        const D = C.scope("D")

        const sel = selector(get => `sel:${get(member)}`, {
            name: "deepMemberSel",
        })
        const dCb = mock(() => {})
        D.sub(sel, dCb) // D inherits member through B and C — no shadow anywhere

        expect(D.get(sel)).toBe("sel:root-val")

        A.del(member)

        expect(dCb).toHaveBeenCalledTimes(1)
        expect(D.get(sel)).toBe("sel:DEFAULT")
    })

    test("member shadowed at an intermediate scope masks a root del from deeper scopes", () => {
        const A = store("A")
        const family = atomFamily<string, [string]>("DEFAULT", {
            name: "maskMemberFam",
        })
        const member = family("a")
        A.set(member, "root-val")

        const B = A.scope("B")
        const C = B.scope("C")
        B.set(member, "B-val") // B shadows — C reads B's value, not root's

        const sel = selector(get => `sel:${get(member)}`, {
            name: "maskMemberSel",
        })
        const cCb = mock(() => {})
        C.sub(sel, cCb)
        expect(C.get(sel)).toBe("sel:B-val")

        A.del(member)

        // C's visible value comes from B's shadow, unchanged — no notification.
        expect(cCb).toHaveBeenCalledTimes(0)
        expect(C.get(sel)).toBe("sel:B-val")
    })

    test("delete from mid-scope does not affect siblings", () => {
        const A = store("A")
        const family = atomFamily<string>(undefined, { name: "sibFam" })
        A.set(family("x"), "x-root")

        const B1 = A.scope("B1")
        const B2 = A.scope("B2")

        // B1 adds a member — clones family into B1's chain
        B1.set(family("y"), "B1-y")
        // B2 adds a different member — clones into B2
        B2.set(family("z"), "B2-z")

        const countSel = selector(get => get(family).length)

        expect(B1.get(countSel)).toBe(2) // x + y
        expect(B2.get(countSel)).toBe(2) // x + z

        // Delete y at B1
        B1.del(family("y"))

        expect(B1.get(countSel)).toBe(1) // x
        // B2 unaffected
        expect(B2.get(countSel)).toBe(2) // x + z
        // Root unaffected
        expect(A.get(countSel)).toBe(1) // x
    })
})

describe("subscribe / unsubscribe / resubscribe across scopes", () => {
    test("subscribe in scope, unsubscribe, then resubscribe — parent-chain wiring still correct", () => {
        const A = store("A")
        const B = A.scope("B")

        const a = atom(0)
        const sel = selector(get => get(a) + 1)

        const cb1 = mock(() => {})
        const unsub1 = B.sub(sel, cb1)
        expect(B.get(sel)).toBe(1)

        A.set(a, 10)
        expect(cb1).toHaveBeenCalledTimes(1)
        expect(B.get(sel)).toBe(11)

        unsub1()

        // After unsub, an update at root should NOT call cb1 again
        A.set(a, 20)
        expect(cb1).toHaveBeenCalledTimes(1)

        // Re-subscribe a fresh callback — the parent-chain wiring should
        // re-initialize cleanly.
        const cb2 = mock(() => {})
        const unsub2 = B.sub(sel, cb2)
        expect(B.get(sel)).toBe(21)

        A.set(a, 30)
        expect(cb2).toHaveBeenCalledTimes(1)
        expect(B.get(sel)).toBe(31)
        // cb1 still not re-fired
        expect(cb1).toHaveBeenCalledTimes(1)

        unsub2()
    })

    test("scope subscription delegates to parent until scope writes — then re-roots", () => {
        const A = store("A")
        const B = A.scope("B")

        const a = atom("init")
        const cb = mock(() => {})
        B.sub(a, cb)

        // Until B writes, B's subscription is registered up at A
        expect(A.data.subscriptions.get(a)?.size).toBe(1)
        expect(B.data.subscriptions.get(a)?.size).toBe(1)

        // Root write notifies B's callback through the delegated subscription
        A.set(a, "from-A")
        expect(cb).toHaveBeenCalledTimes(1)

        // Now B writes — should "re-root" the subscription to live in B
        B.set(a, "from-B")
        expect(cb).toHaveBeenCalledTimes(2)

        // Subsequent A writes should NOT notify B (B has shadowed the value)
        A.set(a, "from-A-2")
        expect(cb).toHaveBeenCalledTimes(2)

        // But B writes still do
        B.set(a, "from-B-2")
        expect(cb).toHaveBeenCalledTimes(3)
    })

    test("two subscriptions in same scope — unsubscribing one leaves the other functional", () => {
        const A = store("A")
        const B = A.scope("B")

        const a = atom(0)

        const cb1 = mock(() => {})
        const cb2 = mock(() => {})
        const unsub1 = B.sub(a, cb1)
        const unsub2 = B.sub(a, cb2)

        A.set(a, 1)
        expect(cb1).toHaveBeenCalledTimes(1)
        expect(cb2).toHaveBeenCalledTimes(1)

        unsub1()

        A.set(a, 2)
        expect(cb1).toHaveBeenCalledTimes(1)
        expect(cb2).toHaveBeenCalledTimes(2)

        unsub2()

        A.set(a, 3)
        expect(cb2).toHaveBeenCalledTimes(2)
    })
})

describe("maxAge interaction with scopes", () => {
    test("scope reading a maxAge atom inherits root's cached value, no separate timer", async () => {
        const A = store("A")
        let count = 0
        const a = atom(() => ++count, { maxAge: 20 })

        const B = A.scope("B")

        // Root subscribes — this installs the maxAge timer at root
        const aCb = mock(() => {})
        const unsub = A.sub(a, aCb)

        expect(A.get(a)).toBe(1)
        expect(B.get(a)).toBe(1) // inherits from A

        // Wait long enough for the timer to fire twice
        await wait(60)
        unsub()

        // Multiple ticks should have happened at root and B reads the latest
        expect(count).toBeGreaterThan(1)
        const latest = A.get(a)
        expect(B.get(a)).toBe(latest)
    })

    test("scope.set(maxAgeAtom, value) pins the value — no scope-local timer runs", async () => {
        // Setting a maxAge atom in a scope is a deliberate override. No
        // scope-local revalidation timer is installed even when the scope
        // subscribes, so the shadow survives indefinitely.
        const A = store("A")
        let count = 0
        const a = atom(() => ++count, { maxAge: 15 })

        const B = A.scope("B")
        B.set(a, 999)
        expect(B.data.values.get(a)).toBe(999)

        const bUnsub = B.sub(a, () => {})

        await wait(50)
        bUnsub()

        // B's shadow survived — no scope-local timer overwrote it.
        expect(B.data.values.get(a)).toBe(999)
        expect(B.get(a)).toBe(999)
        // defaultValue() ran only during set() initialization (to read the
        // prior value), not from any scope-local revalidation tick.
        expect(count).toBe(1)
    })

    test("scope.set on maxAge atom: shadow survives past the freshness window without a subscriber", async () => {
        // The lazy revalidation eviction in isCachedValueStale is skipped
        // for scoped stores. Without this, an unsubscribed scope shadow
        // would be dropped on the next stale read and silently fall back
        // to the parent.
        const A = store("A")
        let count = 0
        const a = atom(() => ++count, { maxAge: 10 })

        const B = A.scope("B")
        B.set(a, 999)

        const aUnsub = A.sub(a, () => {})
        await wait(40)
        aUnsub()

        // B's shadow is pinned regardless of TTL.
        expect(B.get(a)).toBe(999)
    })

    test("non-shadowed scope read of a maxAge atom inherits root's revalidated value", async () => {
        // No scope shadow: the scope simply walks up to the parent and sees
        // the latest revalidated value. This confirms that the eviction
        // exemption for scopes (in isCachedValueStale) does not break the
        // normal inherited-read path.
        const A = store("A")
        let count = 0
        const a = atom(() => ++count, { maxAge: 20 })

        const B = A.scope("B")

        const aUnsub = A.sub(a, () => {})
        await wait(100)
        aUnsub()

        // Settle the root read FIRST. With no subscriber the timer is stopped,
        // so reading A runs the lazy TTL revalidation (isCachedValueStale) and
        // pins A's freshest value. The scope then walks up and must observe
        // that exact value. Reading A first avoids an evaluation-order race:
        // if `B.get(a)` were evaluated before `A.get(a)`, the scope would read
        // A's still-cached value while the subsequent root read straddled a
        // revalidation tick — an off-by-one that has nothing to do with the
        // inherited-read invariant this test asserts.
        const rootValue = A.get(a)
        const countAfterRoot = count
        expect(B.get(a)).toBe(rootValue)
        // The scope read inherited the parent's value — it did NOT re-evaluate
        // the default in its own context (that would bump count and diverge).
        expect(count).toBe(countAfterRoot)
        expect(count).toBeGreaterThan(1)
    })
})

describe("batchUpdates and scopes", () => {
    test("batchUpdates option is inherited by scopes created via store.scope()", () => {
        const A = store({ id: "A", batchUpdates: true })
        const B = A.scope("B")
        const C = B.scope("C")

        expect(A.data.batchUpdates).toBe(true)
        expect(B.data.batchUpdates).toBe(true)
        expect(C.data.batchUpdates).toBe(true)
    })

    test("batched scope set is observable inside the same microtask via get", async () => {
        const A = store({ id: "A", batchUpdates: true })
        const B = A.scope("B")

        const a = atom(0)
        const cb = mock(() => {})
        B.sub(a, cb)

        B.set(a, 1)
        B.set(a, 2)
        B.set(a, 3)

        // Within sync code, pending txn buffers writes; B.get goes through
        // pending txn to see the in-flight value.
        expect(B.get(a)).toBe(3)
        // Callback has not yet fired because batched commit is queued
        expect(cb).toHaveBeenCalledTimes(0)

        await Promise.resolve()
        await Promise.resolve()

        // After microtasks flush, the subscriber sees the final batched value
        expect(cb).toHaveBeenCalledTimes(1)
        expect(B.get(a)).toBe(3)
    })

    test("non-batched root and batched scope (manual) do not cross-contaminate", async () => {
        // Root non-batched (default), scope option only applies when scopes
        // are auto-created — but here we verify the default behavior:
        // batchUpdates does NOT spontaneously enable on a non-batched root.
        const A = store("A")
        const B = A.scope("B")

        expect(A.data.batchUpdates).toBeUndefined()
        expect(B.data.batchUpdates).toBeUndefined()

        const a = atom(0)
        const cb = mock(() => {})
        B.sub(a, cb)

        // Synchronous writes — should propagate immediately (no batching)
        B.set(a, 1)
        expect(cb).toHaveBeenCalledTimes(1)
        B.set(a, 2)
        expect(cb).toHaveBeenCalledTimes(2)
    })
})

describe("regression: contract guards", () => {
    // Red against the pre-fix code, which used `data.parent!` and
    // `data.scopeIndexKeys!` and would throw a generic TypeError
    // ("Cannot read properties of undefined") instead of a clear,
    // contract-naming error when called on a root store.
    test("trackScopeValue throws a clear error when called on a root store", () => {
        const rootStore = store()
        const a = atom(1)
        expect(() => trackScopeValue(a, rootStore.data)).toThrow(
            "trackScopeValue called on a root store",
        )
    })
})

describe("regression: maxAge: 0 is a valid TTL", () => {
    // The type is `Reactive<number>`, so 0 is well-formed. The pre-fix
    // truthiness checks (`if (!state.maxAge) return`, `&& state.maxAge`,
    // `if (atom.maxAge && ...)`) treated it as unset and skipped the
    // timer install, breaking the only observable contract: subscribing
    // to a maxAge atom installs a setInterval.

    test("subscribe installs maxAge timer for a regular atom with maxAge: 0", () => {
        const setIntervalSpy = spyOn(globalThis, "setInterval")
        const before = setIntervalSpy.mock.calls.length
        const a = atom(0, { maxAge: 0 })
        const s = store()
        const unsub = s.sub(a, () => {})
        try {
            expect(setIntervalSpy.mock.calls.length).toBe(before + 1)
        } finally {
            unsub()
            setIntervalSpy.mockRestore()
        }
    })

    test("attach installs maxAge timer for a global atom with maxAge: 0", () => {
        const setIntervalSpy = spyOn(globalThis, "setInterval")
        const before = setIntervalSpy.mock.calls.length
        const a = atom(0, {
            global: true,
            maxAge: 0,
            name: "@valdres/test/maxage-zero",
        })
        const s = store()
        const unsub = s.sub(a, () => {})
        try {
            expect(setIntervalSpy.mock.calls.length).toBe(before + 1)
        } finally {
            unsub()
            a.detach(s.data)
            setIntervalSpy.mockRestore()
        }
    })
})
