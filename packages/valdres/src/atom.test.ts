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

    test("onMount fires when subscribing to a selector that depends on the atom", () => {
        const store1 = store()
        const onUnmount = mock(() => {})
        const onMount = mock(() => onUnmount)
        const baseAtom = atom(0, { onMount })
        const derived = selector(get => get(baseAtom) * 2)

        const unsub = store1.sub(derived, () => {})
        expect(onMount).toHaveBeenCalledTimes(1)
        expect(onUnmount).toHaveBeenCalledTimes(0)

        unsub()
        expect(onUnmount).toHaveBeenCalledTimes(1)
    })

    test("onMount fires when atom becomes a transitive dependency of a subscribed selector", () => {
        const store1 = store()
        const condAtom = atom(false)
        const onUnmount = mock(() => {})
        const onMount = mock(() => onUnmount)
        const baseAtom = atom("hello", { onMount })

        // Selector conditionally depends on baseAtom
        const derived = selector(get => {
            if (get(condAtom)) return get(baseAtom)
            return "default"
        })

        // Subscribe to derived — baseAtom is NOT a dependency yet
        store1.sub(derived, () => {})
        expect(onMount).toHaveBeenCalledTimes(0)

        // Now make baseAtom a dependency by changing the condition
        store1.set(condAtom, true)
        expect(onMount).toHaveBeenCalledTimes(1)
        expect(onUnmount).toHaveBeenCalledTimes(0)
    })

    test("onUnmount fires when atom is no longer a transitive dependency", () => {
        const store1 = store()
        const condAtom = atom(true)
        const onUnmount = mock(() => {})
        const onMount = mock(() => onUnmount)
        const baseAtom = atom(0, { onMount })

        const derived = selector(get => {
            if (get(condAtom)) return get(baseAtom)
            return "unused"
        })

        store1.sub(derived, () => {})
        expect(onMount).toHaveBeenCalledTimes(1)

        // Remove baseAtom from dependency graph
        store1.set(condAtom, false)
        expect(onUnmount).toHaveBeenCalledTimes(1)
    })

    test("onMount setSelf updates value for transitive dependents", () => {
        const store1 = store()
        const condAtom = atom(false)
        const baseAtom = atom(0, {
            onMount: (store1, state) => {
                store1.set(state, 42)
            },
        })

        const derived = selector(get => {
            if (get(condAtom)) return get(baseAtom)
            return -1
        })

        store1.sub(derived, () => {})
        expect(store1.get(derived)).toBe(-1)

        store1.set(condAtom, true)
        expect(store1.get(baseAtom)).toBe(42)
        expect(store1.get(derived)).toBe(42)
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

    test("mutable atom", () => {
        const store1 = store()
        const mutableObject = {}
        const immutableObject = {}
        const immutableAtom = atom(undefined)
        const mutableAtom = atom(undefined, { mutable: true })
        store1.set(immutableAtom, immutableObject)
        store1.set(mutableAtom, mutableObject)
        expect(() => (immutableObject.foo = "bar")).toThrowError()
        expect(() => (mutableObject.foo = "bar")).not.toThrowError()
    })
})

describe("atom with promise values", () => {
    test("setting a different promise replaces the value", () => {
        const store1 = store()
        const countAtom = atom(Promise.resolve(0))
        const infinitePending = new Promise<never>(() => {})
        store1.set(countAtom, infinitePending)
        expect(store1.get(countAtom)).toBe(infinitePending)
    })

    test("setting the same promise is a no-op", () => {
        const store1 = store()
        const p = Promise.resolve(1)
        const countAtom = atom(p)
        const callback = mock(() => {})
        store1.sub(countAtom, callback)
        store1.set(countAtom, p)
        expect(callback).not.toHaveBeenCalled()
    })
})

describe("subscriber error handling", () => {
    test("all subscribers are notified even if one throws", () => {
        const store1 = store()
        const countAtom = atom(0)
        const callbackA = mock(() => {})
        const callbackB = mock(() => {
            throw new Error("subscriber error")
        })
        const callbackC = mock(() => {})

        store1.sub(countAtom, callbackA)
        store1.sub(countAtom, callbackB)
        store1.sub(countAtom, callbackC)

        try {
            store1.set(countAtom, 1)
        } catch {
            // expected
        }

        expect(callbackA).toHaveBeenCalledTimes(1)
        expect(callbackB).toHaveBeenCalledTimes(1)
        expect(callbackC).toHaveBeenCalledTimes(1)
    })

    test("store.set rethrows the first subscriber error", () => {
        const store1 = store()
        const countAtom = atom(0)
        store1.sub(countAtom, () => {})
        store1.sub(countAtom, () => {
            throw new Error("subscriber error")
        })
        store1.sub(countAtom, () => {})

        expect(() => store1.set(countAtom, 1)).toThrow("subscriber error")
    })
})
