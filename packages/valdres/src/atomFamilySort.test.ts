import { describe, expect, mock, test } from "bun:test"
import { atomFamily } from "./atomFamily"
import { atomFamilySort } from "./atomFamilySort"
import { store } from "./store"

describe("atomFamilySort", () => {
    test("ascending sort by extracted key", () => {
        const s = store()
        const post = atomFamily<{ createdAt: number }, [string]>(null, {
            name: "posts",
        })
        const byDate = atomFamilySort(post, p => p.createdAt, {
            name: "byDate",
        })

        s.set(post("a"), { createdAt: 30 })
        s.set(post("b"), { createdAt: 10 })
        s.set(post("c"), { createdAt: 20 })

        expect(
            s.get(byDate).map(atom => atom.familyArgsStringified),
        ).toEqual(["b", "c", "a"])
    })

    test("descending sort", () => {
        const s = store()
        const post = atomFamily<{ createdAt: number }, [string]>(null, {
            name: "posts",
        })
        const byDateDesc = atomFamilySort(post, p => p.createdAt, {
            direction: "desc",
        })

        s.set(post("a"), { createdAt: 30 })
        s.set(post("b"), { createdAt: 10 })
        s.set(post("c"), { createdAt: 20 })

        expect(
            s.get(byDateDesc).map(atom => atom.familyArgsStringified),
        ).toEqual(["a", "c", "b"])
    })

    test("key change moves position", () => {
        const s = store()
        const post = atomFamily<{ createdAt: number }, [string]>(null, {
            name: "posts",
        })
        const byDate = atomFamilySort(post, p => p.createdAt)

        s.set(post("a"), { createdAt: 10 })
        s.set(post("b"), { createdAt: 20 })
        s.set(post("c"), { createdAt: 30 })
        expect(
            s.get(byDate).map(atom => atom.familyArgsStringified),
        ).toEqual(["a", "b", "c"])

        // Move "a" to the end
        s.set(post("a"), { createdAt: 40 })
        expect(
            s.get(byDate).map(atom => atom.familyArgsStringified),
        ).toEqual(["b", "c", "a"])
    })

    test("same-key write does not re-run extractor", () => {
        const s = store()
        const post = atomFamily<{ createdAt: number }, [string]>(null, {
            name: "posts",
        })
        const extractor = mock((p: { createdAt: number }) => p.createdAt)
        const byDate = atomFamilySort(post, extractor)

        s.set(post("a"), { createdAt: 10 })
        expect(extractor).toHaveBeenCalledTimes(1)

        // Deep-equal write — setAtom equality short-circuit prevents the
        // hook from firing, so the extractor must not re-run.
        s.set(post("a"), { createdAt: 10 })
        expect(extractor).toHaveBeenCalledTimes(1)
    })

    test("extractor returning null/undefined excludes atom", () => {
        const s = store()
        const post = atomFamily<{ createdAt: number | null }, [string]>(
            null,
            { name: "posts" },
        )
        const byDate = atomFamilySort(post, p => p.createdAt)

        s.set(post("a"), { createdAt: 10 })
        s.set(post("b"), { createdAt: null })
        s.set(post("c"), { createdAt: 20 })

        expect(
            s.get(byDate).map(atom => atom.familyArgsStringified),
        ).toEqual(["a", "c"])
    })

    test("atom transitions in/out of the view via key updates", () => {
        const s = store()
        const post = atomFamily<{ createdAt: number | null }, [string]>(
            null,
            { name: "posts" },
        )
        const byDate = atomFamilySort(post, p => p.createdAt)

        s.set(post("a"), { createdAt: 10 })
        s.set(post("b"), { createdAt: null })
        expect(
            s.get(byDate).map(atom => atom.familyArgsStringified),
        ).toEqual(["a"])

        // Give "b" a key — joins the view
        s.set(post("b"), { createdAt: 5 })
        expect(
            s.get(byDate).map(atom => atom.familyArgsStringified),
        ).toEqual(["b", "a"])

        // Remove "a" from the view via null
        s.set(post("a"), { createdAt: null })
        expect(
            s.get(byDate).map(atom => atom.familyArgsStringified),
        ).toEqual(["b"])
    })

    test("stable tiebreak on equal keys", () => {
        const s = store()
        const post = atomFamily<{ createdAt: number }, [string]>(null, {
            name: "posts",
        })
        const byDate = atomFamilySort(post, p => p.createdAt)

        s.set(post("c"), { createdAt: 10 })
        s.set(post("a"), { createdAt: 10 })
        s.set(post("b"), { createdAt: 10 })

        // All keys equal — order falls back to familyArgsStringified
        expect(
            s.get(byDate).map(atom => atom.familyArgsStringified),
        ).toEqual(["a", "b", "c"])
    })

    test("store.del removes from sorted view", () => {
        const s = store()
        const post = atomFamily<{ createdAt: number }, [string]>(null, {
            name: "posts",
        })
        const byDate = atomFamilySort(post, p => p.createdAt)

        s.set(post("a"), { createdAt: 10 })
        s.set(post("b"), { createdAt: 20 })
        s.set(post("c"), { createdAt: 30 })

        s.del(post("b"))
        expect(
            s.get(byDate).map(atom => atom.familyArgsStringified),
        ).toEqual(["a", "c"])
    })

    test("subscriber fires on writes that change the sort", () => {
        const s = store()
        const post = atomFamily<{ createdAt: number }, [string]>(null, {
            name: "posts",
        })
        const byDate = atomFamilySort(post, p => p.createdAt)

        const cb = mock(() => {})
        s.sub(byDate, cb)

        s.set(post("a"), { createdAt: 10 })
        expect(cb).toHaveBeenCalledTimes(1)
        s.set(post("b"), { createdAt: 20 })
        expect(cb).toHaveBeenCalledTimes(2)

        // Same-key write — should not fire
        s.set(post("a"), { createdAt: 10 })
        expect(cb).toHaveBeenCalledTimes(2)
    })

    test("transaction batch — subscribers fire once at commit", () => {
        const s = store()
        const post = atomFamily<{ createdAt: number }, [string]>(null, {
            name: "posts",
        })
        const byDate = atomFamilySort(post, p => p.createdAt)

        const cb = mock(() => {})
        s.sub(byDate, cb)

        s.txn(({ set }) => {
            set(post("a"), { createdAt: 10 })
            set(post("b"), { createdAt: 20 })
        })

        expect(cb).toHaveBeenCalledTimes(1)
        expect(
            s.get(byDate).map(atom => atom.familyArgsStringified),
        ).toEqual(["a", "b"])
    })

    test("late subscriber sees current view via onInit", () => {
        const s = store()
        const post = atomFamily<{ createdAt: number }, [string]>(null, {
            name: "posts",
        })
        const byDate = atomFamilySort(post, p => p.createdAt)

        s.set(post("a"), { createdAt: 30 })
        s.set(post("b"), { createdAt: 10 })

        // First read — onInit populates from storage
        expect(
            s.get(byDate).map(atom => atom.familyArgsStringified),
        ).toEqual(["b", "a"])
    })

    describe("scoped stores", () => {
        test("scope reads see root sort", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ createdAt: number }, [string]>(null, {
                name: "posts",
            })
            const byDate = atomFamilySort(post, p => p.createdAt)

            root.set(post("a"), { createdAt: 10 })
            root.set(post("b"), { createdAt: 20 })

            expect(
                child.get(byDate).map(atom => atom.familyArgsStringified),
            ).toEqual(["a", "b"])
        })

        test("scope-local writes don't leak to root", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ createdAt: number }, [string]>(null, {
                name: "posts",
            })
            const byDate = atomFamilySort(post, p => p.createdAt)

            child.set(post("a"), { createdAt: 10 })
            expect(child.get(byDate)).toHaveLength(1)
            expect(root.get(byDate)).toHaveLength(0)
        })

        test("scope override changes position only in scope", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ createdAt: number }, [string]>(null, {
                name: "posts",
            })
            const byDate = atomFamilySort(post, p => p.createdAt)

            root.set(post("a"), { createdAt: 10 })
            root.set(post("b"), { createdAt: 20 })
            // Child reorders by re-keying "a" to be last
            child.set(post("a"), { createdAt: 30 })

            expect(
                root.get(byDate).map(atom => atom.familyArgsStringified),
            ).toEqual(["a", "b"])
            expect(
                child.get(byDate).map(atom => atom.familyArgsStringified),
            ).toEqual(["b", "a"])
        })

        test("parent write after child write updates child view", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ createdAt: number }, [string]>(null, {
                name: "posts",
            })
            const byDate = atomFamilySort(post, p => p.createdAt)

            child.set(post("c"), { createdAt: 20 })
            expect(
                child.get(byDate).map(atom => atom.familyArgsStringified),
            ).toEqual(["c"])

            root.set(post("r"), { createdAt: 10 })
            expect(
                child.get(byDate).map(atom => atom.familyArgsStringified),
            ).toEqual(["r", "c"])
        })

        test("child subscriber fires when parent writes after child has its own state", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ createdAt: number }, [string]>(null, {
                name: "posts",
            })
            const byDate = atomFamilySort(post, p => p.createdAt)

            child.set(post("c"), { createdAt: 20 })

            const cb = mock(() => {})
            child.sub(byDate, cb)

            root.set(post("r"), { createdAt: 10 })
            expect(cb).toHaveBeenCalledTimes(1)
        })

        test("subscriber on root does not fire when child writes", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ createdAt: number }, [string]>(null, {
                name: "posts",
            })
            const byDate = atomFamilySort(post, p => p.createdAt)

            const cb = mock(() => {})
            root.sub(byDate, cb)

            child.set(post("c"), { createdAt: 10 })
            expect(cb).toHaveBeenCalledTimes(0)
            expect(root.get(byDate)).toHaveLength(0)
        })
    })

    describe("result atom lifecycle", () => {
        test("last subscriber unmount drops cached array from data.values", () => {
            const s = store()
            const post = atomFamily<{ createdAt: number }, [string]>(null, {
                name: "posts",
            })
            const byDate = atomFamilySort(post, p => p.createdAt)
            s.set(post("1"), { createdAt: 1 })

            const unsub = s.sub(byDate, () => {})
            s.get(byDate)
            expect(s.data.values.has(byDate)).toBe(true)

            unsub()
            expect(s.data.values.has(byDate)).toBe(false)

            // Re-subscribe re-populates correctly
            const unsub2 = s.sub(byDate, () => {})
            expect(s.get(byDate).map(a => a.familyArgsStringified)).toEqual(
                ["1"],
            )
            unsub2()
        })
    })

    describe("tiebreak under desc direction (S7)", () => {
        test("equal keys tiebreak ascending under desc", () => {
            // Regression: previously the whole compare result was negated
            // under `desc`, including the familyArgsStringified tiebreak.
            // Two atoms with the same key came back in reverse-ID order.
            // The direction should only apply to the key comparison; the
            // deterministic tiebreak is always ascending so identical-key
            // sets stay stable across renders and across directions.
            const s = store()
            const post = atomFamily<{ date: number }, [string]>(null, {
                name: "posts",
            })
            const byDate = atomFamilySort(post, p => p.date, {
                direction: "desc",
            })

            s.set(post("a"), { date: 100 })
            s.set(post("b"), { date: 100 })
            s.set(post("c"), { date: 200 })

            // c (200) first under desc; for the (a, b) tie, expect ASC ID
            // tiebreak → [a, b], not [b, a].
            expect(
                s.get(byDate).map(a => a.familyArgsStringified),
            ).toEqual(["c", "a", "b"])
        })

        test("equal keys tiebreak ascending under asc (regression guard)", () => {
            const s = store()
            const post = atomFamily<{ date: number }, [string]>(null, {
                name: "posts",
            })
            const byDate = atomFamilySort(post, p => p.date, {
                direction: "asc",
            })

            s.set(post("a"), { date: 100 })
            s.set(post("b"), { date: 100 })
            s.set(post("c"), { date: 50 })

            expect(
                s.get(byDate).map(a => a.familyArgsStringified),
            ).toEqual(["c", "a", "b"])
        })
    })
})
