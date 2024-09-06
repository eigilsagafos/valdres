import { describe, test, expect, mock } from "bun:test"
import { createStore } from "../createStore"
import { atom } from "../atom"
import { wait } from "../../test/utils/wait"
import { initAtom } from "./initAtom"

describe("initAtom", () => {
    test("Atom with simple defaultValue", () => {
        const store = createStore()
        const numberAtom = atom(1)
        expect(store.data.values.get(numberAtom)).toBeUndefined()
        const res = initAtom(numberAtom, store.data)
        expect(res).toBe(1)
        expect(store.data.values.get(numberAtom)).toBe(1)
    })

    test("Atom with sync callback default value", () => {
        const store = createStore()
        const callback = mock(() => "Foo")
        const callbackAtom = atom(callback)
        expect(store.data.values.get(callbackAtom)).toBeUndefined()
        const res = initAtom(callbackAtom, store.data)
        expect(res).toBe("Foo")
        expect(callback).toHaveBeenCalledTimes(1)
        expect(store.data.values.get(callbackAtom)).toBe("Foo")
    })

    test("Atom with no default value", async () => {
        const store = createStore()
        const emptyAtom = atom()
        expect(store.data.values.get(emptyAtom)).toBeUndefined()
        const promise: Promise<string> = initAtom(emptyAtom, store.data)
        expect(promise).toBeInstanceOf(Promise)
        let resolved: string | undefined
        promise.then((val) => (resolved = val))
        store.set(emptyAtom, "Foo")
        expect(resolved).toBeUndefined()
        await wait(1)
        expect(resolved).toEqual("Foo")
    })

    test("Atom with callback that returns a promise", async () => {
        const store = createStore()
        const callback = mock(() => wait(10).then(() => "Bar"))
        const callbackAtom = atom<string>(callback)
        const value = store.get(callbackAtom)
        expect(value).toBeInstanceOf(Promise)
        const subscriptionCallback = mock(() => {})
        const unsubscribe = store.sub(callbackAtom, subscriptionCallback)
        const res = await value
        expect(res).toBe("Bar")
        expect(subscriptionCallback).toHaveBeenCalledTimes(1)
        expect(store.data.subscriptions.get(callbackAtom)?.size).toBe(1)
        unsubscribe()
        expect(store.data.subscriptions.get(callbackAtom)?.size).toBe(0)
    })
})
