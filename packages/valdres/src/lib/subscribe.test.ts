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

    test("Subscribe to un-mounted selector", () => {
        const store1 = store()
        const atom1 = atom([1, 2, 3])
        const selector1 = selector(get => {
            const [int1, int2, int3] = get(atom1)
            return int1 + int2 + int3
        })
        const callback = mock(() => {})
        store1.sub(selector1, callback)
        expect(callback).toHaveBeenCalledTimes(0)
        store1.set(atom1, [2, 1, 3])
        expect(callback).toHaveBeenCalledTimes(0)
        store1.set(atom1, [3, 2, 1])
        expect(callback).toHaveBeenCalledTimes(0)
        store1.set(atom1, [3, 2, 2])
        expect(callback).toHaveBeenCalledTimes(1)
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
     */
    test("subscribe with no-other", () => {
        const store1 = store()
        const links = ["a", "b", "c"]
        const atom1 = atom({ id: 1, name: "Foo 1", links })
        const linksSelector = selector(get => get(atom1).links)

        const callbackResults: boolean[] = []
        const callback = mock(() => {
            callbackResults.push(Object.is(store1.get(linksSelector), links))
        })
        store1.sub(linksSelector, callback, false)
        store1.set(atom1, curr => ({ ...curr, name: "Foo 2" }))
        expect(callback).toHaveBeenCalledTimes(1)
        expect(callbackResults).toStrictEqual([true])

        /** We now replace the links array with one that is deep equal to the
         * previous but that does not equal on Object.is. Valdres should in
         * this case keep the old value and return that instead of the new object.
         */
        store1.set(atom1, curr => ({
            ...curr,
            name: "Foo 3",
            links: ["a", "b", "c"],
        }))
        expect(callbackResults).toStrictEqual([true, true])
        // expect(callback).toHaveBeenCalledTimes(2)
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
})
