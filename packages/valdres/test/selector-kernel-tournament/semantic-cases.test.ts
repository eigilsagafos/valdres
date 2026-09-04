import { expect, test } from "bun:test"
import { runSemanticCases } from "./semantic-cases.mjs"
import { manifest } from "../../../../scripts/selector-kernel-tournament/inputs.mjs"

test("semantic admission rejects unknown fixtures without driving a runtime", async () => {
    await expect(
        runSemanticCases({ api: {}, manifest, only: ["A-ASYNC-001"] }),
    ).rejects.toThrow("unknown semantic ID")
})
test("a red mutation cannot be silently skipped or applied to an unrelated fixture", async () => {
    await expect(
        runSemanticCases({
            api: {},
            manifest,
            only: ["C-TXN-001"],
            mutation: "unknown",
        }),
    ).rejects.toThrow("MUTATION-ID")
    await expect(
        runSemanticCases({
            api: {},
            manifest,
            only: ["C-TXN-001"],
            mutation: "wrong-causal-blame",
        }),
    ).rejects.toThrow("MUTATION-ID")
    await expect(
        runSemanticCases({
            api: {},
            manifest,
            only: ["A-GRAPH-001"],
            mutation: "wrong-causal-blame",
        }),
    ).rejects.toThrow("MUTATION-MODE")
})
