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

        store1.txn((set, get) => {
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
        test.only("family", () => {
            const root = store("root")
            const child = root.scope("child")
            const userFamily = atomFamily<string>(id => ({ id }))

            expect(root.get(userFamily)).toHaveLength(0)
            expect(child.get(userFamily)).toHaveLength(0)
            const user1 = userFamily("1")
            expect(root.get(userFamily)).toHaveLength(0)
            expect(child.get(userFamily)).toHaveLength(0)

            root.get(user1)
            expect(root.get(userFamily)).toHaveLength(1)
            expect(child.get(userFamily)).toHaveLength(1)

            const user2 = userFamily("2")
            root.get(user2)
            expect(root.get(userFamily)).toHaveLength(2)
            expect(child.get(userFamily)).toHaveLength(2)

            const user3 = userFamily("3")
            child.get(user3)
            expect(root.get(userFamily)).toHaveLength(3)
            expect(child.get(userFamily)).toHaveLength(3)
            const user4 = userFamily("4")
            child.set(user4, { id: "4", name: "Foo" })
            expect(root.get(userFamily)).toHaveLength(4)
            expect(child.get(userFamily)).toHaveLength(4)

            /**
             * Currently getting the list of keys alawys stays in sync
             * in root and scoped stores. I'm still figuring out what
             * would be the expected behaviour, but I'm leaning towards
             * this not being the right approach. The reason that it
             * works like this is because when getting the key set it
             * always bubbles up to the root. Set as well triggers the
             * get first.
             */
        })
    })
})
