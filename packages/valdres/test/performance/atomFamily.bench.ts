import { describe, test } from "./test-compat"
import { atom as jotaiAtom } from "jotai"
import { atomFamily as jotaiAtomFamily } from "jotai/utils"
import { atom as valdresAtom } from "../../src/atom"
import { atomFamily as valdresAtomFamily } from "../../src/atomFamily"
import { selectorFamily as valdresSelectorFamily } from "../../src/selectorFamily"
import { compare } from "./bench-utils"
import { do_not_optimize } from "mitata"

describe("atomFamily", () => {
    test("create atoms from family", async () => {
        const vFamily = valdresAtomFamily<string, [number]>(
            id => `user-${id}`,
        )
        const jFamily = jotaiAtomFamily((id: number) => jotaiAtom(`user-${id}`))

        let vCounter = 0
        let jCounter = 0
        await compare(
            "atomFamily(id)",
            () => do_not_optimize(vFamily(++vCounter)),
            () => do_not_optimize(jFamily(++jCounter)),
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

        // valdres's atomFamily cache hit is ~2x slower than jotai's on quiet
        // hardware (a known optimization target). It sits near the timer-
        // resolution floor (~16ns), so its absolute latency is noisy; Bencher's
        // t-test widens the band accordingly — tracked, not tightly gated.
        await compare(
            "atomFamily(id) cache hit",
            () => do_not_optimize(vFamily(1)),
            () => do_not_optimize(jFamily(1)),
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
        await compare(
            "selectorFamily(id)",
            () => do_not_optimize(vFamily(++vCounter)),
            () => do_not_optimize(jFamily(++jCounter)),
        )
    })
})
