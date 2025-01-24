import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { transaction } from "./transaction"
import { selector } from "../selector"
import { atomFamily } from "../atomFamily"

describe("transaction", () => {
    test("txn set with callback", () => {
        const store1 = store()
        const atom1 = atom(1)
        transaction(({ set }) => {
            set(atom1, curr => curr + 1)
        }, store1.data)
        expect(store1.get(atom1)).toBe(2)
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

    test("transaction works when reading atomFamily", () => {
        const family = atomFamily<number>(null)
        const store1 = store()
        store1.set(family(1), { id: 1, name: "Foo" })
        store1.set(family(2), { id: 2, name: "Bar" })
        expect(store1.get(family)).toStrictEqual([1, 2])
        store1.txn(({ set, get }) => {
            expect(get(family)).toStrictEqual([1, 2])
            set(family(3), { id: 3, name: "Lorem" })
            expect(get(family)).toStrictEqual([1, 2])
            // TODO: Should support updates in transaction so that the following works
            // expect(get(family)).toStrictEqual([1, 2, 3])
        })
        expect(store1.get(family)).toStrictEqual([1, 2, 3])
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
})
