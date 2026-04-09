import { describe, test, expect, mock } from "bun:test"
import { createStore } from "../../src/createStore"
import { atom } from "../../src/atom"

type Getter = Parameters<Parameters<typeof atom>[0] extends Function ? Parameters<typeof atom>[0] : never>[0]

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

test("should not fire subscription if primitive atom value is the same", () => {
    const store = createStore()
    const countAtom = atom(0)
    const callback = mock(() => {})
    store.sub(countAtom, callback)
    const calledTimes = callback.mock.calls.length
    store.set(countAtom, 0)
    expect(callback).toHaveBeenCalledTimes(calledTimes)
})

test("should not fire subscription if derived atom value is the same", () => {
    const store = createStore()
    const countAtom = atom(0)
    const derivedAtom = atom((get) => get(countAtom) * 0)
    const callback = mock(() => {})
    store.sub(derivedAtom, callback)
    const calledTimes = callback.mock.calls.length
    store.set(countAtom, 1)
    expect(callback).toHaveBeenCalledTimes(calledTimes)
})

// Requires createDevStore + get_mounted_atoms (jotai internals)
test.todo("should unmount with store.get", () => {
    const store = createStore() // jotai uses createDevStore()
    const countAtom = atom(0)
    const callback = mock(() => {})
    const unsub = store.sub(countAtom, callback)

    store.get(countAtom)
    unsub()
    // jotai asserts: Array.from(store.get_mounted_atoms()) === []
})

// Requires createDevStore + get_mounted_atoms (jotai internals)
test.todo("should unmount dependencies with store.get", () => {
    const store = createStore() // jotai uses createDevStore()
    const countAtom = atom(0)
    const derivedAtom = atom((get) => get(countAtom) * 2)
    const callback = mock(() => {})
    const unsub = store.sub(derivedAtom, callback)

    store.get(derivedAtom)
    unsub()
    // jotai asserts: Array.from(store.get_mounted_atoms()) === []
})

test("should update async atom with delay (#1813)", async () => {
    const countAtom = atom(0)

    const resolve: (() => void)[] = []
    const delayedAtom = atom(async (get) => {
        const count = get(countAtom)
        await new Promise<void>((r) => resolve.push(r))
        return count
    })

    const store = createStore()
    store.get(delayedAtom)
    store.set(countAtom, 1)
    resolve.splice(0).forEach((fn) => fn())
    await new Promise<void>((r) => setTimeout(r)) // wait for a tick
    const promise = store.get(delayedAtom)
    resolve.splice(0).forEach((fn) => fn())
    expect(await promise).toBe(1)
})

test("should override a promise by setting", async () => {
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

test("should update async atom with deps after await (#1905)", async () => {
    const countAtom = atom(0)
    const delayedAtom = atom(async (get) => {
        await new Promise<void>((r) => setTimeout(r, 10))
        const count = get(countAtom)
        return count
    })
    const derivedAtom = atom(async (get) => {
        const count = await get(delayedAtom)
        return count
    })

    const store = createStore()
    let lastValue = store.get(derivedAtom)
    const unsub = store.sub(derivedAtom, () => {
        lastValue = store.get(derivedAtom)
    })

    store.set(countAtom, 1)
    await new Promise<void>((r) => setTimeout(r, 20))
    expect(await lastValue).toBe(1)

    store.set(countAtom, 2)
    await new Promise<void>((r) => setTimeout(r, 20))
    expect(await lastValue).toBe(2)

    store.set(countAtom, 3)
    await new Promise<void>((r) => setTimeout(r, 20))
    expect(await lastValue).toBe(3)

    unsub()
})

// NOTE: This test causes a bun segfault — bun bug, not a valdres issue
test("should not fire subscription when async atom promise is the same", async () => {
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
})

test("should notify subscription with tree dependencies (#1956)", () => {
    const valueAtom = atom(1)
    const dep1Atom = atom((get) => get(valueAtom) * 2)
    const dep2Atom = atom((get) => get(valueAtom) + get(dep1Atom))
    const dep3Atom = atom((get) => get(dep1Atom))

    const cb = mock(() => {})
    const store = createStore()
    store.sub(dep2Atom, mock(() => {})) // this will cause the bug
    store.sub(dep3Atom, cb)

    expect(cb).toBeCalledTimes(0)
    expect(store.get(dep3Atom)).toBe(2)
    store.set(valueAtom, (c) => c + 1)
    expect(cb).toBeCalledTimes(1)
    expect(store.get(dep3Atom)).toBe(4)
})

test("should notify subscription with tree dependencies with bail-out", () => {
    const valueAtom = atom(1)
    const dep1Atom = atom((get) => get(valueAtom) * 2)
    const dep2Atom = atom((get) => get(valueAtom) * 0)
    const dep3Atom = atom((get) => get(dep1Atom) + get(dep2Atom))

    const cb = mock(() => {})
    const store = createStore()
    store.sub(dep1Atom, mock(() => {}))
    store.sub(dep3Atom, cb)

    expect(cb).toBeCalledTimes(0)
    expect(store.get(dep3Atom)).toBe(2)
    store.set(valueAtom, (c) => c + 1)
    expect(cb).toBeCalledTimes(1)
    expect(store.get(dep3Atom)).toBe(4)
})

test("should bail out with the same value with chained dependency (#2014)", () => {
    const store = createStore()
    const objAtom = atom({ count: 1 })
    const countAtom = atom((get) => get(objAtom).count)
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

    store.set(objAtom, (obj) => ({ ...obj }))
    expect(callback).toHaveBeenCalledTimes(0)
    expect(deriveFn).toHaveBeenCalledTimes(1)
    expect(deriveFurtherFn).toHaveBeenCalledTimes(2)
})

test("should not call read function for unmounted atoms (#2076)", () => {
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

    store.sub(derived2Atom, mock(() => {}))

    store.set(countAtom, (c) => c + 1)
    expect(derive1Fn).toHaveBeenCalledTimes(1)
    expect(derive2Fn).toHaveBeenCalledTimes(2)
})

test("should update with conditional dependencies (#2084)", () => {
    const store = createStore()
    const f1 = atom(false)
    const f2 = atom(false)
    const f3 = atom(
        (get) => get(f1) && get(f2),
        (_get, set, val: boolean) => {
            set(f1, val)
            set(f2, val)
        },
    )

    store.sub(f1, mock(() => {}))
    store.sub(f2, mock(() => {}))
    store.sub(f3, mock(() => {}))

    store.set(f3, true)
    expect(store.get(f3)).toBe(true)
})

test("should recompute dependents' state after onMount (#2098)", () => {
    const store = createStore()

    const condAtom = atom(false)
    const baseAtom = atom(false)
    baseAtom.onMount = (set) => set(true)
    const derivedAtom = atom(
        (get) => get(baseAtom),
        (_get, set, update: boolean) => set(baseAtom, update),
    )
    const finalAtom = atom(
        (get) => (get(condAtom) ? get(derivedAtom) : undefined),
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
})

test("should update derived atoms during write (#2107)", () => {
    const store = createStore()

    const baseCountAtom = atom(1)
    const countAtom = atom(
        (get) => get(baseCountAtom),
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

test("resolves dependencies reliably after a delay (#2192)", async () => {
    const countAtom = atom(0)
    let result: number | null = null

    const resolve: (() => void)[] = []
    const asyncAtom = atom(async (get) => {
        const count = get(countAtom)
        await new Promise<void>((r) => resolve.push(r))
        return count
    })

    const derivedAtom = atom(
        async (get, { setSelf }) => {
            get(countAtom)
            await Promise.resolve()
            result = await get(asyncAtom)
            if (result === 2) setSelf()
        },
        () => {},
    )

    const store = createStore()
    store.sub(derivedAtom, () => {})

    await new Promise<void>((r) => setTimeout(r, 10))

    resolve[0]!()
    const increment = (c: number) => c + 1
    store.set(countAtom, increment)
    store.set(countAtom, increment)

    await new Promise<void>((r) => setTimeout(r, 10))

    resolve[1]!()
    resolve[2]!()
    await new Promise<void>((r) => setTimeout(r, 10))

    store.set(countAtom, increment)
    store.set(countAtom, increment)

    await new Promise<void>((r) => setTimeout(r, 10))

    resolve[3]!()
    resolve[4]!()

    await new Promise<void>((r) => setTimeout(r, 10))

    expect(result).toBe(4)
})

test("should not recompute a derived atom value if unchanged (#2168)", () => {
    const store = createStore()
    const countAtom = atom(1)
    const derived1Atom = atom((get) => get(countAtom) * 0)
    const derive2Fn = mock((get: Getter) => get(derived1Atom))
    const derived2Atom = atom(derive2Fn)

    expect(store.get(derived2Atom)).toBe(0)
    store.set(countAtom, (c) => c + 1)
    expect(store.get(derived2Atom)).toBe(0)
    expect(derive2Fn).toHaveBeenCalledTimes(1)
})

test("should mount once with atom creator atom (#2314)", () => {
    const countAtom = atom(1)
    countAtom.onMount = mock(((setAtom: (v: number) => void) => {
        setAtom(2)
    }) as NonNullable<(typeof countAtom)["onMount"]>)
    const atomCreatorAtom = atom((get) => {
        const derivedAtom = atom((get) => get(countAtom))
        get(derivedAtom)
    })
    const store = createStore()
    store.sub(atomCreatorAtom, () => {})
    expect(countAtom.onMount).toHaveBeenCalledTimes(1)
})

// Requires async atoms
test("should flush pending write triggered asynchronously and indirectly (#2451)", async () => {
    const store = createStore()
    const anAtom = atom("initial")
    const callbackFn = mock((_value: string) => {})
    const unsub = store.sub(anAtom, () => {
        callbackFn(store.get(anAtom))
    })
    const indirectSetAtom = atom(null, (_get, set) => {
        set(anAtom, "next")
    })
    const actionAtom = atom(null, async (_get, set) => {
        await Promise.resolve()
        set(indirectSetAtom)
    })

    await store.set(actionAtom)
    expect(callbackFn).toHaveBeenCalledTimes(1)
    expect(callbackFn).toHaveBeenCalledWith("next")
    unsub()
})

describe("async atom with subtle timing", () => {
    test("case 1", async () => {
        const store = createStore()
        const resolve: (() => void)[] = []
        const a = atom(1)
        const b = atom(async (get) => {
            await new Promise<void>((r) => resolve.push(r))
            return get(a)
        })
        const bValue = store.get(b)
        store.set(a, 2)
        resolve.splice(0).forEach((fn) => fn())
        const bValue2 = store.get(b)
        resolve.splice(0).forEach((fn) => fn())
        expect(await bValue).toBe(2)
        expect(await bValue2).toBe(2)
    })

    test("case 2", async () => {
        const store = createStore()
        const resolve: (() => void)[] = []
        const a = atom(1)
        const b = atom(async (get) => {
            const aValue = get(a)
            await new Promise<void>((r) => resolve.push(r))
            return aValue
        })
        const bValue = store.get(b)
        store.set(a, 2)
        resolve.splice(0).forEach((fn) => fn())
        const bValue2 = store.get(b)
        resolve.splice(0).forEach((fn) => fn())
        expect(await bValue).toBe(1) // returns old value
        expect(await bValue2).toBe(2)
    })
})

describe("aborting atoms", () => {
    const throwIfAborted = (signal: AbortSignal) => {
        if (signal.aborted) {
            throw new Error("aborted")
        }
    }

    test("should abort the signal when dependencies change", async () => {
        const a = atom(1)
        const callBeforeAbort = mock(() => {})
        const callAfterAbort = mock(() => {})
        const resolve: (() => void)[] = []

        const store = createStore()

        const derivedAtom = atom(async (get, { signal }) => {
            const aVal = get(a)
            await new Promise<void>((r) => resolve.push(r))
            callBeforeAbort()
            throwIfAborted(signal)
            callAfterAbort()
            return aVal + 1
        })

        const promise = store.get(derivedAtom)
        store.set(a, 3)
        const promise2 = store.get(derivedAtom)

        resolve.splice(0).forEach((fn) => fn())
        await expect(promise).rejects.toThrow("aborted")
        expect(await promise2).toEqual(4)
        expect(callBeforeAbort).toHaveBeenCalledTimes(2)
        expect(callAfterAbort).toHaveBeenCalledTimes(1)
    })

    test("should abort the signal when dependencies change and the atom is mounted", async () => {
        const a = atom(1)
        const callBeforeAbort = mock(() => {})
        const callAfterAbort = mock(() => {})
        const resolve: (() => void)[] = []

        const store = createStore()

        const derivedAtom = atom(async (get, { signal }) => {
            const aVal = get(a)
            await new Promise<void>((r) => resolve.push(r))
            callBeforeAbort()
            throwIfAborted(signal)
            callAfterAbort()
            return aVal + 1
        })

        store.sub(derivedAtom, () => {})
        store.set(a, 3)

        resolve.splice(0).forEach((fn) => fn())
        await new Promise((r) => setTimeout(r))
        expect(callBeforeAbort).toHaveBeenCalledTimes(2)
        expect(callAfterAbort).toHaveBeenCalledTimes(1)
    })

    test("should not abort the signal when unsubscribed", async () => {
        const a = atom(1)
        const callBeforeAbort = mock(() => {})
        const callAfterAbort = mock(() => {})
        const resolve: (() => void)[] = []

        const store = createStore()

        const derivedAtom = atom(async (get, { signal }) => {
            const aVal = get(a)
            await new Promise<void>((r) => resolve.push(r))
            callBeforeAbort()
            throwIfAborted(signal)
            callAfterAbort()
            return aVal + 1
        })

        const unsub = store.sub(derivedAtom, () => {})
        unsub()

        resolve.splice(0).forEach((fn) => fn())
        await new Promise((r) => setTimeout(r))
        expect(callBeforeAbort).toHaveBeenCalledTimes(1)
        expect(callAfterAbort).toHaveBeenCalledTimes(1)
    })
})

test("Unmount an atom that is no longer dependent within a derived atom (#2658)", () => {
    const condAtom = atom(true)
    const baseAtom = atom(0)
    const onUnmount = mock(() => {})
    baseAtom.onMount = () => onUnmount
    const derivedAtom = atom((get) => {
        if (get(condAtom)) get(baseAtom)
    })
    const store = createStore()

    store.sub(derivedAtom, () => {})
    store.set(condAtom, false)
    expect(onUnmount).toHaveBeenCalledTimes(1)
})

test("should update derived atom even if dependencies changed (#2697)", () => {
    const primitiveAtom = atom<number | undefined>(undefined)
    const derivedAtom = atom((get) => get(primitiveAtom))
    const conditionalAtom = atom((get) => {
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

describe("should invoke flushPending only after all atoms are updated (#2804)", () => {
    test("should invoke flushPending only after all atoms are updated with set", () => {
        const store = createStore()
        const a = atom(0)
        const setResult: string[] = []
        const w = atom(null, (_get, set, value: number) => {
            setResult.push("before set")
            set(a, value)
            setResult.push("after set")
        })

        store.sub(a, () => {
            setResult.push("a value changed - " + store.get(a))
        })
        setResult.push("before store.set")
        store.set(w, 1)
        setResult.push("after store.set")
        expect(setResult).not.toEqual([
            "before store.set",
            "before set",
            "a value changed - 1",
            "after set",
            "after store.set",
        ])
        expect(setResult).toEqual([
            "before store.set",
            "before set",
            "after set",
            "a value changed - 1",
            "after store.set",
        ])
    })

    test("should invoke flushPending only after all atoms are updated with mount", () => {
        const store = createStore()
        const mountResult: string[] = []
        const a = atom(0)
        const m = atom(null, (_get, set, value: number) => {
            set(a, value)
        })
        m.onMount = (setSelf) => {
            mountResult.push("before onMount setSelf")
            setSelf(1)
            mountResult.push("after onMount setSelf")
        }
        mountResult.push("before store.sub")
        store.sub(a, () => {
            mountResult.push("a value changed - " + store.get(a))
        })

        store.sub(m, () => {})

        mountResult.push("after store.sub")
        expect(mountResult).not.toEqual([
            "before store.sub",
            "before onMount setSelf",
            "a value changed - 1",
            "after onMount setSelf",
            "after store.sub",
        ])
        expect(mountResult).toEqual([
            "before store.sub",
            "before onMount setSelf",
            "after onMount setSelf",
            "a value changed - 1",
            "after store.sub",
        ])
    })

    test("should flush only after all atoms are updated with unmount", () => {
        const store = createStore()
        const result: string[] = []
        const a = atom(0)
        const b = atom(null, (_get, set, value: number) => {
            set(a, value)
        })
        b.onMount = (setAtom) => {
            return () => {
                result.push("onUmount: before setAtom")
                setAtom(1)
                result.push("onUmount: after setAtom")
            }
        }
        const c = atom(true)
        const d = atom((get) => get(c) && get(b))

        store.sub(a, () => {
            result.push("a value changed - " + store.get(a))
        })
        store.sub(d, () => {})

        expect(store.get(d)).toEqual(null)
        store.set(c, false)
        expect(result).toEqual([
            "onUmount: before setAtom",
            "onUmount: after setAtom",
            "a value changed - 1",
        ])
    })
})

describe("should mount and trigger listeners even when an error is thrown", () => {
    test("in asynchronous read", async () => {
        const store = createStore()
        const a = atom(0)
        a.onMount = mock(() => {})
        const e = atom(
            () => {
                throw new Error("error")
            },
            () => {},
        )
        e.onMount = mock(() => {})
        const b = atom((get: Getter) => {
            setTimeout(() => {
                get(a)
                try {
                    get(e)
                } catch {
                    // expect error
                }
            })
        })

        store.sub(b, () => {})

        await new Promise<void>(r => setTimeout(r, 0))
        expect(a.onMount).toHaveBeenCalledTimes(1)
        expect(e.onMount).toHaveBeenCalledTimes(1)
    })

    test("in read setSelf", async () => {
        const store = createStore()
        const a = atom(0)
        const e = atom(
            () => {
                throw new Error("error")
            },
            () => {},
        )
        const b = atom(
            (_get: Getter, { setSelf }: { setSelf: () => void }) => {
                setTimeout(() => {
                    try {
                        setSelf()
                    } catch {
                        // expect error
                    }
                })
            },
            (get: Getter, set: any) => {
                set(a, 1)
                get(e)
            },
        )
        const listener = mock(() => {})

        store.sub(a, listener)
        store.sub(b, () => {})

        await new Promise<void>(r => setTimeout(r, 0))
        expect(listener).toHaveBeenCalledTimes(1)
    })

    test("in read promise on settled", async () => {
        const store = createStore()
        const a = atom(0)
        a.onMount = mock(() => {})
        const e = atom(
            () => {
                throw new Error("error")
            },
            () => {},
        )
        const b = atom(async (get: Getter) => {
            await new Promise<void>(r => setTimeout(r, 0))
            get(a)
            get(e)
        })

        store.sub(b, () => {})

        await new Promise<void>(r => setTimeout(r, 10))
        expect(a.onMount).toHaveBeenCalledTimes(1)
    })

    test("in asynchronous write", async () => {
        const store = createStore()
        const a = atom(0)
        const e = atom(() => {
            throw new Error("error")
        })
        const b = atom(null, (get: Getter, set: any) => {
            set(a, 1)
            get(e)
        })
        const w = atom(null, async (_get: Getter, set: any) => {
            setTimeout(() => {
                try {
                    set(b)
                } catch {
                    // expect error
                }
            })
        })
        const listener = mock(() => {})

        store.sub(a, listener)
        store.set(w)

        await new Promise<void>(r => setTimeout(r, 0))
        expect(listener).toHaveBeenCalledTimes(1)
    })

    test("in synchronous write", () => {
        const store = createStore()
        const a = atom(0)
        const e = atom(() => {
            throw new Error("error")
        })
        const b = atom(null, (get, set) => {
            set(a, 1)
            get(e)
        })
        const listener = mock(() => {})
        store.sub(a, listener)
        try {
            store.set(b)
        } catch {
            // expect error
        }

        expect(listener).toHaveBeenCalledTimes(1)
    })

    test("in onmount/onunmount asynchronous setAtom", async () => {
        const store = createStore()
        const a = atom(0)
        const e = atom(() => {
            throw new Error("error")
        })
        const b = atom(null, (get, set) => {
            set(a, (v: number) => ++v)
            get(e)
        })
        b.onMount = (setAtom) => {
            setTimeout(() => {
                try {
                    setAtom()
                } catch {
                    // expect error
                }
            })
            return () => {
                setTimeout(() => {
                    try {
                        setAtom()
                    } catch {
                        // expect error
                    }
                })
            }
        }
        const listener = mock(() => {})

        store.sub(a, listener)
        const unsub = store.sub(b, () => {})

        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(listener).toHaveBeenCalledTimes(1)

        listener.mockClear()
        unsub()

        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(listener).toHaveBeenCalledTimes(1)
    })

    test("in synchronous onmount", () => {
        const store = createStore()
        const a = atom(0)
        const aUnmount = mock(() => {})
        a.onMount = mock(() => aUnmount)
        const b = atom(
            (get) => get(a),
            () => {},
        )
        b.onMount = () => {
            throw new Error("error")
        }
        try {
            store.sub(b, () => {})
        } catch {
            // expect error
        }

        expect(a.onMount).toHaveBeenCalledTimes(1)
    })

    test("in synchronous onunmount", () => {
        const store = createStore()
        const a = atom(0)
        const aUnmount = mock(() => {})
        a.onMount = () => aUnmount
        const b = atom(
            (get) => get(a),
            () => {},
        )
        b.onMount = () => () => {
            throw new Error("error")
        }
        const unsub = store.sub(b, () => {})
        try {
            unsub()
        } catch {
            // expect error
        }

        expect(aUnmount).toHaveBeenCalledTimes(1)
    })

    test("in synchronous listener", () => {
        const store = createStore()
        const a = atom(0)
        const e = atom(0)
        const b = atom(null, (_, set) => {
            set(a, 1)
            set(e, 1)
        })
        store.sub(e, () => {
            throw new Error("error")
        })
        const listener = mock(() => {})
        store.sub(a, listener)
        try {
            store.set(b)
        } catch {
            // expect error
        }

        expect(listener).toHaveBeenCalledTimes(1)
    })
})

test("throws falsy errors in onMount, onUnmount, and listeners", () => {
    const store = createStore()
    const a = atom(0)
    a.onMount = () => {
        throw ""
    }
    expect(() => store.sub(a, () => {})).toThrow("")
    const b = atom(0)
    b.onMount = () => () => {
        throw ""
    }
    const unsub = store.sub(b, () => {})
    expect(() => unsub()).toThrow("")
    const c = atom(0)

    store.sub(c, () => {
        throw ""
    })

    expect(() => store.set(c, 1)).toThrow("")
})

test("should use the correct pending on unmount", () => {
    const store = createStore()
    const a = atom(0)
    const b = atom(0, (_, set, update: number) => set(a, update))
    b.onMount = (setAtom) => () => setAtom(1)
    const aListener = mock(() => {})

    store.sub(a, aListener)
    const unsub = store.sub(b, () => {})
    aListener.mockClear?.() ?? (aListener as any).mock.calls.splice(0)
    unsub()

    expect(store.get(a)).toBe(1)
    expect(aListener).toHaveBeenCalledTimes(1)
})

test("should call subscribers after setAtom updates atom value on mount but not on unmount", () => {
    const store = createStore()
    const a = atom(0)
    let unmount: any
    a.onMount = mock(((setAtom) => {
        setAtom(1)
        unmount = mock(() => {
            setAtom(2)
        })
        return unmount
    }) as NonNullable<(typeof a)["onMount"]>)
    const listener = mock(() => {})

    const unsub = store.sub(a, listener)
    expect(store.get(a)).toBe(1)
    expect(a.onMount).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledTimes(1)

    listener.mockClear?.() ?? (listener as any).mock.calls.splice(0)
    unsub()

    expect(store.get(a)).toBe(2)
    expect(unmount).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledTimes(0)
})

test("processes deep atom a graph beyond maxDepth", () => {
    function getMaxDepth() {
        let depth = 0
        function d(): number {
            ++depth
            try {
                return d()
            } catch {
                return depth
            }
        }
        return d()
    }
    const maxDepth = Math.min(getMaxDepth(), 5000)
    const store = createStore()
    const baseAtom = atom(0)
    const atoms: any[] = [baseAtom]
    Array.from({ length: maxDepth }, (_, i) => {
        const prevAtom = atoms[i]!
        const a = atom((get) => get(prevAtom))
        atoms.push(a)
    })
    const lastAtom = atoms[maxDepth]!
    expect(() => store.sub(lastAtom, () => {})).not.toThrow()
    expect(() => store.set(baseAtom, 1)).not.toThrow()
}, 10_000)

test("mounted atom should be recomputed eagerly", () => {
    const result: string[] = []
    const a = atom(0)
    const b = atom((get) => {
        result.push("bRead")
        return get(a)
    })
    const store = createStore()

    store.sub(a, () => {
        result.push("aCallback")
    })
    store.sub(b, () => {
        result.push("bCallback")
    })

    expect(result).toEqual(["bRead"])
    result.splice(0)
    store.set(a, 1)
    expect(result).toEqual(["bRead", "aCallback", "bCallback"])
})

test("should notify subscription even with reading atom in write", () => {
    const a = atom(1)
    const b = atom((get) => get(a) * 2)
    const c = atom((get) => get(b) + 1)
    const d = atom(null, (get, set) => {
        set(a, 2)
        get(b)
    })
    const store = createStore()
    const callback = mock(() => {})

    store.sub(c, callback)
    store.set(d)
    expect(callback).toHaveBeenCalledTimes(1)
})

test("should process all atom listeners even if some of them throw errors", () => {
    const store = createStore()
    const a = atom(0)
    const listenerA = mock(() => {})
    const listenerB = mock(() => {
        throw new Error("error")
    })
    const listenerC = mock(() => {})

    store.sub(a, listenerA)
    store.sub(a, listenerB)
    store.sub(a, listenerC)
    try {
        store.set(a, 1)
    } catch {
        // expect empty
    }

    expect(listenerA).toHaveBeenCalledTimes(1)
    expect(listenerB).toHaveBeenCalledTimes(1)
    expect(listenerC).toHaveBeenCalledTimes(1)
})

// Requires INTERNAL_onInit (jotai internal)
test.todo("should call onInit only once per atom", () => {
    const store = createStore()
    const a = atom(0)
    const onInit = mock(() => {})

    ;(a as any).INTERNAL_onInit = onInit
    store.get(a)
    expect(onInit).toHaveBeenCalledTimes(1)
    expect(onInit).toHaveBeenCalledWith(store)

    onInit.mockClear()
    store.get(a)
    store.set(a, 1)

    const unsub = store.sub(a, () => {})
    unsub()

    const b = atom((get) => get(a))
    store.get(b)
    store.sub(b, () => {})
    expect(onInit).not.toHaveBeenCalled()
})

// Requires INTERNAL_onInit + deriveStore (jotai internals)
test.todo("should call onInit only once per store", () => {
    // Uses deriveStore which is a jotai internal API for custom atom state storage.
    // Full test body omitted — requires deriveStore implementation.
})

// Requires INTERNAL_onInit (jotai internal)
test.todo("should pass store and atomState to the atom initializer", () => {
    const store = createStore()
    const a = atom(null)

    ;(a as any).INTERNAL_onInit = (s: any) => {
        expect(s).toBe(store)
    }
    store.get(a)
})

test("recomputes dependents of unmounted atoms", () => {
    const a = atom(0)
    const bRead = mock((get: Getter) => {
        return get(a)
    })
    const b = atom(bRead)
    const c = atom((get) => get(b))
    const w = atom(null, (get, set) => {
        set(a, 1)
        get(c)
        set(a, 2)
        bRead.mockClear?.() ?? (bRead as any).mock.calls.splice(0)
    })
    const store = createStore()

    store.set(w)
    expect(bRead).not.toHaveBeenCalled()
})

test("recomputes all changed atom dependents together", () => {
    const a = atom([0])
    const b = atom([0])
    const a0 = atom((get) => get(a)[0]!)
    const b0 = atom((get) => get(b)[0]!)
    const a0b0 = atom((get) => [get(a0), get(b0)])
    const w = atom(null, (_, set) => {
        set(a, [0])
        set(b, [1])
    })
    const store = createStore()

    store.sub(a0b0, () => {})
    store.set(w)
    expect(store.get(a0)).toBe(0)
    expect(store.get(b0)).toBe(1)
    expect(store.get(a0b0)).toEqual([0, 1])
})

test("should not inf on subscribe or unsubscribe", () => {
    const store = createStore()
    const countAtom = atom(0)
    const effectAtom = atom(
        (get) => get(countAtom),
        (_, set) => set,
    )
    effectAtom.onMount = (setAtom) => {
        const set = setAtom()
        set(countAtom, 1)
        return () => {
            set(countAtom, 2)
        }
    }

    const unsub = store.sub(effectAtom, () => {})
    expect(store.get(countAtom)).toBe(1)
    unsub()
    expect(store.get(countAtom)).toBe(2)
})

test("supports recursion in an atom subscriber", () => {
    const a = atom(0)
    const store = createStore()

    store.sub(a, () => {
        if (store.get(a) < 3) {
            store.set(a, (v) => v + 1)
        }
    })
    store.set(a, 1)
    expect(store.get(a)).toBe(3)
})

test("allows subscribing to atoms during mount", () => {
    const store = createStore()
    const a = atom(0)
    a.onMount = () => {
        store.sub(b, () => {})
    }
    const b = atom(0)
    let bMounted = false
    b.onMount = () => {
        bMounted = true
    }

    store.sub(a, () => {})
    expect(bMounted).toBe(true)
})

test("updates with reading derived atoms (#2959)", () => {
    const store = createStore()
    const countAtom = atom(0)
    const countDerivedAtom = atom((get) => get(countAtom))
    const countUpAtom = atom(null, (get, set) => {
        set(countAtom, 1)
        get(countDerivedAtom)
        set(countAtom, 2)
    })

    store.sub(countDerivedAtom, () => {})
    store.set(countUpAtom)
    expect(store.get(countDerivedAtom)).toBe(2)
})

test("updates dependents when it eagerly recomputes dirty atoms", () => {
    const countAtom = atom(0)
    const isActiveAtom = atom(false)
    const activeCountAtom = atom((get) =>
        get(isActiveAtom) ? get(countAtom) : undefined,
    )
    const activateAction = atom(null, (get, set, value: boolean) => {
        set(isActiveAtom, value)
        get(activeCountAtom)
    })

    const store = createStore()
    store.sub(activeCountAtom, () => {})
    store.set(activateAction, true)
    store.set(countAtom, 1)

    expect(store.get(activeCountAtom)).toBe(1)
})

// Requires DEV mode + console.warn mock
test.todo("[DEV-ONLY] should warn store mutation during read", () => {
    const store = createStore()
    const countAtom = atom(0)
    const derivedAtom = atom(() => {
        store.set(countAtom, (c: number) => c + 1)
    })
    store.get(derivedAtom)
    // jotai asserts: console.warn called with
    // "Detected store mutation during atom read. This is not supported."
})

test("should keep reactivity when a derived atom returns a function that calls get (#3240)", () => {
    const store = createStore()
    const stableAtom = atom(0)
    const closureAtom = atom((get) => (x: number) => {
        const s = get(stableAtom)
        return x + s
    })
    const changingAtom = atom(0)
    const upstreamAtom = atom((get) => {
        const n = get(changingAtom)
        const fn = get(closureAtom)
        return fn(n)
    })
    const downstreamAtom = atom((get) => get(upstreamAtom) * 2)

    const callback = mock(() => {})
    store.sub(downstreamAtom, callback)

    expect(store.get(upstreamAtom)).toBe(0)
    expect(store.get(downstreamAtom)).toBe(0)

    store.set(changingAtom, 1)
    expect(store.get(upstreamAtom)).toBe(1)
    expect(store.get(downstreamAtom)).toBe(2)
    expect(callback).toHaveBeenCalledTimes(1)

    store.set(changingAtom, 2)
    expect(store.get(upstreamAtom)).toBe(2)
    expect(store.get(downstreamAtom)).toBe(4)
    expect(callback).toHaveBeenCalledTimes(2)
})

test("notifies derived-atom subscriber when read calls store.set", () => {
    const store = createStore()
    const counterAtom = atom(0)
    const queryAtom = atom(null, (_get, _set, v: number) => v)
    const dataAtom = atom((get) => {
        const v = get(counterAtom)
        const result = store.set(queryAtom, v * 2)
        return result
    })

    const dataListener = mock(() => {})
    store.sub(dataAtom, dataListener)

    expect(store.get(dataAtom)).toBe(0)
    expect(dataListener.mock.calls.length).toBe(0)

    store.set(counterAtom, 1)

    expect(store.get(dataAtom)).toBe(2)
    expect(dataListener.mock.calls.length).toBe(1)

    store.set(counterAtom, 2)

    expect(store.get(dataAtom)).toBe(4)
    expect(dataListener.mock.calls.length).toBe(2)
})

test("notifies subscriber through chain of derived atoms when root calls store.set", () => {
    const store = createStore()
    const counterAtom = atom(0)
    const queryAtom = atom(null, (_get, _set, v: number) => v)
    const baseAtom = atom((get) => {
        const v = get(counterAtom)
        return store.set(queryAtom, v * 2)
    })
    const derivedAtom = atom((get) => get(baseAtom) * 2)

    const derivedListener = mock(() => {})
    store.sub(derivedAtom, derivedListener)

    expect(store.get(derivedAtom)).toBe(0)
    expect(derivedListener.mock.calls.length).toBe(0)

    store.set(counterAtom, 1)

    expect(store.get(derivedAtom)).toBe(4)
    expect(derivedListener.mock.calls.length).toBe(1)
})

test("notifies subscriber when nested write uses get to read atom with store.set", () => {
    const store = createStore()
    const counterAtom = atom(0)
    const innerQueryAtom = atom(null, (_get, _set, v: number) => v)
    const middleAtom = atom((get) => {
        const v = get(counterAtom)
        return store.set(innerQueryAtom, v * 3)
    })
    const outerQueryAtom = atom(null, (get, _set, v: number) => {
        const m = get(middleAtom)
        return v + m
    })
    const dataAtom = atom((get) => {
        const v = get(counterAtom)
        return store.set(outerQueryAtom, v * 2)
    })

    const dataListener = mock(() => {})
    store.sub(dataAtom, dataListener)

    expect(store.get(dataAtom)).toBe(0)
    expect(dataListener.mock.calls.length).toBe(0)

    store.set(counterAtom, 1)

    expect(store.get(dataAtom)).toBe(5)
    expect(dataListener.mock.calls.length).toBe(1)

    store.set(counterAtom, 2)

    expect(store.get(dataAtom)).toBe(10)
    expect(dataListener.mock.calls.length).toBe(2)
})

test("notifies async derived-atom subscriber when read calls store.set before await", async () => {
    const store = createStore()
    const counterAtom = atom(0)
    const queryAtom = atom(null, (_get, _set, v: number) => v)
    const dataAtom = atom(async (get) => {
        const v = get(counterAtom)
        const result = store.set(queryAtom, v * 2)
        await new Promise<void>((r) => setTimeout(r, 0))
        return result
    })

    let lastValue: number | Promise<number> | undefined
    store.sub(dataAtom, () => {
        lastValue = store.get(dataAtom)
    })

    await new Promise<void>((r) => setTimeout(r, 10))
    expect(await store.get(dataAtom)).toBe(0)

    store.set(counterAtom, 1)
    await new Promise<void>((r) => setTimeout(r, 10))
    expect(await lastValue).toBe(2)

    store.set(counterAtom, 2)
    await new Promise<void>((r) => setTimeout(r, 10))
    expect(await lastValue).toBe(4)
})

test("notifies subscriber normally when store.set is in write function, not read", () => {
    const store = createStore()
    const counterAtom = atom(0)
    const innerQueryAtom = atom(null, (_get, _set, v: number) => v)
    const queryAtom = atom(null, (_get, _set, v: number) =>
        store.set(innerQueryAtom, v),
    )
    const dataAtom = atom((get) => {
        const v = get(counterAtom)
        const result = store.set(queryAtom, v * 2)
        return result
    })

    const dataListener = mock(() => {})
    store.sub(dataAtom, dataListener)

    expect(store.get(dataAtom)).toBe(0)

    store.set(counterAtom, 1)

    expect(store.get(dataAtom)).toBe(2)
    expect(dataListener.mock.calls.length).toBe(1)

    store.set(counterAtom, 2)

    expect(store.get(dataAtom)).toBe(4)
    expect(dataListener.mock.calls.length).toBe(2)
})

test("store.set before get(dep) causes deep recursion but recovers", () => {
    const store = createStore()
    const counterAtom = atom(0)
    const queryAtom = atom(null, (_get, _set, v: number) => v)
    const dataAtom = atom((get) => {
        const result = store.set(queryAtom, 1)
        const v = get(counterAtom)
        return result + v
    })

    const dataListener = mock(() => {})
    store.sub(dataAtom, dataListener)

    expect(store.get(dataAtom)).toBe(1)

    store.set(counterAtom, 1)

    expect(store.get(dataAtom)).toBe(2)
    expect(dataListener.mock.calls.length).toBeGreaterThanOrEqual(1)
})

test("notifies subscriber when read calls store.set multiple times", () => {
    const store = createStore()
    const counterAtom = atom(0)
    const query1 = atom(null, (_get, _set, v: number) => v)
    const query2 = atom(null, (_get, _set, v: number) => v * 10)
    const dataAtom = atom((get) => {
        const v = get(counterAtom)
        const r1 = store.set(query1, v)
        const r2 = store.set(query2, v)
        return r1 + r2
    })

    const dataListener = mock(() => {})
    store.sub(dataAtom, dataListener)

    expect(store.get(dataAtom)).toBe(0)
    expect(dataListener.mock.calls.length).toBe(0)

    store.set(counterAtom, 1)

    expect(store.get(dataAtom)).toBe(11)
    expect(dataListener.mock.calls.length).toBe(1)

    store.set(counterAtom, 2)

    expect(store.get(dataAtom)).toBe(22)
    expect(dataListener.mock.calls.length).toBe(2)
})

test("does not recompute derived atom redundantly when store.set in read uses return value without setting atoms", () => {
    const store = createStore()
    const counterAtom = atom(0)
    const queryAtom = atom(null, (_get, _set, v: number) => v)

    let baseReadCount = 0
    const baseAtom = atom((get) => {
        baseReadCount++
        const v = get(counterAtom)
        return store.set(queryAtom, v * 2)
    })
    const baseAtom2 = atom((get) => {
        const v = get(counterAtom)
        return store.set(queryAtom, v * 2)
    })

    let derivedReadCount = 0
    const derivedAtom = atom((get) => {
        derivedReadCount++
        get(baseAtom)
        get(baseAtom2)
        return get(counterAtom)
    })

    const listener = mock(() => {})
    store.sub(derivedAtom, listener)

    expect(store.get(derivedAtom)).toBe(0)
    expect(baseReadCount).toBe(1)
    expect(derivedReadCount).toBe(1)

    baseReadCount = 0
    derivedReadCount = 0

    store.set(counterAtom, 1)

    expect(store.get(derivedAtom)).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)
})
