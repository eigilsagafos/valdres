import { describe, test, expect, mock, spyOn } from "bun:test"
import { atom } from "./atom"
import { selector } from "./selector"
import { store } from "./store"
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
        const store1 = store()
        const ageAtom = atom<number>(24)
        const ageDoubleSelector = selector<number>(get => get(ageAtom) * 2)

        store1.set(ageAtom, 20)
        expect(store1.get(ageAtom)).toBe(20)
        expect(store1.get(ageDoubleSelector)).toBe(40)

        store1.set(ageAtom, 30)
        expect(store1.get(ageAtom)).toBe(30)
        expect(store1.get(ageDoubleSelector)).toBe(60)
    })

    test("get in default function", () => {
        const store1 = store()
        const atom1 = atom<number>(10)
        const atom2 = atom(() => store1.get(atom1) + 10)

        expect(store1.get(atom1)).toBe(10)
        expect(store1.get(atom2)).toBe(20)
        store1.set(atom1, 11)
        expect(store1.get(atom1)).toBe(11)
        expect(store1.get(atom2)).toBe(20)
        store1.reset(atom2)
        expect(store1.get(atom2)).toBe(21)
    })

    test("set with function", () => {
        const store1 = store()
        const numberAtom = atom(10)
        expect(store1.get(numberAtom)).toBe(10)
        store1.set(numberAtom, curr => curr * 10)
        expect(store1.get(numberAtom)).toBe(100)
    })

    test("async default", () => {
        const store1 = store()
        const asyncFunction = () =>
            new Promise(resolve => setTimeout(() => resolve("done"), 100))
        const numberAtom = atom(asyncFunction)
        const res = store1.get(numberAtom)
    })

    test("onMount", () => {
        const store1 = store()
        const onUnmountCallback = mock(() => {})
        const onMountCallback = mock(() => {
            return onUnmountCallback
        })
        const user1 = atom("Foo", {
            onMount: onMountCallback,
        })
        expect(store1.get(user1)).toBe("Foo")
        expect(onMountCallback).toHaveBeenCalledTimes(0)
        expect(onUnmountCallback).toHaveBeenCalledTimes(0)
        const unsubscribe = store1.sub(user1, () => {})
        expect(onMountCallback).toHaveBeenCalledTimes(1)
        expect(onUnmountCallback).toHaveBeenCalledTimes(0)
        unsubscribe()
        expect(onMountCallback).toHaveBeenCalledTimes(1)
        expect(onUnmountCallback).toHaveBeenCalledTimes(1)
    })

    test("onInit", () => {
        const store1 = store()
        const onInitCallback = mock(() => {})
        const user1 = atom("Foo", {
            onInit: onInitCallback,
        })
        expect(store1.get(user1)).toBe("Foo")
        expect(onInitCallback).toHaveBeenCalledTimes(1)
    })

    test("onInit atom with no value", () => {
        const store1 = store()
        const onInitCallback = mock(setSelf => setSelf("Foo"))
        const user1 = atom<string>(undefined, {
            onInit: onInitCallback,
        })
        expect(store1.get(user1)).toBe("Foo")
        expect(onInitCallback).toHaveBeenCalledTimes(1)
    })

    test("atom with selector as default value", () => {
        const store1 = store()
        const atom1 = atom(1)
        const selector1 = selector(get => get(atom1))
        const atom2 = atom(selector1)
        expect(store1.get(atom2)).toBe(1)
        store1.set(atom1, 2)
        expect(store1.get(atom1)).toBe(2)
        expect(store1.get(atom2)).toBe(1)
        store1.set(atom2, 3)
        expect(store1.get(atom1)).toBe(2)
        expect(store1.get(atom2)).toBe(3)
    })

    test("atom with maxAge", async () => {
        const setIntervalSpy = spyOn(global, "setInterval")
        const clearIntervalSpy = spyOn(global, "clearInterval")
        const store1 = store()
        const atom1 = atom(() => Date.now(), { maxAge: 2 })
        const res: any[] = []
        expect(setIntervalSpy).toHaveBeenCalledTimes(0)
        expect(clearIntervalSpy).toHaveBeenCalledTimes(0)

        const callback = mock(() => {
            res.push(store1.get(atom1))
        })
        const unsubscribe = store1.sub(atom1, callback)
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
        const store1 = store()
        let count = 0
        const atomCallback = async () =>
            wait(1).then(() => {
                count++
                return count
            })
        const atom1 = atom(atomCallback, { maxAge: 3 })

        const res: number[] = []
        const callback = mock(() => {
            res.push(store1.get(atom1))
        })
        const unsubscribe = store1.sub(atom1, callback)
        expect(setInterval).toHaveBeenCalledTimes(1)
        expect(res).toStrictEqual([])
        await waitFor(() => expect(store1.get(atom1)).toBeInstanceOf(Promise))
        await waitFor(() => expect(store1.get(atom1)).toBe(1))
        expect(res).toStrictEqual([1])
        expect(callback).toHaveBeenCalledTimes(1)
        // await waitFor(() => expect(store1.get(atom1)).toBeInstanceOf(Promise))
        // await waitFor(() => expect(store1.get(atom1)).toBe(2))
        // expect(res).toStrictEqual([1, 2])
        // expect(callback).toHaveBeenCalledTimes(2)
        // await waitFor(() => expect(store1.get(atom1)).toBeInstanceOf(Promise))
        // await waitFor(() => expect(store1.get(atom1)).toBe(3))
        // expect(res).toStrictEqual([1, 2, 3])
        // expect(callback).toHaveBeenCalledTimes(3)
        // unsubscribe()
        // expect(setInterval).toHaveBeenCalledTimes(1)
        // expect(clearInterval).toHaveBeenCalledTimes(1)
    })

    test.todo("atom with maxAge async and staleWhileRevalidate", async () => {
        const setIntervalSpy = spyOn(global, "setInterval")
        const clearIntervalSpy = spyOn(global, "clearInterval")
        const store1 = store()
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
            res.push(store1.get(atom1))
        })
        const unsubscribe = store1.sub(atom1, callback)
        expect(setIntervalSpy).toHaveBeenCalledTimes(1)
        expect(clearIntervalSpy).toHaveBeenCalledTimes(0)
        await waitFor(() => expect(store1.get(atom1)).toBe(1))
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
