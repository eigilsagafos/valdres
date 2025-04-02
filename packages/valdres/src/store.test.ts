import { describe, test, expect } from "bun:test"
import { store } from "./store"
import { atom } from "./atom"
import { atomFamily } from "./atomFamily"
import { selector } from "./selector"

describe("store", () => {
    test("txn", () => {
        const store1 = store()
        const atom1 = atom(10)
        const atom2 = atom(5)
        // const res = store.get(atom(5))
        const selector1 = selector(get => {
            return get(atom1) * get(atom2)
        })
        expect(store1.get(selector1)).toBe(50)

        store1.txn(({ set, get }) => {
            set(atom1, 11)
            set(atom2, 4)
            expect(get(atom1)).toBe(11)
        })
        expect(store1.get(selector1)).toBe(44)
    })

    test("create scope", () => {
        const root = store("root")
        const child = root.scope("child")
        const nestedChild = child.scope("nestedChild")

        const atom1 = atom("default")

        expect(root.get(atom1)).toBe("default")
        expect(child.get(atom1)).toBe("default")
        expect(nestedChild.get(atom1)).toBe("default")

        root.set(atom1, "set in root")
        expect(root.get(atom1)).toBe("set in root")
        expect(child.get(atom1)).toBe("set in root")
        expect(nestedChild.get(atom1)).toBe("set in root")

        child.set(atom1, "set in child")
        expect(root.get(atom1)).toBe("set in root")
        expect(child.get(atom1)).toBe("set in child")
        expect(nestedChild.get(atom1)).toBe("set in child")

        nestedChild.set(atom1, "set in nestedChild")
        expect(root.get(atom1)).toBe("set in root")
        expect(child.get(atom1)).toBe("set in child")
        expect(nestedChild.get(atom1)).toBe("set in nestedChild")

        root.set(atom1, "set in root again")
        expect(root.get(atom1)).toBe("set in root again")
        expect(child.get(atom1)).toBe("set in child")
        expect(nestedChild.get(atom1)).toBe("set in nestedChild")
    })

    test("selector in scope", () => {
        const root = store("root")
        const child = root.scope("child")
        const atom1 = atom(1)
        const selector1 = selector(get => get(atom1) * 2)

        expect(root.get(selector1)).toBe(2)
        expect(child.get(selector1)).toBe(2)
        child.set(atom1, 2)
        expect(child.get(selector1)).toBe(4)
        expect(root.get(selector1)).toBe(2)
        child.set(atom1, 3)
        expect(child.get(selector1)).toBe(6)
        root.set(atom1, 5)
        expect(child.get(selector1)).toBe(6)
        expect(root.get(selector1)).toBe(10)
    })
    describe("scope", () => {
        test("family", () => {
            const root = store("root")
            const child = root.scope("child")
            const userFamily = atomFamily<string>(id => ({ id }))

            expect(root.get(userFamily)).toHaveLength(0)
            expect(child.get(userFamily)).toHaveLength(0)
            expect(root.data.values.get(userFamily)).toStrictEqual([])
            expect(child.data.values.get(userFamily)).toBeUndefined()

            // We get a atom from the family. Nothing should happen
            const user1 = userFamily("1")
            expect(root.get(userFamily)).toHaveLength(0)
            expect(child.get(userFamily)).toHaveLength(0)
            expect(root.data.values.get(userFamily)).toStrictEqual([])
            expect(child.data.values.get(userFamily)).toBeUndefined()

            // We get the atom from root. This will then init in the root
            root.get(user1)
            expect(root.get(userFamily)).toHaveLength(1)
            expect(child.get(userFamily)).toHaveLength(1)
            expect(root.data.values.get(userFamily)).toStrictEqual([user1])
            expect(child.data.values.get(userFamily)).toBeUndefined()
            expect(root.data.values.get(user1)).toStrictEqual({ id: "1" })
            expect(child.data.values.get(user1)).toBeUndefined()

            // Init another user and get from root
            const user2 = userFamily("2")
            root.get(user2)
            expect(root.get(userFamily)).toHaveLength(2)
            expect(child.get(userFamily)).toHaveLength(2)
            expect(root.data.values.get(userFamily)).toStrictEqual([
                user1,
                user2,
            ])
            expect(child.data.values.get(userFamily)).toBeUndefined()

            // Now we init user3 and get it on the child. This should trigger
            // the atom family array to split
            const user3 = userFamily("3")
            child.get(user3)
            expect(root.get(userFamily)).toHaveLength(2)
            expect(child.get(userFamily)).toHaveLength(3)
            expect(root.data.values.get(userFamily)).toStrictEqual([
                user1,
                user2,
            ])
            expect(child.data.values.get(userFamily)).toStrictEqual([
                user1,
                user2,
                user3,
            ])

            const user4 = userFamily("4")
            child.set(user4, { id: "4", name: "Foo" })
            expect(root.get(userFamily)).toHaveLength(2)
            expect(child.get(userFamily)).toHaveLength(4)
        })
    })
})
