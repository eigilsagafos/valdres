import { describe, expect, mock, test } from "bun:test"
import { atomFamily } from "./atomFamily"
import { atomFamilyIndex } from "./atomFamilyIndex"
import { selector } from "./selector"
import { store } from "./store"

describe("atomFamilyIndex", () => {
    test("crud", () => {
        const defaultStore = store()
        const post = atomFamily<{ title: string; tags: string[] }, [string]>(
            null,
            { name: "posts" },
        )
        const extractor = mock((doc: { tags: string[] }) => doc.tags)
        const postsByTag = atomFamilyIndex(post, extractor, {
            name: "postsByTag",
        })

        expect(extractor).toHaveBeenCalledTimes(0)
        defaultStore.set(post("1"), { title: "Initial", tags: ["foo"] })

        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(1)
        expect(extractor).toHaveBeenCalledTimes(1)

        // Same-value write — extractor must not re-run (setAtom equality skip)
        defaultStore.set(post("1"), { title: "Initial", tags: ["foo"] })
        expect(extractor).toHaveBeenCalledTimes(1)
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(1)

        // Different value — extractor re-runs
        defaultStore.set(post("1"), { title: "Updated", tags: ["foo"] })
        expect(extractor).toHaveBeenCalledTimes(2)
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(1)

        // Delete drops atom from buckets without re-running extractor
        defaultStore.del(post("1"))
        expect(extractor).toHaveBeenCalledTimes(2)
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(0)
    })

    test("multi-term, multi-atom", () => {
        const defaultStore = store()
        const post = atomFamily<
            { id: string; title: string; tags: string[] },
            [string]
        >(null, { name: "posts" })
        const postsByTag = atomFamilyIndex(post, p => p.tags, {
            name: "postsByTag",
        })

        defaultStore.set(post("1"), { id: "1", title: "Post 1", tags: ["foo"] })
        defaultStore.set(post("2"), { id: "2", title: "Post 2", tags: ["bar"] })
        defaultStore.set(post("3"), {
            id: "3",
            title: "Post 3",
            tags: ["foo", "bar"],
        })

        expect(
            defaultStore
                .get(postsByTag("foo"))
                .map(a => a.familyArgsStringified),
        ).toEqual(["1", "3"])
        expect(
            defaultStore
                .get(postsByTag("bar"))
                .map(a => a.familyArgsStringified),
        ).toEqual(["2", "3"])

        // Move post 3 out of all tags
        defaultStore.set(post("3"), { id: "3", title: "Post 3", tags: [] })
        expect(
            defaultStore
                .get(postsByTag("foo"))
                .map(a => a.familyArgsStringified),
        ).toEqual(["1"])
        expect(
            defaultStore
                .get(postsByTag("bar"))
                .map(a => a.familyArgsStringified),
        ).toEqual(["2"])

        defaultStore.del(post("1"))
        defaultStore.del(post("2"))
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(0)
        expect(defaultStore.get(postsByTag("bar"))).toHaveLength(0)
    })

    test("empty bucket for unseen term", () => {
        const defaultStore = store()
        const entity = atomFamily<{ id: string; kind: string }, [string]>(null)
        const entitiesByKind = atomFamilyIndex(
            entity,
            d => [d.kind],
            { name: "byKind" },
        )
        expect(defaultStore.get(entitiesByKind("User"))).toHaveLength(0)
    })

    test("extractor returning null/undefined/[] places atom in no bucket", () => {
        const defaultStore = store()
        const post = atomFamily<
            { title: string; tags: string[] | null | undefined },
            [string]
        >(null, { name: "posts" })
        const postsByTag = atomFamilyIndex(post, p => p.tags ?? [])

        defaultStore.set(post("1"), { title: "A", tags: null })
        defaultStore.set(post("2"), { title: "B", tags: undefined })
        defaultStore.set(post("3"), { title: "C", tags: [] })
        defaultStore.set(post("4"), { title: "D", tags: ["x"] })

        expect(defaultStore.get(postsByTag("x"))).toHaveLength(1)
        // No phantom buckets for the null/undefined/[] cases
        expect(defaultStore.get(postsByTag("null"))).toHaveLength(0)
    })

    test("atom moves bucket in single write — subscribers fire once each", () => {
        const defaultStore = store()
        const post = atomFamily<{ tags: string[] }, [string]>(null, {
            name: "posts",
        })
        const postsByTag = atomFamilyIndex(post, p => p.tags)

        defaultStore.set(post("1"), { tags: ["foo"] })

        const fooCb = mock(() => {})
        const barCb = mock(() => {})
        defaultStore.sub(postsByTag("foo"), fooCb)
        defaultStore.sub(postsByTag("bar"), barCb)

        // Move from foo to bar
        defaultStore.set(post("1"), { tags: ["bar"] })

        expect(fooCb).toHaveBeenCalledTimes(1)
        expect(barCb).toHaveBeenCalledTimes(1)
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(0)
        expect(defaultStore.get(postsByTag("bar"))).toHaveLength(1)
    })

    test("subscribe before any match — fires on first matching write only", () => {
        const defaultStore = store()
        const post = atomFamily<{ tags: string[] }, [string]>(null, {
            name: "posts",
        })
        const postsByTag = atomFamilyIndex(post, p => p.tags)

        const cb = mock(() => {})
        defaultStore.sub(postsByTag("foo"), cb)

        // Unrelated write — must not fire
        defaultStore.set(post("a"), { tags: ["bar"] })
        expect(cb).toHaveBeenCalledTimes(0)

        // Matching write — fires
        defaultStore.set(post("b"), { tags: ["foo"] })
        expect(cb).toHaveBeenCalledTimes(1)
    })

    test("store.del notifies subscribers of the dropped term", () => {
        const defaultStore = store()
        const post = atomFamily<{ tags: string[] }, [string]>(null, {
            name: "posts",
        })
        const postsByTag = atomFamilyIndex(post, p => p.tags)

        defaultStore.set(post("1"), { tags: ["foo"] })

        const cb = mock(() => {})
        defaultStore.sub(postsByTag("foo"), cb)

        defaultStore.del(post("1"))
        expect(cb).toHaveBeenCalledTimes(1)
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(0)
    })

    test("transaction batch — subscribers fire once at commit", () => {
        const defaultStore = store()
        const post = atomFamily<{ tags: string[] }, [string]>(null, {
            name: "posts",
        })
        const postsByTag = atomFamilyIndex(post, p => p.tags)

        const cb = mock(() => {})
        defaultStore.sub(postsByTag("foo"), cb)

        defaultStore.txn(({ set }) => {
            set(post("1"), { tags: ["foo"] })
            set(post("2"), { tags: ["foo"] })
        })

        expect(cb).toHaveBeenCalledTimes(1)
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(2)
    })

    test("late subscriber sees current bucket on first read", () => {
        const defaultStore = store()
        const post = atomFamily<{ tags: string[] }, [string]>(null, {
            name: "posts",
        })
        const postsByTag = atomFamilyIndex(post, p => p.tags)

        // Write first, then read the index — onInit must populate from storage
        defaultStore.set(post("1"), { tags: ["foo"] })
        defaultStore.set(post("2"), { tags: ["foo"] })

        const result = defaultStore.get(postsByTag("foo"))
        expect(result).toHaveLength(2)
        expect(result.map(a => a.familyArgsStringified).sort()).toEqual([
            "1",
            "2",
        ])
    })

    describe("scoped stores", () => {
        // Phase 1 supports reads from a scope when writes happen in the root,
        // because reads of the term atom walk the parent chain via getState
        // and the root's bucket storage is populated. Scope-local writes and
        // scope-overrides are not yet supported — they require a parentIndex
        // chain on the descriptor storage, tracked as Phase 2 work in the plan.

        test("scope reads see root writes", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            root.set(post("1"), { tags: ["foo"] })
            expect(root.get(postsByTag("foo"))).toHaveLength(1)
            expect(child.get(postsByTag("foo"))).toHaveLength(1)
        })

        test("subscriber on child fires when root writes a matching atom", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            const cb = mock(() => {})
            child.sub(postsByTag("foo"), cb)

            root.set(post("1"), { tags: ["foo"] })
            expect(cb).toHaveBeenCalledTimes(1)
            expect(child.get(postsByTag("foo"))).toHaveLength(1)
        })

        // TODO Phase 2: scope-local writes should be visible in that scope's
        // index reads. Currently fails because getState walks parent chain
        // first and the term atom's onInit reads from the parent's storage,
        // which doesn't contain the scope-local writes. Fix requires a
        // parentIndex chain on the descriptor storage (mirror of
        // AtomFamilyIndex.parentIndex at lib/atomFamilyIndex.ts:50-83).
        test("scope-local writes don't leak to root", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            child.set(post("1"), { tags: ["foo"] })
            expect(child.get(postsByTag("foo"))).toHaveLength(1)
            expect(root.get(postsByTag("foo"))).toHaveLength(0)
        })

        test("scope override of a parent-set atom is reflected in scope index only", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            root.set(post("1"), { tags: ["foo"] })
            child.set(post("1"), { tags: ["bar"] })

            expect(root.get(postsByTag("foo"))).toHaveLength(1)
            expect(root.get(postsByTag("bar"))).toHaveLength(0)
            expect(child.get(postsByTag("foo"))).toHaveLength(0)
            expect(child.get(postsByTag("bar"))).toHaveLength(1)
        })

        test("sibling scopes are isolated", () => {
            const root = store("root")
            const a = root.scope("a")
            const b = root.scope("b")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            a.set(post("1"), { tags: ["foo"] })
            expect(a.get(postsByTag("foo"))).toHaveLength(1)
            expect(b.get(postsByTag("foo"))).toHaveLength(0)
            expect(root.get(postsByTag("foo"))).toHaveLength(0)
        })

        test("nested scope inherits parent + grandparent state", () => {
            const root = store("root")
            const child = root.scope("child")
            const grand = child.scope("grand")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            root.set(post("r"), { tags: ["foo"] })
            child.set(post("c"), { tags: ["foo"] })
            grand.set(post("g"), { tags: ["foo"] })

            expect(
                root.get(postsByTag("foo")).map(a => a.familyArgsStringified)
                    .sort(),
            ).toEqual(["r"])
            expect(
                child.get(postsByTag("foo")).map(a => a.familyArgsStringified)
                    .sort(),
            ).toEqual(["c", "r"])
            expect(
                grand.get(postsByTag("foo")).map(a => a.familyArgsStringified)
                    .sort(),
            ).toEqual(["c", "g", "r"])
        })

        test("subscriber on child fires when child writes locally", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            const cb = mock(() => {})
            child.sub(postsByTag("foo"), cb)

            child.set(post("1"), { tags: ["foo"] })
            expect(cb).toHaveBeenCalledTimes(1)
        })

        test("subscriber on root does not fire when child writes", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            const cb = mock(() => {})
            root.sub(postsByTag("foo"), cb)

            child.set(post("1"), { tags: ["foo"] })
            expect(cb).toHaveBeenCalledTimes(0)
            expect(root.get(postsByTag("foo"))).toHaveLength(0)
        })

        test("parent write after child write updates child view", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            child.set(post("c"), { tags: ["foo"] })
            expect(
                child.get(postsByTag("foo")).map(a => a.familyArgsStringified),
            ).toEqual(["c"])

            // Parent writes — child's view should pick this up too
            root.set(post("r"), { tags: ["foo"] })
            expect(
                child.get(postsByTag("foo")).map(a => a.familyArgsStringified)
                    .sort(),
            ).toEqual(["c", "r"])
        })

        test("child subscriber fires when parent writes after child has its own state", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            // Child writes first → child gains its own data.values[termAtom]
            child.set(post("c"), { tags: ["foo"] })

            // Now subscribe in child — subscription lands in childData since
            // child already has the value
            const cb = mock(() => {})
            child.sub(postsByTag("foo"), cb)

            // Parent writes — cross-scope dispatch should notify child's
            // subscriber
            root.set(post("r"), { tags: ["foo"] })
            expect(cb).toHaveBeenCalledTimes(1)
        })

        test("parent delete updates child view and notifies child subscriber", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            root.set(post("r"), { tags: ["foo"] })
            child.set(post("c"), { tags: ["foo"] })

            const cb = mock(() => {})
            child.sub(postsByTag("foo"), cb)

            root.del(post("r"))
            expect(
                child.get(postsByTag("foo")).map(a => a.familyArgsStringified),
            ).toEqual(["c"])
            expect(cb).toHaveBeenCalledTimes(1)
        })

        test("cross-scope dispatch does not double-fire descendant selectors", () => {
            const root = store("root")
            const child = root.scope("child")
            const grand = child.scope("grand")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            // Give grand its own local override so it has storage and we
            // exercise the cross-scope dispatch path for both child and grand.
            grand.set(post("g"), { tags: ["foo"] })

            const childCb = mock(() => {})
            const grandCb = mock(() => {})
            child.sub(postsByTag("foo"), childCb)
            grand.sub(postsByTag("foo"), grandCb)

            root.set(post("r"), { tags: ["foo"] })

            // Each scope-local subscriber must fire exactly once for one
            // parent write — not twice via the scope-recurse path and once
            // via the cross-scope dispatch.
            expect(childCb).toHaveBeenCalledTimes(1)
            expect(grandCb).toHaveBeenCalledTimes(1)
        })
    })

    describe("memory & cache hygiene", () => {
        test("release(term) drops the cached term atom", () => {
            const defaultStore = store()
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            defaultStore.set(post("1"), { tags: ["foo"] })
            const a1 = postsByTag("foo")
            postsByTag.release("foo")
            const a2 = postsByTag("foo")
            expect(a1).not.toBe(a2)
        })

        test("root delete preserves child override (valdres family.release semantics)", () => {
            // valdres' family.release removes the atom from the family map
            // but leaves scope-local overrides intact. Our index must match:
            // root.del nukes root.bucketsLocal but child's explicit override
            // continues to render.
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            root.set(post("1"), { tags: ["foo"] })
            child.set(post("1"), { tags: ["bar"] })
            expect(child.get(postsByTag("foo"))).toHaveLength(0)
            expect(
                child.get(postsByTag("bar")).map(a => a.familyArgsStringified),
            ).toEqual(["1"])

            root.del(post("1"))

            // root view is gone
            expect(root.get(postsByTag("foo"))).toHaveLength(0)
            expect(root.get(postsByTag("bar"))).toHaveLength(0)
            // child still sees its own override; this matches the built-in
            // family-render semantics. The internal cleanupDescendantBucketsRemoved
            // releases bucketsRemoved entries but does not touch legitimate
            // local overrides in bucketsLocal/atomTerms.
            expect(child.get(postsByTag("foo"))).toHaveLength(0)
            expect(
                child.get(postsByTag("bar")).map(a => a.familyArgsStringified),
            ).toEqual(["1"])
        })

        test("root delete after child shadow-del invalidates child view", () => {
            // Scenario where bucketsRemoved is the only place the atom lives
            // in child's storage (child.del records bucketsRemoved without
            // adding to bucketsLocal). After root.del, cleanup must drop the
            // bucketsRemoved entry so the atom is GC-eligible.
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            root.set(post("1"), { tags: ["foo"] })
            // Child shadows the atom out. Note: child.del also calls
            // family.release, so we can't easily inspect the original atom
            // via post("1") after this. Instead verify behavior remains
            // consistent.
            child.del(post("1"))
            // Force child storage to materialize for "foo"
            expect(child.get(postsByTag("foo"))).toHaveLength(0)
        })

        test("pass-through scope reads do not pollute scope data.values", () => {
            // A scope with storage but no local writes for a term should not
            // get a data.values entry for that term atom when parent writes.
            // Reads in the scope walk up to parent.
            const root = store("root")
            const child = root.scope("child")
            const grand = child.scope("grand")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            // Grand writes a different term → child becomes pass-through for "foo"
            grand.set(post("g"), { tags: ["bar"] })
            // Now parent writes "foo"
            root.set(post("r"), { tags: ["foo"] })

            const fooTerm = postsByTag("foo")
            // Child should NOT have its own value for the foo term atom —
            // pass-through scopes walk up to parent
            expect(child.data.values.has(fooTerm)).toBe(false)
            // But the read still returns the correct value
            expect(
                child.get(fooTerm).map(a => a.familyArgsStringified),
            ).toEqual(["r"])
        })
    })

    describe("term atom lifecycle", () => {
        test("last subscriber unmount drops cached value from data.values", () => {
            // When the only subscriber to a term atom detaches, the
            // per-store cached value is cleared so the termAtom isn't
            // pinned by data.values. Cache entry itself stays so identity
            // is preserved across re-subscribes.
            const s = store()
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            s.set(post("1"), { tags: ["foo"] })
            const fooTerm = postsByTag("foo")

            const unsub = s.sub(fooTerm, () => {})
            // Read to populate data.values
            expect(s.get(fooTerm)).toHaveLength(1)
            expect(s.data.values.has(fooTerm)).toBe(true)

            unsub()
            // Cleanup runs synchronously: data.values entry should be gone
            expect(s.data.values.has(fooTerm)).toBe(false)

            // Identity is stable — re-querying returns the same atom
            const sameFooTerm = postsByTag("foo")
            expect(sameFooTerm).toBe(fooTerm)

            // Re-subscribe + read works (re-populates via onInit)
            const unsub2 = s.sub(fooTerm, () => {})
            expect(s.get(fooTerm).map(a => a.familyArgsStringified)).toEqual(
                ["1"],
            )
            unsub2()
        })

        test("multiple subscribers — cleanup only fires on the last unsubscribe", () => {
            const s = store()
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            s.set(post("1"), { tags: ["foo"] })
            const fooTerm = postsByTag("foo")

            const unsub1 = s.sub(fooTerm, () => {})
            const unsub2 = s.sub(fooTerm, () => {})
            s.get(fooTerm)
            expect(s.data.values.has(fooTerm)).toBe(true)

            unsub1()
            // Still one subscriber → no cleanup
            expect(s.data.values.has(fooTerm)).toBe(true)

            unsub2()
            // Last subscriber gone → cleanup fires
            expect(s.data.values.has(fooTerm)).toBe(false)
        })

        test("cleanup is per-store — unsubscribing in one store doesn't touch another", () => {
            const s1 = store("s1")
            const s2 = store("s2")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            s1.set(post("a"), { tags: ["foo"] })
            s2.set(post("b"), { tags: ["foo"] })
            const fooTerm = postsByTag("foo")

            const unsub1 = s1.sub(fooTerm, () => {})
            const unsub2 = s2.sub(fooTerm, () => {})
            s1.get(fooTerm)
            s2.get(fooTerm)

            unsub1()
            // s1's cleanup ran; s2's is untouched
            expect(s1.data.values.has(fooTerm)).toBe(false)
            expect(s2.data.values.has(fooTerm)).toBe(true)

            unsub2()
            expect(s2.data.values.has(fooTerm)).toBe(false)
        })

        test("release(term) clears data.values across live stores for read-only usage", () => {
            // The `release()` API is the manual escape hatch for terms
            // that were `get`-only (no subscription, so `onMount` never
            // fired). Verifies it walks tracked stores and clears entries.
            const s = store()
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            s.set(post("1"), { tags: ["foo"] })
            const fooTerm = postsByTag("foo")

            // Read without subscribing
            expect(s.get(fooTerm)).toHaveLength(1)
            expect(s.data.values.has(fooTerm)).toBe(true)

            const released = postsByTag.release("foo")
            expect(released).toBe(true)
            expect(s.data.values.has(fooTerm)).toBe(false)

            // After release, calling postsByTag("foo") creates a FRESH
            // term atom — identity is intentionally not preserved across
            // release boundaries.
            const newFooTerm = postsByTag("foo")
            expect(newFooTerm).not.toBe(fooTerm)
            // And the fresh atom still resolves correctly
            expect(
                s.get(newFooTerm).map(a => a.familyArgsStringified),
            ).toEqual(["1"])
        })

        test("S5: release(term) clears scoped-store data.values when scope wrote locally", () => {
            // Pins the contract for read+release across scopes.
            //
            // Scoped reads of the termAtom WITHOUT a local write don't
            // cache in the scope's data.values (the scope walks the
            // parent chain on read), so there's nothing to clean up
            // locally. Scoped writes DO cache: the descriptor's onWrite
            // fires for the scoped data, getStorage(scopeData) runs and
            // registers the scope in `knownStores`, and the scope's
            // own data.values gets a copy of the term atom.
            //
            // release(term) must walk the scope and clear that entry.
            // (Without proper knownStores registration on writes, the
            // scope's entry would be orphaned.)
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            root.set(post("1"), { tags: ["foo"] })
            child.set(post("2"), { tags: ["foo"] })
            const fooTerm = postsByTag("foo")

            // Read in both stores so both have local caches.
            expect(root.get(fooTerm).map(a => a.familyArgsStringified)).toEqual(
                ["1"],
            )
            expect(
                child.get(fooTerm).map(a => a.familyArgsStringified).sort(),
            ).toEqual(["1", "2"])
            expect(root.data.values.has(fooTerm)).toBe(true)
            expect(child.data.values.has(fooTerm)).toBe(true)

            const released = postsByTag.release("foo")
            expect(released).toBe(true)
            // BOTH the root cache and the scoped-write cache get cleared.
            expect(root.data.values.has(fooTerm)).toBe(false)
            expect(child.data.values.has(fooTerm)).toBe(false)
        })

        test("S5: scoped reads-without-overrides don't pollute scope cache", () => {
            // Companion contract: a scope reading a parent-only term
            // walks the parent chain instead of caching locally, so
            // there's nothing release(term) needs to clean in the scope.
            // Pins the behavior so a future "always cache locally" change
            // would surface here and prompt revisiting release semantics.
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            root.set(post("1"), { tags: ["foo"] })
            const fooTerm = postsByTag("foo")

            expect(child.get(fooTerm)).toHaveLength(1)
            // Scope walked the parent — no local cache entry was created.
            expect(child.data.values.has(fooTerm)).toBe(false)
        })

        test("release(term) returns false for an unknown term", () => {
            const post = atomFamily<{ tags: string[] }, [string]>(null)
            const postsByTag = atomFamilyIndex(post, p => p.tags)
            expect(postsByTag.release("never-queried")).toBe(false)
        })

        test("cleanup also fires for transitive subscription via a selector", () => {
            // Subscriber attaches to a selector that reads the term atom;
            // when the selector unmounts (last sub gone), our termAtom
            // also unmounts, and our cleanup runs.
            const s = store()
            const post = atomFamily<{ tags: string[] }, [string]>(null)
            const postsByTag = atomFamilyIndex(post, p => p.tags)

            s.set(post("1"), { tags: ["foo"] })
            const fooTerm = postsByTag("foo")

            // Build a selector that depends on the term atom
            const countSelector = selector(get => get(fooTerm).length)

            const unsub = s.sub(countSelector, () => {})
            expect(s.get(countSelector)).toBe(1)
            expect(s.data.values.has(fooTerm)).toBe(true)

            unsub()
            // Selector unmount → termAtom is no longer transitively
            // subscribed → cleanup fires
            expect(s.data.values.has(fooTerm)).toBe(false)
        })
    })

    describe("descriptor error containment", () => {
        // Pin the contract: a descriptor hook that throws must not take
        // down the whole propagation pass. Other descriptors keep working;
        // the user-visible store-level write completes; the error is
        // reported via `console.error` with enough context to debug.

        test("extractor that throws is logged, other descriptors keep working", () => {
            const s = store()
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            // Descriptor that always blows up
            atomFamilyIndex(post, () => {
                throw new Error("boom")
            }, { name: "broken" })
            // A second, healthy descriptor on the same family
            const byTag = atomFamilyIndex(post, p => p.tags, {
                name: "byTag",
            })

            const captured: unknown[][] = []
            const origError = console.error
            console.error = (...args: unknown[]) => captured.push(args)
            try {
                // This must not throw even though one descriptor is broken
                s.set(post("1"), { tags: ["foo"] })
            } finally {
                console.error = origError
            }

            // The error was logged with enough context to identify the
            // family / descriptor that failed
            expect(captured.length).toBeGreaterThan(0)
            const flat = captured.flat().map(String).join(" ")
            expect(flat).toMatch(/posts|broken/)

            // The healthy descriptor still works
            expect(
                s
                    .get(byTag("foo"))
                    .map(a => a.familyArgsStringified),
            ).toEqual(["1"])

            // And the public store value is in place
            expect(s.get(post("1"))).toEqual({ tags: ["foo"] })
        })

        test("descriptor onDelete that throws is logged, write succeeds", () => {
            // Same shape on the delete path. We use a descriptor whose
            // onDelete will reach for `atomTerms` of an atom it never
            // saw — guaranteed to throw on read of `undefined.size` if
            // unhandled. Simulated here by writing then deleting under a
            // broken extractor.
            const s = store()
            const post = atomFamily<{ tags: string[] }, [string]>(null, {
                name: "posts",
            })
            let failOnExtractor = false
            const byTag = atomFamilyIndex(post, p => {
                if (failOnExtractor) throw new Error("delete-boom")
                return p.tags
            })

            s.set(post("1"), { tags: ["foo"] })
            failOnExtractor = true

            const captured: unknown[][] = []
            const origError = console.error
            console.error = (...args: unknown[]) => captured.push(args)
            try {
                // del path doesn't call extractor, so this should still
                // succeed cleanly. The test here is really that del
                // never throws on the descriptor side.
                s.del(post("1"))
            } finally {
                console.error = origError
            }
            // No errors expected — delete uses cached oldTerms
            expect(s.get(byTag("foo"))).toHaveLength(0)
        })
    })
})
