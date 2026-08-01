import { getStoreData } from "./getStoreData"
import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"
import { transaction } from "./transaction"
import { index } from "../indexConstructor"
import { SchemaValidationError } from "../errors/SchemaValidationError"
import { SelectorCircularDependencyError } from "../errors/SelectorCircularDependencyError"
import { SelectorEvaluationError } from "../errors/SelectorEvaluationError"
import type { InternalAtom } from "../types/InternalAtom"
import { assertStoreInvariants } from "../../test/invariants/checkStoreInvariants"

/** Resolve to a promise's value if it settles within `ms`, else report it
 *  still pending — a bounded race so a hung suspense promise fails fast
 *  instead of timing out the test. Clears the timer in `finally` so a won
 *  race never leaves a dangling timeout holding the event loop open. */
const settleWithin = async <T>(promise: Promise<T>, ms = 50) => {
    let timer: ReturnType<typeof setTimeout>
    try {
        return await Promise.race([
            promise.then(value => ({ kind: "resolved" as const, value })),
            new Promise<{ kind: "pending" }>(resolve => {
                timer = setTimeout(() => resolve({ kind: "pending" }), ms)
            }),
        ])
    } finally {
        clearTimeout(timer!)
    }
}

describe("transaction", () => {
    test("txn set direct", () => {
        const store1 = store()
        const atom1 = atom(1)
        transaction(({ set }) => {
            set(atom1, 2)
        }, getStoreData(store1))
        expect(store1.get(atom1)).toBe(2)
    })

    test("large fresh unobserved writes still close one commit boundary", () => {
        const store1 = store()
        const atoms = Array.from({ length: 256 }, () => atom(0))
        const onCommitEnd = mock(() => {})
        const unsubscribe = store1.onCommitEnd(onCommitEnd)

        store1.txn(txn => {
            for (let index = 0; index < atoms.length; index++) {
                txn.set(atoms[index]!, index + 1)
            }
        })

        expect(store1.get(atoms[0]!)).toBe(1)
        expect(store1.get(atoms[atoms.length - 1]!)).toBe(256)
        expect(onCommitEnd).toHaveBeenCalledTimes(1)
        unsubscribe()
    })

    test("fresh atoms with initialization behavior stay on the full path", () => {
        const store1 = store()
        const atom1 = atom(0) as InternalAtom<number>
        const onInit = mock(() => {})
        atom1.onInit = onInit

        store1.txn(txn => txn.set(atom1, 1))

        expect(onInit).toHaveBeenCalledTimes(1)
        expect(store1.get(atom1)).toBe(1)
    })

    test("txn set with callback", () => {
        const store1 = store()
        const atom1 = atom(1)
        transaction(({ set }) => {
            set(atom1, curr => curr + 1)
        }, getStoreData(store1))
        expect(store1.get(atom1)).toBe(2)
    })

    test("a callback cannot publish writes before it throws", () => {
        const store1 = store()
        const atom1 = atom(1)
        const callbackError = new Error("callback failed")

        expect(() =>
            store1.txn(txn => {
                txn.set(atom1, 2)
                expect("commit" in txn).toBe(false)
                expect("data" in txn).toBe(false)

                // Exercise the legacy escape hatch without making it part of
                // the callback's public type. A transaction must remain atomic
                // even when untyped consumer code attempts an early commit.
                ;(txn as any).commit?.()
                throw callbackError
            }),
        ).toThrow(callbackError)
        expect(store1.get(atom1)).toBe(1)
    })

    test("captured transaction operations close after success and failure", () => {
        const store1 = store()
        const atom1 = atom(1)
        let successfulTxn: any
        let failedTxn: any

        store1.txn(txn => {
            successfulTxn = txn
            txn.set(atom1, 2)
        })
        expect(() => successfulTxn.get(atom1)).toThrow(
            "Cannot read from transaction while it is closed",
        )
        expect(() => successfulTxn.set(atom1, 3)).toThrow(
            "Cannot write to transaction while it is closed",
        )

        expect(() =>
            store1.txn(txn => {
                failedTxn = txn
                txn.set(atom1, 3)
                throw new Error("abort")
            }),
        ).toThrow("abort")
        expect(() => failedTxn.set(atom1, 4)).toThrow(
            "Cannot write to transaction while it is closed",
        )
        expect(store1.get(atom1)).toBe(2)
    })

    test("captured operations cannot mutate a committing transaction", () => {
        const store1 = store()
        const atom1 = atom(1)
        let capturedTxn: any
        store1.sub(atom1, () => capturedTxn.set(atom1, 3))

        expect(() =>
            store1.txn(txn => {
                capturedTxn = txn
                txn.set(atom1, 2)
            }),
        ).toThrow("Cannot write to transaction while it is committing")
        expect(store1.get(atom1)).toBe(2)
        expect(() => capturedTxn.set(atom1, 4)).toThrow(
            "Cannot write to transaction while it is closed",
        )
    })

    test("txn simple get", () => {
        const store1 = store()
        const atom1 = atom(1)
        transaction(({ get }) => {
            expect(get(atom1)).toBe(1)
        }, getStoreData(store1))
    })
    test("txn get after set", () => {
        const store1 = store()
        const atom1 = atom(1)
        transaction(({ set, get }) => {
            set(atom1, 2)
            expect(get(atom1)).toBe(2)
        }, getStoreData(store1))
    })

    test("txn reset", () => {
        const store1 = store()
        const atom1 = atom(1)
        transaction(({ get, set, reset }) => {
            set(atom1, 2)
            expect(get(atom1)).toBe(2)
            reset(atom1)
            expect(get(atom1)).toBe(1)
        }, getStoreData(store1))
        expect(store1.get(atom1)).toBe(1)
    })

    test("staged selector reads stay isolated until the callback returns", () => {
        const store1 = store()

        const atom1 = atom(10)
        const atom2 = atom(20)
        const atom3 = atom(30)
        const sum = selector(get => get(atom1) + get(atom2) + get(atom3))
        const product = selector(get => get(atom1) * get(atom2) * get(atom3))

        expect(store1.get(sum)).toBe(60)
        expect(store1.get(product)).toBe(6_000)

        transaction(({ set, get }) => {
            expect(get(sum)).toBe(60)
            expect(get(product)).toBe(6000)
            set(atom1, 100)
            set(atom2, 200)
            set(atom3, 300)
            expect(get(sum)).toBe(600)
            expect(get(product)).toBe(6_000_000)
            expect(store1.get(sum)).toBe(60)
            expect(store1.get(product)).toBe(6_000)
        }, getStoreData(store1))

        expect(store1.get(sum)).toBe(600)
        expect(store1.get(product)).toBe(6_000_000)
    })

    test("transaction selectors have access to all staged state", () => {
        const store1 = store()
        const ids = atom(["1"])
        const userFamily = atomFamily(null)
        store1.set(userFamily("1"), { id: "1", name: "Foo" })
        const userNames = selector(get =>
            get(ids).map(id => get(userFamily(id)).name),
        )

        expect(store1.get(userNames)).toStrictEqual(["Foo"])

        store1.txn(({ set, get }) => {
            set(ids, curr => [...curr, "2"])
            set(userFamily("2"), { id: "2", name: "Bar" })
            expect(get(userNames)).toStrictEqual(["Foo", "Bar"])
            expect(store1.get(userNames)).toStrictEqual(["Foo"])
        })
        expect(store1.get(userNames)).toStrictEqual(["Foo", "Bar"])
    })

    test("transaction works with selectors", () => {
        const store1 = store()
        const atom1 = atom(1, { name: "txn-sel-atom1" })
        const selectorCb1 = mock(get => get(atom1) + 1)
        const selectorCb2 = mock(get => get(atom1) + 2)
        const selector1 = selector(selectorCb1, "selector1")
        const selector2 = selector(selectorCb2, "selector2")
        // const selector2 = selector((get) => get(selector1) + 1, "selector2")

        store1.txn(({ set, get }) => {
            expect(get(selector1)).toBe(2)
            expect(get(selector2)).toBe(3)
            set(atom1, 2)
            expect(selectorCb1).toHaveBeenCalledTimes(1)
            expect(selectorCb2).toHaveBeenCalledTimes(1)
            expect(get(selector1)).toBe(3)
            expect(selectorCb1).toHaveBeenCalledTimes(2)
            set(atom1, 3)
            expect(get(selector1)).toBe(4)
            expect(selectorCb1).toHaveBeenCalledTimes(3)
            expect(get(selector1)).toBe(4)
            expect(selectorCb1).toHaveBeenCalledTimes(3)
            set(atom1, 4)
            expect(get(selector1)).toBe(5)
            expect(get(selector2)).toBe(6)
            expect(selectorCb1).toHaveBeenCalledTimes(4)
            expect(selectorCb2).toHaveBeenCalledTimes(2)
        })
    })

    test("transaction selectors use the normal options, validation, and error boundaries", () => {
        const store1 = store()
        let receivedOptions: any
        const optionsSelector = selector((_get, options) => {
            receivedOptions = options
            return 1
        })
        const schemaFailure = new Error("not a number")
        const invalidSelector = selector(() => "wrong", {
            name: "invalid transaction selector",
            schemaValidation: true,
            schema: {
                parse() {
                    throw schemaFailure
                },
            },
        })
        const evaluationFailure = new Error("selector exploded")
        const throwingSelector = selector(
            () => {
                throw evaluationFailure
            },
            { name: "throwing transaction selector" },
        )

        store1.txn(({ get }) => {
            expect(get(optionsSelector)).toBe(1)
            expect(receivedOptions.signal).toBeInstanceOf(AbortSignal)
            expect(receivedOptions.storeId).toBe(store1.id)

            try {
                get(invalidSelector)
                throw new Error("expected selector validation to fail")
            } catch (error) {
                expect(error).toBeInstanceOf(SchemaValidationError)
                expect((error as SchemaValidationError).cause).toBe(
                    schemaFailure,
                )
            }

            try {
                get(throwingSelector)
                throw new Error("expected selector evaluation to fail")
            } catch (error) {
                expect(error).toBeInstanceOf(SelectorEvaluationError)
                expect((error as SelectorEvaluationError).cause).toBe(
                    evaluationFailure,
                )
            }
        })
    })

    test("transaction selector cycles use the normal cycle error", () => {
        const store1 = store()
        let circular: ReturnType<typeof selector>
        circular = selector(get => get(circular), {
            name: "transaction cycle",
        })

        expect(() =>
            store1.txn(({ get }) => {
                get(circular)
            }),
        ).toThrow(SelectorCircularDependencyError)
    })

    test("aborted transaction selector reads do not mutate committed selector state", async () => {
        const store1 = store()
        const useLeft = atom(false)
        const left = atom("left")
        const right = atom("right")
        const selected = selector(get =>
            get(useLeft) ? get(left) : get(right),
        )
        const asyncSelected = selector(get => Promise.resolve(get(selected)))

        expect(store1.get(selected)).toBe("right")
        const committedDependencies = new Set(
            getStoreData(store1).stateDependencies.get(selected),
        )

        expect(() =>
            store1.txn(txn => {
                txn.set(useLeft, true)
                expect(txn.get(selected)).toBe("left")
                txn.get(asyncSelected)
                throw new Error("abort")
            }),
        ).toThrow("abort")

        await Promise.resolve()
        expect(store1.get(useLeft)).toBe(false)
        expect(store1.get(selected)).toBe("right")
        expect(getStoreData(store1).stateDependencies.get(selected)).toEqual(
            committedDependencies,
        )
        expect(getStoreData(store1).stateDependencies.has(asyncSelected)).toBe(
            false,
        )
        expect(getStoreData(store1).values.has(asyncSelected)).toBe(false)
    })

    test("transaction selector reads do not validate a stale committed cold cache", () => {
        const store1 = store()
        const count = atom(1)
        const doubled = selector(get => get(count) * 2)

        expect(store1.get(doubled)).toBe(2)
        store1.set(count, 2)

        store1.txn(txn => {
            expect(txn.get(doubled)).toBe(4)
        })

        expect(store1.get(doubled)).toBe(4)
    })

    test("transaction evaluator tracks async dependencies and aborts superseded work locally", async () => {
        const store1 = store()
        const count = atom(1)
        let release!: () => void
        const gate = new Promise<void>(resolve => {
            release = resolve
        })
        const signals: AbortSignal[] = []
        const asyncCount = selector((get, { signal }) => {
            signals.push(signal)
            return gate.then(() => get(count))
        })
        let transactionRef: any
        let latest!: Promise<number>

        store1.txn(txn => {
            transactionRef = txn
            txn.get(asyncCount)
            txn.set(count, 2)
            latest = txn.get(asyncCount) as Promise<number>
        })

        expect(signals).toHaveLength(2)
        expect(signals[0].aborted).toBe(true)
        expect(signals[1].aborted).toBe(false)

        release()
        expect(await latest).toBe(2)
        expect(
            transactionRef._draft.selectorRuntime.stateDependencies
                .get(asyncCount)
                .has(count),
        ).toBe(true)
        expect(getStoreData(store1).stateDependencies.has(asyncCount)).toBe(
            false,
        )
        expect(getStoreData(store1).values.has(asyncCount)).toBe(false)
    })

    test("transaction selector continuations read current committed state", async () => {
        const store1 = store()
        const count = atom(1)
        let release!: () => void
        const gate = new Promise<void>(resolve => {
            release = resolve
        })
        const asyncCount = selector(get => gate.then(() => get(count)))
        let pending!: Promise<number>

        store1.txn(txn => {
            txn.set(count, 2)
            pending = txn.get(asyncCount) as Promise<number>
        })
        store1.set(count, 3)
        release()

        expect(await pending).toBe(3)
    })

    test("every transaction write invalidates cached selector reads", () => {
        const store1 = store()
        const count = atom(1)
        const users = atomFamily<string, [number]>()
        const firstUser = users(1)
        const secondUser = users(2)
        const doubled = selector(get => get(count) * 2)
        const userSummary = selector(get =>
            get(users)
                .map(member => get(member))
                .join(","),
        )

        store1.set(count, 3)
        store1.set(firstUser, "one")

        store1.txn(txn => {
            expect(txn.get(doubled)).toBe(6)
            txn.reset(count)
            expect(txn.get(doubled)).toBe(2)

            txn.set(count, 4)
            expect(txn.get(doubled)).toBe(8)
            txn.unset(count)
            expect(txn.get(doubled)).toBe(2)

            expect(txn.get(userSummary)).toBe("one")
            txn.batchSetFamilyAtoms(users, [[secondUser, "two"]])
            expect(txn.get(userSummary)).toBe("one,two")
            txn.del(firstUser)
            expect(txn.get(userSummary)).toBe("two")
        })
    })

    test("thenable transaction callbacks throw synchronously and never commit", async () => {
        const store1 = store()
        const count = atom(0)

        expect(() =>
            store1.txn(txn => {
                txn.set(count, 1)
                return { then() {} }
            }),
        ).toThrow("Transaction callbacks must be synchronous")
        expect(store1.get(count)).toBe(0)

        expect(() =>
            store1.txn(txn => {
                txn.set(count, 2)
                return Promise.resolve()
            }),
        ).toThrow("Transaction callbacks must be synchronous")
        expect(store1.get(count)).toBe(0)

        expect(() =>
            store1.txn(async txn => {
                txn.set(count, 3)
                await Promise.resolve()
                txn.set(count, 4)
            }),
        ).toThrow("Transaction callbacks must be synchronous")

        await Promise.resolve()
        expect(store1.get(count)).toBe(0)
    })

    test("uninitialized selector reads txn state", () => {
        const store1 = store()
        const atom1 = atom(10, { name: "txn-uninit-atom1" })
        const atom2 = atom(20, { name: "txn-uninit-atom2" })
        const selector1 = selector(get => get(atom1) + 1)
        const selector2 = selector(get => get(atom2) + 1)
        const selector3 = selector(get => get(selector1) + get(selector2))

        store1.txn(({ set, get }) => {
            expect(get(selector3)).toBe(32)
            set(atom1, 11)
            set(atom2, 21)
            expect(get(selector1)).toBe(12)
            expect(get(selector2)).toBe(22)
        })
    })

    test.todo("transaction fails when trying to access dirty selector", () => {
        const store1 = store()
        const atom1 = atom(1, { name: "txn-dirty-atom1" })
        const selector1 = selector(get => get(atom1) + 1, { name: "selector1" })
        // const selector2 = selector((get) => get(selector1) + 1, "selector2")

        store1.txn(({ set, get }) => {
            expect(get(selector1)).toBe(2)
            set(atom1, 2)
            expect(() => get(selector1)).toThrow()
        })
    })

    test("set in transaction", () => {
        const store1 = store()
        const counter = atom(0)
        store1.txn(({ set, get }) => {
            const res1 = get(counter)
            expect(res1).toBe(0)
            const res2 = set(counter, 1)
            expect(res2).toBe(1)
            const res3 = set(counter, curr => curr + 1)
            expect(res3).toBe(2)
        })
    })

    test("value-only family writes preserve membership order and identity", () => {
        const store1 = store()
        const family = atomFamily<number, [string]>(0)
        const a = family("a")
        const b = family("b")
        const c = family("c")

        store1.txn(({ set }) => {
            set(a, 1)
            set(b, 2)
            set(c, 3)
        })
        const members = store1.get(family)

        // Updating values in a different order must not turn writes into
        // membership churn. In particular, the cached family list remains the
        // same object and members retain their original insertion order.
        store1.txn(({ set }) => {
            set(c, 30)
            set(a, 10)
            set(b, 20)
        })

        expect(store1.get(family)).toBe(members)
        expect(store1.get(family)).toStrictEqual([a, b, c])
    })

    test("family membership renders lazily on transaction read", () => {
        const store1 = store()
        const family = atomFamily<number, [string]>(0)
        const a = family("a")
        const b = family("b")

        store1.txn(txn => {
            txn.set(a, 1)
            const familyValue = (
                txn as unknown as {
                    _draft: {
                        values: Map<
                            unknown,
                            { __index: { renderedArray: unknown } }
                        >
                    }
                }
            )._draft.values.get(family)!

            // Staging membership only dirties the index. Rendering here would
            // copy + sort after every set and make K staged members superlinear.
            expect(familyValue.__index.renderedArray).toBeNull()
            txn.set(b, 2)
            expect(familyValue.__index.renderedArray).toBeNull()

            const rendered = txn.get(family)
            expect(rendered).toStrictEqual([a, b])
            expect(familyValue.__index.renderedArray).toBe(rendered)
        })

        expect(store1.get(family)).toStrictEqual([a, b])
    })

    test("delete in transaction", () => {
        const rootStore = store()
        const user = atomFamily<{ id: number; name: string }, [number]>()
        const user1atom = user(1)
        const user2atom = user(2)
        const user3atom = user(3)
        const user4atom = user(4)
        rootStore.set(user1atom, { id: 1, name: "Foo" })
        rootStore.set(user2atom, { id: 2, name: "Bar" })
        expect(getStoreData(rootStore).values.get(user)).toStrictEqual([
            user1atom,
            user2atom,
        ])
        expect(rootStore.get(user)).toStrictEqual([user1atom, user2atom])
        rootStore.txn(({ set, get, del }) => {
            expect(get(user)).toStrictEqual([user1atom, user2atom])
            set(user3atom, { id: 3, name: "Baz" })
            expect(get(user)).toStrictEqual([user1atom, user2atom, user3atom])
            set(user4atom, { id: 4, name: "Fiz" })
            expect(get(user)).toStrictEqual([
                user1atom,
                user2atom,
                user3atom,
                user4atom,
            ])
            del(user1atom)
            expect(get(user)).toStrictEqual([user2atom, user3atom, user4atom])
            del(user3atom)
            expect(get(user)).toStrictEqual([user2atom, user4atom])
        })
        expect(getStoreData(rootStore).values.get(user)).toStrictEqual([
            user2atom,
            user4atom,
        ])
        expect(getStoreData(rootStore).values.has(user1atom)).toBe(false)
        expect(getStoreData(rootStore).values.has(user2atom)).toBe(true)
        expect(getStoreData(rootStore).values.has(user3atom)).toBe(false)
        expect(getStoreData(rootStore).values.has(user4atom)).toBe(true)
    })

    test("transaction in scope", () => {
        const nameAtom = atom("default")
        const store1 = store()
        const fooScope = store1.scope("Foo")
        const barScope = store1.scope("Bar")
        const barNestedScope = barScope.scope("Bar Nested")

        store1.txn(txn => {
            txn.set(nameAtom, "Set in Root")
            const scopedRes = txn.scope("Foo", scopedTxn => {
                scopedTxn.set(nameAtom, "Set in Foo")
                return scopedTxn.get(nameAtom)
            })
            expect(scopedRes).toBe("Set in Foo")
            txn.scope("Bar", scopedTxn => {
                scopedTxn.set(nameAtom, "Set in Bar")
                scopedTxn.scope("Bar Nested", nestedScopedTxn => {
                    nestedScopedTxn.set(nameAtom, "Set in Bar Nested")
                })
            })
        })
        expect(store1.get(nameAtom)).toBe("Set in Root")
        expect(fooScope.get(nameAtom)).toBe("Set in Foo")
        expect(barScope.get(nameAtom)).toBe("Set in Bar")
        expect(barNestedScope.get(nameAtom)).toBe("Set in Bar Nested")
        // Committed nested-scope transaction leaves the whole tree consistent.
        assertStoreInvariants(store1)

        expect(() => {
            store1.txn(({ set, scope }) => {
                set(nameAtom, "fails")
                scope("Foo", scopedTxn => {
                    scopedTxn.set(nameAtom, "fails")
                })
                throw new Error("Fail")
            })
        }).toThrow("Fail")

        expect(store1.get(nameAtom)).toBe("Set in Root")
        expect(fooScope.get(nameAtom)).toBe("Set in Foo")
        expect(barScope.get(nameAtom)).toBe("Set in Bar")

        expect(() => {
            store1.txn(({ scope }) => {
                scope("Missing", txn => {
                    txn.set(nameAtom, "fails")
                })
            })
        }).toThrow("Scope 'Missing' not found. Registered scopes: Foo, Bar")
        // Rolled-back transactions must not corrupt the tree either.
        assertStoreInvariants(store1)
    })

    test("parentScope atom", () => {
        const nameAtom = atom("default")
        const rootStore = store()
        const childScope1 = rootStore.scope("Child1")
        const childScope2 = rootStore.scope("Child2")

        childScope1.txn(txn => {
            txn.parentScope(parentTxn => {
                parentTxn.set(nameAtom, "Set in Parent")
                parentTxn.scope("Child2", child2txn => {
                    expect(child2txn.get(nameAtom)).toBe("Set in Parent")
                })
            })
            expect(txn.get(nameAtom)).toBe("Set in Parent")
        })
    })

    test("parentScope family", () => {
        const userAtomFamily = atomFamily()
        const rootStore = store()
        const childScope1 = rootStore.scope("Child1")
        const childScope2 = rootStore.scope("Child2")
        const user1atom = userAtomFamily(1)
        const user2atom = userAtomFamily(2)
        const user3atom = userAtomFamily(3)

        childScope1.txn(txn => {
            // expect(t)
            txn.set(user1atom, "User 1")
            txn.parentScope(parentTxn => {
                parentTxn.set(user2atom, "User2")
            })
            txn.set(user3atom, "User 3")
            expect(txn.get(userAtomFamily)).toStrictEqual([
                user1atom,
                user2atom,
                user3atom,
            ])
        })
    })

    test("family in scopes", () => {
        const userAtomFamily = atomFamily()
        const rootStore = store()
        const childStore1 = rootStore.scope("Child1")

        const user1atom = userAtomFamily(1)
        const user2atom = userAtomFamily(2)
        const user3atom = userAtomFamily(3)
        const user4atom = userAtomFamily(4)
        const user5atom = userAtomFamily(5)

        rootStore.set(user1atom, "User 1 set before txn")
        childStore1.set(user2atom, "User 2 set before txn")

        expect(rootStore.get(userAtomFamily)).toStrictEqual([user1atom])
        expect(childStore1.get(userAtomFamily)).toStrictEqual([
            user1atom,
            user2atom,
        ])

        rootStore.txn(txn => {
            expect(txn.get(userAtomFamily)).toStrictEqual([user1atom])
            txn.scope("Child1", childTxn => {
                expect(childTxn.get(userAtomFamily)).toStrictEqual([
                    user1atom,
                    user2atom,
                ])
            })
            txn.set(user3atom, "User 3 set in root txn")
            expect(txn.get(userAtomFamily)).toStrictEqual([
                user1atom,
                user3atom,
            ])
            txn.scope("Child1", childTxn => {
                const entry = childTxn.get(userAtomFamily)
                expect(entry.__index.parentIndex).toBeDefined()
                expect(childTxn.get(userAtomFamily)).toHaveLength(3)
                expect(childTxn.get(userAtomFamily)).toStrictEqual([
                    user1atom,
                    user2atom,
                    user3atom,
                ])
                childTxn.set(user4atom, "User 4 set in child txn")
            })
            txn.set(user2atom, "User 2 set in root txn")
            expect(txn.get(userAtomFamily)).toStrictEqual([
                user1atom,
                user3atom,
                user2atom,
            ])
        })

        expect(rootStore.get(user1atom)).toBe("User 1 set before txn")
        expect(rootStore.get(user2atom)).toBe("User 2 set in root txn")
        expect(rootStore.get(user3atom)).toBe("User 3 set in root txn")
        expect(rootStore.get(user4atom)).toBeInstanceOf(Promise)

        expect(childStore1.get(user1atom)).toBe("User 1 set before txn")
        expect(childStore1.get(user2atom)).toBe("User 2 set before txn")
        expect(childStore1.get(user3atom)).toBe("User 3 set in root txn")
        expect(childStore1.get(user4atom)).toBe("User 4 set in child txn")
    })

    test("atom family add scope to txn after family atom change", () => {
        const userAtomFamily = atomFamily()
        const rootStore = store()
        const childStore = rootStore.scope("Child1")

        const user1atom = userAtomFamily(1)
        const user2atom = userAtomFamily(2)

        rootStore.txn(txn => {
            txn.set(user1atom, "User 1 set in root txn")
            txn.scope("Child1", childTxn => {
                childTxn.set(user2atom, "User 2 set in child txn")
                expect(childTxn.get(userAtomFamily)).toHaveLength(2)
                expect(childTxn.get(userAtomFamily)).toStrictEqual([
                    user1atom,
                    user2atom,
                ])
            })
        })

        expect(rootStore.get(userAtomFamily)).toStrictEqual([user1atom])
        expect(childStore.get(userAtomFamily)).toStrictEqual([
            user1atom,
            user2atom,
        ])
    })

    test("atomFamily index works when we start txn in scoped store and then access parent txn", () => {
        const userAtomFamily = atomFamily()
        const rootStore = store()
        const childStore = rootStore.scope("Child1")

        const user1atom = userAtomFamily(1)
        const user2atom = userAtomFamily(2)

        childStore.txn(txn => {
            txn.set(user1atom, "User 1 atom set in child txn")
            txn.parentScope(parentTxn => {
                expect(parentTxn.get(userAtomFamily)).toHaveLength(0)
                parentTxn.set(user2atom, "User 2 atom set in parentTxn")
                expect(parentTxn.get(userAtomFamily)).toHaveLength(1)
                expect(txn.get(userAtomFamily)).toHaveLength(2)
            })
            expect(txn.get(userAtomFamily)).toStrictEqual([
                user1atom,
                user2atom,
            ])
        })
        expect(rootStore.get(userAtomFamily)).toStrictEqual([user2atom])
        // Commit-time propagation must not refresh either member's timestamp:
        // the child write happened first and keeps that insertion position.
        expect(childStore.get(userAtomFamily)).toStrictEqual([
            user1atom,
            user2atom,
        ])
    })

    test("parentScope crash", () => {
        const nameAtom = atom("default")
        const store1 = store()
        const fooScope = store1.scope("Foo")
        const barScope = store1.scope("Bar")

        try {
            fooScope.txn(txn => {
                txn.parentScope(parentTxn => {
                    parentTxn.set(nameAtom, "Set in Parent")
                })
                expect(txn.get(nameAtom)).toBe("Set in Parent")
                txn.set(nameAtom, "Set in Foo")
                throw new Error("Crash")
            })
        } catch (e) {}
        expect(store1.get(nameAtom)).toBe("default")
        expect(fooScope.get(nameAtom)).toBe("default")
        expect(barScope.get(nameAtom)).toBe("default")
    })

    test("family key set in transactions and transaction scopes", () => {
        const userAtom = atomFamily()
        const store1 = store()
        store1.scope("Foo").scope("Bar")
        store1.txn(txn => {
            txn.set(userAtom(1), "User 1")
            expect(txn.get(userAtom).map(a => a.familyArgs)).toStrictEqual([
                [1],
            ])
            txn.set(userAtom(2), "User 2")
            expect(txn.get(userAtom).map(a => a.familyArgs)).toStrictEqual([
                [1],
                [2],
            ])
            txn.scope("Foo", fooTxn => {
                expect(
                    fooTxn.get(userAtom).map(a => a.familyArgs),
                ).toStrictEqual([[1], [2]])
                fooTxn.set(userAtom(3), "User 3")
                expect(
                    fooTxn.get(userAtom).map(a => a.familyArgs),
                ).toStrictEqual([[1], [2], [3]])
                fooTxn.scope("Bar", barTxn => {
                    expect(
                        barTxn.get(userAtom).map(a => a.familyArgs),
                    ).toStrictEqual([[1], [2], [3]])
                    barTxn.set(userAtom(4), "User 4")
                    expect(
                        barTxn.get(userAtom).map(a => a.familyArgs),
                    ).toStrictEqual([[1], [2], [3], [4]])
                })
                expect(
                    fooTxn.get(userAtom).map(a => a.familyArgs),
                ).toStrictEqual([[1], [2], [3]])
            })
            expect(txn.get(userAtom).map(a => a.familyArgs)).toStrictEqual([
                [1],
                [2],
            ])
        })
    })

    test("scope re-read test", () => {
        const documentAtom = atomFamily()
        const store1 = store()
        const doc1 = documentAtom("1")
        store1.set(doc1, [1])
        store1.scope("foo").scope("bar")
        store1.txn(txn => {
            expect(txn.get(doc1)).toStrictEqual([1])
            txn.set(doc1, [1, 2])
            expect(txn.get(doc1)).toStrictEqual([1, 2])
            txn.scope("foo", fooTxn => {
                expect(fooTxn.get(doc1)).toStrictEqual([1, 2])
                fooTxn.set(doc1, [1, 2, 3])
                fooTxn.scope("bar", barTxn => {
                    expect(barTxn.get(doc1)).toStrictEqual([1, 2, 3])
                    barTxn.set(doc1, [1, 2, 3, 4])
                    expect(barTxn.get(doc1)).toStrictEqual([1, 2, 3, 4])
                })
            })
        })

        expect(getStoreData(store1).values.get(doc1)).toStrictEqual([1, 2])
        expect(
            getStoreData(store1).scopes.get("foo")!.values.get(doc1),
        ).toStrictEqual([1, 2, 3])
        expect(
            getStoreData(store1)
                .scopes.get("foo")!
                .scopes.get("bar")!
                .values.get(doc1),
        ).toStrictEqual([1, 2, 3, 4])

        store1.txn(txn => {
            expect(txn.get(doc1)).toStrictEqual([1, 2])
            txn.scope("foo", fooTxn => {
                expect(fooTxn.get(doc1)).toStrictEqual([1, 2, 3])
                fooTxn.scope("bar", barTxn => {
                    expect(barTxn.get(doc1)).toStrictEqual([1, 2, 3, 4])
                })
            })
        })
    })

    test("deep freeze", () => {
        const defaultStore = store()
        const postFamily = atomFamily<string, { data: { tags: string[] } }>()

        defaultStore.txn(txn => {
            const post = txn.set(postFamily("1"), {
                data: {
                    tags: ["tag1"],
                },
            })
            expect(() => (post.data.tags = [])).toThrowError(
                "Attempted to assign to readonly property.",
            )
        })
    })

    test("mutable atom is not frozen in transaction", () => {
        const defaultStore = store()
        const mutableAtom = atom<{ tags: string[] } | undefined>(undefined, {
            mutable: true,
        })

        defaultStore.txn(txn => {
            const value = txn.set(mutableAtom, { tags: ["tag1"] })
            // mutable atoms should NOT be frozen, even inside a transaction
            expect(() => (value.tags = ["tag2"])).not.toThrowError()
        })

        // Verify the value is still mutable after commit
        const committed = defaultStore.get(mutableAtom)!
        expect(() => (committed.tags = ["tag3"])).not.toThrowError()
    })

    test("delete from transaction", () => {
        const defaultStore = store()
        const post = atomFamily<{ title: string; tags: string[] }, [string]>(
            null,
            {
                name: "txn-del-posts",
            },
        )
        const indexCallback = mock((doc, term) => {
            return doc.tags.includes(term)
        })
        const postsByTag = index(post, indexCallback, { name: "postsByTag" })
        expect(indexCallback).toHaveBeenCalledTimes(0)
        defaultStore.txn(txn => {
            txn.set(post("1"), {
                title: "Initial",
                tags: ["foo"],
            })
        })
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(1)
        defaultStore.set(post("1"), {
            title: "Initial",
            tags: ["foo"],
        })

        expect(indexCallback).toHaveBeenCalledTimes(1)
        defaultStore.txn(txn => {
            txn.del(post("1"))
        })
        expect(defaultStore.get(postsByTag("foo"))).toHaveLength(0)
    })

    test("parent and child writes both roll back when the callback throws", () => {
        const nameAtom = atom("default")
        const rootStore = store()
        const nestedStore = rootStore.scope("Nested")

        expect(() => {
            nestedStore.txn(txn => {
                txn.set(nameAtom, "Set in Foo before parentScope")
                txn.parentScope(parentTxn => {
                    parentTxn.set(nameAtom, "Set in Parent")
                })
                throw new Error("Crash")
            })
        }).toThrow("Crash")
        expect(nestedStore.get(nameAtom)).toBe("default")
        expect(rootStore.get(nameAtom)).toBe("default")
    })

    test("delete family atom does not corrupt index when subscription re-reads atom", () => {
        const rootStore = store()
        const mutationAtom = atomFamily<any, [string]>(null)
        const m1 = mutationAtom("1")
        const m2 = mutationAtom("2")
        const m3 = mutationAtom("3")

        rootStore.set(m1, { id: "1", changeSetRef: "cs1" })
        rootStore.set(m2, { id: "2", changeSetRef: "cs1" })
        rootStore.set(m3, { id: "3", changeSetRef: "cs2" })

        // Subscribe to m2 and re-read it on change (simulates mutationSync)
        rootStore.sub(m2, () => {
            rootStore.get(m2)
        })

        rootStore.txn(txn => {
            txn.del(m1)
            txn.del(m2)
        })

        expect(rootStore.get(mutationAtom)).toStrictEqual([m3])
        const atoms = rootStore.get(mutationAtom)
        atoms.forEach(a => {
            expect(rootStore.get(a)).not.toBeNull()
        })
    })

    test("If a scope sets a value to the same as the parent scope we should set it in the scope, but not trigger updates", () => {
        const nameAtom = atom("initial")
        const rootStore = store()
        const nestedStore = rootStore.scope("Nested")

        rootStore.set(nameAtom, "Foo")
        rootStore.txn(txn => {
            txn.scope("Nested", scopedTxn => {
                scopedTxn.set(nameAtom, "Foo")
            })
        })
        expect(rootStore.get(nameAtom)).toBe("Foo")
        expect(nestedStore.get(nameAtom)).toBe("Foo")

        rootStore.set(nameAtom, "Bar")
        expect(rootStore.get(nameAtom)).toBe("Bar")
        expect(nestedStore.get(nameAtom)).toBe("Foo")
    })

    // Regression guard: plain `store.set` on a no-default atom resolves the
    // pending-default suspense promise (see lib/setAtom.test.ts). The
    // transaction write path goes through writeAtoms, which previously wrote
    // the value but never resolved the placeholder — so a reader suspended on
    // it hung forever even though the value was set. writeAtoms now calls
    // resolvePendingDefault, matching `set`.
    test("txn set resolves pending-default suspense promise", async () => {
        const store1 = store()
        const emptyAtom = atom<string>()

        // Reading the empty atom gives us the suspense placeholder promise.
        const suspense = store1.get(emptyAtom) as Promise<string>

        store1.txn(txn => {
            txn.set(emptyAtom, "hello")
        })

        // Value is written correctly...
        expect(store1.get(emptyAtom)).toBe("hello")

        // ...but the suspense promise must also resolve, exactly as it does for
        // a plain `store.set`. Bounded race so the gap fails fast instead of
        // hanging until the test timeout.
        const settled = await settleWithin(suspense)
        expect(settled).toEqual({ kind: "resolved", value: "hello" })
    })

    // The placeholder is registered in root (the scoped read falls through),
    // so resolving it from a scoped txn write must walk up the scope chain —
    // mirrors the supported `set` case in lib/setAtom.test.ts.
    test("scoped txn set resolves suspense promise inited in root", async () => {
        const root = store()
        const scoped = root.scope("s1")
        const emptyAtom = atom<string>()

        const suspense = scoped.get(emptyAtom) as Promise<string>

        scoped.txn(txn => {
            txn.set(emptyAtom, "hello")
        })

        const settled = await settleWithin(suspense)
        expect(settled).toEqual({ kind: "resolved", value: "hello" })
    })

    // Storing an in-flight promise must NOT resolve the placeholder by adoption
    // before that write settles — that would consume it and strand it if the
    // user promise never resolves. The placeholder survives until a settled
    // value lands. Mirrors lib/setAtom.test.ts "sync set after in-flight async
    // set on empty atom resolves suspense promise" for the transaction path.
    test("txn set: in-flight promise does not consume the suspense placeholder", async () => {
        const store1 = store()
        const emptyAtom = atom<string>()

        const suspense = store1.get(emptyAtom) as Promise<string>

        // Store a never-resolving promise via txn — placeholder must survive.
        const pending = new Promise<string>(() => {})
        store1.txn(txn => {
            txn.set(emptyAtom, pending)
        })

        // A later settled value lands and resolves the still-live placeholder.
        store1.txn(txn => {
            txn.set(emptyAtom, "done")
        })

        const settled = await settleWithin(suspense)
        expect(settled).toEqual({ kind: "resolved", value: "done" })
        expect(store1.get(emptyAtom)).toBe("done")
    })
})

describe("single-store cleanup commits through the commit engine", () => {
    test("a cleanup transaction with a global write runs the user onSet before any subscriber and reports onChange last", () => {
        const store1 = store()
        const store2 = store()
        const events: string[] = []
        const globalCounter = atom(0, {
            global: true,
            onSet: () => events.push("onSet"),
        })
        const localAtom = atom(1)
        store1.set(localAtom, 2)
        store2.get(globalCounter)
        store1.sub(globalCounter, () => events.push("sub:global@store1"))
        store2.sub(globalCounter, () => events.push("sub:global@store2"))
        store1.sub(localAtom, () => events.push("sub:local"))
        store1.onChange(() => events.push("onChange"))

        store1.txn(txn => {
            txn.set(globalCounter, 5)
            txn.unset(localAtom)
        })

        // Hooks fire after every local and peer write, before any delivery;
        // the origin store's onChange flushes after every subscriber. The
        // relative order of independent subscribers is incidental (a bag).
        expect(events[0]).toBe("onSet")
        expect(events.at(-1)).toBe("onChange")
        expect(events.slice(1, -1).sort()).toEqual([
            "sub:global@store1",
            "sub:global@store2",
            "sub:local",
        ])
        expect(store2.get(globalCounter)).toBe(5)
        expect(store1.get(localAtom)).toBe(1)
    })

    test("a throwing user hook in a global cleanup transaction surfaces without starving peer or unset-dependent notifications", () => {
        const store1 = store()
        const store2 = store()
        const seen: string[] = []
        const globalCounter = atom(0, {
            global: true,
            onSet: () => {
                throw new Error("hook boom")
            },
        })
        const localAtom = atom(1)
        const localTenfold = selector(get => get(localAtom) * 10)
        store1.set(localAtom, 2)
        store2.get(globalCounter)
        store2.sub(globalCounter, () => seen.push("sub:global@store2"))
        store1.sub(localTenfold, () => seen.push("sub:selector"))

        expect(() =>
            store1.txn(txn => {
                txn.set(globalCounter, 7)
                txn.unset(localAtom)
            }),
        ).toThrow("hook boom")

        expect(store2.get(globalCounter)).toBe(7)
        expect(store1.get(localAtom)).toBe(1)
        expect(store1.get(localTenfold)).toBe(10)
        expect(seen.sort()).toEqual(["sub:global@store2", "sub:selector"])
    })

    test("a global write combined with a family delete (no unsets) commits atomically through the fan-out arm", () => {
        const store1 = store()
        const store2 = store()
        const family = atomFamily<number, [string]>(0)
        const globalCounter = atom(0, { global: true })
        const member = family("a")
        const seen: string[] = []
        store1.set(member, 1)
        store2.get(globalCounter)
        store2.sub(globalCounter, () => seen.push("sub:global@store2"))
        store1.sub(family, () => seen.push("sub:family"))

        store1.txn(txn => {
            txn.set(globalCounter, 3)
            txn.del(member)
        })

        expect(store2.get(globalCounter)).toBe(3)
        expect(store1.get(family)).toEqual([])
        expect(seen.sort()).toEqual(["sub:family", "sub:global@store2"])
    })

    test("a transaction started by a subscriber during a hook-free commit falls back safely", () => {
        // The reusable static hook-free plan must detect the nested commit
        // and fall back to a fresh plan without cross-contaminating state.
        const store1 = store()
        const outer = atom(0)
        const inner = atom(0)
        const commitEnds = mock(() => {})
        let cascaded = false
        store1.onCommitEnd(commitEnds)
        store1.sub(outer, () => {
            if (!cascaded) {
                cascaded = true
                store1.txn(txn => txn.set(inner, 42))
            }
        })

        store1.txn(txn => txn.set(outer, 1))

        expect(store1.get(outer)).toBe(1)
        expect(store1.get(inner)).toBe(42)
        // The nested boundary coalesces into the outer commit.
        expect(commitEnds).toHaveBeenCalledTimes(1)
    })

    test("schema validators observe the same unfrozen representation across direct, staged, and family-batch writes", () => {
        // Guards the shared normalizeStagedValue contract: validation runs
        // BEFORE the staging-time dev-freeze, exactly as setAtom validates the
        // raw value before setValueInData freezes at write.
        const observedFrozen: boolean[] = []
        const recordingSchema = {
            parse(value: unknown) {
                if ((value as { probe?: boolean })?.probe) {
                    observedFrozen.push(Object.isFrozen(value))
                }
                return value
            },
        }
        const store1 = store()
        const directAtom = atom(
            { probe: false, n: 0 },
            { schemaValidation: true, schema: recordingSchema as any },
        )
        const stagedAtom = atom(
            { probe: false, n: 0 },
            { schemaValidation: true, schema: recordingSchema as any },
        )
        const family = atomFamily<{ probe: boolean; n: number }, [string]>(
            { probe: false, n: 0 },
            { schemaValidation: true, schema: recordingSchema as any },
        )

        store1.set(directAtom, { probe: true, n: 1 })
        store1.txn(txn => txn.set(stagedAtom, { probe: true, n: 2 }))
        store1.txn(txn =>
            txn.batchSetFamilyAtoms(family, [
                [family("a"), { probe: true, n: 3 }],
            ]),
        )

        expect(observedFrozen).toEqual([false, false, false])
        expect(Object.isFrozen(store1.get(directAtom))).toBe(true)
        expect(Object.isFrozen(store1.get(stagedAtom))).toBe(true)
        expect(Object.isFrozen(store1.get(family("a")))).toBe(true)
        expect(store1.get(directAtom)).toEqual({ probe: true, n: 1 })
        expect(store1.get(stagedAtom)).toEqual({ probe: true, n: 2 })
        expect(store1.get(family("a"))).toEqual({ probe: true, n: 3 })
    })

    test("an unset-report failure surfaces the first captured commit error instead of masking it", () => {
        // The unset report is Phase C of the commit-forest walk, which records
        // into the commit's CommitErrors rather than letting the throw escape.
        // So an earlier recorded error (here the phase-3 hook error) wins,
        // instead of being masked by the report read-through's own error.
        let defaultEvaluations = 0
        const boom = atom(() => {
            defaultEvaluations += 1
            if (defaultEvaluations > 1) throw new Error("default boom")
            return 1
        })
        const hooked = atom(0, {
            onSet: () => {
                throw new Error("hook boom")
            },
        })
        const store1 = store()
        const scoped = store1.scope("request")
        const changes: unknown[] = []

        // The scope claims its own shadow; the root's default materializes at
        // most once. De-materialize the root so the unset report's parent
        // read-through must re-evaluate the (now throwing) default.
        scoped.txn(txn => txn.set(boom, 5))
        store1.unset(boom)
        scoped.onChange(change => changes.push(change))

        expect(() =>
            scoped.txn(txn => {
                txn.set(hooked, 1)
                txn.unset(boom)
            }),
        ).toThrow("hook boom")

        expect(defaultEvaluations).toBeGreaterThan(1)
        expect(scoped.get(hooked)).toBe(1)
        expect(changes.length).toBeGreaterThan(0)
    })
})
