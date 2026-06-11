import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"
import { transaction } from "./transaction"
import { index } from "../indexConstructor"

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
        }, store1.data)
        expect(store1.get(atom1)).toBe(2)
    })
    test("txn set with callback", () => {
        const store1 = store()
        const atom1 = atom(1)
        transaction(({ set }) => {
            set(atom1, curr => curr + 1)
        }, store1.data)
        expect(store1.get(atom1)).toBe(2)
    })

    test("txn simple get", () => {
        const store1 = store()
        const atom1 = atom(1)
        transaction(({ get }) => {
            expect(get(atom1)).toBe(1)
        }, store1.data)
    })
    test("txn get after set", () => {
        const store1 = store()
        const atom1 = atom(1)
        transaction(({ set, get }) => {
            set(atom1, 2)
            expect(get(atom1)).toBe(2)
        }, store1.data)
    })

    test("txn reset", () => {
        const store1 = store()
        const atom1 = atom(1)
        transaction(({ get, set, reset }) => {
            set(atom1, 2)
            expect(get(atom1)).toBe(2)
            reset(atom1)
            expect(get(atom1)).toBe(1)
        }, store1.data)
        expect(store1.get(atom1)).toBe(1)
    })

    test("commit during transaction", () => {
        const store1 = store()

        const atom1 = atom(10)
        const atom2 = atom(20)
        const atom3 = atom(30)
        const sum = selector(get => get(atom1) + get(atom2) + get(atom3))
        const product = selector(get => get(atom1) * get(atom2) * get(atom3))

        expect(store1.get(sum)).toBe(60)
        expect(store1.get(product)).toBe(6_000)

        transaction(({ set, get, commit }) => {
            expect(get(sum)).toBe(60)
            expect(get(product)).toBe(6000)
            set(atom1, 100)
            set(atom2, 200)
            set(atom3, 300)
            commit()
            expect(get(sum)).toBe(600)
            expect(get(product)).toBe(6_000_000)
        }, store1.data)

        expect(store1.get(sum)).toBe(600)
        expect(store1.get(product)).toBe(6_000_000)
    })

    test("commit has access to all state", () => {
        const store1 = store()
        const ids = atom(["1"])
        const userFamily = atomFamily(null)
        store1.set(userFamily("1"), { id: "1", name: "Foo" })
        const userNames = selector(get =>
            get(ids).map(id => get(userFamily(id)).name),
        )

        expect(store1.get(userNames)).toStrictEqual(["Foo"])

        store1.txn(({ set, get, reset, commit }) => {
            set(ids, curr => [...curr, "2"])
            set(userFamily("2"), { id: "2", name: "Bar" })
            commit()
            expect(store1.get(userNames)).toStrictEqual(["Foo", "Bar"])
        })
    })

    test("transaction works with selectors", () => {
        const store1 = store()
        const atom1 = atom(1, { name: "txn-sel-atom1" })
        const selectorCb1 = mock(get => get(atom1) + 1)
        const selectorCb2 = mock(get => get(atom1) + 2)
        const selector1 = selector(selectorCb1, "selector1")
        const selector2 = selector(selectorCb2, "selector2")
        // const selector2 = selector((get) => get(selector1) + 1, "selector2")

        store1.txn(({ set, get, reset, commit }) => {
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
    test("delete in transaction", () => {
        const rootStore = store()
        const user = atomFamily<{ id: number; name: string }, [number]>()
        const user1atom = user(1)
        const user2atom = user(2)
        const user3atom = user(3)
        const user4atom = user(4)
        rootStore.set(user1atom, { id: 1, name: "Foo" })
        rootStore.set(user2atom, { id: 2, name: "Bar" })
        expect(rootStore.data.values.get(user)).toStrictEqual([
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
        expect(rootStore.data.values.get(user)).toStrictEqual([
            user2atom,
            user4atom,
        ])
        expect(rootStore.data.values.has(user1atom)).toBe(false)
        expect(rootStore.data.values.has(user2atom)).toBe(true)
        expect(rootStore.data.values.has(user3atom)).toBe(false)
        expect(rootStore.data.values.has(user4atom)).toBe(true)
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

        // TODO: Find way for txn insertion order to persist on txn commit...
        expect(childStore.get(userAtomFamily)).toStrictEqual([
            user2atom,
            user1atom,
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

        expect(store1.data.values.get(doc1)).toStrictEqual([1, 2])
        expect(store1.data.scopes.get("foo")!.values.get(doc1)).toStrictEqual([1, 2, 3])
        expect(
            store1.data.scopes.get("foo")!.scopes.get("bar")!.values.get(doc1),
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

    test("when using txn.parentScope commit in child scope and then crashm should persist correctly", () => {
        const nameAtom = atom("default")
        const rootStore = store()
        const nestedStore = rootStore.scope("Nested")

        try {
            nestedStore.txn(txn => {
                txn.set(nameAtom, "Set in Foo before parentScope")
                txn.parentScope(parentTxn => {
                    parentTxn.set(nameAtom, "Set in Parent")
                })
                txn.commit()
                throw new Error("Crash")
            })
        } catch (e) {}
        expect(nestedStore.get(nameAtom)).toBe("Set in Foo before parentScope")
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

    // Demonstrates the `!isPromiseLike(value)` half of the writeAtoms gate.
    // The txn path does no async resolution, so storing an in-flight promise
    // must NOT resolve the placeholder by adoption — that would consume it and
    // strand it on a promise that never settles, so a later settled write
    // could never resolve it. The placeholder must survive until a settled
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
