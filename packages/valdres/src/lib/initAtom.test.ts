import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { wait } from "../../test/utils/wait"
import { initAtom } from "./initAtom"

describe("initAtom", () => {
    test("Atom with simple defaultValue", () => {
        const store1 = store()
        const numberAtom = atom(1)
        expect(store1.data.values.get(numberAtom)).toBeUndefined()
        initAtom(numberAtom, store1.data)
        expect(store1.data.values.get(numberAtom)).toBe(1)
    })

    test("Atom with sync callback default value", () => {
        const store1 = store()
        const callback = mock(() => "Foo")
        const callbackAtom = atom(callback)
        expect(store1.data.values.get(callbackAtom)).toBeUndefined()
        initAtom(callbackAtom, store1.data)
        expect(callback).toHaveBeenCalledTimes(1)
        expect(store1.data.values.get(callbackAtom)).toBe("Foo")
    })

    test("Atom with no default value", async () => {
        const store1 = store()
        const emptyAtom = atom()
        expect(store1.data.values.get(emptyAtom)).toBeUndefined()
        initAtom(emptyAtom, store1.data)
        const res = store1.data.values.get(emptyAtom)
        expect(res).toBeInstanceOf(Promise)

        expect(res).toBeInstanceOf(Promise)
        let resolved: string | undefined
        res.then(val => (resolved = val))
        store1.set(emptyAtom, "Foo")
        expect(resolved).toBeUndefined()
        await wait(1)
        expect(resolved).toEqual("Foo")
    })

    test("Atom with callback that returns a promise", async () => {
        const store1 = store()
        const callback = mock(() => wait(10).then(() => "Bar"))
        const callbackAtom = atom<string>(callback)
        const value = store1.get(callbackAtom)
        expect(value).toBeInstanceOf(Promise)
        const subscriptionCallback = mock(() => {})
        const unsubscribe = store1.sub(callbackAtom, subscriptionCallback)
        const res = await value
        expect(res).toBe("Bar")
        expect(subscriptionCallback).toHaveBeenCalledTimes(1)
        expect(store1.data.subscriptions.get(callbackAtom)).toHaveLength(1)
        unsubscribe()
        expect(store1.data.subscriptions.get(callbackAtom)).toBeUndefined()
    })

    // onSet means "on set" — a user write. An async default resolving its own
    // initial value is initialization, not a set, so onSet must stay silent.
    // (The set path fires onSet on async resolve; see lib/setAtom.test.ts
    // "async updater calls onSet after resolution" — the deliberate inverse.)
    test("async default resolving does not fire onSet", async () => {
        const store1 = store()
        const onSet = mock(() => {})
        const callbackAtom = atom<string>(() => wait(10).then(() => "Bar"), {
            onSet,
        })
        const value = store1.get(callbackAtom)
        expect(value).toBeInstanceOf(Promise)
        const res = await value
        expect(res).toBe("Bar")
        expect(store1.get(callbackAtom)).toBe("Bar")
        // Initialization resolved the value but is not a "set".
        expect(onSet).toHaveBeenCalledTimes(0)
    })
})
