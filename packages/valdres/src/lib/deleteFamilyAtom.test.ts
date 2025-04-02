import { describe, expect, mock, test } from "bun:test"
import { store } from "../store"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { deleteFamilyAtom } from "./deleteFamilyAtom"

describe("deleteFamilyAtom", () => {
    test("selector subscribing to atom family args ids", () => {
        const rootStore = store()
        const user = atomFamily<{ id: number }, [number]>()

        const allUserIds = selector(get =>
            get(user).map(atom => atom.familyArgs[0]),
        )
        expect(rootStore.get(allUserIds)).toStrictEqual([])
        rootStore.set(user(1), { id: 1 })
        expect(rootStore.get(allUserIds)).toStrictEqual([1])
        deleteFamilyAtom(user(1), rootStore.data)
        expect(rootStore.get(allUserIds)).toStrictEqual([])
    })
    test("selector subscribing to family and all family atoms", () => {
        const rootStore = store()
        const user = atomFamily<{ id: number }, [number]>()
        const allUsers = selector(get => get(user).map(atom => get(atom)))
        expect(rootStore.get(allUsers)).toStrictEqual([])
        rootStore.set(user(1), { id: 1 })
        expect(rootStore.get(allUsers)).toStrictEqual([{ id: 1 }])
        rootStore.set(user(2), { id: 2 })
        expect(rootStore.get(allUsers)).toStrictEqual([{ id: 1 }, { id: 2 }])
        deleteFamilyAtom(user(1), rootStore.data)
        expect(rootStore.get(allUsers)).toStrictEqual([{ id: 2 }])
        deleteFamilyAtom(user(2), rootStore.data)
        expect(rootStore.get(allUsers)).toStrictEqual([])
    })

    test("selector subsrbing to subset of family, then returning atom", () => {
        const rootStore = store()
        const user = atomFamily<{ id: number; gender: string }, [number]>(null)
        const allUsers = selector(get => get(user).map(atom => get(atom)))
        const allWomenAtoms = selector(get =>
            get(user).filter(atom => get(atom).gender === "woman"),
        )
        const allWomen = selector(get => get(allWomenAtoms).map(get))
        const callback = mock(() => {})
        rootStore.sub(allWomen, callback)
        expect(rootStore.get(allWomenAtoms)).toStrictEqual([])
        expect(callback).toHaveBeenCalledTimes(0)
        rootStore.set(user(1), { id: 1, gender: "woman" })
        expect(callback).toHaveBeenCalledTimes(1)
        expect(rootStore.get(allWomenAtoms)).toStrictEqual([user(1)])
        const callback2 = mock((...args) => {
            rootStore.get(user(2))
        })
        rootStore.sub(user(2), callback2)
        rootStore.set(user(2), { id: 2, gender: "male" })
        expect(rootStore.get(allWomenAtoms)).toStrictEqual([user(1)])
        rootStore.set(user(3), { id: 3, gender: "woman" })
        expect(callback).toHaveBeenCalledTimes(2)
        expect(rootStore.get(allWomenAtoms)).toStrictEqual([user(1), user(3)])
        rootStore.set(user(4), { id: 4, gender: "male" })
        expect(callback).toHaveBeenCalledTimes(2)
        expect(rootStore.get(allWomenAtoms)).toStrictEqual([user(1), user(3)])
        rootStore.del(user(1))
        // expect(callback).toHaveBeenCalledTimes(3)
        expect(rootStore.get(allWomenAtoms)).toStrictEqual([user(3)])
        const user3idSelector = selector(get => get(user(3))?.id ?? null)
        const callback3 = mock(() => {})
        rootStore.sub(user3idSelector, callback3)
        expect(rootStore.get(user3idSelector)).toBe(3)
        rootStore.del(user(3))
        expect(callback3).toHaveBeenCalledTimes(1)
        expect(rootStore.get(user3idSelector)).toBe(null)
        expect(rootStore.get(allWomenAtoms)).toStrictEqual([])

        // expect(callback).toHaveBeenCalledTimes(4)
        // TODO Check call count
        // expect(rootStore.get(allWomenAtoms)).toStrictEqual([user(4)])
    })

    test("default value", () => {
        const rootStore = store()
        const user = atomFamily<{ id: number }, [number]>(id => ({ id }), {
            name: "userFamily",
        })
        const allUsers = selector(get => get(user).map(atom => get(atom)), {
            name: "allUsersSelector",
        })
        expect(rootStore.get(allUsers)).toStrictEqual([])
        expect(rootStore.get(user(1))).toStrictEqual({ id: 1 })
        expect(rootStore.get(allUsers)).toStrictEqual([{ id: 1 }])
    })
})
