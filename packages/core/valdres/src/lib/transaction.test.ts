import { describe, test, expect, mock } from "bun:test"
import { createStore } from "../createStore"
import { atom } from "../atom"
import { transaction } from "./transaction"
import { selector } from "../selector"
import { atomFamily } from "../atomFamily"

describe("transaction", () => {
    test("txn set with callback", () => {
        const store = createStore()
        const atom1 = atom(1)
        transaction(set => {
            set(atom1, curr => curr + 1)
        }, store.data)
        expect(store.get(atom1)).toBe(2)
    })

    test("commit during transaction", () => {
        const store = createStore()

        const atom1 = atom(10)
        const atom2 = atom(20)
        const atom3 = atom(30)
        const sum = selector(get => get(atom1) + get(atom2) + get(atom3))
        const product = selector(get => get(atom1) * get(atom2) * get(atom3))

        expect(store.get(sum)).toBe(60)
        expect(store.get(product)).toBe(6_000)

        transaction((set, get, reset, commit) => {
            expect(get(sum)).toBe(60)
            expect(get(product)).toBe(6000)
            set(atom1, 100)
            set(atom2, 200)
            set(atom3, 300)
            commit()
            expect(get(sum)).toBe(600)
            expect(get(product)).toBe(6_000_000)
        }, store.data)

        expect(store.get(sum)).toBe(600)
        expect(store.get(product)).toBe(6_000_000)
    })

    test("commit has access to all state", () => {
        const store = createStore()
        const ids = atom(["1"])
        const userFamily = atomFamily(null)
        store.set(userFamily("1"), { id: "1", name: "Foo" })
        const userNames = selector(get =>
            get(ids).map(id => get(userFamily(id)).name),
        )

        expect(store.get(userNames)).toStrictEqual(["Foo"])

        store.txn((set, get, reset, commit) => {
            set(ids, curr => [...curr, "2"])
            set(userFamily("2"), { id: "2", name: "Bar" })
            commit()
            expect(store.get(userNames)).toStrictEqual(["Foo", "Bar"])
        })
    })

    test.only("transaction works with selectors", () => {
        const store = createStore()
        const atom1 = atom(1, "astom1")
        const selectorCb1 = mock(get => get(atom1) + 1)
        const selectorCb2 = mock(get => get(atom1) + 2)
        const selector1 = selector(selectorCb1, "selector1")
        const selector2 = selector(selectorCb2, "selector2")
        // const selector2 = selector((get) => get(selector1) + 1, "selector2")

        store.txn((set, get, reset, commit) => {
            expect(get(selector1)).toBe(2)
            expect(get(selector2)).toBe(3)
            set(atom1, 2)
            expect(selectorCb1).toHaveBeenCalledTimes(1)
            expect(selectorCb2).toHaveBeenCalledTimes(1)
            expect(get(selector1)).toBe(3)
            expect(selectorCb1).toHaveBeenCalledTimes(2)
            set(atom1, 3)
            expect(get(selector1)).toBe(4)
            // expect(selectorCb1).toHaveBeenCalledTimes(3)
            // expect(selectorCb2).toHaveBeenCalledTimes(1)
        })
    })

    test.todo("transaction fails when trying to access dirty selector", () => {
        const store = createStore()
        const atom1 = atom(1, "astom1")
        const selector1 = selector(get => get(atom1) + 1, "selector1")
        // const selector2 = selector((get) => get(selector1) + 1, "selector2")

        store.txn((set, get, reset, commit) => {
            expect(get(selector1)).toBe(2)
            set(atom1, 2)
            expect(() => get(selector1)).toThrow()
        })
    })
})
