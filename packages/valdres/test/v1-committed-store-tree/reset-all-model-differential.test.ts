// Transaction.resetAll(): the V1M-RESETALL-008 owner. A quick deterministic
// subset of the seeded runtime-versus-model differential (harness in
// reset-all-model-differential.harness.ts); the contract checker executes
// owner files under a short timeout. The full sweep runs in
// reset-all-model-differential-sweep.test.ts.
import { describe, expect, test } from "bun:test"
import { sweep } from "./reset-all-model-differential.harness"

describe("resetAll matches the ReferenceModel", () => {
    test("V1M-RESETALL-008 seeded runtime differential across nested scopes, staged writes, repeated clears and rollback", () => {
        expect(
            sweep([
                ["mixed", 100, false],
                ["sparse", 100, false],
                ["mixed", 25, true],
                ["sparse", 25, true],
            ]),
        ).toBeGreaterThan(4_000)
    })
})
