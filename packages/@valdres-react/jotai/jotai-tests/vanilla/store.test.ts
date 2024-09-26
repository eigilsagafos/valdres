import { waitFor } from "@testing-library/dom"
import { describe, test, expect, mock } from "bun:test"
import { createStore } from "../../src/createStore"
import { atom } from "../../src/atom"
// import { assert, describe, expect, it, vi } from 'vitest'
// import { atom, createStore } from "jotai/vanilla"
// import type { Getter } from "jotai/vanilla"

test("should not fire on subscribe", async () => {
    const store = createStore()
    const countAtom = atom(0)
    const callback1 = mock(() => {})
    const callback2 = mock(() => {})
    store.sub(countAtom, callback1)
    store.sub(countAtom, callback2)
    expect(callback1).not.toHaveBeenCalled()
    expect(callback2).not.toHaveBeenCalled()
})

test("should not fire subscription if primitive atom value is the same", async () => {
    const store = createStore()
    const countAtom = atom(0)
    const callback = mock(() => {})
    store.sub(countAtom, callback)
    const calledTimes = callback.mock.calls.length
    store.set(countAtom, 0)
    expect(callback).toHaveBeenCalledTimes(calledTimes)
})

test("should not fire subscription if derived atom value is the same", async () => {
    const store = createStore()
    const countAtom = atom(0)
    const derivedAtom = atom(get => get(countAtom) * 0)
    const callback = mock(() => {})
    store.sub(derivedAtom, callback)
    const calledTimes = callback.mock.calls.length
    store.set(countAtom, 1)
    expect(callback).toHaveBeenCalledTimes(calledTimes)
})

test.todo("should unmount with store.get", async () => {
    const store = createStore()
    const countAtom = atom(0)
    const callback = mock(() => {})
    const unsub = store.sub(countAtom, callback)
    store.get(countAtom)
    unsub()
    const result = Array.from(
        "dev4_get_mounted_atoms" in store ? store.dev4_get_mounted_atoms() : [],
    )
    expect(result).toEqual([])
})

test.todo("should unmount dependencies with store.get", async () => {
    const store = createStore()
    const countAtom = atom(0)
    const derivedAtom = atom(get => get(countAtom) * 2)
    const callback = mock(() => {})
    const unsub = store.sub(derivedAtom, callback)
    store.get(derivedAtom)
    unsub()
    const result = Array.from(
        "dev4_restore_atoms" in store ? store.dev4_get_mounted_atoms() : [],
    )
    expect(result).toEqual([])
})

test.todo("should update async atom with delay (#1813)", async () => {
    const countAtom = atom(0)

    const resolve: (() => void)[] = []
    const delayedAtom = atom(async get => {
        const count = get(countAtom)
        await new Promise<void>(r => resolve.push(r))
        return count
    })

    const store = createStore()
    store.get(delayedAtom)
    store.set(countAtom, 1)
    resolve.splice(0).forEach(fn => fn())
    await new Promise<void>(r => setTimeout(r)) // wait for a tick
    const promise = store.get(delayedAtom)
    resolve.splice(0).forEach(fn => fn())
    expect(await promise).toBe(1)
})

test.todo("should override a promise by setting", async () => {
    const store = createStore()
    const countAtom = atom(Promise.resolve(0))
    const infinitePending = new Promise<never>(() => {})
    store.set(countAtom, infinitePending)
    const promise1 = store.get(countAtom)
    expect(promise1).toBe(infinitePending)
    store.set(countAtom, Promise.resolve(1))
    const promise2 = store.get(countAtom)
    expect(await promise2).toBe(1)
})

test.todo(
    "should update async atom with deps after await (#1905)",
    async () => {
        const countAtom = atom(0)
        const resolve: (() => void)[] = []
        const delayedAtom = atom(async get => {
            await new Promise<void>(r => resolve.push(r))
            const count = get(countAtom)
            return count
        })
        const derivedAtom = atom(async get => {
            const count = await get(delayedAtom)
            return count
        })

        const store = createStore()
        let lastValue = store.get(derivedAtom)
        const unsub = store.sub(derivedAtom, () => {
            lastValue = store.get(derivedAtom)
        })
        store.set(countAtom, 1)
        resolve.splice(0).forEach(fn => fn())
        expect(await lastValue).toBe(1)
        store.set(countAtom, 2)
        resolve.splice(0).forEach(fn => fn())
        expect(await lastValue).toBe(2)
        store.set(countAtom, 3)
        resolve.splice(0).forEach(fn => fn())
        expect(await lastValue).toBe(3)
        unsub()
    },
)

test.todo(
    "should not fire subscription when async atom promise is the same",
    async () => {
        const promise = Promise.resolve()
        const promiseAtom = atom(promise)
        const derivedGetter = mock((get: Getter) => get(promiseAtom))
        const derivedAtom = atom(derivedGetter)

        const store = createStore()

        expect(derivedGetter).not.toHaveBeenCalled()

        const promiseListener = mock(() => {})
        const promiseUnsub = store.sub(promiseAtom, promiseListener)
        const derivedListener = mock(() => {})
        const derivedUnsub = store.sub(derivedAtom, derivedListener)

        expect(derivedGetter).toHaveBeenCalledTimes(1)
        expect(promiseListener).not.toHaveBeenCalled()
        expect(derivedListener).not.toHaveBeenCalled()

        store.get(promiseAtom)
        store.get(derivedAtom)

        expect(derivedGetter).toHaveBeenCalledTimes(1)
        expect(promiseListener).not.toHaveBeenCalled()
        expect(derivedListener).not.toHaveBeenCalled()

        store.set(promiseAtom, promise)

        expect(derivedGetter).toHaveBeenCalledTimes(1)
        expect(promiseListener).not.toHaveBeenCalled()
        expect(derivedListener).not.toHaveBeenCalled()

        store.set(promiseAtom, promise)

        expect(derivedGetter).toHaveBeenCalledTimes(1)
        expect(promiseListener).not.toHaveBeenCalled()
        expect(derivedListener).not.toHaveBeenCalled()

        promiseUnsub()
        derivedUnsub()
    },
)

test("should notify subscription with tree dependencies (#1956)", async () => {
    const valueAtom = atom(1)
    const dep1Atom = atom(get => get(valueAtom) * 2)
    const dep2Atom = atom(get => get(valueAtom) + get(dep1Atom))
    const dep3Atom = atom(get => get(dep1Atom))

    const cb = mock(() => {})
    const store = createStore()
    store.sub(
        dep2Atom,
        mock(() => {}),
    ) // this will cause the bug
    store.sub(dep3Atom, cb)

    expect(cb).toBeCalledTimes(0)
    expect(store.get(dep3Atom)).toBe(2)
    store.set(valueAtom, c => c + 1)
    expect(cb).toBeCalledTimes(1)
    expect(store.get(dep3Atom)).toBe(4)
})

test("should notify subscription with tree dependencies with bail-out", async () => {
    const valueAtom = atom(1)
    const dep1Atom = atom(get => get(valueAtom) * 2)
    const dep2Atom = atom(get => get(valueAtom) * 0)
    const dep3Atom = atom(get => get(dep1Atom) + get(dep2Atom))

    const cb = mock(() => {})
    const store = createStore()
    store.sub(
        dep1Atom,
        mock(() => {}),
    )
    store.sub(dep3Atom, cb)

    expect(cb).toBeCalledTimes(0)
    expect(store.get(dep3Atom)).toBe(2)
    store.set(valueAtom, c => c + 1)
    expect(cb).toBeCalledTimes(1)
    expect(store.get(dep3Atom)).toBe(4)
})

test.todo(
    "should bail out with the same value with chained dependency (#2014)",
    async () => {
        const store = createStore()
        const objAtom = atom({ count: 1 })
        const countAtom = atom(get => get(objAtom).count)
        const deriveFn = mock((get: Getter) => get(countAtom))
        const derivedAtom = atom(deriveFn)
        const deriveFurtherFn = mock((get: Getter) => {
            get(objAtom) // intentional extra dependency
            return get(derivedAtom)
        })
        const derivedFurtherAtom = atom(deriveFurtherFn)
        const callback = mock(() => {})
        store.sub(derivedFurtherAtom, callback)
        expect(store.get(derivedAtom)).toBe(1)
        expect(store.get(derivedFurtherAtom)).toBe(1)
        expect(callback).toHaveBeenCalledTimes(0)
        expect(deriveFn).toHaveBeenCalledTimes(1)
        expect(deriveFurtherFn).toHaveBeenCalledTimes(1)
        store.set(objAtom, obj => ({ ...obj }))
        expect(callback).toHaveBeenCalledTimes(0)
        expect(deriveFn).toHaveBeenCalledTimes(1)
        // Valdres is probably optimizing this further than jotai
        expect(deriveFurtherFn).toHaveBeenCalledTimes(2)
    },
)

test("should not call read function for unmounted atoms (#2076)", async () => {
    const store = createStore()
    const countAtom = atom(1)
    const derive1Fn = mock((get: Getter) => get(countAtom))
    const derived1Atom = atom(derive1Fn)
    const derive2Fn = mock((get: Getter) => get(countAtom))
    const derived2Atom = atom(derive2Fn)
    expect(store.get(derived1Atom)).toBe(1)
    expect(store.get(derived2Atom)).toBe(1)
    expect(derive1Fn).toHaveBeenCalledTimes(1)
    expect(derive2Fn).toHaveBeenCalledTimes(1)
    store.sub(
        derived2Atom,
        mock(() => {}),
    )
    store.set(countAtom, c => c + 1)
    expect(derive1Fn).toHaveBeenCalledTimes(1)
    expect(derive2Fn).toHaveBeenCalledTimes(2)
})

test("should update with conditional dependencies (#2084)", async () => {
    const store = createStore()
    const f1 = atom(false)
    const f2 = atom(false)
    const f3 = atom(
        get => get(f1) && get(f2),
        (_get, set, val: boolean) => {
            set(f1, val)
            set(f2, val)
        },
    )
    store.sub(
        f1,
        mock(() => {}),
    )
    store.sub(
        f2,
        mock(() => {}),
    )
    store.sub(
        f3,
        mock(() => {}),
    )
    store.set(f3, true)
    expect(store.get(f3)).toBe(true)
})

test.todo(
    "should recompute dependents' state after onMount (#2098)",
    async () => {
        const store = createStore()

        const condAtom = atom(false)
        const baseAtom = atom(false)
        baseAtom.onMount = set => set(true)
        const derivedAtom = atom(
            get => get(baseAtom),
            (_get, set, update: boolean) => set(baseAtom, update),
        )
        const finalAtom = atom(
            get => (get(condAtom) ? get(derivedAtom) : undefined),
            (_get, set, value: boolean) => set(derivedAtom, value),
        )

        store.sub(finalAtom, () => {}) // mounts finalAtom, but not baseAtom
        expect(store.get(baseAtom)).toBe(false)
        expect(store.get(derivedAtom)).toBe(false)
        expect(store.get(finalAtom)).toBe(undefined)

        store.set(condAtom, true) // mounts baseAtom
        expect(store.get(baseAtom)).toBe(true)
        expect(store.get(derivedAtom)).toBe(true)
        expect(store.get(finalAtom)).toBe(true)

        store.set(finalAtom, false)
        expect(store.get(baseAtom)).toBe(false)
        expect(store.get(derivedAtom)).toBe(false)
        expect(store.get(finalAtom)).toBe(false)
    },
)

test("should update derived atoms during write (#2107)", async () => {
    const store = createStore()

    const baseCountAtom = atom(1)
    const countAtom = atom(
        get => get(baseCountAtom),
        (get, set, newValue: number) => {
            set(baseCountAtom, newValue)
            if (get(countAtom) !== newValue) {
                throw new Error("mismatch")
            }
        },
    )

    store.sub(countAtom, () => {})
    expect(store.get(countAtom)).toBe(1)
    store.set(countAtom, 2)
    expect(store.get(countAtom)).toBe(2)
})

test.todo("resolves dependencies reliably after a delay (#2192)", async () => {
    expect.assertions(1)
    const countAtom = atom(0)
    let result: number | null = null

    const resolve: (() => void)[] = []
    const asyncAtom = atom(async get => {
        const count = get(countAtom)
        await new Promise<void>(r => resolve.push(r))
        return count
    })

    const derivedAtom = atom(
        async (get, { setSelf }) => {
            get(countAtom)
            await Promise.resolve()
            result = await get(asyncAtom)
            if (result === 2) setSelf() // <-- necessary
        },
        () => {},
    )

    const store = createStore()
    store.sub(derivedAtom, () => {})

    await waitFor(() => assert(resolve.length === 1))

    resolve[0]!()
    const increment = (c: number) => c + 1
    store.set(countAtom, increment)
    store.set(countAtom, increment)

    await waitFor(() => assert(resolve.length === 3))

    resolve[1]!()
    resolve[2]!()
    await waitFor(() => assert(result === 2))

    store.set(countAtom, increment)
    store.set(countAtom, increment)

    await waitFor(() => assert(resolve.length === 5))

    resolve[3]!()
    resolve[4]!()

    await new Promise(setImmediate)
    await waitFor(() => assert(store.get(countAtom) === 4))

    expect(result).toBe(4) // 3
})

test.todo(
    "should not recompute a derived atom value if unchanged (#2168)",
    async () => {
        const store = createStore()
        const countAtom = atom(1)
        const derived1Atom = atom(get => get(countAtom) * 0)
        const derive2Fn = mock((get: Getter) => get(derived1Atom))
        const derived2Atom = atom(derive2Fn)
        expect(store.get(derived2Atom)).toBe(0)
        store.set(countAtom, c => c + 1)
        expect(store.get(derived2Atom)).toBe(0)
        expect(derive2Fn).toHaveBeenCalledTimes(1)
    },
)

test.todo("should mount once with atom creator atom (#2314)", async () => {
    const countAtom = atom(1)
    countAtom.onMount = mock((setAtom: (v: number) => void) => {
        setAtom(2)
    })
    const atomCreatorAtom = atom(get => {
        const derivedAtom = atom(get => get(countAtom))
        get(derivedAtom)
    })
    const store = createStore()
    store.sub(atomCreatorAtom, () => {})
    expect(countAtom.onMount).toHaveBeenCalledTimes(1)
})

test.todo(
    "should flush pending write triggered asynchronously and indirectly (#2451)",
    async () => {
        const store = createStore()
        const anAtom = atom("initial")

        const callbackFn = mock((_value: string) => {})
        const unsub = store.sub(anAtom, () => {
            callbackFn(store.get(anAtom))
        })

        const actionAtom = atom(null, async (_get, set) => {
            await Promise.resolve() // waiting a microtask
            set(indirectSetAtom)
        })

        const indirectSetAtom = atom(null, (_get, set) => {
            set(anAtom, "next")
        })

        // executing the chain reaction
        await store.set(actionAtom)

        expect(callbackFn).toHaveBeenCalledTimes(1)
        expect(callbackFn).toHaveBeenCalledWith("next")
        unsub()
    },
)

describe("async atom with subtle timing", () => {
    test("case 1", async () => {
        const store = createStore()
        const resolve: (() => void)[] = []
        const a = atom(1)
        const b = atom(async get => {
            await new Promise<void>(r => resolve.push(r))
            return get(a)
        })
        const bValue = store.get(b)
        store.set(a, 2)
        resolve.splice(0).forEach(fn => fn())
        const bValue2 = store.get(b)
        resolve.splice(0).forEach(fn => fn())
        expect(await bValue).toBe(2)
        expect(await bValue2).toBe(2)
    })

    test.todo("case 2", async () => {
        const store = createStore()
        const resolve: (() => void)[] = []
        const a = atom(1)
        const b = atom(async get => {
            const aValue = get(a)
            await new Promise<void>(r => resolve.push(r))
            return aValue
        })
        const bValue = store.get(b)
        store.set(a, 2)
        resolve.splice(0).forEach(fn => fn())
        const bValue2 = store.get(b)
        resolve.splice(0).forEach(fn => fn())
        expect(await bValue).toBe(1) // returns old value
        expect(await bValue2).toBe(2)
    })
})

describe("aborting atoms", () => {
    // We can't use signal.throwIfAborted as it is not available
    // in earlier versions of TS that this is tested on.
    const throwIfAborted = (signal: AbortSignal) => {
        if (signal.aborted) {
            throw new Error("aborted")
        }
    }

    test.todo("should abort the signal when dependencies change", async () => {
        const a = atom(1)
        const callBeforeAbort = mock(() => {})
        const callAfterAbort = mock(() => {})
        const resolve: (() => void)[] = []

        const store = createStore()

        const derivedAtom = atom(async (get, { signal }) => {
            const aVal = get(a)
            await new Promise<void>(r => resolve.push(r))
            callBeforeAbort()
            throwIfAborted(signal)
            callAfterAbort()
            return aVal + 1
        })

        const promise = store.get(derivedAtom)
        store.set(a, 3)
        const promise2 = store.get(derivedAtom)

        resolve.splice(0).forEach(fn => fn())
        expect(promise).rejects.toThrow("aborted")
        expect(await promise2).toEqual(4)
        expect(callBeforeAbort).toHaveBeenCalledTimes(2)
        expect(callAfterAbort).toHaveBeenCalledTimes(1)
    })

    test.todo(
        "should abort the signal when dependencies change and the atom is mounted",
        async () => {
            const a = atom(1)
            const callBeforeAbort = mock(() => {})
            const callAfterAbort = mock(() => {})
            const resolve: (() => void)[] = []

            const store = createStore()

            const derivedAtom = atom(async (get, { signal }) => {
                const aVal = get(a)
                await new Promise<void>(r => resolve.push(r))
                callBeforeAbort()
                throwIfAborted(signal)
                callAfterAbort()
                return aVal + 1
            })

            store.sub(derivedAtom, () => {})
            store.set(a, 3)

            resolve.splice(0).forEach(fn => fn())
            await new Promise(r => setTimeout(r)) // wait for a tick
            expect(callBeforeAbort).toHaveBeenCalledTimes(2)
            expect(callAfterAbort).toHaveBeenCalledTimes(1)
        },
    )

    test.todo("should not abort the signal when unsubscribed", async () => {
        const a = atom(1)
        const callBeforeAbort = mock(() => {})
        const callAfterAbort = mock(() => {})
        const resolve: (() => void)[] = []

        const store = createStore()

        const derivedAtom = atom(async (get, { signal }) => {
            const aVal = get(a)
            await new Promise<void>(r => resolve.push(r))
            callBeforeAbort()
            throwIfAborted(signal)
            callAfterAbort()
            return aVal + 1
        })

        const unsub = store.sub(derivedAtom, () => {})
        unsub()
        resolve.splice(0).forEach(fn => fn())

        expect(await store.get(derivedAtom)).toEqual(2)
        expect(callBeforeAbort).toHaveBeenCalledTimes(1)
        expect(callAfterAbort).toHaveBeenCalledTimes(1)
    })
})

test.todo(
    "Unmount an atom that is no longer dependent within a derived atom (#2658)",
    async () => {
        const condAtom = atom(true)

        const baseAtom = atom(0)
        const onUnmount = mock(() => {})
        baseAtom.onMount = () => onUnmount

        const derivedAtom = atom(get => {
            if (get(condAtom)) get(baseAtom)
        })

        const store = createStore()
        store.sub(derivedAtom, () => {})
        store.set(condAtom, false)
        expect(onUnmount).toHaveBeenCalledTimes(1)
    },
)

test("should update derived atom even if dependances changed (#2697)", () => {
    const primitiveAtom = atom<number | undefined>(undefined)
    const derivedAtom = atom(get => get(primitiveAtom))
    const conditionalAtom = atom(get => {
        const base = get(primitiveAtom)
        if (!base) return
        return get(derivedAtom)
    })

    const store = createStore()
    const onChangeDerived = mock(() => {})

    store.sub(derivedAtom, onChangeDerived)
    store.sub(conditionalAtom, () => {})

    expect(onChangeDerived).toHaveBeenCalledTimes(0)
    store.set(primitiveAtom, 1)
    expect(onChangeDerived).toHaveBeenCalledTimes(1)
})
