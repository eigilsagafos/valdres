import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { selector } from "../selector"
import { atomFamily } from "../atomFamily"

describe("subscribe", () => {
    test("Subscribe to un-mounted atom", () => {
        const store1 = store()
        const atom1 = atom(1)
        const callback = mock(() => {})
        store1.sub(atom1, callback)
        expect(callback).toHaveBeenCalledTimes(0)
        store1.set(atom1, 2)
        expect(callback).toHaveBeenCalledTimes(1)
    })

    test("fresh family-member subscription registers a plain-default member", () => {
        const store1 = store()
        const family = atomFamily("default")
        const member = family("member")
        const callback = mock(() => {})

        const unsubscribe = store1.sub(member, callback)

        expect(store1.get(member)).toBe("default")
        expect(store1.get(family)).toStrictEqual([member])
        expect(callback).toHaveBeenCalledTimes(0)
        unsubscribe()
    })

    test("fresh family-member subscription propagates selector-default initialization", () => {
        const store1 = store()
        const sourceFamily = atomFamily((id: number) => id)
        const source = sourceFamily(1)
        const defaultSelector = selector(get => get(source) + 1)
        const targetFamily = atomFamily(defaultSelector)
        const target = targetFamily("target")
        const callback = mock(() => {})

        const unsubscribe = store1.sub(target, callback)

        expect(store1.get(source)).toBe(1)
        expect(store1.get(sourceFamily)).toStrictEqual([source])
        expect(store1.get(target)).toBe(2)
        expect(store1.get(targetFamily)).toStrictEqual([target])
        expect(callback).toHaveBeenCalledTimes(0)

        store1.set(target, 3)
        expect(callback).toHaveBeenCalledTimes(1)
        unsubscribe()
    })

    test("Subscribe to un-mounted selector", () => {
        const store1 = store()
        const atom1 = atom([1, 2, 3]) // sum 6
        const selector1 = selector(get => {
            const [int1, int2, int3] = get(atom1)
            return int1 + int2 + int3
        })
        const callback = mock(() => {})
        store1.sub(selector1, callback)
        expect(callback).toHaveBeenCalledTimes(0)
        store1.set(atom1, [2, 1, 3]) // sum 6
        expect(callback).toHaveBeenCalledTimes(0)
        store1.set(atom1, [3, 2, 1]) // sum 6
        expect(callback).toHaveBeenCalledTimes(0)
        store1.set(atom1, [3, 2, 2]) // sum 7
        expect(callback).toHaveBeenCalledTimes(1)
    })

    test("fresh selector subscriptions initialize directly in the live graph", () => {
        const store1 = store()
        const source = atom(1)
        const child = selector(get => get(source) + 1)
        const root = selector(get => get(child) + 1)

        const unsubscribe = store1.sub(root, () => {})

        expect(store1.data.selectorGraphActive.has(root)).toBe(true)
        expect(store1.data.selectorGraphActive.has(child)).toBe(true)
        expect(store1.data.stateDependents.get(source)).toContain(child)
        expect(store1.data.stateDependents.get(child)).toContain(root)
        // A selector that is known-live before its first evaluation never needs
        // a forward-only revision snapshot or the associated write bookkeeping.
        expect(store1.data.stateRevisionClock.enabled).toBe(false)

        unsubscribe()
    })

    test("a failed fresh selector subscription rolls back live graph activation", () => {
        const store1 = store()
        const source = atom(1)
        const child = selector(get => get(source) + 1)
        const root = selector(get => {
            get(child)
            throw new Error("subscription failed")
        })

        expect(() => store1.sub(root, () => {})).toThrow()
        expect(store1.data.selectorGraphActive.has(root)).toBe(false)
        expect(store1.data.selectorGraphActive.has(child)).toBe(false)
        expect(store1.data.stateDependents.get(source)?.has(child) ?? false).toBe(
            false,
        )
    })

    test("a caught nested selector error rolls back its live graph activation", () => {
        const store1 = store()
        const source = atom(1)
        const failingChild = selector(() => {
            throw new Error("child failed")
        })
        const root = selector(get => {
            try {
                get(failingChild)
            } catch {}
            return get(source)
        })

        const unsubscribe = store1.sub(root, () => {})

        expect(store1.data.selectorGraphActive.has(root)).toBe(true)
        expect(store1.data.selectorGraphActive.has(failingChild)).toBe(false)
        expect(store1.data.stateDependencies.has(failingChild)).toBe(false)
        expect(store1.data.stateDependents.get(source)).toContain(root)

        unsubscribe()
    })

    test("subscription to selector with non-primitive value", () => {
        const store1 = store()
        const atom1 = atom(1)
        const selector1 = selector(get => get(atom1))
        const callback = mock(() => {})
        store1.sub(selector1, callback)
        expect(callback).toHaveBeenCalledTimes(0)
        store1.set(atom1, 2)
        expect(callback).toHaveBeenCalledTimes(1)
    })

    /**
     * useSyncExternalStore in React takes two arguments. A callback function
     * that is triggerd with state changes and a function to fetch the state.
     * On state changes the value is not returned in the callback, but React
     * will fetch the new value, compare with Object.is and only re-render when
     * Object.is returns false. Since state change can trigger wast numbers of
     * subscriptions to be destroyed we don't want to re-calculate selectors
     * unnecessarily. Therefore we allow callbacks to be called even if we have
     * not checked if the state actually did update. When re-calculating though
     * we ensure that the previous value is returned if deep-equal is true. This
     * ensures that react does not re-render.
     *
     * UPDATE: I changed the logic for how updates are propagated, so this should
     * no longer be an issue.
     */
    test("subscribe with no-other", () => {
        const store1 = store()
        const links = ["a", "b", "c"]
        const atom1 = atom({ id: 1, name: "Foo 1", links })
        const linksSelector = selector(get => get(atom1).links)

        const callback = mock(() => {})
        store1.sub(linksSelector, callback, false)
        store1.set(atom1, curr => ({ ...curr, name: "Foo 2" }))
        expect(callback).toHaveBeenCalledTimes(0)
        // expect(callbackResults).toStrictEqual([])

        /** We now replace the links array with one that is deep equal to the
         * previous but that does not equal on Object.is. Valdres should in
         * this case keep the old value and return that instead of the new object.
         */
        store1.set(atom1, curr => ({
            ...curr,
            name: "Foo 3",
            links: ["a", "b", "c"],
        }))
        expect(callback).toHaveBeenCalledTimes(0)
        store1.set(atom1, curr => ({
            ...curr,
            name: "Foo 3",
            links: ["a", "b", "c", "d"],
        }))
        expect(callback).toHaveBeenCalledTimes(1)
        // expect(callbackResults).toStrictEqual([true, true])
    })

    test("unsubscribe resets when needed", () => {
        const store1 = store()
        const atom1 = atom(1)
        const selector1 = selector(get => get(atom1) * 2)

        expect(
            store1.data.subscriptionsRequireEqualCheck.get(selector1),
        ).toBeUndefined()

        // We subscribe but opt-out of equality check
        const unsubscribe1 = store1.sub(selector1, () => {}, false)
        expect(
            store1.data.subscriptionsRequireEqualCheck.get(selector1),
        ).toBeUndefined()

        // We subscribe
        const unsubscribe2 = store1.sub(selector1, () => {})
        expect(store1.data.subscriptionsRequireEqualCheck.get(selector1)).toBe(
            true,
        )

        // We subscribe again and opt-out of equality check
        const unsubscribe3 = store1.sub(selector1, () => {}, false)
        expect(store1.data.subscriptionsRequireEqualCheck.get(selector1)).toBe(
            true,
        )

        // We cancel one of the two opt-out callbacks
        unsubscribe1()
        expect(store1.data.subscriptionsRequireEqualCheck.get(selector1)).toBe(
            true,
        )

        // We cancel the default subscription with equality check
        unsubscribe2()
        expect(
            store1.data.subscriptionsRequireEqualCheck.get(selector1),
        ).toBeUndefined()
    })

    test("subscribe to atom in scoped store", () => {
        const level1store = store()
        const level2store = level1store.scope("child")
        const level3store = level2store.scope("nested")
        const anAtom = atom("default")
        const level1callback = mock(() => () => {})
        const level2callback = mock(() => () => {})
        const level3callback = mock(() => () => {})
        const rootUnsub = mock(level1store.sub(anAtom, level1callback))
        const scopedUnsub = mock(level2store.sub(anAtom, level2callback))
        const nestedUnsub = mock(level3store.sub(anAtom, level3callback))
        expect(level1store.data.subscriptions.get(anAtom)).toHaveLength(3)
        expect(level2store.data.subscriptions.get(anAtom)).toHaveLength(2)
        expect(level3store.data.subscriptions.get(anAtom)).toHaveLength(1)
        // We set the atom in the root store. All callbacks should be called once
        level1store.set(anAtom, "set in level 1")
        expect(level1callback).toHaveBeenCalledTimes(1)
        expect(level2callback).toHaveBeenCalledTimes(1)
        expect(level3callback).toHaveBeenCalledTimes(1)
        expect(rootUnsub).toHaveBeenCalledTimes(0)
        expect(scopedUnsub).toHaveBeenCalledTimes(0)
        expect(nestedUnsub).toHaveBeenCalledTimes(0)

        // We set the atom in the root store. All callbacks should be called once
        level2store.set(anAtom, "set in level 2")
        expect(level1callback).toHaveBeenCalledTimes(1)
        expect(level2callback).toHaveBeenCalledTimes(2)
        expect(level3callback).toHaveBeenCalledTimes(2)
        expect(level1store.data.subscriptions.get(anAtom)).toHaveLength(1)
        expect(level2store.data.subscriptions.get(anAtom)).toHaveLength(2)
        expect(level3store.data.subscriptions.get(anAtom)).toHaveLength(1)
        level1store.set(anAtom, "root 2")
        expect(level1callback).toHaveBeenCalledTimes(2)
        expect(level2callback).toHaveBeenCalledTimes(2)
        expect(level3callback).toHaveBeenCalledTimes(2)
        level3store.set(anAtom, "nested 1")
        expect(level1store.data.subscriptions.get(anAtom)).toHaveLength(1)
        expect(level2store.data.subscriptions.get(anAtom)).toHaveLength(1)
        expect(level3store.data.subscriptions.get(anAtom)).toHaveLength(1)
        expect(level1callback).toHaveBeenCalledTimes(2)
        expect(level2callback).toHaveBeenCalledTimes(2)
        expect(level3callback).toHaveBeenCalledTimes(3)
        level2store.set(anAtom, "scoped 2")
        expect(level1callback).toHaveBeenCalledTimes(2)
        expect(level2callback).toHaveBeenCalledTimes(3)
        expect(level3callback).toHaveBeenCalledTimes(3)
        level1store.set(anAtom, "root 3")
        expect(level1callback).toHaveBeenCalledTimes(3)
        expect(level2callback).toHaveBeenCalledTimes(3)
        expect(level3callback).toHaveBeenCalledTimes(3)
        rootUnsub()
        scopedUnsub()
        nestedUnsub()
        expect(rootUnsub).toHaveBeenCalledTimes(1)
        expect(scopedUnsub).toHaveBeenCalledTimes(1)
        expect(nestedUnsub).toHaveBeenCalledTimes(1)
        expect(level1store.data.subscriptions.get(anAtom)).toBeUndefined()
        expect(level2store.data.subscriptions.get(anAtom)).toBeUndefined()
        expect(level3store.data.subscriptions.get(anAtom)).toBeUndefined()
    })
    test("subscribe to atomFamily in scoped store", () => {
        const level1store = store()
        const level2store = level1store.scope("child")
        const level3store = level2store.scope("nested")
        const userAtom = atomFamily("default")
        const level1callback = mock(key => {})
        const level2callback = mock(key => {})
        const level3callback = mock(key => {})
        const rootUnsub = mock(level1store.sub(userAtom, level1callback))
        const scopedUnsub = mock(level2store.sub(userAtom, level2callback))
        const nestedUnsub = mock(level3store.sub(userAtom, level3callback))
        // expect(level1store.data.subscriptions.get(userAtom)).toHaveLength(3)
        expect(level2store.data.subscriptions.get(userAtom)).toHaveLength(2)
        expect(level3store.data.subscriptions.get(userAtom)).toHaveLength(1)
        // // We set the atom in the root store. All callbacks should be called once
        level1store.set(userAtom("Foo"), "set in level 1")
        expect(level1callback).toHaveBeenCalledTimes(1)
        expect(level2callback).toHaveBeenCalledTimes(1)
        expect(level3callback).toHaveBeenCalledTimes(1)
        // expect(level1callback).toHaveBeenCalledWith(["Foo"]) // Bun issue?
        // expect(level2callback).toHaveBeenCalledWith(["Foo"]) // Bun issue?
        // expect(level3callback).toHaveBeenCalledWith(["Foo"]) // Bun issue?
        expect(level1callback.mock.calls[0]).toStrictEqual(["Foo"])
        expect(level2callback.mock.calls[0]).toStrictEqual(["Foo"])
        expect(level3callback.mock.calls[0]).toStrictEqual(["Foo"])
        expect(rootUnsub).toHaveBeenCalledTimes(0)
        expect(scopedUnsub).toHaveBeenCalledTimes(0)
        expect(nestedUnsub).toHaveBeenCalledTimes(0)

        // // We set the atom in the root store. All callbacks should be called once
        level2store.set(userAtom("Foo"), "set in level 2")
        expect(level1callback).toHaveBeenCalledTimes(1)
        expect(level2callback).toHaveBeenCalledTimes(2)
        expect(level3callback).toHaveBeenCalledTimes(2)
        expect(level1store.data.subscriptions.get(userAtom)).toHaveLength(1)
        expect(level2store.data.subscriptions.get(userAtom)).toHaveLength(2)
        expect(level3store.data.subscriptions.get(userAtom)).toHaveLength(1)
        level1store.set(userAtom("Foo"), "root 2")
        expect(level1callback).toHaveBeenCalledTimes(2)
        expect(level2callback).toHaveBeenCalledTimes(2)
        expect(level3callback).toHaveBeenCalledTimes(2)
        level3store.set(userAtom("Foo"), "nested 1")
        expect(level1store.data.subscriptions.get(userAtom)).toHaveLength(1)
        expect(level2store.data.subscriptions.get(userAtom)).toHaveLength(1)
        expect(level3store.data.subscriptions.get(userAtom)).toHaveLength(1)
        expect(level1callback).toHaveBeenCalledTimes(2)
        expect(level2callback).toHaveBeenCalledTimes(2)
        expect(level3callback).toHaveBeenCalledTimes(3)
        level2store.set(userAtom("Foo"), "scoped 2")
        expect(level1callback).toHaveBeenCalledTimes(2)
        expect(level2callback).toHaveBeenCalledTimes(3)
        expect(level3callback).toHaveBeenCalledTimes(3)
        level1store.set(userAtom("Foo"), "root 3")
        expect(level1callback).toHaveBeenCalledTimes(3)
        expect(level2callback).toHaveBeenCalledTimes(3)
        expect(level3callback).toHaveBeenCalledTimes(3)

        level1store.txn(txn => {
            txn.set(userAtom("Foo"), "txn root")
            txn.scope("child", txn => {
                txn.set(userAtom("Foo"), "txn child")
                txn.scope("nested", txn => {
                    txn.set(userAtom("Foo"), "txn nested")
                })
            })
        })
        expect(level1callback).toHaveBeenCalledTimes(4)
        expect(level2callback).toHaveBeenCalledTimes(4)
        expect(level3callback).toHaveBeenCalledTimes(4)

        // Unsuscribe
        rootUnsub()
        scopedUnsub()
        nestedUnsub()
        expect(rootUnsub).toHaveBeenCalledTimes(1)
        expect(scopedUnsub).toHaveBeenCalledTimes(1)
        expect(nestedUnsub).toHaveBeenCalledTimes(1)
        expect(level1store.data.subscriptions.get(userAtom)).toBeUndefined()
        expect(level2store.data.subscriptions.get(userAtom)).toBeUndefined()
        expect(level3store.data.subscriptions.get(userAtom)).toBeUndefined()
    })

    test("nested family callback includes key", () => {
        const userAtom = atomFamily("default")
        const level1store = store()
        const level2store = level1store.scope("child")
        const level1callback = mock(key => {})
        const level2callback = mock(key => {})
        mock(level1store.sub(userAtom, level1callback))
        mock(level2store.sub(userAtom, level2callback))
        level2store.set(userAtom("Foo"), "nested 1")
        expect(level2callback).toHaveBeenCalledTimes(1)
        // expect(level2callback).toHaveBeenLastCalledWith(["Foo"]) // This is not working in current version of bun. Should work with strictEqual under the hood...
        expect(level2callback.mock.calls[0]).toStrictEqual(["Foo"])
    })

    test("nested selectors should only re-calculate when needed", () => {
        const rootStore = store()
        const atom1 = atom(1, { name: "sub-nested-atom" })
        const selector1cb = mock(get => {
            get(atom1) // We get the atom but we dont use the value
            return 1
        })
        const selector1 = selector(selector1cb, { name: "selector1" })
        const selector2cb = mock(get => get(selector1) + 1)
        const selector2 = selector(selector2cb, { name: "selector2" })
        const selector3cb = mock(get => get(selector2) + 1)
        const selector3 = selector(selector3cb, { name: "selector3" })
        expect(selector1cb).toHaveBeenCalledTimes(0)
        expect(selector2cb).toHaveBeenCalledTimes(0)
        expect(selector3cb).toHaveBeenCalledTimes(0)
        const atom1SubCallback = mock(() => {
            rootStore.get(atom1)
        })
        const selector1SubCallback = mock(() => {
            rootStore.get(selector1)
        })
        const selector2SubCallback = mock(() => {
            rootStore.get(selector2)
        })
        const selector3SubCallback = mock(() => {
            rootStore.get(selector3)
        })
        rootStore.sub(atom1, atom1SubCallback)
        rootStore.sub(selector1, selector1SubCallback)
        rootStore.sub(selector2, selector2SubCallback)
        rootStore.sub(selector3, selector3SubCallback)
        expect(selector1cb).toHaveBeenCalledTimes(1)
        expect(selector2cb).toHaveBeenCalledTimes(1)
        expect(selector3cb).toHaveBeenCalledTimes(1)
        expect(atom1SubCallback).toHaveBeenCalledTimes(0)
        expect(selector1SubCallback).toHaveBeenCalledTimes(0)
        expect(selector3SubCallback).toHaveBeenCalledTimes(0)

        // We set the atom to the same value as before
        rootStore.set(atom1, 1)
        expect(selector1cb).toHaveBeenCalledTimes(1)
        expect(selector2cb).toHaveBeenCalledTimes(1)
        expect(selector3cb).toHaveBeenCalledTimes(1)
        expect(atom1SubCallback).toHaveBeenCalledTimes(0)
        expect(selector3SubCallback).toHaveBeenCalledTimes(0)

        // We set the atom to a new value
        rootStore.set(atom1, 2)
        expect(selector1cb).toHaveBeenCalledTimes(2)
        expect(selector2cb).toHaveBeenCalledTimes(1)
        expect(selector3cb).toHaveBeenCalledTimes(1)
        expect(atom1SubCallback).toHaveBeenCalledTimes(1)
        expect(selector1SubCallback).toHaveBeenCalledTimes(0)
        expect(selector2SubCallback).toHaveBeenCalledTimes(0)
        expect(selector3SubCallback).toHaveBeenCalledTimes(0)

        // We set the atom back to a previous value
        rootStore.set(atom1, 1)
        expect(atom1SubCallback).toHaveBeenCalledTimes(2)
        expect(selector1cb).toHaveBeenCalledTimes(3)
        expect(selector2cb).toHaveBeenCalledTimes(1)
        expect(selector3cb).toHaveBeenCalledTimes(1)
        expect(selector1SubCallback).toHaveBeenCalledTimes(0)
        expect(selector2SubCallback).toHaveBeenCalledTimes(0)
        expect(selector3SubCallback).toHaveBeenCalledTimes(0)

        // rootStore.get(selector3)
        // expect(selector1cb).toHaveBeenCalledTimes(2)
        // We set the atom to the same value as before
        // expect(selector2cb).toHaveBeenCalledTimes(1)
        // expect(selector3cb).toHaveBeenCalledTimes(1)
        // // expect(subCallback).toHaveBeenCalledTimes(1)
        // rootStore.set(atom1, 1)
        // expect(selector1cb).toHaveBeenCalledTimes(3)
        // expect(selector2cb).toHaveBeenCalledTimes(1)
        // expect(selector3cb).toHaveBeenCalledTimes(1)
        // expect(subCallback).toHaveBeenCalledTimes(1)
    })

    test("unsubscribe cleans orphaned dependency selectors", async () => {
        const rootStore = store()
        const source = atom(1, { name: "orphan-source" })
        const intermediateCallback = mock(get => get(source) * 2)
        const intermediate = selector(intermediateCallback, {
            name: "orphan-intermediate",
        })
        const leaf = selector(get => get(intermediate) + 1, {
            name: "orphan-leaf",
        })

        const unsubscribeLeaf = rootStore.sub(leaf, () => {}, false)
        expect(rootStore.get(leaf)).toBe(3)
        expect(rootStore.data.stateDependencies.has(intermediate)).toBe(true)
        expect(rootStore.data.stateDependents.get(source)).toContain(
            intermediate,
        )

        unsubscribeLeaf()
        await Promise.resolve()

        expect(rootStore.data.stateDependencies.has(leaf)).toBe(false)
        expect(rootStore.data.stateDependencies.has(intermediate)).toBe(false)
        expect(rootStore.data.values.has(leaf)).toBe(false)
        expect(rootStore.data.values.has(intermediate)).toBe(false)
        expect(rootStore.data.stateDependents.get(source)).not.toContain(
            intermediate,
        )

        rootStore.set(source, 2)
        expect(intermediateCallback).toHaveBeenCalledTimes(1)
    })

    test("subscription promotes a freshly validated dynamic cold cache", () => {
        const rootStore = store()
        const chooseLeft = atom(true)
        const left = atom(1)
        const right = atom(2)
        const evaluate = mock(get => (get(chooseLeft) ? get(left) : get(right)))
        const dynamic = selector(evaluate)

        expect(rootStore.get(dynamic)).toBe(1)
        expect(rootStore.data.stateDependents.get(left)).toBeUndefined()

        // This invalidates the cold dependency snapshot without eagerly
        // evaluating or inserting a reverse edge.
        rootStore.set(chooseLeft, false)
        expect(evaluate).toHaveBeenCalledTimes(1)

        const callback = mock(() => {})
        const unsubscribe = rootStore.sub(dynamic, callback, false)
        expect(evaluate).toHaveBeenCalledTimes(2)
        expect(
            rootStore.data.stateDependents.get(left)?.has(dynamic) ?? false,
        ).toBe(false)
        expect(rootStore.data.stateDependents.get(right)).toContain(dynamic)

        rootStore.set(right, 3)
        expect(callback).toHaveBeenCalledTimes(1)
        expect(rootStore.get(dynamic)).toBe(3)
        unsubscribe()
    })

    test("tearing down a live child invalidates a cold parent cache", async () => {
        const rootStore = store()
        const source = atom(1)
        const child = selector(get => get(source) * 2)
        const parent = selector(get => get(child) + 1)

        const unsubscribe = rootStore.sub(child, () => {})
        expect(rootStore.get(parent)).toBe(3)

        unsubscribe()
        await Promise.resolve()
        rootStore.set(source, 2)

        expect(rootStore.get(parent)).toBe(5)
    })

    test("plain atom unsubscribe skips an empty orphan cleanup", () => {
        const rootStore = store()
        const source = atom(1, { name: "orphan-free-atom" })

        const unsubscribe = rootStore.sub(source, () => {}, false)
        unsubscribe()

        expect(rootStore.data.pendingOrphanCleanup).toBeUndefined()
        expect(rootStore.data.orphanCleanupScheduled).toBe(false)
    })

    test("orphan cleanup runs again after an empty selector is re-materialized", async () => {
        const rootStore = store()
        const constant = selector(() => 42, { name: "orphan-constant" })

        const firstUnsubscribe = rootStore.sub(constant, () => {}, false)
        expect(rootStore.get(constant)).toBe(42)
        firstUnsubscribe()
        await Promise.resolve()
        expect(rootStore.data.stateDependencies.has(constant)).toBe(false)
        expect(rootStore.data.values.has(constant)).toBe(false)

        // An empty dependency set creates no edge that could implicitly
        // invalidate a shared teardown visit. Re-materializing the selector
        // itself must invalidate it so the second unsubscribe still cleans up.
        const secondUnsubscribe = rootStore.sub(constant, () => {}, false)
        expect(rootStore.get(constant)).toBe(42)
        secondUnsubscribe()
        await Promise.resolve()
        expect(rootStore.data.stateDependencies.has(constant)).toBe(false)
        expect(rootStore.data.values.has(constant)).toBe(false)
    })

    test("a public read flushes queued orphan cleanup first", () => {
        const rootStore = store()
        const evaluate = mock(() => 42)
        const constant = selector(evaluate, { name: "orphan-read-flush" })

        const unsubscribe = rootStore.sub(constant, () => {}, false)
        expect(evaluate).toHaveBeenCalledTimes(1)
        unsubscribe()

        // Cleanup is normally microtask-batched, but an immediate public read
        // preserves the previous observable behavior: clear the cached orphan,
        // then evaluate it again instead of returning the pre-unsubscribe value.
        expect(rootStore.get(constant)).toBe(42)
        expect(evaluate).toHaveBeenCalledTimes(2)
    })

    test("lifecycle cleanup is synchronous while graph cleanup is microtask-batched", async () => {
        const rootStore = store()
        let lifecycleCleanups = 0
        const mounted = atom(1, {
            name: "orphan-timing-mounted",
            onMount: () => () => {
                lifecycleCleanups++
            },
        })
        const derived = selector(get => get(mounted) + 1, {
            name: "orphan-timing-derived",
        })

        const unsubscribe = rootStore.sub(derived, () => {}, false)
        expect(rootStore.data.stateDependencies.has(derived)).toBe(true)
        unsubscribe()

        // This timing split is deliberate: release user resources before the
        // disposer returns, but coalesce internal graph/cache work for the burst.
        expect(lifecycleCleanups).toBe(1)
        expect(rootStore.data.stateDependencies.has(derived)).toBe(true)

        await Promise.resolve()
        expect(rootStore.data.stateDependencies.has(derived)).toBe(false)
        expect(rootStore.data.values.has(derived)).toBe(false)
    })

    test("a failed mount rolls back the subscription so retry mounts again", () => {
        const rootStore = store()
        let mountCalls = 0
        let cleanupCalls = 0
        let shouldThrow = true
        const mounted = atom(1, {
            name: "failed-mount-rollback",
            onMount: () => {
                mountCalls++
                if (shouldThrow) throw new Error("mount boom")
                return () => {
                    cleanupCalls++
                }
            },
        })

        expect(() => rootStore.sub(mounted, () => {})).toThrow("mount boom")
        expect(rootStore.data.subscriptions.get(mounted)).toBeUndefined()

        shouldThrow = false
        const unsubscribe = rootStore.sub(mounted, () => {})
        expect(mountCalls).toBe(2)

        unsubscribe()
        expect(cleanupCalls).toBe(1)
    })

    test("a throwing cleanup still queues orphaned graph cleanup", async () => {
        const rootStore = store()
        const mounted = atom(1, {
            name: "throwing-cleanup-mounted",
            onMount: () => () => {
                throw new Error("cleanup boom")
            },
        })
        const derived = selector(get => get(mounted) + 1, {
            name: "throwing-cleanup-derived",
        })

        const unsubscribe = rootStore.sub(derived, () => {}, false)
        expect(rootStore.data.stateDependencies.has(derived)).toBe(true)

        expect(() => unsubscribe()).toThrow("cleanup boom")
        await Promise.resolve()

        expect(rootStore.data.stateDependencies.has(derived)).toBe(false)
        expect(rootStore.data.values.has(derived)).toBe(false)
        expect(rootStore.data.stateDependents.get(mounted)).not.toContain(
            derived,
        )
    })

    test("unsubscribe cleans deep orphaned selector chains iteratively", async () => {
        const rootStore = store()
        const source = atom(1)
        const depth = 100_000
        let current = selector(get => get(source) + 1)
        const first = current
        rootStore.get(current)

        for (let i = 1; i < depth; i++) {
            const previous = current
            current = selector(get => get(previous) + 1)
            // Materialize each link as it is built so this test isolates
            // unsubscribe cleanup depth rather than selector eval recursion.
            rootStore.get(current)
        }

        const unsubscribeTail = rootStore.sub(current, () => {}, false)

        expect(() => unsubscribeTail()).not.toThrow()
        await Promise.resolve()
        expect(rootStore.data.stateDependencies.has(current)).toBe(false)
        expect(rootStore.data.stateDependencies.has(first)).toBe(false)
        expect(rootStore.data.values.has(current)).toBe(false)
        expect(rootStore.data.values.has(first)).toBe(false)
        expect(rootStore.data.stateDependents.get(source)).not.toContain(
            first,
        )
    })
})
