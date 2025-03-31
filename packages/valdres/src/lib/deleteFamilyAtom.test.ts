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

    test.todo(
        "selector subsrbing to subset of family, then returning atom",
        () => {
            const rootStore = store()
            const user = atomFamily<{ id: number; gender: string }, [number]>()
            const allUsers = selector(get => get(user).map(atom => get(atom)))
            const allWomenAtoms = selector(get =>
                get(user).filter(atom => get(atom).gender === "female"),
            )
            const allWomen = selector(get => get(allWomenAtoms).map(get))
            const callback = mock(() => {})
            rootStore.sub(allWomen, callback)
            expect(rootStore.get(allWomenAtoms)).toStrictEqual([])
            expect(callback).toHaveBeenCalledTimes(0)
            rootStore.set(user(1), { id: 1, gender: "male" })
            expect(callback).toHaveBeenCalledTimes(1) // Why is this 2?
            expect(rootStore.get(allWomenAtoms)).toStrictEqual([])
            const callback2 = mock((...args) => {
                rootStore.get(user(2))
            })
            rootStore.sub(user(2), callback2)
            rootStore.set(user(2), { id: 2, gender: "female" })
            expect(rootStore.get(allWomenAtoms)).toStrictEqual([user(2)])
            rootStore.set(user(3), { id: 3, gender: "male" })
            expect(rootStore.get(allWomenAtoms)).toStrictEqual([user(2)])
            rootStore.set(user(4), { id: 4, gender: "female" })
            expect(callback).toHaveBeenCalledTimes(2)
            expect(rootStore.get(allWomenAtoms)).toStrictEqual([
                user(2),
                user(4),
            ])
            rootStore.delete(user(1))
            expect(rootStore.get(allWomenAtoms)).toStrictEqual([
                user(2),
                user(4),
            ])
            rootStore.delete(user(2))
            expect(callback).toHaveBeenCalledTimes(3)
            expect(rootStore.get(allWomenAtoms)).toStrictEqual([user(4)])
        },
    )

    test("default value", () => {
        const rootStore = store()
        const user = atomFamily<{ id: number }, [number]>(id => ({ id }), {
            name: "userFamily",
        })
        const allUsers = selector(get => get(user).map(atom => get(atom)), {
            name: "allUsersSelector",
        })
        expect(rootStore.get(allUsers)).toStrictEqual([])
        rootStore.get(user(1))
        expect(rootStore.data.values.get(user)).toStrictEqual([user(1)])
        expect(rootStore.get(user)).toStrictEqual([user(1)])
        expect(rootStore.get(allUsers)).toStrictEqual([{ id: 1 }])
        // ootStore.get(allUsers)
        // .toBe()
        // rootStore.set(user(2), { id: 3 })
        // console.log(rootStore.get(allUsers))
        // rootStore.set(user(1), rootStore.get(user(1)))
        // console.log(rootStore.data.values.get(user(1)))
        // console.log(rootStore.data.values.get(user.__initializedMembersAtom))
        // expect(rootStore.get(allUsers)).toStrictEqual(["asdf"])

        // console.log(rootStore.get(allUsers))
    })
})
