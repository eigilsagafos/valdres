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

    // Helper: wrap async fn so selector() accepts it (it rejects AsyncFunction).
    // This mirrors what the jotai adapter does via wrapAsync.
    const wrapAsync = (fn: Function) => (...args: any[]) => fn(...args)

    test("async selector: deps read after await are not unmounted on re-evaluation", async () => {
        // When a sync dep changes, the async selector is re-evaluated.
        // The sync phase only discovers atom1, so atom2 (read after await)
        // would appear as a "removed dep" and get unmounted — unless the
        // dep-preservation logic retains it.
        const store1 = store()
        const metrics1 = { mounted: 0, unmounted: 0 }
        const atom1 = atom(0, {
            onMount: () => {
                ++metrics1.mounted
                return () => { ++metrics1.unmounted }
            },
        })
        const metrics2 = { mounted: 0, unmounted: 0 }
        const atom2 = atom(0, {
            onMount: () => {
                ++metrics2.mounted
                return () => { ++metrics2.unmounted }
            },
        })

        let resolve = () => {}
        const asyncDerived = selector(wrapAsync(async get => {
            get(atom1)
            await new Promise<void>(r => (resolve = r))
            get(atom2)
        }))

        store1.sub(asyncDerived, () => {})
        resolve()
        await Promise.resolve()
        await Promise.resolve()

        expect(metrics1).toEqual({ mounted: 1, unmounted: 0 })
        expect(metrics2).toEqual({ mounted: 1, unmounted: 0 })

        // Trigger re-evaluation via sync dep change.
        // Without dep-preservation, atom2 is reported as removed and unmounted.
        store1.set(atom1, 1)
        resolve()

        expect(metrics1).toEqual({ mounted: 1, unmounted: 0 })
        expect(metrics2).toEqual({ mounted: 1, unmounted: 0 })
    })

    test("async selector: dropped async dep no longer triggers subscriber", async () => {
        // Correctness test for the reconciliation path in handleSelectorResult.
        // The dep-preservation logic (tested above) retains previous deps
        // during re-evaluation to prevent premature unmounting. This test
        // verifies that genuinely stale deps are cleaned up when the promise
        // resolves, so they don't cause phantom re-evaluations.
        const store1 = store()
        const triggerAtom = atom(0)
        const atomA = atom("A")

        let resolve = () => {}
        let readAtomA = true
        const asyncDerived = selector(wrapAsync(async get => {
            get(triggerAtom)
            await new Promise<void>(r => (resolve = r))
            if (readAtomA) return get(atomA)
            return "static"
        }))

        const callback = mock(() => {})
        store1.sub(asyncDerived, callback)
        resolve()
        await Promise.resolve()
        await Promise.resolve()

        // Eval 2: stop reading atomA
        readAtomA = false
        store1.set(triggerAtom, 1)
        resolve()
        await Promise.resolve()
        await Promise.resolve()

        const callCountAfterEval2 = callback.mock.calls.length

        // Now change atomA — this should NOT trigger the subscriber
        // because atomA is no longer a dependency after reconciliation.
        store1.set(atomA, "changed")
        resolve()
        await Promise.resolve()
        await Promise.resolve()

        expect(callback.mock.calls.length).toBe(callCountAfterEval2)
    })

    test("async selector: rejection cleans up pendingAsyncDeps", async () => {
        // If an async selector rejects, the .catch() handler must clean up
        // the pendingAsyncDeps entry so it doesn't leak. Verify by checking
        // that subsequent evaluations work correctly.
        const store1 = store()
        const onUnmount = mock(() => {})
        const onMount = mock(() => onUnmount)
        const atom1 = atom(0, { onMount })

        let resolve = () => {}
        let shouldReject = true
        const asyncDerived = selector(wrapAsync(async get => {
            get(atom1)
            await new Promise<void>(r => (resolve = r))
            if (shouldReject) throw new Error("boom")
            return "ok"
        }))

        store1.sub(asyncDerived, () => {})
        resolve()
        await Promise.resolve()
        await Promise.resolve()

        // Despite rejection, onMount was called (atom1 was a sync dep)
        expect(onMount).toHaveBeenCalledTimes(1)

        // After rejection, the selector value should be cleaned up
        // and the system should not be in a corrupted state.
        // Re-trigger: set atom1 to force re-evaluation
        shouldReject = false
        store1.set(atom1, 1)
        resolve()
        await Promise.resolve()
        await Promise.resolve()

        // atom1 should still be mounted (not double-mounted or leaked)
        expect(onMount).toHaveBeenCalledTimes(1)
        expect(onUnmount).toHaveBeenCalledTimes(0)
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
        setIntervalSpy.mockRestore()
        clearIntervalSpy.mockRestore()
    })

    test("atom with maxAge async rejection does not cause unhandled rejection", async () => {
        const store1 = store()
        let callCount = 0
        const atomCallback = () => {
            callCount++
            if (callCount > 1) {
                return new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("fetch failed")), 1),
                )
            }
            return new Promise(resolve =>
                setTimeout(() => resolve(callCount), 1),
            )
        }

        const atom1 = atom(atomCallback, {
            maxAge: 10,
            staleWhileRevalidate: 100,
        })

        const callback = mock(() => {
            store1.get(atom1)
        })
        const unsubscribe = store1.sub(atom1, callback)
        await waitFor(() => expect(store1.get(atom1)).toBe(1))
        // Wait for the interval to fire with a rejection
        await wait(50)
        expect(callCount).toBeGreaterThanOrEqual(2)
        // Cleanup should work without errors
        unsubscribe()
    })

    test("atom with maxAge async (no SWR) shows promise during revalidation", async () => {
        const store1 = store()
        let fetchCount = 0
        const resolvers: Array<(v: number) => void> = []
        const atomCallback = () => {
            fetchCount++
            return new Promise<number>(resolve => {
                resolvers.push(resolve)
            })
        }
        const atom1 = atom(atomCallback, { maxAge: 20 })

        const callback = mock(() => {})
        const unsubscribe = store1.sub(atom1, callback)

        // Initially holds a pending promise
        expect(store1.get(atom1)).toBeInstanceOf(Promise)

        // Resolve initial fetch
        resolvers[0](100)
        await waitFor(() => expect(store1.get(atom1)).toBe(100))

        // Wait for maxAge to expire and trigger revalidation
        await waitFor(() => expect(fetchCount).toBe(2))

        // Without SWR, the store should show the pending promise (loading state)
        expect(store1.get(atom1)).toBeInstanceOf(Promise)

        // Resolve revalidation
        resolvers[1](200)
        await waitFor(() => expect(store1.get(atom1)).toBe(200))

        unsubscribe()
    })

    test("atom with maxAge async and staleWhileRevalidate", async () => {
        const store1 = store()
        let fetchCount = 0
        const resolvers: Array<(v: number) => void> = []
        const atomCallback = () => {
            fetchCount++
            return new Promise<number>(resolve => {
                resolvers.push(resolve)
            })
        }

        const atom1 = atom(atomCallback, {
            maxAge: 30,
            staleWhileRevalidate: 200,
        })

        const res: any[] = []
        const callback = mock(() => {
            res.push(store1.get(atom1))
        })

        // Subscribe — triggers initial fetch
        const unsubscribe = store1.sub(atom1, callback)
        expect(fetchCount).toBe(1)

        // Initially the store holds the pending promise
        expect(store1.get(atom1)).toBeInstanceOf(Promise)

        // Resolve the initial fetch
        resolvers[0](100)
        await wait(1)

        // Subscriber notified with resolved value
        expect(store1.get(atom1)).toBe(100)
        expect(res).toContain(100)

        // Wait for maxAge to expire and trigger revalidation
        await wait(50)
        expect(fetchCount).toBe(2)

        // While revalidation is in-flight, store still returns
        // the stale value (not a promise) — this is the key
        // stale-while-revalidate behavior
        expect(store1.get(atom1)).toBe(100)

        // Resolve the revalidation
        resolvers[1](200)
        await wait(1)

        // Value updated, subscriber notified
        expect(store1.get(atom1)).toBe(200)
        expect(res).toContain(200)

        unsubscribe()
    })

    test(
        "staleWhileRevalidate timeout is cleared on revalidation resolve",
        async () => {
            const store1 = store()
            let fetchCount = 0
            const resolvers: Array<(v: number) => void> = []
            const atomCallback = () => {
                fetchCount++
                return new Promise<number>(resolve => {
                    resolvers.push(resolve)
                })
            }

            const atom1 = atom(atomCallback, {
                maxAge: 20,
                staleWhileRevalidate: 200,
            })

            const staleTimeoutIds: ReturnType<typeof setTimeout>[] = []
            const originalSetTimeout = globalThis.setTimeout
            const setTimeoutSpy = spyOn(globalThis, "setTimeout").mockImplementation(
                (...args: any[]) => {
                    // @ts-ignore
                    const id = originalSetTimeout(...args)
                    if (args[1] === 200) staleTimeoutIds.push(id)
                    return id
                },
            )
            const clearedIds: Set<ReturnType<typeof setTimeout>> = new Set()
            const originalClearTimeout = globalThis.clearTimeout
            const clearTimeoutSpy = spyOn(
                globalThis,
                "clearTimeout",
            ).mockImplementation((id: any) => {
                clearedIds.add(id)
                return originalClearTimeout(id)
            })

            const callback = mock(() => {})
            const unsubscribe = store1.sub(atom1, callback)

            // Resolve initial fetch
            resolvers[0](1)
            await wait(1)

            // Wait for revalidation tick
            await waitFor(() => expect(fetchCount).toBe(2))

            // A staleWhileRevalidate timeout was created
            expect(staleTimeoutIds.length).toBe(1)

            // Resolve the revalidation — should clear the timeout
            resolvers[1](2)
            await wait(1)
            expect(clearedIds.has(staleTimeoutIds[0])).toBe(true)

            unsubscribe()

            setTimeoutSpy.mockRestore()
            clearTimeoutSpy.mockRestore()
        },
    )

    test(
        "maxAge interval should skip tick while revalidation is in-flight",
        async () => {
            // If revalidation takes longer than maxAge, the interval should
            // NOT start another revalidation. This prevents unbounded
            // accumulation of in-flight promises and matches HTTP cache
            // semantics (don't re-fetch while already revalidating).
            const store1 = store()
            let fetchCount = 0
            const resolvers: Array<(v: number) => void> = []
            const atomCallback = () => {
                fetchCount++
                return new Promise<number>(resolve => {
                    resolvers.push(resolve)
                })
            }

            // maxAge is 15ms — interval fires frequently
            const atom1 = atom(atomCallback, {
                maxAge: 15,
                staleWhileRevalidate: 200,
            })

            const callback = mock(() => {})
            const unsubscribe = store1.sub(atom1, callback)

            // Resolve initial fetch
            resolvers[0](1)
            await wait(1)
            expect(fetchCount).toBe(1)

            // Wait long enough for multiple ticks to fire (3-4x maxAge)
            // but DON'T resolve the revalidation promise
            await wait(60)

            // Only one revalidation should have started, even though
            // multiple interval ticks fired
            expect(fetchCount).toBe(2)

            // Resolve the pending revalidation
            resolvers[1](2)
            await wait(1)
            expect(store1.get(atom1)).toBe(2)

            // Now the next tick should be allowed to start a new revalidation
            await wait(20)
            expect(fetchCount).toBe(3)

            unsubscribe()
        },
    )

    test("staleIfError keeps stale value on revalidation rejection", async () => {
        const store1 = store()
        let fetchCount = 0
        const resolvers: Array<{
            resolve: (v: number) => void
            reject: (e: Error) => void
        }> = []
        const atomCallback = () => {
            fetchCount++
            return new Promise<number>((resolve, reject) => {
                resolvers.push({ resolve, reject })
            })
        }

        const atom1 = atom(atomCallback, {
            maxAge: 20,
            staleWhileRevalidate: 200,
            staleIfError: 500,
        })

        const callback = mock(() => {})
        const unsubscribe = store1.sub(atom1, callback)

        // Resolve initial fetch
        resolvers[0].resolve(100)
        await wait(1)
        expect(store1.get(atom1)).toBe(100)

        // Wait for revalidation
        await waitFor(() => expect(fetchCount).toBe(2))

        // Reject the revalidation
        resolvers[1].reject(new Error("network error"))
        await wait(1)

        // With staleIfError, the stale value should be preserved
        expect(store1.get(atom1)).toBe(100)

        unsubscribe()
    })

    test(
        "staleIfError window expiration stops serving stale on error",
        async () => {
            const store1 = store()
            let fetchCount = 0
            const resolvers: Array<{
                resolve: (v: number) => void
                reject: (e: Error) => void
            }> = []
            const atomCallback = () => {
                fetchCount++
                return new Promise<number>((resolve, reject) => {
                    resolvers.push({ resolve, reject })
                })
            }

            const atom1 = atom(atomCallback, {
                maxAge: 20,
                staleIfError: 30,
            })

            const callback = mock(() => {})
            const unsubscribe = store1.sub(atom1, callback)

            // Resolve initial fetch
            resolvers[0].resolve(100)
            await wait(1)
            expect(store1.get(atom1)).toBe(100)

            // Wait long enough for maxAge + staleIfError to expire
            await wait(60)
            expect(fetchCount).toBeGreaterThanOrEqual(2)

            // Reject all pending revalidations
            for (let i = 1; i < resolvers.length; i++) {
                resolvers[i].reject(new Error("network error"))
            }
            await wait(1)

            // staleIfError window has passed — the rejected promise should
            // remain in the store (not the stale value, not deleted)
            const val = store1.get(atom1)
            expect(val).not.toBe(100)
            expect(val).toBeInstanceOf(Promise)

            unsubscribe()
        },
    )

    test(
        "SWR revalidation rejection keeps stale value visible",
        async () => {
            const store1 = store()
            let fetchCount = 0
            const resolvers: Array<{
                resolve: (v: number) => void
                reject: (e: Error) => void
            }> = []
            const atomCallback = () => {
                fetchCount++
                return new Promise<number>((resolve, reject) => {
                    resolvers.push({ resolve, reject })
                })
            }

            const atom1 = atom(atomCallback, {
                maxAge: 20,
                staleWhileRevalidate: 200,
            })

            const callback = mock(() => {})
            const unsubscribe = store1.sub(atom1, callback)

            // Resolve initial fetch
            resolvers[0].resolve(100)
            await wait(1)
            expect(store1.get(atom1)).toBe(100)

            // Wait for revalidation
            await waitFor(() => expect(fetchCount).toBe(2))

            // Reject the revalidation
            resolvers[1].reject(new Error("network error"))
            await wait(1)

            // With SWR (no staleIfError), the stale value should still
            // be preserved — rejection shouldn't delete it
            expect(store1.get(atom1)).toBe(100)

            unsubscribe()
        },
    )

    test(
        "SWR + staleIfError: rejection past window shows error",
        async () => {
            const store1 = store()
            let fetchCount = 0
            const resolvers: Array<{
                resolve: (v: number) => void
                reject: (e: Error) => void
            }> = []
            const atomCallback = () => {
                fetchCount++
                return new Promise<number>((resolve, reject) => {
                    resolvers.push({ resolve, reject })
                })
            }

            const atom1 = atom(atomCallback, {
                maxAge: 20,
                staleWhileRevalidate: 200,
                staleIfError: 30,
            })

            const callback = mock(() => {})
            const unsubscribe = store1.sub(atom1, callback)

            // Resolve initial fetch
            resolvers[0].resolve(100)
            await wait(1)
            expect(store1.get(atom1)).toBe(100)

            // Wait past maxAge + staleIfError (20 + 30 = 50ms)
            await wait(60)
            expect(fetchCount).toBeGreaterThanOrEqual(2)

            // Reject all pending revalidations
            for (let i = 1; i < resolvers.length; i++) {
                resolvers[i].reject(new Error("network error"))
            }
            await wait(1)

            // Past staleIfError window — stale value should NOT be served
            expect(store1.get(atom1)).not.toBe(100)

            unsubscribe()
        },
    )

    test("staleIfError works when atom value is undefined", async () => {
        const store1 = store()
        let fetchCount = 0
        const resolvers: Array<{
            resolve: (v: undefined) => void
            reject: (e: Error) => void
        }> = []
        const atomCallback = () => {
            fetchCount++
            return new Promise<undefined>((resolve, reject) => {
                resolvers.push({ resolve, reject })
            })
        }

        const atom1 = atom(atomCallback, {
            maxAge: 20,
            staleIfError: 500,
        })

        const callback = mock(() => {})
        const unsubscribe = store1.sub(atom1, callback)

        // Resolve initial fetch with undefined
        resolvers[0].resolve(undefined)
        await wait(1)
        expect(store1.get(atom1)).toBe(undefined)

        // Wait for revalidation
        await waitFor(() => expect(fetchCount).toBe(2))

        // Reject — within staleIfError window, should restore undefined
        resolvers[1].reject(new Error("network error"))
        await wait(1)

        // The stale value (undefined) should be restored, not the rejected promise
        expect(store1.get(atom1)).toBe(undefined)

        unsubscribe()
    })

    test(
        "staleIfError recovery: succeed → fail → succeed",
        async () => {
            const store1 = store()
            let fetchCount = 0
            const resolvers: Array<{
                resolve: (v: number) => void
                reject: (e: Error) => void
            }> = []
            const atomCallback = () => {
                fetchCount++
                return new Promise<number>((resolve, reject) => {
                    resolvers.push({ resolve, reject })
                })
            }

            const atom1 = atom(atomCallback, {
                maxAge: 20,
                staleIfError: 500,
            })

            const callback = mock(() => {})
            const unsubscribe = store1.sub(atom1, callback)

            // Resolve initial fetch
            resolvers[0].resolve(100)
            await wait(1)
            expect(store1.get(atom1)).toBe(100)

            // Wait for first revalidation, reject it
            await waitFor(() => expect(fetchCount).toBe(2))
            resolvers[1].reject(new Error("network error"))
            await wait(1)

            // Within staleIfError window — stale value restored
            expect(store1.get(atom1)).toBe(100)

            // Wait for next revalidation, resolve it
            await waitFor(() => expect(fetchCount).toBe(3))
            resolvers[2].resolve(200)
            await wait(1)

            // Value should be updated to 200
            expect(store1.get(atom1)).toBe(200)

            unsubscribe()
        },
    )

    test(
        "multiple consecutive failures with staleIfError",
        async () => {
            const store1 = store()
            let fetchCount = 0
            const resolvers: Array<{
                resolve: (v: number) => void
                reject: (e: Error) => void
            }> = []
            const atomCallback = () => {
                fetchCount++
                return new Promise<number>((resolve, reject) => {
                    resolvers.push({ resolve, reject })
                })
            }

            const atom1 = atom(atomCallback, {
                maxAge: 15,
                staleIfError: 40,
            })

            const callback = mock(() => {})
            const unsubscribe = store1.sub(atom1, callback)

            // Resolve initial fetch
            resolvers[0].resolve(100)
            await wait(1)
            expect(store1.get(atom1)).toBe(100)

            // First revalidation: reject (within staleIfError window)
            await waitFor(() => expect(fetchCount).toBe(2))
            resolvers[1].reject(new Error("fail 1"))
            await wait(1)
            expect(store1.get(atom1)).toBe(100) // stale value kept

            // Second revalidation: succeed (resets the window)
            await waitFor(() => expect(fetchCount).toBe(3))
            resolvers[2].resolve(200)
            await wait(1)
            expect(store1.get(atom1)).toBe(200) // updated

            // Wait past maxAge + staleIfError from last success (15 + 40 = 55ms)
            await wait(60)

            // Reject all pending revalidations (past window now)
            const pending = resolvers.length
            expect(fetchCount).toBeGreaterThanOrEqual(4)
            for (let i = 3; i < resolvers.length; i++) {
                resolvers[i].reject(new Error("fail N"))
            }
            await wait(1)

            // Past staleIfError window — stale value should NOT be served
            expect(store1.get(atom1)).not.toBe(200)

            unsubscribe()
        },
    )

    test(
        "async atom should recover after init rejection",
        async () => {
            // Concern: if the async init function rejects, the rejected
            // promise stays in data.values permanently. The atom never
            // retries and store.get() returns a rejected promise forever.
            //
            // Expected: after rejection, the atom should be in a state
            // where re-subscribing or re-getting triggers a retry of the
            // init function, rather than being stuck.
            const store1 = store()
            let callCount = 0
            const atomCallback = () => {
                callCount++
                if (callCount === 1) {
                    return Promise.reject(new Error("init failed"))
                }
                return Promise.resolve(42)
            }

            const atom1 = atom(atomCallback)

            const callback = mock(() => {})
            const unsub1 = store1.sub(atom1, callback)
            await wait(5)

            // First access — rejected promise is stuck in the store
            const value = store1.get(atom1)
            expect(value).toBeInstanceOf(Promise)
            unsub1()

            // Re-subscribing should retry the init function and recover
            const unsub2 = store1.sub(atom1, callback)
            await wait(5)

            expect(callCount).toBe(2)
            expect(store1.get(atom1)).toBe(42)

            unsub2()
        },
    )

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

    test("atom with maxAge async: in-flight promise should not update store after unsubscribe", async () => {
        const store1 = store()
        let resolver: (v: number) => void
        let fetchCount = 0
        const atomCallback = () => {
            fetchCount++
            return new Promise<number>(resolve => {
                resolver = resolve
            })
        }
        // Use SWR so the stale value stays visible during revalidation
        const atom1 = atom(atomCallback, {
            maxAge: 20,
            staleWhileRevalidate: 1000,
        })

        const callback = mock(() => {})
        const unsubscribe = store1.sub(atom1, callback)

        // Resolve the initial defaultValue call
        resolver!(1)
        await wait(1)
        expect(store1.get(atom1)).toBe(1)

        // Wait for the interval to fire — this calls defaultValue() again,
        // creating a new in-flight promise. With SWR the store keeps value 1.
        await wait(25)
        expect(fetchCount).toBe(2)
        expect(store1.get(atom1)).toBe(1)

        // Unsubscribe while the second promise is still pending.
        // Cleanup runs: clears the interval and pending timeouts.
        unsubscribe()

        // Now resolve the in-flight promise AFTER cleanup
        resolver!(999)
        await wait(1)

        // The resolved value should NOT have been written to the store,
        // because the subscription (and its interval) was cleaned up.
        expect(store1.get(atom1)).toBe(1)
    })

    test("atom with maxAge: last subscriber unsubscribing clears interval even if it was not the first", async () => {
        const setIntervalSpy = spyOn(global, "setInterval")
        const clearIntervalSpy = spyOn(global, "clearInterval")
        const store1 = store()
        const atom1 = atom(() => Date.now(), { maxAge: 50 })

        // First subscription creates the interval
        const unsub1 = store1.sub(atom1, () => {})
        expect(setIntervalSpy).toHaveBeenCalledTimes(1)

        // Second subscription does NOT create a new interval
        const unsub2 = store1.sub(atom1, () => {})
        expect(setIntervalSpy).toHaveBeenCalledTimes(1)

        // Unsub the first subscriber — still one left, interval should stay
        unsub1()
        expect(clearIntervalSpy).toHaveBeenCalledTimes(0)

        // Unsub the last subscriber — interval should be cleaned up
        unsub2()
        expect(clearIntervalSpy).toHaveBeenCalledTimes(1)

        setIntervalSpy.mockRestore()
        clearIntervalSpy.mockRestore()
    })
})
