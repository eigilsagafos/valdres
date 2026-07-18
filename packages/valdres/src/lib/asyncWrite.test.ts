import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"
import type { Atom } from "../types/Atom"
import type { Store } from "../types/Store"
import { isPromiseLike } from "../utils/isPromiseLike"

const flushMicrotasks = async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
}

type WriteMode = {
    name: string
    createStore: () => Store
    write: (
        store1: Store,
        valueAtom: Atom<number>,
        value: number | PromiseLike<number>,
    ) => void
}

const writeModes: WriteMode[] = [
    {
        name: "direct set",
        createStore: () => store(),
        write: (store1, valueAtom, value) => {
            store1.set(valueAtom, value)
        },
    },
    {
        name: "batched set",
        createStore: () => store({ batchUpdates: true }),
        write: (store1, valueAtom, value) => {
            store1.set(valueAtom, value)
        },
    },
    {
        name: "transactional set",
        createStore: () => store(),
        write: (store1, valueAtom, value) => {
            store1.txn(txn => {
                txn.set(valueAtom, value)
            })
        },
    },
]

describe("async writes", () => {
    test("batched set settles the atom and its subscribed selector", async () => {
        const store1 = store({ batchUpdates: true })
        const valueAtom = atom(1)
        let evaluations = 0
        const selectedValue = selector(get => {
            evaluations++
            return get(valueAtom)
        })
        expect(store1.get(selectedValue)).toBe(1)

        const callback = mock(() => {})
        const unsubscribe = store1.sub(selectedValue, callback)
        let resolve!: (value: number) => void
        const pending = new Promise<number>(done => {
            resolve = done
        })

        store1.set(valueAtom, pending)
        await flushMicrotasks()
        expect(store1.get(valueAtom)).toBe(pending)
        expect(isPromiseLike(store1.get(selectedValue))).toBe(true)

        resolve(2)
        await pending
        await flushMicrotasks()

        expect(store1.get(valueAtom)).toBe(2)
        expect(store1.get(selectedValue)).toBe(2)
        const settledEvaluations = evaluations
        await flushMicrotasks()
        expect(evaluations).toBe(settledEvaluations)
        unsubscribe()
    })

    test("transactional set settles a promise value", async () => {
        const store1 = store()
        const valueAtom = atom(1)
        const pending = Promise.resolve(2)

        store1.txn(txn => {
            // Transaction writes support the same Promise-like values as set().
            txn.set(valueAtom, pending)
        })
        expect(store1.get(valueAtom)).toBe(pending)

        await pending
        await flushMicrotasks()

        expect(store1.get(valueAtom)).toBe(2)
    })

    test("transactional async updater settles its returned promise", async () => {
        const store1 = store()
        const valueAtom = atom(1)

        store1.txn(txn => {
            txn.set(valueAtom, current => Promise.resolve(current + 1))
        })
        await flushMicrotasks()

        expect(store1.get(valueAtom)).toBe(2)
    })

    test("an explicit commit adopts a bare thenable only once", async () => {
        const store1 = store()
        const valueAtom = atom(1)
        let adoptions = 0
        const thenable: PromiseLike<number> = {
            then(onFulfilled) {
                adoptions++
                return Promise.resolve(
                    onFulfilled ? onFulfilled(2) : (2 as any),
                ) as any
            },
        }

        store1.txn(txn => {
            txn.set(valueAtom, thenable)
            txn.commit()
        })
        await flushMicrotasks()

        expect(adoptions).toBe(1)
        expect(store1.get(valueAtom)).toBe(2)
    })

    for (const mode of writeModes) {
        test(`${mode.name} rolls back rejection and ignores stale settlement`, async () => {
            const store1 = mode.createStore()
            const valueAtom = atom(1)
            let reject!: (reason: Error) => void
            const rejected = new Promise<number>((_, fail) => {
                reject = fail
            })

            mode.write(store1, valueAtom, rejected)
            await flushMicrotasks()
            reject(new Error("boom"))
            await rejected.catch(() => {})
            await flushMicrotasks()
            expect(store1.get(valueAtom)).toBe(1)

            let resolve!: (value: number) => void
            const stale = new Promise<number>(done => {
                resolve = done
            })
            mode.write(store1, valueAtom, stale)
            await flushMicrotasks()
            mode.write(store1, valueAtom, 3)
            await flushMicrotasks()
            resolve(2)
            await stale
            await flushMicrotasks()
            expect(store1.get(valueAtom)).toBe(3)
        })

        test(`${mode.name} calls onSet with only the resolved value`, async () => {
            const onSet = mock(() => {})
            const store1 = mode.createStore()
            const valueAtom = atom(1, { onSet })
            let resolve!: (value: number) => void
            const pending = new Promise<number>(done => {
                resolve = done
            })

            mode.write(store1, valueAtom, pending)
            await flushMicrotasks()
            expect(onSet).not.toHaveBeenCalled()

            resolve(2)
            await pending
            await flushMicrotasks()
            expect(onSet).toHaveBeenCalledTimes(1)
            expect(onSet).toHaveBeenCalledWith(2, store1.data)
        })

        test(`${mode.name} propagates settlement after onSet throws`, async () => {
            const hookError = new Error("onSet failed")
            const store1 = mode.createStore()
            const valueAtom = atom(1, {
                onSet: () => {
                    throw hookError
                },
            })
            const doubled = selector(get => get(valueAtom) * 2)
            const seen: number[] = []
            store1.sub(doubled, () => seen.push(store1.get(doubled)))

            mode.write(store1, valueAtom, Promise.resolve(2))
            await flushMicrotasks()

            expect(store1.get(valueAtom)).toBe(2)
            expect(store1.get(doubled)).toBe(4)
            expect(seen.at(-1)).toBe(4)
        })

        test(`${mode.name} fans a settled global write out to peers`, async () => {
            const source = mode.createStore()
            const peer = store()
            const valueAtom = atom(1, { global: true })
            source.get(valueAtom)
            peer.get(valueAtom)

            mode.write(source, valueAtom, Promise.resolve(2))
            await flushMicrotasks()

            expect(source.get(valueAtom)).toBe(2)
            expect(peer.get(valueAtom)).toBe(2)
        })

        test(`${mode.name} adopts a bare thenable`, async () => {
            const store1 = mode.createStore()
            const valueAtom = atom(1)
            const thenable: PromiseLike<number> & { adopted: boolean } = {
                adopted: false,
                then(onFulfilled) {
                    this.adopted = true
                    return Promise.resolve(
                        onFulfilled ? onFulfilled(2) : (2 as any),
                    ) as any
                },
            }

            mode.write(store1, valueAtom, thenable)
            await flushMicrotasks()

            expect(store1.get(valueAtom)).toBe(2)
            expect(thenable.adopted).toBe(true)
        })

        test(`${mode.name} settles an equal Promise pinned in a scope`, async () => {
            const root = mode.createStore()
            const scoped = root.scope("child")
            const valueAtom = atom(1)
            let resolve!: (value: number) => void
            const pending = new Promise<number>(done => {
                resolve = done
            })

            mode.write(root, valueAtom, pending)
            await flushMicrotasks()
            mode.write(scoped, valueAtom, pending)
            await flushMicrotasks()

            resolve(2)
            await pending
            await flushMicrotasks()
            mode.write(root, valueAtom, 3)
            await flushMicrotasks()

            expect(root.get(valueAtom)).toBe(3)
            expect(scoped.get(valueAtom)).toBe(2)
        })

        test(`${mode.name} re-inherits when an equal scoped Promise rejects`, async () => {
            const root = mode.createStore()
            const scoped = root.scope("child")
            const valueAtom = atom(1)
            let reject!: (reason: Error) => void
            const pending = new Promise<number>((_, fail) => {
                reject = fail
            })

            mode.write(root, valueAtom, pending)
            await flushMicrotasks()
            mode.write(scoped, valueAtom, pending)
            await flushMicrotasks()

            reject(new Error("boom"))
            await pending.catch(() => {})
            await flushMicrotasks()
            expect(root.get(valueAtom)).toBe(1)
            expect(scoped.get(valueAtom)).toBe(1)

            mode.write(root, valueAtom, 3)
            await flushMicrotasks()
            expect(scoped.get(valueAtom)).toBe(3)
        })
    }
})
