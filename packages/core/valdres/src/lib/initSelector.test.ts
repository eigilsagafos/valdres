import { describe, test, expect, mock } from 'bun:test'
import { createStore } from '../createStore'
import { atom } from '../atom'
import { wait } from '../../test/utils/wait'
import { initAtom } from './initAtom'
import { selector } from '../selector'
import { initSelector } from './initSelector'

describe("initSelector", () => {
    // test("Selector with simple sync callback", () => {
    //     const store = createStore()
    //     const callback = mock(() => 1)
    //     const syncCallbackSelector = selector(callback)
    //     expect(callback).toHaveBeenCalledTimes(0)
    //     const res = initSelector(syncCallbackSelector, store)
    //     expect(callback).toHaveBeenCalledTimes(1)
    //     expect(res).toBe(1)
    //     expect(store.get(syncCallbackSelector)).toBe(1)
    //     expect(callback).toHaveBeenCalledTimes(1)
    // })

    // test("Selector with simple async callback", async () => {
    //     const store = createStore()
    //     const callback = mock(() => wait(5).then(() => "Foo"))
    //     const asyncCallbackSelector = selector(callback)
    //     expect(callback).toHaveBeenCalledTimes(0)
    //     const res = initSelector(asyncCallbackSelector, store)
    //     expect(callback).toHaveBeenCalledTimes(1)
    //     expect(res).toBeInstanceOf(Promise)
    //     let promiseResolvedValue
    //     res.then(value => promiseResolvedValue = value)
    //     await wait(5)
    //     expect(promiseResolvedValue).toBe("Foo")
    //     expect(store.get(asyncCallbackSelector)).toBe("Foo")
    // })


    test("selector with simple atom", () => {
        const store = createStore()
        const atom1 = atom(1)
        const callback = mock((get) => get(atom1))
        const selector1 = selector(callback)
        expect(store.get(selector1)).toBe(1)
        store.set(atom1, 2)
        expect(store.get(selector1)).toBe(2)
    })

    test("atom < selector1 < selector2", () => {
        const store = createStore()
        const atom1 = atom(1)
        const callback1 = mock((get) => get(atom1) + 1)
        const selector1 = selector(callback1)
        const callback2 = mock((get) => get(selector1) + 1)
        const selector2 = selector(callback2)
        expect(store.get(selector2)).toBe(3)
        expect(callback1).toHaveBeenCalledTimes(1)
        expect(callback2).toHaveBeenCalledTimes(1)
        // console.log(`\n\n\n\n\n\n`)
        store.set(atom1, 2)
        // expect(callback1).toHaveBeenCalledTimes(2)
        // expect(callback2).toHaveBeenCalledTimes(2)
        // expect(store.get(selector2)).toBe(4)
    })

    // test("Atom with sync callback default value", () => {
    //     const store = createStore()
    //     const callback = mock(() => "Foo")
    //     const callbackAtom = atom(callback)
    //     expect(store.values.get(callbackAtom)).toBeUndefined()
    //     const res = initAtom(callbackAtom, store)
    //     expect(res).toBe("Foo")
    //     expect(callback).toHaveBeenCalledTimes(1)
    //     expect(store.values.get(callbackAtom)).toBe("Foo")  
    // })


    // test("Atom with no default value", async () => {
    //     const store = createStore()
    //     const emptyAtom = atom()
    //     expect(store.values.get(emptyAtom)).toBeUndefined()
    //     const promise: Promise<string> = initAtom(emptyAtom, store)
    //     expect(promise).toBeInstanceOf(Promise)
    //     let resolved: string | undefined
    //     promise.then(val => resolved = val)
    //     store.set(emptyAtom, "Foo")
    //     expect(resolved).toBeUndefined()
    //     await wait(1)
    //     expect(resolved).toEqual("Foo")
    // })

    // test("Atom with callback that returns a promise",async  () => {
    //     const store = createStore()
    //     const callback = mock(() => wait(10).then(() => "Bar"))
    //     const callbackAtom = atom<string>(callback)
    //     const value = store.get(callbackAtom)
    //     expect(value).toBeInstanceOf(Promise)
    //     const subscriptionCallback = mock((newValue, oldValue) => {
    //         expect(newValue).toBe("Bar")
    //         expect(oldValue).toBe(value)
    //     })
    //     const unsubscribe = store.sub(callbackAtom, subscriptionCallback)
    //     const res = await value
    //     expect(res).toBe("Bar")
    //     expect(subscriptionCallback).toHaveBeenCalledTimes(1)
    //     expect(store.subscribers.get(callbackAtom)?.size).toBe(1)
    //     unsubscribe()
    //     expect(store.subscribers.get(callbackAtom)?.size).toBe(0)
    // })
})  
