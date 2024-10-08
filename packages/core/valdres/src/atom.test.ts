import { describe, test, expect, mock, spyOn } from "bun:test"
import { atom } from "./atom"
import { selector } from "./selector"
import { createStore } from "./createStore"
import { wait } from "../test/utils/wait"

const waitFor = async (callback, count = 0) => {
    try {
        callback()
        return
    } catch (e) {
        await wait(1)
        return waitFor(callback, count++)
    }
}

describe("atom", () => {
    test("is good", () => {
        const store = createStore()
        const ageAtom = atom<number>(24)
        const ageDoubleSelector = selector<number>(get => get(ageAtom) * 2)

        store.set(ageAtom, 20)
        expect(store.get(ageAtom)).toBe(20)
        expect(store.get(ageDoubleSelector)).toBe(40)

        store.set(ageAtom, 30)
        expect(store.get(ageAtom)).toBe(30)
        expect(store.get(ageDoubleSelector)).toBe(60)
    })

    test("get in default function", () => {
        const store = createStore()
        const atom1 = atom<number>(10)
        const atom2 = atom(() => store.get(atom1) + 10)

        expect(store.get(atom1)).toBe(10)
        expect(store.get(atom2)).toBe(20)
        store.set(atom1, 11)
        expect(store.get(atom1)).toBe(11)
        expect(store.get(atom2)).toBe(20)
        store.reset(atom2)
        expect(store.get(atom2)).toBe(21)
    })

    test("set with function", () => {
        const store = createStore()
        const numberAtom = atom(10)
        expect(store.get(numberAtom)).toBe(10)
        store.set(numberAtom, curr => curr * 10)
        expect(store.get(numberAtom)).toBe(100)
    })

    test("async default", () => {
        const store = createStore()
        const asyncFunction = () =>
            new Promise(resolve => setTimeout(() => resolve("done"), 100))
        const numberAtom = atom(asyncFunction)
        const res = store.get(numberAtom)
    })

    test("onMount", () => {
        const store = createStore()
        const onUnmountCallback = mock(() => {})
        const onMountCallback = mock(() => {
            return onUnmountCallback
        })
        const user1 = atom("Foo", {
            onMount: onMountCallback,
        })
        expect(store.get(user1)).toBe("Foo")
        expect(onMountCallback).toHaveBeenCalledTimes(0)
        expect(onUnmountCallback).toHaveBeenCalledTimes(0)
        const unsubscribe = store.sub(user1, () => {})
        expect(onMountCallback).toHaveBeenCalledTimes(1)
        expect(onUnmountCallback).toHaveBeenCalledTimes(0)
        unsubscribe()
        expect(onMountCallback).toHaveBeenCalledTimes(1)
        expect(onUnmountCallback).toHaveBeenCalledTimes(1)
    })

    test("onInit", () => {
        const store = createStore()
        const onInitCallback = mock(() => {})
        const user1 = atom("Foo", {
            onInit: onInitCallback,
        })
        expect(store.get(user1)).toBe("Foo")
        expect(onInitCallback).toHaveBeenCalledTimes(1)
    })

    test("onInit atom with no value", () => {
        const store = createStore()
        const onInitCallback = mock(setSelf => setSelf("Foo"))
        const user1 = atom<string>(undefined, {
            onInit: onInitCallback,
        })
        expect(store.get(user1)).toBe("Foo")
        expect(onInitCallback).toHaveBeenCalledTimes(1)
    })

    test("atom with selector as default value", () => {
        const store = createStore()
        const atom1 = atom(1)
        const selector1 = selector(get => get(atom1))
        const atom2 = atom(selector1)
        expect(store.get(atom2)).toBe(1)
        store.set(atom1, 2)
        expect(store.get(atom1)).toBe(2)
        expect(store.get(atom2)).toBe(1)
        store.set(atom2, 3)
        expect(store.get(atom1)).toBe(2)
        expect(store.get(atom2)).toBe(3)
    })

    test.only("atom with maxAge", async () => {
        const setIntervalSpy = spyOn(global, "setInterval")
        const clearIntervalSpy = spyOn(global, "clearInterval")
        const store = createStore()
        const atom1 = atom(() => Date.now(), { maxAge: 2 })
        const res = []
        expect(setIntervalSpy).toHaveBeenCalledTimes(0)
        expect(clearIntervalSpy).toHaveBeenCalledTimes(0)

        const callback = mock(() => {
            res.push(store.get(atom1))
        })
        const unsubscribe = store.sub(atom1, callback)
        expect(setIntervalSpy).toHaveBeenCalledTimes(1)
        expect(clearIntervalSpy).toHaveBeenCalledTimes(0)
        await wait(2)
        expect(callback).toHaveBeenCalledTimes(1)
        expect(res).toHaveLength(1)
        await wait(2)
        expect(callback).toHaveBeenCalledTimes(2)
        expect(res).toHaveLength(2)
        unsubscribe()
        expect(clearIntervalSpy).toHaveBeenCalledTimes(1)
        await wait(4)
        expect(callback).toHaveBeenCalledTimes(2)
        expect(res).toHaveLength(2)
        setIntervalSpy.mockReset()
        clearIntervalSpy.mockReset()
    })

    test.todo("atom with maxAge async", async () => {
        const setIntervalSpy = spyOn(global, "setInterval")
        const clearIntervalSpy = spyOn(global, "clearInterval")
        const store = createStore()
        let count = 0
        const atomCallback = async () =>
            wait(1).then(() => {
                count++
                return count
            })
        const atom1 = atom(atomCallback, { maxAge: 3 })

        const res: number[] = []
        const callback = mock(() => {
            res.push(store.get(atom1))
        })
        const unsubscribe = store.sub(atom1, callback)
        expect(setInterval).toHaveBeenCalledTimes(1)
        expect(res).toStrictEqual([])
        await waitFor(() => expect(store.get(atom1)).toBeInstanceOf(Promise))
        await waitFor(() => expect(store.get(atom1)).toBe(1))
        expect(res).toStrictEqual([1])
        expect(callback).toHaveBeenCalledTimes(1)
        // await waitFor(() => expect(store.get(atom1)).toBeInstanceOf(Promise))
        // await waitFor(() => expect(store.get(atom1)).toBe(2))
        // expect(res).toStrictEqual([1, 2])
        // expect(callback).toHaveBeenCalledTimes(2)
        // await waitFor(() => expect(store.get(atom1)).toBeInstanceOf(Promise))
        // await waitFor(() => expect(store.get(atom1)).toBe(3))
        // expect(res).toStrictEqual([1, 2, 3])
        // expect(callback).toHaveBeenCalledTimes(3)
        // unsubscribe()
        // expect(setInterval).toHaveBeenCalledTimes(1)
        // expect(clearInterval).toHaveBeenCalledTimes(1)
    })

    test("atom with maxAge async and staleWhileRevalidate", async () => {
        const setIntervalSpy = spyOn(global, "setInterval")
        const clearIntervalSpy = spyOn(global, "clearInterval")
        const store = createStore()
        let startCount = 0
        let completeCount = 0
        let waitMs = 2
        const atomCallback = async () => {
            startCount++
            return wait(waitMs).then(() => {
                completeCount++
                return completeCount
            })
        }

        const atom1 = atom(atomCallback, { maxAge: 5, staleWhileRevalidate: 5 })

        const res: number[] = []
        const callback = mock(() => {
            res.push(store.get(atom1))
        })
        const unsubscribe = store.sub(atom1, callback)
        expect(setIntervalSpy).toHaveBeenCalledTimes(1)
        expect(clearIntervalSpy).toHaveBeenCalledTimes(0)
        await waitFor(() => expect(store.get(atom1)).toBe(1))
        expect(startCount).toBe(1)
        await wait(3)
        expect(startCount).toBe(2)
        expect(completeCount).toBe(1)
        await wait(6)
        expect(startCount).toBe(2)
        expect(completeCount).toBe(2)
        unsubscribe()
        expect(clearIntervalSpy).toHaveBeenCalledTimes(1)
        setIntervalSpy.mockReset()
        clearIntervalSpy.mockReset()
    })
})
