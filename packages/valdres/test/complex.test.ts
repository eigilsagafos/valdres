import { describe, test, expect } from "bun:test"
import { atom } from "../src/atom"
import { atomFamily } from "../src/atomFamily"
import { selector } from "../src/selector"
import { store } from "../src/store"
import { selectorFamily } from "../src/selectorFamily"
// import { createStore, atom } from "jotai"
// import { atomFamily } from "jotai/utils"
// import { wait } from "./utils/wait"
import * as jotai from "jotai"
import * as jotaiUtils from "jotai/utils"

// selector()

describe("when a transaction removes something that a subscriber has access to", () => {
    test("valdres", async () => {
        const userIds = atom([1, 2, 3, 4])
        const userFamily = atomFamily(id => ({
            id,
            visible: true,
            email: `${id}@foo.com`,
        }))
        const user = selectorFamily(id => get => {
            const user = get(userFamily(id))
            if (user.visible) return user
        })
        const userEmailSelector = selectorFamily(id => get => {
            const res = get(user(id))
            return get(user(id)).id
        })
        const visibleUserIds = selector(get =>
            get(userIds).filter(id => get(user(id)).visible),
        )
        const store1 = store()

        store1.sub(userEmailSelector(1), emailChanged => {})
        store1.sub(userEmailSelector(2), emailChanged => {})
        store1.sub(userEmailSelector(3), emailChanged => {})
        store1.sub(userEmailSelector(4), emailChanged => {})

        store1.set(userFamily(4), curr => ({ ...curr, visible: false }))
        expect(() => store1.get(userEmailSelector(4))).toThrow()
    })
    test("jotai", async () => {
        const userIds = jotai.atom([1, 2, 3, 4])
        const userFamily = jotaiUtils.atomFamily(id =>
            jotai.atom({
                id,
                visible: true,
                email: `${id}@foo.com`,
            }),
        )
        const user = jotaiUtils.atomFamily(id => {
            return jotai.atom(get => {
                const user = get(userFamily(id))
                if (user.visible) return user
            })
        })
        const userEmailSelector = jotaiUtils.atomFamily(id => {
            return jotai.atom(get => {
                const res = get(user(id))

                if (!res) {
                    throw new Error("asdfasdf")
                }
                return get(user(id)).id
            })
        })
        const visibleUserIds = jotai.atom(get =>
            get(userIds).filter(id => get(user(id)).visible),
        )
        const store = jotai.createStore()

        store.sub(userEmailSelector(1), emailChanged => {
            console.log(`asdf`, emailChanged)
        })
        store.sub(userEmailSelector(2), emailChanged => {
            console.log(`asdf`, emailChanged)
        })
        store.sub(userEmailSelector(3), emailChanged => {
            console.log(`3 email changed`, emailChanged)
        })
        store.sub(userEmailSelector(4), emailChanged => {
            // console.log(`4 email changed`, emailChanged)
        })

        store.set(userFamily(4), curr => ({ ...curr, visible: false }))
        expect(() => store.get(userEmailSelector(4))).toThrow()
    })
})
