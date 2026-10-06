import { describe, expect, test } from "bun:test"
import {
    CallbackCapabilityError,
    DormantExternalReadError,
    InvalidSynchronousAtomValueError,
    InvalidTransactionCallbackResultError,
    ScopeNotFoundError,
    StoreDisposedError,
    StoreTreeMismatchError,
    SettleLimitError,
    SubscriberNotificationError,
    TransactionClosedError,
    TransactionPhaseError,
    atom,
    collection,
    externalAtom,
    family,
    selector,
    store,
    type Transaction,
} from "../../src/index"

/**
 * The examples in packages/valdres/src/store.mdx and the transactions and
 * scoped-stores guides under docs/content/guides/, run as written against the
 * public entry. The MDX is not compiled as code, so this is what keeps a
 * corrected example from drifting back to a removed API.
 */

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

describe("docs: store", () => {
    test("store() takes no arguments and has no id", () => {
        const myStore = store()
        expect("id" in myStore).toBe(false)
        expect(Object.keys(myStore).sort()).toEqual(
            [
                "delete",
                "dispose",
                "get",
                "reset",
                "scope",
                "set",
                "sub",
                "txn",
                "update",
            ].sort(),
        )
        // @ts-expect-error store() accepts no arguments
        expect(thrownBy(() => store("checkout"))).toBeInstanceOf(TypeError)
    })

    test("get shares references; set stores, update calls, reset restores", () => {
        const myStore = store()
        const countAtom = atom(0)
        const value = { a: 1 }
        const objectAtom = atom(value)
        expect(myStore.get(objectAtom)).toBe(value)
        expect(Object.isFrozen(myStore.get(objectAtom))).toBe(false)

        expect(myStore.set(countAtom, 42)).toBeUndefined()
        expect(myStore.update(countAtom, prev => prev + 1)).toBeUndefined()
        expect(myStore.get(countAtom)).toBe(43)
        myStore.reset(countAtom)
        expect(myStore.get(countAtom)).toBe(0)

        if (false as boolean) {
            // @ts-expect-error set stores values; updaters go through update
            myStore.set(countAtom, (prev: number) => prev + 1)
            myStore.txn(tx => {
                // @ts-expect-error the cursor's set stores values too
                tx.set(countAtom, (prev: number) => prev + 1)
            })
        }

        const logs: string[] = []
        const onSaveAtom = atom<() => void>(() => {})
        myStore.set(onSaveAtom, () => logs.push("saved"))
        myStore.get(onSaveAtom)()
        expect(logs).toEqual(["saved"])

        expect(
            thrownBy(() => myStore.set(countAtom, Promise.resolve(1) as never)),
        ).toBeInstanceOf(InvalidSynchronousAtomValueError)
    })

    test("notification callbacks read but cannot change state", () => {
        const myStore = store()
        const other = store()
        const countAtom = atom(0)
        const lastSeenAtom = atom(0)
        const failures: unknown[] = []
        const reads: number[] = []
        const unsub = myStore.sub(countAtom, () => {
            reads.push(myStore.get(countAtom), other.get(countAtom))
            for (const operation of [
                () => myStore.set(lastSeenAtom, 1),
                () => myStore.txn(tx => tx.set(lastSeenAtom, 1)),
                () => other.set(lastSeenAtom, 1),
                () => myStore.sub(lastSeenAtom, () => {}),
                () => myStore.scope("x"),
                () => other.dispose(),
                () => store(),
            ]) {
                failures.push(thrownBy(operation))
            }
            unsub()
        })
        myStore.set(countAtom, 1)
        expect(reads).toEqual([1, 0])
        expect(failures).toHaveLength(7)
        for (const failure of failures) {
            expect(failure).toBeInstanceOf(CallbackCapabilityError)
        }
    })

    test("notification callbacks cannot sample a dormant external atom", () => {
        const external = externalAtom({
            getSnapshot: () => 1,
            subscribe: () => () => {},
        })
        const derived = selector(get => get(external) + 1)
        for (const read of [external, derived]) {
            const myStore = store()
            const countAtom = atom(0)
            myStore.sub(countAtom, () => {
                myStore.get(read)
            })
            const error = thrownBy(() => myStore.set(countAtom, 1))
            expect(error).toBeInstanceOf(SubscriberNotificationError)
            expect((error as SubscriberNotificationError).cause).toBeInstanceOf(
                DormantExternalReadError,
            )
            expect(myStore.get(countAtom)).toBe(1)

            // Once subscribed, the same read is allowed.
            const stop = myStore.sub(read, () => {})
            expect(() => myStore.set(countAtom, 2)).not.toThrow()
            stop()
        }
    })

    test("deferred work is a separate operation", async () => {
        const myStore = store()
        const countAtom = atom(0)
        const lastSeenAtom = atom(0)
        const seen: [number, number][] = []
        myStore.sub(countAtom, () => {
            seen.push([myStore.get(countAtom), myStore.get(lastSeenAtom)])
            const count = myStore.get(countAtom)
            queueMicrotask(() => myStore.set(lastSeenAtom, count))
        })
        myStore.set(countAtom, 2)
        expect(myStore.get(lastSeenAtom)).toBe(0)
        expect(seen).toEqual([[2, 0]])
        await Promise.resolve()
        expect(myStore.get(lastSeenAtom)).toBe(2)
    })

    test("notification failures report a committed write", () => {
        const myStore = store()
        const countAtom = atom(0)
        const reached: string[] = []
        myStore.sub(countAtom, () => {
            throw new Error("ui")
        })
        myStore.sub(countAtom, () => reached.push("second"))

        const reported: unknown[] = []
        const reportError = (error: unknown) => reported.push(error)
        try {
            myStore.update(countAtom, n => n + 1)
        } catch (error) {
            if (!(error instanceof SubscriberNotificationError)) throw error
            const committed: true = error.committed
            expect(committed).toBe(true)
            reportError(error.cause)
        }
        expect(myStore.get(countAtom)).toBe(1)
        expect(reached).toEqual(["second"])
        expect((reported[0] as Error).message).toBe("ui")
    })

    test("transactions commit once, return, roll back, reject async", () => {
        const myStore = store()
        const atomA = atom(0)
        const atomB = atom(0)
        const sum = selector(get => get(atomA) + get(atomB))
        const seen: number[] = []
        myStore.sub(sum, () => seen.push(myStore.get(sum)))
        myStore.txn(tx => {
            tx.set(atomA, 1)
            tx.update(atomB, n => n + 1)
        })
        expect(seen).toEqual([2])

        expect(
            myStore.txn(({ get, set }) => {
                set(atomA, 5)
                return get(atomA) * 2
            }),
        ).toBe(10)

        expect(
            thrownBy(() =>
                myStore.txn(tx => {
                    tx.set(atomA, 100)
                    throw new Error("save failed")
                }),
            ),
        ).toBeInstanceOf(Error)
        expect(myStore.get(atomA)).toBe(5)

        expect(
            thrownBy(() =>
                myStore.txn((async () => {}) as unknown as () => void),
            ),
        ).toBeInstanceOf(InvalidTransactionCallbackResultError)
        expect(myStore.get(atomA)).toBe(5)
    })

    test("a subscriber failure replaces the txn return value", () => {
        const myStore = store()
        const priceAtom = atom(0)
        myStore.sub(priceAtom, () => {
            throw new Error("ui")
        })
        let total: unknown = "unset"
        const error = thrownBy(() => {
            total = myStore.txn(txn => {
                txn.set(priceAtom, 100)
                return txn.get(priceAtom) * 2
            })
        })
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect(total).toBe("unset")
        expect(myStore.get(priceAtom)).toBe(100)
    })

    test("the settle round limit reports committed rounds", () => {
        const myStore = store()
        const x = atom(0)
        const y = atom(0)
        myStore.sub(x, { settle: tx => tx.set(y, tx.get(y) + 1) })
        myStore.sub(y, { settle: tx => tx.set(x, tx.get(x) + 1) })
        const error = thrownBy(() => myStore.set(x, 1))
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect((error as SubscriberNotificationError).committed).toBe(true)
        expect((error as SubscriberNotificationError).cause).toBeInstanceOf(
            SettleLimitError,
        )
        expect(myStore.get(y)).toBeGreaterThan(0)
    })

    test("transactions use the cursor, not captured Stores", () => {
        const myStore = store()
        const unrelated = store()
        const countAtom = atom(3)
        const draft = myStore.scope("draft")

        for (const operation of [
            () => myStore.get(countAtom),
            () => draft.get(countAtom),
            () => unrelated.get(countAtom),
            () => unrelated.set(countAtom, 1),
            () => myStore.txn(() => {}),
            () => myStore.sub(countAtom, () => {}),
            () => store(),
        ]) {
            expect(thrownBy(() => myStore.txn(operation))).toBeInstanceOf(
                TransactionPhaseError,
            )
        }

        myStore.txn(tx => {
            const count = tx.get(countAtom)
            tx.scope("draft").set(countAtom, count + 1)
        })
        expect(draft.get(countAtom)).toBe(4)
        expect(myStore.get(countAtom)).toBe(3)

        expect(
            thrownBy(() => myStore.txn(tx => tx.scope("missing"))),
        ).toBeInstanceOf(ScopeNotFoundError)
        expect(
            thrownBy(() => myStore.txn(tx => tx.scope(unrelated))),
        ).toBeInstanceOf(StoreTreeMismatchError)

        let leaked: Transaction | undefined
        myStore.txn(tx => {
            leaked = tx
        })
        expect(thrownBy(() => leaked!.set(countAtom, 1))).toBeInstanceOf(
            TransactionClosedError,
        )
    })

    test("settle reaches its own tree's scopes only through tx.scope", () => {
        const myStore = store()
        const unrelated = store()
        const trigger = atom(0)
        const mirrored = atom(0)
        const kid = myStore.scope("kid")
        const failures: unknown[] = []
        myStore.sub(trigger, {
            settle: tx => {
                failures.push(thrownBy(() => tx.scope(unrelated)))
                tx.scope("kid").set(mirrored, tx.get(trigger))
            },
        })
        myStore.set(trigger, 7)
        expect(kid.get(mirrored)).toBe(7)
        expect(failures[0]).toBeInstanceOf(StoreTreeMismatchError)
    })

    test("resetAll restores the parent's values and order in one commit", () => {
        const movies = collection<string, string>()
        const root = store()
        for (const key of ["a", "b", "c", "d"]) root.set(movies(key), key)
        const keys = (target: { get: typeof root.get }) =>
            target.get(movies).map(row => row.key)

        const draft = root.scope("draft")
        draft.delete(movies("b"))
        expect(keys(draft)).toEqual(["a", "c", "d"])
        root.txn(tx => tx.scope(draft).resetAll())
        expect(keys(draft)).toEqual(["a", "b", "c", "d"])

        // one-at-a-time reset reveals b at the end
        const loop = root.scope("loop")
        loop.delete(movies("b"))
        loop.reset(movies("b"))
        expect(keys(loop)).toEqual(["a", "c", "d", "b"])

        // rebuild in place: one notification, same handle
        const snapshot = new Map([
            ["c", "C"],
            ["e", "E"],
        ])
        draft.delete(movies("a"))
        let notified = 0
        const stop = draft.sub(movies, () => notified++)
        root.txn(tx => {
            const cursor = tx.scope(draft)
            cursor.resetAll()
            for (const [key, value] of snapshot) cursor.set(movies(key), value)
        })
        stop()
        expect(keys(draft)).toEqual(["a", "b", "c", "d", "e"])
        expect(draft.get(movies("c"))).toBe("C")
        expect(notified).toBe(1)
        expect(root.scope("draft")).toBe(draft)
    })

    test("resetAll rejects roots and arguments, and is all or nothing", () => {
        const countAtom = atom(0)
        const root = store()
        const draft = root.scope("draft")
        draft.set(countAtom, 1)
        expect(thrownBy(() => root.txn(tx => tx.resetAll()))).toBeInstanceOf(
            TypeError,
        )
        expect(
            thrownBy(() =>
                root.txn(tx =>
                    Reflect.apply(tx.scope(draft).resetAll, undefined, [
                        countAtom,
                    ]),
                ),
            ),
        ).toBeInstanceOf(TypeError)
        expect(draft.get(countAtom)).toBe(1)

        let leaked: Transaction | undefined
        root.txn(tx => {
            leaked = tx.scope(draft)
        })
        expect(thrownBy(() => leaked!.resetAll())).toBeInstanceOf(
            TransactionClosedError,
        )

        const boom = new Error("initializer failed")
        const lazyAtom = atom.lazy<number>(() => {
            throw boom
        })
        draft.set(lazyAtom, 5)
        root.txn(tx => {
            const cursor = tx.scope(draft)
            expect(thrownBy(() => cursor.resetAll())).toBe(boom)
            expect(cursor.get(countAtom)).toBe(1)
        })
        expect(draft.get(countAtom)).toBe(1)
        expect(draft.get(lazyAtom)).toBe(5)
    })

    test("resetAll is applied even when a subscriber fails afterwards", () => {
        const countAtom = atom(0)
        const root = store()
        const draft = root.scope("draft")
        draft.set(countAtom, 3)
        draft.sub(countAtom, () => {
            throw new Error("subscriber failed")
        })
        const error = thrownBy(() =>
            root.txn(tx => tx.scope(draft).resetAll()),
        )
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect((error as SubscriberNotificationError).committed).toBe(true)
        expect(draft.get(countAtom)).toBe(0)
    })

    test("a settle handler on a child scope can reset its own scope", () => {
        const trigger = atom(0)
        const countAtom = atom(0)
        const root = store()
        const draft = root.scope("draft")
        draft.set(countAtom, 5)
        draft.sub(trigger, { settle: tx => tx.resetAll() })
        root.set(trigger, 1)
        expect(draft.get(countAtom)).toBe(0)
    })

    test("named scopes are shared and disposal ends them for everyone", () => {
        const myStore = store()
        const nameAtom = atom("Alice")
        const draft = myStore.scope("draft")
        expect(myStore.scope("draft")).toBe(draft)
        draft.set(nameAtom, "Bob")

        draft.dispose()
        expect(thrownBy(() => draft.get(nameAtom))).toBeInstanceOf(
            StoreDisposedError,
        )
        const next = myStore.scope("draft")
        expect(next).not.toBe(draft)
        expect(next.get(nameAtom)).toBe("Alice")
        expect(() => draft.dispose()).not.toThrow()
    })

    test("anonymous scopes are isolated and die with their parent", () => {
        const root = store()
        const nameAtom = atom("Alice")
        const preview = root.scope()
        expect(root.scope()).not.toBe(preview)
        preview.set(nameAtom, "Preview")
        expect(root.get(nameAtom)).toBe("Alice")

        root.dispose()
        expect(thrownBy(() => preview.get(nameAtom))).toBeInstanceOf(
            StoreDisposedError,
        )
        expect(thrownBy(() => root.get(nameAtom))).toBeInstanceOf(
            StoreDisposedError,
        )
    })
})

describe("docs: transactions guide", () => {
    test("drag and drop moves an item atomically", () => {
        const listItemsAtom = family((listId: string) => atom<string[]>([]))
        const myStore = store()
        myStore.set(listItemsAtom("todo"), ["a", "b"])

        const seen: [string[], string[]][] = []
        myStore.sub(listItemsAtom("done"), () =>
            seen.push([
                myStore.get(listItemsAtom("todo")),
                myStore.get(listItemsAtom("done")),
            ]),
        )

        function moveItem(itemId: string, fromListId: string, toListId: string) {
            myStore.txn(tx => {
                tx.update(listItemsAtom(fromListId), ids =>
                    ids.filter(id => id !== itemId),
                )
                tx.update(listItemsAtom(toListId), ids => [...ids, itemId])
            })
        }

        moveItem("a", "todo", "done")
        expect(seen).toEqual([[["b"], ["a"]]])
    })

    test("updater functions in a transaction", () => {
        const myStore = store()
        const countA = atom(0)
        const countB = atom(0)
        myStore.txn(tx => {
            tx.update(countA, prev => prev + 1)
            tx.update(countB, prev => prev + 10)
            tx.set(countA, 100)
        })
        expect([myStore.get(countA), myStore.get(countB)]).toEqual([100, 10])
    })
})

describe("docs: scoped-stores guide", () => {
    test("reads inherit, writes stay local, reset reverts one value", () => {
        const nameAtom = atom("Alice")
        const rootStore = store()
        const childStore = rootStore.scope("child-1")

        rootStore.set(nameAtom, "Alice")
        expect(childStore.get(nameAtom)).toBe("Alice")
        childStore.set(nameAtom, "Bob")
        expect(rootStore.get(nameAtom)).toBe("Alice")
        rootStore.set(nameAtom, "Charlie")
        expect(childStore.get(nameAtom)).toBe("Bob")

        const ageAtom = atom(30)
        rootStore.set(ageAtom, 31)
        expect(childStore.get(ageAtom)).toBe(31)

        childStore.reset(nameAtom)
        expect(childStore.get(nameAtom)).toBe("Charlie")
    })

    test("selectors evaluate against the scope's view", () => {
        const priceAtom = atom(100)
        const taxAtom = atom(0.25)
        const totalSelector = selector(
            get => get(priceAtom) * (1 + get(taxAtom)),
        )
        const root = store()
        const child = root.scope("preview")
        root.set(taxAtom, 0.5)
        expect(root.get(totalSelector)).toBe(150)
        child.set(taxAtom, 0.25)
        expect(child.get(totalSelector)).toBe(125)
        expect(root.get(totalSelector)).toBe(150)
    })

    test("collections in scopes", () => {
        type Todo = { title: string; done: boolean }
        const todos = collection<string, Todo>()
        const root = store()
        const child = root.scope("draft")

        root.set(todos("a"), { title: "Buy milk", done: false })
        expect(child.get(todos("a"))).toEqual({ title: "Buy milk", done: false })

        child.set(todos("b"), { title: "Draft todo", done: false })
        expect(root.get(todos)).toEqual([todos("a")])
        expect(child.get(todos)).toEqual([todos("a"), todos("b")])

        child.delete(todos("a"))
        expect(child.get(todos("a"))).toBeUndefined()
        expect(root.get(todos("a"))).toEqual({ title: "Buy milk", done: false })

        child.reset(todos("a"))
        expect(child.get(todos("a"))).toEqual({ title: "Buy milk", done: false })
    })

    test("subscriptions follow the scope's view", () => {
        const root = store()
        const child = root.scope("child")
        const countAtom = atom(0)
        const logs: number[] = []
        child.sub(countAtom, () => logs.push(child.get(countAtom)))

        root.set(countAtom, 1)
        child.set(countAtom, 99)
        root.set(countAtom, 2)
        expect(logs).toEqual([1, 99])
    })

    test("a parent transaction publishes and reverts a draft in one commit", () => {
        const nameAtom = atom("Alice")
        const root = store()
        const draft = root.scope("draft")
        draft.set(nameAtom, "Bob")
        const seen: string[] = []
        root.sub(nameAtom, () => seen.push(root.get(nameAtom)))

        root.txn(tx => {
            tx.set(nameAtom, tx.scope("draft", scoped => scoped.get(nameAtom)))
            tx.scope("draft").reset(nameAtom)
        })
        expect(root.get(nameAtom)).toBe("Bob")
        expect(draft.get(nameAtom)).toBe("Bob")
        expect(seen).toEqual(["Bob"])

        const editorStore = root.scope("editor")
        editorStore.set(nameAtom, "Carol")
        root.txn(tx => {
            tx.set(
                nameAtom,
                tx.scope(editorStore, scoped => scoped.get(nameAtom)),
            )
            tx.scope(editorStore).reset(nameAtom)
        })
        expect(root.get(nameAtom)).toBe("Carol")
    })

    test("resetAll rebuilds a draft in one transaction", () => {
        const nameAtom = atom("Alice")
        const ageAtom = atom(30)
        const root = store()
        const draft = root.scope("draft")
        draft.set(nameAtom, "Bob")
        draft.set(ageAtom, 40)
        const seen: string[] = []
        draft.sub(nameAtom, () => seen.push(draft.get(nameAtom)))

        root.txn(tx => {
            const scoped = tx.scope("draft")
            scoped.resetAll()
            scoped.set(nameAtom, "Dana")
        })
        expect(draft.get(nameAtom)).toBe("Dana")
        expect(draft.get(ageAtom)).toBe(30)
        expect(seen).toEqual(["Dana"])
    })
})
