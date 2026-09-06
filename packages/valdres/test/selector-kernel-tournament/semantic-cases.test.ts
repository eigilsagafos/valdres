import { isolatedTournamentFile } from "./self-test-context.mjs"

if (isolatedTournamentFile()) {
    const { expect, test } = await import("bun:test")
    const { runSemanticCases, requireCircularCause } = await import(
        "./semantic-cases.mjs"
    )
    const { manifest } = await import(
        "../../../../scripts/selector-kernel-tournament/inputs.mjs"
    )

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

    test("renamed ordinary errors cannot impersonate the artifact's exported cycle class", () => {
        class CycleError extends Error {
            name = "SelectorCircularDependencyError"
        }
        const real = new CycleError("cycle")
        expect(requireCircularCause(real, CycleError)).toBe(real)
        const fake = Object.assign(new Error("cycle"), {
            name: real.name,
            selector: "p",
            path: ["p", "p"],
        })
        expect(() => requireCircularCause(fake, CycleError)).toThrow(
            "exported SelectorCircularDependencyError identity",
        )
    })
}
