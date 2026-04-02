import { describe, test } from "bun:test"
import { createStore as jotaiCreateStore, atom as jotaiAtom } from "jotai"
import { atom as valdresAtom } from "../../src/atom"
import { selector as valdresSelector } from "../../src/selector"
import { store as valdresCreateStore } from "../../src/store"
import { assertFaster } from "./bench-utils"

describe("selector", () => {
    test("set + read with 10 subscribers", async () => {
        const count = 10

        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const vSelectors = Array.from({ length: count }, (_, i) =>
            valdresSelector(get => get(vAtom) + i),
        )
        vSelectors.forEach(s => vStore.get(s))

        const jStore = jotaiCreateStore()
        const jAtom = jotaiAtom(0)
        const jSelectors = Array.from({ length: count }, (_, i) =>
            jotaiAtom(get => get(jAtom) + i),
        )
        jSelectors.forEach(s => jStore.get(s))

        let vInt = 0
        let jInt = 0
        await assertFaster(
            "set + read 10 selectors",
            () => {
                vStore.set(vAtom, ++vInt)
                vSelectors.forEach(s => vStore.get(s))
            },
            () => {
                jStore.set(jAtom, ++jInt)
                jSelectors.forEach(s => jStore.get(s))
            },
            2.0,
        )
    })

    test("set + read with 100 subscribers", async () => {
        const count = 100

        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const vSelectors = Array.from({ length: count }, (_, i) =>
            valdresSelector(get => get(vAtom) + i),
        )
        vSelectors.forEach(s => vStore.get(s))

        const jStore = jotaiCreateStore()
        const jAtom = jotaiAtom(0)
        const jSelectors = Array.from({ length: count }, (_, i) =>
            jotaiAtom(get => get(jAtom) + i),
        )
        jSelectors.forEach(s => jStore.get(s))

        let vInt = 0
        let jInt = 0
        await assertFaster(
            "set + read 100 selectors",
            () => {
                vStore.set(vAtom, ++vInt)
                vSelectors.forEach(s => vStore.get(s))
            },
            () => {
                jStore.set(jAtom, ++jInt)
                jSelectors.forEach(s => jStore.get(s))
            },
            2.0,
        )
    })

    test("chained selectors (depth 5)", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()

        const vBase = valdresAtom(0)
        let vPrev: any = vBase
        for (let i = 0; i < 5; i++) {
            const dep = vPrev
            vPrev = valdresSelector(get => get(dep) + 1)
        }
        const vFinal = vPrev
        vStore.get(vFinal)

        const jBase = jotaiAtom(0)
        let jPrev: any = jBase
        for (let i = 0; i < 5; i++) {
            const dep = jPrev
            jPrev = jotaiAtom(get => get(dep) + 1)
        }
        const jFinal = jPrev
        jStore.get(jFinal)

        let vInt = 0
        let jInt = 0
        await assertFaster(
            "set + read through 5 chained selectors",
            () => {
                vStore.set(vBase, ++vInt)
                vStore.get(vFinal)
            },
            () => {
                jStore.set(jBase, ++jInt)
                jStore.get(jFinal)
            },
            2.0,
        )
    })
})
