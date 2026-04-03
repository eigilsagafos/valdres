import { describe, test } from "bun:test"
import { atom as jotaiAtom } from "jotai"
import { atomFamily as jotaiAtomFamily } from "jotai/utils"
import { atom as valdresAtom } from "../../src/atom"
import { atomFamily as valdresAtomFamily } from "../../src/atomFamily"
import { selectorFamily as valdresSelectorFamily } from "../../src/selectorFamily"
import { assertFaster } from "./bench-utils"

let sink: any

describe("atomFamily", () => {
    test("create atoms from family", async () => {
        const vFamily = valdresAtomFamily<string, [number]>(
            id => `user-${id}`,
        )
        const jFamily = jotaiAtomFamily((id: number) => jotaiAtom(`user-${id}`))

        let vCounter = 0
        let jCounter = 0
        await assertFaster(
            "atomFamily(id)",
            () => { sink = vFamily(++vCounter) },
            () => { sink = jFamily(++jCounter) },
            10.0,
        )
    })
})

describe("atomFamily cache hit", () => {
    test("atomFamily cache hit", async () => {
        const vFamily = valdresAtomFamily<string, [number]>(
            id => `user-${id}`,
        )
        const jFamily = jotaiAtomFamily((id: number) => jotaiAtom(`user-${id}`))

        // Prime the cache
        vFamily(1)
        jFamily(1)

        await assertFaster(
            "atomFamily(id) cache hit",
            () => { sink = vFamily(1) },
            () => { sink = jFamily(1) },
            5.0,
        )
    })
})

describe("selectorFamily", () => {
    test("create selectors from family", async () => {
        const vAtom = valdresAtom(0)
        const jAtom = jotaiAtom(0)

        const vFamily = valdresSelectorFamily<number, [number]>(
            (id) => (get) => get(vAtom) + id,
        )
        const jFamily = jotaiAtomFamily((id: number) =>
            jotaiAtom(get => get(jAtom) + id),
        )

        let vCounter = 0
        let jCounter = 0
        await assertFaster(
            "selectorFamily(id)",
            () => { sink = vFamily(++vCounter) },
            () => { sink = jFamily(++jCounter) },
            10.0,
        )
    })
})
