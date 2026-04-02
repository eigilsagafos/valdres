import { describe, test } from "bun:test"
import { atom as jotaiAtom } from "jotai"
import { atomFamily as jotaiAtomFamily } from "jotai/utils"
import { atomFamily as valdresAtomFamily } from "../../src/atomFamily"
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
        // TODO: atomFamily creation is slow — optimization target
        await assertFaster(
            "atomFamily(id)",
            () => { sink = vFamily(++vCounter) },
            () => { sink = jFamily(++jCounter) },
            10.0,
        )
    })
})
