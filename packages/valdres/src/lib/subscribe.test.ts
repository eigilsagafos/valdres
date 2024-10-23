import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { selector } from "../selector"

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
        const rootStore = store()
        const scopedStore = rootStore.createScope("child")
        const nestedScopedStore = scopedStore.createScope("nested")
        const anAtom = atom("default")
        const rootCallback = mock(() => {})
        const scopedCallback = mock(() => {})
        const nestedScopedCallback = mock(() => {})
        const rootUnsub = rootStore.sub(anAtom, rootCallback)
        const scopedUnsub = scopedStore.sub(anAtom, scopedCallback)
        const nestedUnsub = nestedScopedStore.sub(anAtom, nestedScopedCallback)
        expect(rootStore.data.subscriptions.get(anAtom)).toHaveLength(3)
        expect(scopedStore.data.subscriptions.get(anAtom)).toHaveLength(2)
        expect(nestedScopedStore.data.subscriptions.get(anAtom)).toHaveLength(1)
        rootStore.set(anAtom, "root 1")
        expect(rootCallback).toHaveBeenCalledTimes(1)
        expect(scopedCallback).toHaveBeenCalledTimes(1)
        expect(nestedScopedCallback).toHaveBeenCalledTimes(1)
        scopedStore.set(anAtom, "scoped 1")
        expect(rootStore.data.subscriptions.get(anAtom)).toHaveLength(1)
        expect(scopedStore.data.subscriptions.get(anAtom)).toHaveLength(2)
        expect(nestedScopedStore.data.subscriptions.get(anAtom)).toHaveLength(1)
        expect(rootCallback).toHaveBeenCalledTimes(1)
        expect(scopedCallback).toHaveBeenCalledTimes(2)
        expect(nestedScopedCallback).toHaveBeenCalledTimes(2)
        rootStore.set(anAtom, "root 2")
        expect(rootCallback).toHaveBeenCalledTimes(2)
        expect(scopedCallback).toHaveBeenCalledTimes(2)
        expect(nestedScopedCallback).toHaveBeenCalledTimes(2)
        nestedScopedStore.set(anAtom, "nested 1")
        expect(rootStore.data.subscriptions.get(anAtom)).toHaveLength(1)
        expect(scopedStore.data.subscriptions.get(anAtom)).toHaveLength(1)
        expect(nestedScopedStore.data.subscriptions.get(anAtom)).toHaveLength(1)
        expect(rootCallback).toHaveBeenCalledTimes(2)
        expect(scopedCallback).toHaveBeenCalledTimes(2)
        expect(nestedScopedCallback).toHaveBeenCalledTimes(3)
        scopedStore.set(anAtom, "scoped 2")
        expect(rootCallback).toHaveBeenCalledTimes(2)
        expect(scopedCallback).toHaveBeenCalledTimes(3)
        expect(nestedScopedCallback).toHaveBeenCalledTimes(3)
        rootStore.set(anAtom, "root 3")
        expect(rootCallback).toHaveBeenCalledTimes(3)
        expect(scopedCallback).toHaveBeenCalledTimes(3)
        expect(nestedScopedCallback).toHaveBeenCalledTimes(3)
        rootUnsub()
        scopedUnsub()
        nestedUnsub()
        expect(rootStore.data.subscriptions.get(anAtom)).toBeUndefined()
        expect(scopedStore.data.subscriptions.get(anAtom)).toBeUndefined()
        expect(nestedScopedStore.data.subscriptions.get(anAtom)).toBeUndefined()
    })
})
