import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { setAtom } from "./setAtom"
import { selector } from "../selector"
import { isPromiseLike } from "../utils/isPromiseLike"

describe("setAtom", () => {
    test("set with direct value", () => {
        const store1 = store()
        const numberAtom = atom(1)
        expect(store1.data.values.get(numberAtom)).toBeUndefined()
        setAtom(numberAtom, 2, store1.data)
        expect(store1.data.values.get(numberAtom)).toBe(2)
    })

    test("set with callback", () => {
        const store1 = store()
        const numberAtom = atom(1)
        expect(store1.data.values.get(numberAtom)).toBeUndefined()
        setAtom(numberAtom, current => current + 1, store1.data)
        expect(store1.data.values.get(numberAtom)).toBe(2)
    })

    test("set returns the new value", () => {
        const store1 = store()
        const numberAtom = atom(1)
        const returnedValue = setAtom(
            numberAtom,
            current => current + 1,
            store1.data,
        )
        expect(returnedValue).toBe(2)
    })

    test("set with same value does not trigger selectors and subscribers to re-evalute", () => {
        const store1 = store()
        const numberAtom = atom(1)
        const selectorCallback = mock(get => get(numberAtom) + 1)
        const multiplySelector = selector(selectorCallback)
        expect(store1.get(multiplySelector)).toBe(2)
        expect(selectorCallback).toHaveBeenCalledTimes(1)
        store1.set(numberAtom, 1)
        expect(selectorCallback).toHaveBeenCalledTimes(1)
        expect(store1.get(multiplySelector)).toBe(2)
        expect(selectorCallback).toHaveBeenCalledTimes(2) // this could be 1 if we optimize, getting the multiplySelector wrongly triggers a re eval
    })

    test("check deep freeze", () => {
        const defaultStore = store()
        const postAtom = atom({ tags: ["tag1"] })
        const post = defaultStore.get(postAtom)
        expect(post.tags).toEqual(["tag1"])
        expect(() => post.tags.push("tag2")).toThrowError(
            "Attempted to assign to readonly property",
        )
    })

    test("set with bare promise stores it then resolves", async () => {
        const store1 = store()
        const stringAtom = atom("initial")
        store1.get(stringAtom)
        const promise = Promise.resolve("updated")
        const result = setAtom(stringAtom, promise, store1.data)
        expect(isPromiseLike(result)).toBe(true)
        expect(store1.data.values.get(stringAtom)).toBe(promise)
        await result
        expect(store1.data.values.get(stringAtom)).toBe("updated")
    })

    test("set with bare rejected promise reverts to previous value", async () => {
        const store1 = store()
        const stringAtom = atom("initial")
        store1.get(stringAtom)
        const result = setAtom(
            stringAtom,
            Promise.reject(new Error("boom")),
            store1.data,
        )
        try { await result } catch {}
        await Promise.resolve()
        expect(store1.get(stringAtom)).toBe("initial")
    })

    test("set with a bare thenable normalizes to a real Promise", async () => {
        const store1 = store()
        const stringAtom = atom("initial")
        store1.get(stringAtom)
        // Minimal thenable: .then is a function but no .catch/.finally
        const thenable: PromiseLike<string> = {
            then(onFulfilled) {
                return Promise.resolve(
                    onFulfilled ? onFulfilled("adopted") : ("adopted" as any),
                ) as any
            },
        }
        const result = setAtom(stringAtom, thenable, store1.data)
        expect(result instanceof Promise).toBe(true)
        await result
        expect(store1.get(stringAtom)).toBe("adopted")
    })

    test("set with async updater stores promise then resolves", async () => {
        const store1 = store()
        const stringAtom = atom("initial")
        store1.get(stringAtom) // initialize
        const result = setAtom(
            stringAtom,
            current => Promise.resolve(current + " updated"),
            store1.data,
        )
        expect(isPromiseLike(result)).toBe(true)
        await result
        expect(store1.data.values.get(stringAtom)).toBe("initial updated")
    })

    test("async updater notifies subscribers after resolution", async () => {
        const store1 = store()
        const stringAtom = atom("hello")
        store1.get(stringAtom)
        const callback = mock(() => {})
        store1.sub(stringAtom, callback)
        const result = setAtom(
            stringAtom,
            () => Promise.resolve("world"),
            store1.data,
        )
        // Subscriber called once with the promise value
        expect(callback).toHaveBeenCalledTimes(1)
        await result
        // Called again after promise resolves with final value
        expect(callback).toHaveBeenCalledTimes(2)
        expect(store1.get(stringAtom)).toBe("world")
    })

    test("async updater race condition: later set wins", async () => {
        const store1 = store()
        const stringAtom = atom("initial")
        store1.get(stringAtom)

        let resolveFirst!: (v: string) => void
        let resolveSecond!: (v: string) => void
        const first = new Promise<string>(r => { resolveFirst = r })
        const second = new Promise<string>(r => { resolveSecond = r })

        setAtom(stringAtom, () => first, store1.data)
        setAtom(stringAtom, () => second, store1.data)

        // Resolve first call AFTER second was already issued
        resolveSecond("second")
        await second
        resolveFirst("first")
        await first

        // The atom should hold "second" — last-write-wins, not last-resolve
        expect(store1.get(stringAtom)).toBe("second")
    })

    test("async updater rejection does not leave atom in broken state", async () => {
        const store1 = store()
        const stringAtom = atom("initial")
        store1.get(stringAtom)

        const result = setAtom(
            stringAtom,
            () => Promise.reject(new Error("boom")),
            store1.data,
        )

        try { await result } catch {}
        // Allow the .catch() handler microtask to run
        await Promise.resolve()

        // After rejection, atom should revert to original value, not hold a rejected promise
        expect(store1.get(stringAtom)).toBe("initial")
    })

    test("async updater calls onSet after resolution", async () => {
        const onSetMock = mock(() => {})
        const store1 = store()
        const stringAtom = atom<string>("initial", { onSet: onSetMock })
        store1.get(stringAtom)

        const result = setAtom(
            stringAtom,
            () => Promise.resolve("updated"),
            store1.data,
        )
        // onSet should NOT be called synchronously with the promise
        expect(onSetMock).toHaveBeenCalledTimes(0)

        await result
        // onSet should be called once the resolved value is set
        expect(onSetMock).toHaveBeenCalledTimes(1)
        expect(onSetMock).toHaveBeenCalledWith("updated", store1.data)
    })

    test("async updater resolves __isEmptyAtomPromise__", async () => {
        const store1 = store()
        const emptyAtom = atom<string>()

        // Reading the empty atom gives us the suspense promise
        const suspensePromise = store1.get(emptyAtom) as Promise<string>

        const result = setAtom(
            emptyAtom,
            () => Promise.resolve("resolved"),
            store1.data,
        )

        await result
        // The original suspense promise should also resolve
        const suspenseResult = await suspensePromise
        expect(suspenseResult).toBe("resolved")
        expect(store1.get(emptyAtom)).toBe("resolved")
    })

    test("async updater with same promise reference is a no-op", async () => {
        const store1 = store()
        const shared = Promise.resolve("shared")
        const promiseAtom = atom<string | Promise<string>>(() => shared)
        store1.get(promiseAtom) // initialize — stores the promise
        const callback = mock(() => {})
        store1.sub(promiseAtom, callback)

        // Updater returns the exact same promise reference
        setAtom(promiseAtom, () => shared, store1.data)
        // Should be a no-op — no subscriber notification
        expect(callback).toHaveBeenCalledTimes(0)
    })

    test("racing async updaters on empty atom resolve suspense promise", async () => {
        const store1 = store()
        const emptyAtom = atom<string>()

        // Reading gives us the original suspense promise
        const suspensePromise = store1.get(emptyAtom) as Promise<string>

        let resolveFirst!: (v: string) => void
        let resolveSecond!: (v: string) => void
        const first = new Promise<string>(r => { resolveFirst = r })
        const second = new Promise<string>(r => { resolveSecond = r })

        setAtom(emptyAtom, () => first, store1.data)
        setAtom(emptyAtom, () => second, store1.data)

        // Resolve stale first, then the winner
        resolveFirst("first")
        await first
        resolveSecond("second")
        await second

        // Suspense promise should resolve to the last-write-wins value
        const suspenseResult = await suspensePromise
        expect(suspenseResult).toBe("second")
        expect(store1.get(emptyAtom)).toBe("second")
    })

    test("async updater onSet throwing does not escape as unhandled rejection", async () => {
        const rejections: unknown[] = []
        const handler = (err: unknown) => rejections.push(err)
        process.on("unhandledRejection", handler)
        try {
            const onSetMock = mock(() => {
                throw new Error("onSet boom")
            })
            const store1 = store()
            const stringAtom = atom<string>("initial", { onSet: onSetMock })
            store1.get(stringAtom)

            const result = setAtom(
                stringAtom,
                () => Promise.resolve("updated"),
                store1.data,
            )
            await result
            // Allow unhandled rejection tracking to flush
            await new Promise(r => setTimeout(r, 10))

            expect(rejections).toHaveLength(0)
        } finally {
            process.off("unhandledRejection", handler)
        }
    })

    test("deep freeze applies to function values with properties", () => {
        const defaultStore = store()
        const fn = () => "hello"
        ;(fn as any).count = 0
        // Wrap in factory to store the function itself (not call it)
        const fnAtom = atom(() => fn)
        const val = defaultStore.get(fnAtom) as any
        expect(val()).toBe("hello")
        // Functions with own properties should be frozen in dev mode,
        // preventing mutation of their attached state.
        expect(() => { val.count = 1 }).toThrowError(
            "Attempted to assign to readonly property",
        )
    })
})
