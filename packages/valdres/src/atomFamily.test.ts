import { describe, test, expect, mock } from "bun:test"
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

    test("name", () => {
        const userAtomFamily = atomFamily<number | string | number[], string>(
            undefined,
            { name: "familyName" },
        )
        expect(userAtomFamily.name).toBe("familyName")
        const user1 = userAtomFamily(1)
        expect(user1.name).toBe("familyName_1")

        const user2 = userAtomFamily("2")
        expect(user2.name).toBe("familyName_2")

        const user3 = userAtomFamily([1, 2])
        expect(user3.name).toBe("familyName_[1,2]")
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

    test("debug name", () => {
        const userAtomFamily = atomFamily<string, string>(undefined, {
            name: "userFamily",
        })
        const user1 = userAtomFamily("Foo")
        expect(user1.name).toBe("userFamily_Foo")
    })

    test("subscribe to atomFamily", () => {
        const store1 = store()
        const userAtomFamily = atomFamily<{ name: string }, [string]>(null, {
            name: "userFamily",
        })
        const callbackIds: string[] = []
        const docs: { name: string }[] = []
        store1.sub(userAtomFamily, id => {
            callbackIds.push(id)
            docs.push(store1.get(userAtomFamily(id)))
        })
        store1.set(userAtomFamily("1"), { name: "Foo" })
        store1.set(userAtomFamily("2"), { name: "Bar" })
        store1.txn(({ set }) => {
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
        const userAtomFamily = atomFamily<{ name: string }, [{ id: number }]>(
            undefined,
            { name: "userFamily" },
        )
        const ids: number[] = []
        const docs: any[] = []
        store1.sub(userAtomFamily, ({ id }) => {
            ids.push(id)
            docs.push(store1.get(userAtomFamily({ id })))
        })
        const user1atom = userAtomFamily({ id: 1 })
        store1.set(user1atom, { name: "Foo" })
        const user2atom = userAtomFamily({ id: 2 })
        store1.set(user2atom, { name: "Bar" })
        expect(ids).toStrictEqual([1, 2])
        expect(docs).toStrictEqual([{ name: "Foo" }, { name: "Bar" }])
    })

    test("get an entire atom family", () => {
        const store1 = store()
        const userAtomFamily = atomFamily<{ name: string }, [number]>()
        const user1 = store1.set(userAtomFamily(1), { name: "Foo" })
        const user2 = store1.set(userAtomFamily(2), { name: "Bar" })
        expect(
            store1.get(userAtomFamily).map(atom => atom.familyArgsStringified),
        ).toStrictEqual([1, 2])
        expect(store1.get(userAtomFamily)).toBe(store1.get(userAtomFamily))
    })

    test("Getting an empty atomFamily serves the same array", () => {
        const store1 = store()
        const familiy = atomFamily()
        expect(store1.get(familiy)).toBe(store1.get(familiy))
    })

    test("get on familyAtom adds it to array", () => {
        const store1 = store()
        const familiy = atomFamily("new")
        const callback = mock(() => {})
        store1.sub(familiy, callback)
        const atom1 = familiy("1")
        store1.get(atom1)
        // We need to figure out how to get this to work. We need to untangle getState used
        // explicitly and used from setState and other places.
        expect(callback).toHaveBeenCalledTimes(1) // now returns 0 as get does not trigger the callback...
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
        const defaultStringsAtom = atomFamily<string, [number]>()
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
        const todosAtomFamily = atomFamily((id: string) => ({
            id,
            completed: false,
            name: "New todo",
        }))
        expect(store1.get(todosAtomFamily)).toStrictEqual([])
        todosAtomFamily("1")
        expect(store1.get(todosAtomFamily)).toStrictEqual([])
        todosAtomFamily.release("1")
        expect(store1.get(todosAtomFamily)).toStrictEqual([])
        store1.get(todosAtomFamily("1"))
        store1.get(todosAtomFamily("2"))
        store1.get(todosAtomFamily("3"))
        /**
         * TODO: Have to figure out how to correctly do release, have to include
         * store to release from the keys atom
         */
        expect(
            store1.get(todosAtomFamily).map(atom => atom.familyArgsStringified),
        ).toStrictEqual(["1", "2", "3"])
        store1.del(todosAtomFamily("1"))
        expect(
            store1.get(todosAtomFamily).map(atom => atom.familyArgsStringified),
        ).toStrictEqual(["2", "3"])
        // store.del() now also releases the entry from the family map
        expect(
            todosAtomFamily.__valdresAtomFamilyMap.keys().toArray(),
        ).toStrictEqual(["2", "3"])
    })

    test("subscribe to atom family keys", () => {
        const store1 = store()
        const testAtomFamily = atomFamily<string>(0)
        const callback = mock(() => {})
        store1.sub(testAtomFamily, callback)
        const atom1 = testAtomFamily("1")
        store1.get(atom1)
        expect(callback).toHaveBeenCalledTimes(1)
    })

    test("global atomFamily members sync across stores", () => {
        const store1 = store()
        const store2 = store()
        const family = atomFamily<string, [string]>("default", {
            global: true,
            name: "global_sync_test",
        })
        const memberAtom = family("user1")
        store1.set(memberAtom, "updated")
        expect(store1.get(memberAtom)).toBe("updated")
        expect(store2.get(memberAtom)).toBe("updated")
    })

    test("global atomFamily members have setSelf/getSelf/resetSelf", () => {
        const family = atomFamily<string, [string]>("default", {
            global: true,
            name: "global_self_test",
        })
        const memberAtom = family("user1")
        expect(memberAtom.setSelf).toBeFunction()
        expect(memberAtom.getSelf).toBeFunction()
        expect(memberAtom.resetSelf).toBeFunction()
    })

    test("global atomFamily setSelf propagates to all stores", () => {
        const store1 = store()
        const store2 = store()
        const family = atomFamily<string, [string]>("default", {
            global: true,
            name: "global_setSelf_test",
        })
        const memberAtom = family("user1")
        // @ts-ignore - setSelf may not exist yet
        memberAtom.setSelf("from setSelf")
        expect(store1.get(memberAtom)).toBe("from setSelf")
        expect(store2.get(memberAtom)).toBe("from setSelf")
    })

    test("global atomFamily returns same family for same key", () => {
        const family1 = atomFamily("Default", {
            name: "non_global_test",
        })
        const family2 = atomFamily("Default", {
            name: "non_global_test",
        })
        expect(Object.is(family1, family2)).toBe(false)
        const globalGamily1 = atomFamily("Default", {
            global: true,
            name: "global_test",
        })
        const globalFamily2 = atomFamily("Default", {
            global: true,
            name: "global_test",
        })
        expect(Object.is(globalGamily1, globalFamily2)).toBe(true)
    })

    test("atom families in scope", () => {
        const rootStore = store()
        const nestedStore = rootStore.scope("nested")
        const nestedNestedStore = nestedStore.scope("nested-nested")
        const userFamily = atomFamily()
        const user1atom = userFamily(1)
        const user2atom = userFamily(2)
        const user3atom = userFamily(3)
        const user4atom = userFamily(4)

        rootStore.set(user1atom, "User 1 set in root")
        expect(rootStore.get(userFamily)).toStrictEqual([user1atom])
        expect(nestedNestedStore.get(userFamily)).toStrictEqual([user1atom])
        nestedNestedStore.set(user4atom, "User 4 set in nested-nested")
        expect(nestedNestedStore.get(userFamily)).toStrictEqual([
            user1atom,
            user4atom,
        ])
        nestedStore.set(user2atom, "User 2 set in nested")
        expect(nestedStore.get(userFamily)).toStrictEqual([
            user1atom,
            user2atom,
        ])
        rootStore.set(user3atom, "User 3 set in root")
        expect(rootStore.get(userFamily)).toStrictEqual([user1atom, user3atom])
        expect(nestedStore.get(userFamily)).toStrictEqual([
            user1atom,
            user2atom,
            user3atom,
        ])
        rootStore.del(user1atom)
        expect(rootStore.get(userFamily)).toStrictEqual([user3atom])
        expect(nestedStore.get(userFamily)).toStrictEqual([
            user2atom,
            user3atom,
        ])
        expect(nestedNestedStore.get(userFamily)).toStrictEqual([
            user4atom,
            user2atom,
            user3atom,
        ])

        const user5atom = userFamily(5)
        // Test subscriptions
        const rootCallback = mock(() => {})
        const nestedCallback = mock(() => {})
        const nestedNestedCallback = mock(() => {})
        rootStore.sub(userFamily, rootCallback)
        nestedStore.sub(userFamily, nestedCallback)
        nestedNestedStore.sub(userFamily, nestedNestedCallback)

        rootStore.set(user5atom, "User 5 set in root")
        expect(rootCallback).toHaveBeenCalledTimes(1)
        expect(nestedCallback).toHaveBeenCalledTimes(1)
        expect(nestedNestedCallback).toHaveBeenCalledTimes(1)

        rootStore.del(user5atom)
        expect(rootCallback).toHaveBeenCalledTimes(2)
        expect(nestedCallback).toHaveBeenCalledTimes(2)
        expect(nestedNestedCallback).toHaveBeenCalledTimes(2)
    })

    test("order is based on insertion time", () => {
        const rootStore = store()
        const nestedStore = rootStore.scope("nested")
        const nestedNestedStore = nestedStore.scope("nested-nested")
        const userFamily = atomFamily()
        const user1atom = userFamily(1)
        const user2atom = userFamily(2)
        const user3atom = userFamily(3)
        const user4atom = userFamily(4)

        rootStore.set(user1atom, "User 1")
        nestedStore.set(user2atom, "User 2")
        rootStore.set(user3atom, "User 3")

        expect(nestedStore.get(userFamily)).toStrictEqual([
            user1atom,
            user2atom,
            user3atom,
        ])
    })

    test("re-setting an existing atom moves it to the end of the rendered list", () => {
        const s = store()
        const userFamily = atomFamily<string, [number]>()
        const a = userFamily(1)
        const b = userFamily(2)
        const c = userFamily(3)

        s.set(a, "Alice")
        s.set(b, "Bob")
        s.set(c, "Charlie")
        expect(s.get(userFamily)).toStrictEqual([a, b, c])

        // Re-set `a`: same atom reference, new value. The contract is
        // last-touched-last, so `a` should move to the end.
        s.set(a, "Alice v2")
        expect(s.get(userFamily)).toStrictEqual([b, c, a])

        // Re-setting in the middle again pushes that one to the end too.
        s.set(b, "Bob v2")
        expect(s.get(userFamily)).toStrictEqual([c, a, b])
    })

    test("del then set behaves like a fresh insert (atom lands at end)", () => {
        const s = store()
        const userFamily = atomFamily<string, [number]>()
        const a = userFamily(1)
        const b = userFamily(2)
        const c = userFamily(3)

        s.set(a, "Alice")
        s.set(b, "Bob")
        s.set(c, "Charlie")

        s.del(a)
        expect(s.get(userFamily)).toStrictEqual([b, c])

        s.set(a, "Alice again")
        expect(s.get(userFamily)).toStrictEqual([b, c, a])
    })

    test("re-set inside a transaction moves the atom to the end at commit", () => {
        const s = store()
        const userFamily = atomFamily<string, [number]>()
        const a = userFamily(1)
        const b = userFamily(2)
        const c = userFamily(3)

        s.set(a, "Alice")
        s.set(b, "Bob")
        s.set(c, "Charlie")

        s.txn(({ set }) => {
            set(a, "Alice v2")
        })
        expect(s.get(userFamily)).toStrictEqual([b, c, a])
    })

    test("re-set inside a transaction is visible to a same-txn read", () => {
        // Pins the lazy-render path in `valueFromTxnOrData`: when set marks
        // the family dirty and a subsequent get within the same txn must
        // re-render and see the new order.
        const s = store()
        const userFamily = atomFamily<string, [number]>()
        const a = userFamily(1)
        const b = userFamily(2)
        const c = userFamily(3)

        s.set(a, "Alice")
        s.set(b, "Bob")
        s.set(c, "Charlie")

        let midTxnOrder: any[] = []
        s.txn(txn => {
            txn.set(a, "Alice v2")
            midTxnOrder = txn.get(userFamily) as any[]
        })
        expect(midTxnOrder).toStrictEqual([b, c, a])
        expect(s.get(userFamily)).toStrictEqual([b, c, a])
    })

    test("mixed set/del inside a transaction renders correctly on read and commit", () => {
        const s = store()
        const userFamily = atomFamily<string, [number]>()
        const a = userFamily(1)
        const b = userFamily(2)
        const c = userFamily(3)

        s.set(a, "Alice")
        s.set(b, "Bob")
        s.set(c, "Charlie")

        let midTxnOrder: any[] = []
        s.txn(txn => {
            txn.del(a)
            txn.set(c, "Charlie v2")
            midTxnOrder = txn.get(userFamily) as any[]
        })
        expect(midTxnOrder).toStrictEqual([b, c])
        expect(s.get(userFamily)).toStrictEqual([b, c])
    })

    test("scoped store sees parent re-set ordering reflected in its rendered view", () => {
        const root = store()
        const child = root.scope("child")
        const userFamily = atomFamily<string, [number]>()
        const a = userFamily(1)
        const b = userFamily(2)
        const c = userFamily(3)

        root.set(a, "Alice")
        root.set(b, "Bob")
        root.set(c, "Charlie")
        expect(child.get(userFamily)).toStrictEqual([a, b, c])

        // Re-set in root — the child's view (a sorted merge of parent +
        // local) must reflect the new order too.
        root.set(a, "Alice v2")
        expect(root.get(userFamily)).toStrictEqual([b, c, a])
        expect(child.get(userFamily)).toStrictEqual([b, c, a])
    })

    test("scoped txn read sees parent-modified family ordering", () => {
        // Pins the scope branch of the lazy render: parent txn writes
        // mark the family dirty in BOTH the parent and the child txn
        // (via recursivelyMarkFamilyDirty), and a mid-txn read from
        // the scoped txn must observe the live order.
        const root = store("root")
        root.scope("child")
        const userFamily = atomFamily<string, [number]>()
        const a = userFamily(1)
        const b = userFamily(2)

        let childMidTxn: any[] = []
        root.txn(rootTxn => {
            rootTxn.set(a, "Alice")
            rootTxn.set(b, "Bob")
            rootTxn.scope("child", childTxn => {
                childMidTxn = childTxn.get(userFamily) as any[]
            })
        })
        expect(childMidTxn).toStrictEqual([a, b])
        expect(root.scope("child").get(userFamily)).toStrictEqual([a, b])
    })

    test("txn flushes deferred render at commit so post-commit subscribers see changes", () => {
        // Pins the commit-time flushDirtyFamilies path: without flushing
        // the stale rendered array would equal-compare to data.values
        // and skip propagation, leaving subscribers silent.
        const s = store()
        const userFamily = atomFamily<string, [number]>()
        const a = userFamily(1)

        const cb = mock(() => {})
        s.sub(userFamily, cb)

        s.txn(({ set }) => {
            set(a, "Alice")
        })
        // family subscriber fires for each affected familyArg
        expect(cb).toHaveBeenCalledTimes(1)
    })

    test("delete in nested store handled correctly", () => {
        const rootStore = store()
        const nestedStore = rootStore.scope("nested")
        const nestedNestedStore = nestedStore.scope("nested-nested")
        const userFamily = atomFamily()
        const user1atom = userFamily(1)

        // 1. set in root store
        rootStore.set(user1atom, "5 root")
        expect(rootStore.get(userFamily)).toStrictEqual([user1atom])
        expect(nestedStore.get(userFamily)).toStrictEqual([user1atom])

        // 2. del in root store
        rootStore.del(user1atom)
        expect(rootStore.get(userFamily)).toStrictEqual([])
        expect(nestedStore.get(userFamily)).toStrictEqual([])

        // 3. set in root store again
        rootStore.set(user1atom, "5 root again")
        expect(rootStore.get(userFamily)).toStrictEqual([user1atom])
        // expect(nestedStore.get(userFamily)).toStrictEqual([user1atom])

        // 4. set in nested store then delete in root store
        nestedStore.set(user1atom, "5 nested")
        rootStore.del(user1atom)
        expect(rootStore.get(userFamily)).toStrictEqual([])
        expect(nestedStore.get(userFamily)).toStrictEqual([user1atom])
        expect(nestedNestedStore.get(userFamily)).toStrictEqual([user1atom])
    })

    describe("root-level delete cleans up the index for GC", () => {
        test("store.del removes the atom from index.created (no tombstone leak)", () => {
            // Pre-fix: deleted atoms stayed in BOTH `index.created` and
            // `index.deleted` (tombstone). At root that's pure leak —
            // `index.created` already holds a strong ref via the Map key
            // and there's no parent chain to shadow against.
            const s = store()
            const userFamily = atomFamily<{ id: number }, [number]>()
            const a = userFamily(1)
            s.set(a, { id: 1 })

            const index = s.data.values.get(userFamily).__index
            expect(index.created.has(a)).toBe(true)

            s.del(a)
            // After root-level delete the atom should be gone from
            // `index.created` entirely (not just shadowed by `deleted`),
            // so nothing pins it on the family side.
            expect(index.created.has(a)).toBe(false)
            // And the rendered view is empty.
            expect(s.get(userFamily)).toEqual([])
        })

        test("scope-level delete keeps the tombstone (it shadows the parent)", () => {
            // The tombstone is load-bearing in a scope — it's the only
            // way to filter out an atom the parent still has. Don't
            // optimize it away here.
            const root = store("root")
            const child = root.scope("child")
            const userFamily = atomFamily<{ id: number }, [number]>()
            const a = userFamily(1)
            root.set(a, { id: 1 })

            // Materialize the child's index so we can inspect it
            child.get(userFamily)
            child.del(a)
            expect(child.get(userFamily)).toEqual([])
            expect(root.get(userFamily)).toEqual([a])

            // Scope's deleted set still has the tombstone to shadow root.
            const childIndex = child.data.values.get(userFamily).__index
            expect(childIndex.deleted.has(a)).toBe(true)
        })
    })

    test("all family atom subscribers are notified even if one throws", () => {
        const store1 = store()
        const userFamily = atomFamily<string, [string]>(undefined)
        const notifiedKeys: string[] = []

        store1.sub(userFamily, key => {
            if (key === "b") throw new Error("family subscriber error")
            notifiedKeys.push(key)
        })

        try {
            store1.txn(({ set }) => {
                set(userFamily("a"), "Alice")
                set(userFamily("b"), "Bob")
                set(userFamily("c"), "Charlie")
            })
        } catch {
            // expected rethrow
        }

        expect(notifiedKeys).toStrictEqual(["a", "c"])
    })
})
