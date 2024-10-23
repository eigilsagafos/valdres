import { describe, test, expect } from "bun:test"
import { store } from "./store"
import { atom } from "./atom"
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
})
