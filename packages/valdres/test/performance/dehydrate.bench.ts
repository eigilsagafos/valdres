import { do_not_optimize } from "mitata"
import { atomFamily } from "../../src/atomFamily"
import { store } from "../../src/store"
import { dehydrate } from "../../src/utils/dehydrate"
import { measureOne } from "./bench-utils"
import { describe, test } from "./test-compat"

describe("dehydrate", () => {
    test("one store member among 100,000 global family identities", async () => {
        const memberCount = 100_000
        const family = atomFamily<number, [number]>(0, {
            name: "bench-dehydrate-sparse-family",
        })
        const members = Array.from({ length: memberCount }, (_, id) =>
            family(id),
        )
        const sparseStore = store()
        sparseStore.set(members[0], 1)

        await measureOne(
            "dehydrate: 1 of 100,000 global family identities",
            () => {
                // Retain every unrelated identity for the full measurement so
                // the benchmark cannot improve merely because GC weakened the
                // family's process-global identity cache.
                do_not_optimize(members[memberCount - 1])
                do_not_optimize(dehydrate(sparseStore))
            },
        )
    })
})
