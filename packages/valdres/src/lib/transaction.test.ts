import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"
import { transaction } from "./transaction"
import { index } from "../indexConstructor"

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
        const atom1 = atom(1, { name: "astom1" })
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
        const atom1 = atom(10, { name: "atom1" })
        const atom2 = atom(20, { name: "atom2" })
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
        const atom1 = atom(1, { name: "astom1" })
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
        expect(store1.data.scopes.foo.values.get(doc1)).toStrictEqual([1, 2, 3])
        expect(
            store1.data.scopes.foo.scopes.bar.values.get(doc1),
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

    test("delete from transaction", () => {
        const defaultStore = store()
        const post = atomFamily<{ title: string; tags: string[] }, [string]>(
            null,
            {
                name: "posts",
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
})
