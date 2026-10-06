// Transaction.resetAll(): the full seeded runtime-versus-model differential
// (harness in reset-all-model-differential.harness.ts). 2,000 "mixed" seeds:
// fewer let a planted removal of the first-event mirroring invalidation (B4)
// survive. 1,000 "sparse" seeds target explicit resets of never-owning scopes.
// 1,000 more read every scope after every step.
import { describe, expect, test } from "bun:test"
import { sweep } from "./reset-all-model-differential.harness"

describe("resetAll matches the ReferenceModel: full sweep", () => {
    test("2,000 mixed, 1,000 sparse and 1,000 read-everything seeds", () => {
        expect(
            sweep([
                ["mixed", 2000, false],
                ["sparse", 1000, false],
                ["mixed", 500, true],
                ["sparse", 500, true],
            ]),
        ).toBeGreaterThan(80_000)
    }, 30_000)
})
