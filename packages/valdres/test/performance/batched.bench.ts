import { do_not_optimize } from "mitata"
import { atom } from "../../src/atom"
import { store } from "../../src/store"
import { measureOne } from "./bench-utils"
import { describe, test } from "./test-compat"

describe("batched reads", () => {
    test("committed root atom", async () => {
        const root = store({ batchUpdates: true })
        const value = atom(1)
        root.get(value)

        await measureOne("batchUpdates: 100 committed root atom reads", () => {
            let observed = 0
            for (let index = 0; index < 100; index++) {
                observed += root.get(value)
            }
            do_not_optimize(observed)
        })
    })

    test("pending ancestor atom from a scope", async () => {
        const root = store({ batchUpdates: true })
        const child = root.scope("child")
        const value = atom(0)
        let nextValue = 0

        await measureOne(
            "batchUpdates: pending ancestor + 100 scoped reads",
            () => {
                root.set(value, ++nextValue)
                let observed = 0
                for (let index = 0; index < 100; index++) {
                    observed += child.get(value)
                }
                do_not_optimize(observed)
            },
        )
    })
})
