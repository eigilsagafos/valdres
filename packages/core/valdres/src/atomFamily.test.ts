import { describe, test, expect } from "bun:test"
import { createStore } from "./createStore"
import { atomFamily } from "./atomFamily"
import { wait } from "../test/utils/wait"

describe("atomFamily", () => {
    test("the same atom is returned when calling atomFamily", () => {
        const userAtomFamily = atomFamily()
        expect(userAtomFamily(1)).toEqual(userAtomFamily(1))
    })

    test("Simple default value", () => {
        const store = createStore()
        const userAtomFamily = atomFamily<string, number>("Foo")
        expect(store.get(userAtomFamily(1))).toBe("Foo")
    })

    test("label", () => {
        const userAtomFamily = atomFamily<string, number | string | number[]>(
            undefined,
            {
                label: "familyLabel",
            },
        )
        expect(userAtomFamily.label).toBe("familyLabel")
        const user1 = userAtomFamily(1)
        expect(user1.label).toBe("familyLabel_1")

        const user2 = userAtomFamily("2")
        expect(user2.label).toBe("familyLabel_2")

        const user3 = userAtomFamily([1, 2])
        expect(user3.label).toBe("familyLabel_[1,2]")
    })

    // test("Allow default override first time atom is created in family", () => {
    //     const store = createStore()
    //     const family = atomFamily<{ id: number; name: string }, number>(id => ({
    //         id,
    //         name: "Default",
    //     }))
    //     const user1 = family(1)
    //     const user2 = family(2, def => ({ ...def, name: "Foo" }))
    //     const user3 = family(3, { id: 3, name: "Bar" })
    //     expect(store.get(user1)).toStrictEqual({ id: 1, name: "Default" })
    //     expect(store.get(user2)).toStrictEqual({ id: 2, name: "Foo" })
    //     expect(store.get(user3)).toStrictEqual({ id: 3, name: "Bar" })
    //     expect(() => family(3, { id: 3, name: "Bar" })).toThrow()
    // })

    test("sync callback as default value", () => {
        const store = createStore()
        const userAtomFamily = atomFamily<string, number>(() => "Bar")
        expect(store.get(userAtomFamily(1))).toBe("Bar")
    })

    test("async callback as default value", async () => {
        const store = createStore()
        const userAtomFamily = atomFamily<string, number>(() =>
            wait(1).then(() => "Done"),
        )
        expect(store.get(userAtomFamily(1))).toBeInstanceOf(Promise)
        await wait(1)
        expect(store.get(userAtomFamily(1))).toBe("Done")
    })

    test("default callback with params as arg", () => {
        const store = createStore()
        const userAtomFamily = atomFamily<
            [number, number],
            { foo: number; bar: number }
        >(({ foo, bar }) => [foo, bar])
        expect(store.get(userAtomFamily({ foo: 1, bar: 2 }))).toStrictEqual([
            1, 2,
        ])
    })

    test("no defaultValue suspends", () => {
        const store = createStore()
        const userAtomFamily = atomFamily()
        expect(store.get(userAtomFamily(1))).toBeInstanceOf(Promise)
    })

    test("debug label", () => {
        const store = createStore()
        const userAtomFamily = atomFamily<string, string>(undefined, {
            label: "userFamily",
        })
        const user1 = userAtomFamily("Foo")
        expect(user1.label).toBe("userFamily_Foo")
    })

    test("subscribe to atomFamily", () => {
        const store = createStore()
        const userAtomFamily = atomFamily<{ name: string }, string>(undefined, {
            label: "userFamily",
        })
        const callbackIds: string[] = []
        const docs: { name: string }[] = []
        store.sub(userAtomFamily, id => {
            callbackIds.push(id)
            docs.push(store.get(userAtomFamily(id)))
        })

        store.set(userAtomFamily("1"), { name: "Foo" })
        store.set(userAtomFamily("2"), { name: "Bar" })
        store.txn(set => {
            set(userAtomFamily("3"), { name: "Lorem" })
            set(userAtomFamily("4"), { name: "Ipsum" })
        })

        expect(docs).toStrictEqual([
            { name: "Foo" },
            { name: "Bar" },
            { name: "Lorem" },
            { name: "Ipsum" },
        ])
        expect(callbackIds).toStrictEqual(["1", "2", "3", "4"])
    })

    test("atomFamily with object key", () => {
        const store = createStore()
        const userAtomFamily = atomFamily<{ name: string }, { id: number }>(
            undefined,
            {
                label: "userFamily",
            },
        )
        const ids = []
        const docs = []
        store.sub(userAtomFamily, ({ id }) => {
            ids.push(id)
            docs.push(store.get(userAtomFamily({ id })))
        })
        const user1atom = userAtomFamily({ id: 1 })
        const user2atom = userAtomFamily({ id: 2 })
        store.set(user1atom, { name: "Foo" })
        store.set(user2atom, { name: "Bar" })
        expect(ids).toStrictEqual([1, 2])
        expect(docs).toStrictEqual([{ name: "Foo" }, { name: "Bar" }])
    })

    test("get an entire atom family", () => {
        // Should we allow this? Maybe directly but not in selectors?
        const store = createStore()
        const userAtomFamily = atomFamily({})
        const user1 = store.set(userAtomFamily(1), { name: "Foo" })
        const user2 = store.set(userAtomFamily(2), { name: "Bar" })
        userAtomFamily(3)
        expect(store.get(userAtomFamily)).toStrictEqual([1, 2, 3])
        expect(store.get(userAtomFamily)).toBe(store.get(userAtomFamily))
    })
})
