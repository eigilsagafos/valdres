import { describe, test } from "bun:test"
import { createStore as jotaiCreateStore, atom as jotaiAtom } from "jotai"
import { atom as valdresAtom } from "../../src/atom"
import { store as valdresCreateStore } from "../../src/store"
import { measureOne } from "./bench-utils"

let sink: any

describe("baseline: plain object vs state management", () => {
    test("get: object vs valdres vs jotai", async () => {
        const obj = { value: "hello" }
        const map = new Map([["key", "hello"]])

        const vStore = valdresCreateStore()
        const vAtom = valdresAtom("hello")
        vStore.get(vAtom)

        const jStore = jotaiCreateStore()
        const jAtom = jotaiAtom("hello")
        jStore.get(jAtom)

        await measureOne("obj.value", () => { sink = obj.value })
        await measureOne("map.get(key)", () => { sink = map.get("key") })
        await measureOne("valdres get", () => { sink = vStore.get(vAtom) })
        await measureOne("jotai get", () => { sink = jStore.get(jAtom) })
    })

    test("set: object vs valdres vs jotai", async () => {
        const obj = { value: 0 }
        const map = new Map([["key", 0]])

        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)

        const jStore = jotaiCreateStore()
        const jAtom = jotaiAtom(0)

        let i = 0
        await measureOne("obj.value = n", () => { obj.value = ++i })
        i = 0
        await measureOne("map.set(key, n)", () => { map.set("key", ++i) })
        i = 0
        await measureOne("valdres set", () => { vStore.set(vAtom, ++i) })
        i = 0
        await measureOne("jotai set", () => { jStore.set(jAtom, ++i) })
    })
})
