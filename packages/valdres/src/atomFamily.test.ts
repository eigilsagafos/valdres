import { describe, test, expect } from "bun:test"
import { store } from "./store"
import { atomFamily } from "./atomFamily"
import { selectorFamily } from "./selectorFamily"
import { wait } from "../test/utils/wait"
import { selector } from "./selector"

describe("atomFamily", () => {
    test("the same atom is returned when calling atomFamily", () => {
        const userAtomFamily = atomFamily()
        expect(userAtomFamily(1)).toEqual(userAtomFamily(1))
    })

    test("Simple default value", () => {
        const store1 = store()
        const userAtomFamily = atomFamily<number, string>("Foo")
        expect(store1.get(userAtomFamily(1))).toBe("Foo")
    })

    test("label", () => {
        const userAtomFamily = atomFamily<number | string | number[], string>(
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
    //     const store1 = store()
    //     const family = atomFamily<{ id: number; name: string }, number>(id => ({
    //         id,
    //         name: "Default",
    //     }))
    //     const user1 = family(1)
    //     const user2 = family(2, def => ({ ...def, name: "Foo" }))
    //     const user3 = family(3, { id: 3, name: "Bar" })
    //     expect(store1.get(user1)).toStrictEqual({ id: 1, name: "Default" })
    //     expect(store1.get(user2)).toStrictEqual({ id: 2, name: "Foo" })
    //     expect(store1.get(user3)).toStrictEqual({ id: 3, name: "Bar" })
    //     expect(() => family(3, { id: 3, name: "Bar" })).toThrow()
    // })

    test("sync callback as default value", () => {
        const store1 = store()
        const userAtomFamily = atomFamily<number, string>(() => "Bar")
        expect(store1.get(userAtomFamily(1))).toBe("Bar")
    })

    test("async callback as default value", async () => {
        const store1 = store()
        const userAtomFamily = atomFamily<number, string>(() =>
            wait(1).then(() => "Done"),
        )
        expect(store1.get(userAtomFamily(1))).toBeInstanceOf(Promise)
        await wait(1)
        expect(store1.get(userAtomFamily(1))).toBe("Done")
    })

    test("default callback with params as arg", () => {
        const store1 = store()
        const userAtomFamily = atomFamily<
            { foo: number; bar: number },
            [number, number]
        >(({ foo, bar }) => [foo, bar])

        expect(store1.get(userAtomFamily({ foo: 1, bar: 2 }))).toStrictEqual([
            1, 2,
        ])
    })

    test("no defaultValue suspends", () => {
        const store1 = store()
        const userAtomFamily = atomFamily()
        expect(store1.get(userAtomFamily(1))).toBeInstanceOf(Promise)
    })

    test("debug label", () => {
        const userAtomFamily = atomFamily<string, string>(undefined, {
            label: "userFamily",
        })
        const user1 = userAtomFamily("Foo")
        expect(user1.label).toBe("userFamily_Foo")
    })

    test("subscribe to atomFamily", () => {
        const store1 = store()
        const userAtomFamily = atomFamily<string, { name: string }>(undefined, {
            label: "userFamily",
        })
        const callbackIds: string[] = []
        const docs: { name: string }[] = []
        store1.sub(userAtomFamily, id => {
            callbackIds.push(id)
            docs.push(store1.get(userAtomFamily(id)))
        })

        store1.set(userAtomFamily("1"), { name: "Foo" })
        store1.set(userAtomFamily("2"), { name: "Bar" })
        store1.txn(set => {
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
        const store1 = store()
        const userAtomFamily = atomFamily<{ name: string }, { id: number }>(
            undefined,
            {
                label: "userFamily",
            },
        )
        const ids = []
        const docs = []
        store1.sub(userAtomFamily, ({ id }) => {
            ids.push(id)
            docs.push(store1.get(userAtomFamily({ id })))
        })
        const user1atom = userAtomFamily({ id: 1 })
        const user2atom = userAtomFamily({ id: 2 })
        store1.set(user1atom, { name: "Foo" })
        store1.set(user2atom, { name: "Bar" })
        expect(ids).toStrictEqual([1, 2])
        expect(docs).toStrictEqual([{ name: "Foo" }, { name: "Bar" }])
    })

    test("get an entire atom family", () => {
        // Should we allow this? Maybe directly but not in selectors?
        const store1 = store()
        const userAtomFamily = atomFamily({})
        const user1 = store1.set(userAtomFamily(1), { name: "Foo" })
        const user2 = store1.set(userAtomFamily(2), { name: "Bar" })
        userAtomFamily(3)
        expect(store1.get(userAtomFamily)).toStrictEqual([1, 2, 3])
        expect(store1.get(userAtomFamily)).toBe(store1.get(userAtomFamily))
    })

    test("selectorFamily as default value", () => {
        const now = Date.now()
        const store1 = store()
        const todoAtom = atomFamily()
        const isTodoNewlyCreatedSelector = selectorFamily(
            id => get => get(todoAtom(id)).created > Date.now() - 60_000,
        )
        const todoDisplaySettingsAtom = atomFamily(
            selectorFamily(id => get => {
                return {
                    selected: false,
                    expanded: get(isTodoNewlyCreatedSelector(id)),
                }
            }),
        )

        const todo1 = store1.set(todoAtom(1), {
            id: 1,
            name: "Todo 1",
            created: now - 120_000,
        })
        const todo2 = store1.set(todoAtom(2), {
            id: 2,
            name: "Todo 2",
            created: now - 20_000,
        })

        expect(store1.get(todoDisplaySettingsAtom(1))).toStrictEqual({
            selected: false,
            expanded: false,
        })
        expect(store1.get(todoDisplaySettingsAtom(2))).toStrictEqual({
            selected: false,
            expanded: true,
        })
    })

    test("selector as default value", () => {
        const store1 = store()
        const defaultStringsAtom = atomFamily<number, string>()
        store1.set(defaultStringsAtom(1), "Foo")
        store1.set(defaultStringsAtom(2), "Bar")

        const userSettingsAtom = atomFamily(
            selector(get => ({
                string1: get(defaultStringsAtom(1)),
                string2: get(defaultStringsAtom(2)),
            })),
        )

        expect(store1.get(userSettingsAtom(1))).toStrictEqual({
            string1: "Foo",
            string2: "Bar",
        })

        store1.set(defaultStringsAtom(1), "Foo Updated")
        store1.set(defaultStringsAtom(2), "Bar Updated")
        expect(store1.get(userSettingsAtom(1))).toStrictEqual({
            string1: "Foo",
            string2: "Bar",
        })
        expect(store1.get(userSettingsAtom(2))).toStrictEqual({
            string1: "Foo Updated",
            string2: "Bar Updated",
        })
    })

    test("release an atomFamily memeber", () => {
        const store1 = store()
        const todosAtomFamily = atomFamily<string>(id => ({
            id,
            completed: false,
            name: "New todo",
        }))
        expect(store1.get(todosAtomFamily)).toStrictEqual([])
        todosAtomFamily("1")
        expect(store1.get(todosAtomFamily)).toStrictEqual(["1"])
        todosAtomFamily.release("1")
        expect(store1.get(todosAtomFamily)).toStrictEqual([])
        store1.get(todosAtomFamily("1"))
        store1.get(todosAtomFamily("2"))
        store1.get(todosAtomFamily("3"))
        expect(store1.get(todosAtomFamily)).toStrictEqual(["1", "2", "3"])
        todosAtomFamily.release("1")
        expect(store1.get(todosAtomFamily)).toStrictEqual(["2", "3"])
    })
})
