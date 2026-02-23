import { test, expect, mock } from "bun:test"
import { store } from "../store"
import { atomFamily } from "../atomFamily"
import { selectorFamily } from "../selectorFamily"
import { index } from "../indexConstructor"
import { selector } from "../selector"

test("deleting atom family member from root propagates into scope with cloned family", () => {
    const rootStore = store()
    const family = atomFamily<{ name: string }>(undefined, {
        name: "testFamily",
    })
    const atom1 = family("a")
    const atom2 = family("b")

    rootStore.set(atom1, { name: "A" })
    rootStore.set(atom2, { name: "B" })

    const countSelector = selector(get => get(family).length, {
        name: "countSelector",
    })

    // Create a scope and set a family member in it (clones family into scope)
    const scopedStore = rootStore.scope("test-scope")
    scopedStore.set(family("c"), { name: "C" })

    expect(rootStore.get(countSelector)).toBe(2)
    expect(scopedStore.get(countSelector)).toBe(3)

    // Subscribe to the count selector on the scoped store
    const scopeCallback = mock(() => {})
    scopedStore.sub(countSelector, scopeCallback)

    // Delete atom2 from root store
    rootStore.del(atom2)

    // The scope callback should fire because the family changed in root,
    // and the scope's family index inherits from root's
    expect(scopeCallback).toHaveBeenCalledTimes(1)
    expect(rootStore.get(countSelector)).toBe(1)
    expect(scopedStore.get(countSelector)).toBe(2)
})

test("propagateUpdatedAtoms", () => {
    const rootStore = store()
    const userFamily = atomFamily<
        {
            name: string
            country: string
            age: number
        },
        [number]
    >(undefined, { name: "userFamily" })

    const userSettingsFamily = atomFamily(id => ({
        id,
        enabled: true,
        sessionDuration: 3600,
    }))

    const user1 = userFamily(1)
    const user2 = userFamily(2)
    const user3 = userFamily(3)

    // const

    const userNameSelector = selectorFamily(
        mock((id: number) => get => get(userFamily(id)).name),
        { name: "userNameSelector" },
    )
    const userAgeSelector = selectorFamily(
        mock((id: number) => get => get(userFamily(id)).age),
        { name: "userAgeSelector" },
    )
    const userInitialSelector = selectorFamily(
        mock((id: number) => get => get(userNameSelector(id))[0]),
        { name: "userInitialSelector" },
    )

    const userSummarySelector = selectorFamily(
        mock(
            id => get =>
                `${get(userNameSelector(id))} is ${get(userAgeSelector(id))} years old`,
        ),
        { name: "userSummarySelector" },
    )

    const allUserSummariesSelector = selector(get =>
        get(userFamily).map(atom =>
            get(userSummarySelector(...atom.familyArgs)),
        ),
    )

    const usersByCountry = index(
        userFamily,
        mock((doc, term: string) => doc.country === term),
        { name: "usersByCountry" },
    )
    const usersByAge = index(
        userFamily,
        mock((doc, term: number) => doc.age === term),
        { name: "usersByAge" },
    )

    const userUpdatedCallback = mock(() => {})
    const userSettingsUpdatedCallback = mock(() => {})
    const norwegianUserAddedCallback = mock(() => {})
    const age21UserAddedCallback = mock(() => {})
    const usersAgeUpdatedCallback = mock(() => {})
    const user1UpdatedCallback = mock(() => {})

    rootStore.sub(userFamily, userUpdatedCallback)
    rootStore.sub(userSettingsFamily, userSettingsUpdatedCallback)
    rootStore.sub(usersByCountry("Norway"), norwegianUserAddedCallback)
    rootStore.sub(usersByAge(21), age21UserAddedCallback)
    // rootStore.sub(userAgeSelector, usersAgeUpdatedCallback)
    rootStore.sub(user1, user1UpdatedCallback)

    expect(rootStore.get(userSettingsFamily(1))).toStrictEqual({
        id: 1,
        enabled: true,
        sessionDuration: 3600,
    })
    expect(userSettingsUpdatedCallback).toHaveBeenCalledTimes(1)
    // rootStore

    expect(rootStore.get(user1)).toBeInstanceOf(Promise)
    expect(rootStore.get(usersByCountry("Norway"))).toStrictEqual([])
    expect(rootStore.get(allUserSummariesSelector)).toStrictEqual([])

    rootStore.set(user1, { name: "Foo", age: 21, country: "Norway" })

    expect(user1UpdatedCallback).toHaveBeenCalledTimes(1)
    expect(userUpdatedCallback).toHaveBeenCalledTimes(1)
    expect(norwegianUserAddedCallback).toHaveBeenCalledTimes(1)

    expect(age21UserAddedCallback).toHaveBeenCalledTimes(1)
    expect(rootStore.get(usersByAge(21))).toStrictEqual([user1])
    expect(rootStore.get(usersByCountry("Norway"))).toStrictEqual([user1])
    expect(usersByAge.callback).toHaveBeenCalledTimes(1)
    expect(usersByCountry.callback).toHaveBeenCalledTimes(1)
    rootStore.set(user2, { name: "Bar", age: 42, country: "USA" })
    expect(rootStore.get(allUserSummariesSelector)).toStrictEqual([
        "Foo is 21 years old",
        "Bar is 42 years old",
    ])

    expect(rootStore.get(usersByCountry("Norway"))).toStrictEqual([user1])
})
